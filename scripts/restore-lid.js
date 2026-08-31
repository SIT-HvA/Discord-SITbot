const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require('discord.js');

const { listBackups, readBackup } = require('../lib/lid-backups');

const CONFIRM_TIMEOUT_MS = 30_000;
const PROGRESS_EVERY = 25;

function describe(backup) {
  const when = new Date(backup.executedAt).toISOString().replace('T', ' ').slice(0, 19);
  const count = backup.members.length;

  return `${when} UTC - ${count} member${count === 1 ? '' : 's'} (by ${backup.executedBy.tag})`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('restore-lid')
    .setDescription('Puts the "lid" role back on everyone a /clear-lid run removed it from.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option
        .setName('backup')
        .setDescription('Which /clear-lid run to reverse. Defaults to the most recent.')
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const backups = await listBackups(interaction.guildId).catch(() => []);
    const typed = interaction.options.getFocused().toLowerCase();

    const choices = backups
      .map((backup) => ({ name: describe(backup).slice(0, 100), value: backup.id }))
      .filter((choice) => choice.name.toLowerCase().includes(typed));

    await interaction.respond(choices.slice(0, 25));
  },

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const { guild } = interaction;
    const requested = interaction.options.getString('backup');

    let backup;
    if (requested) {
      backup = await readBackup(guild.id, requested).catch(() => null);
      if (!backup) {
        await interaction.editReply(`No backup \`${requested}\` exists for this server.`);
        return;
      }
    } else {
      [backup] = await listBackups(guild.id, 1);
      if (!backup) {
        await interaction.editReply('There are no /clear-lid backups for this server yet.');
        return;
      }
    }

    const role = await guild.roles.fetch(backup.roleId).catch(() => null);
    if (!role) {
      await interaction.editReply(
        `The role this backup refers to (\`${backup.roleId}\`) no longer exists in this server.`
      );
      return;
    }

    const me = guild.members.me ?? (await guild.members.fetchMe());

    if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.editReply('I need the **Manage Roles** permission to do that.');
      return;
    }

    if (me.roles.highest.comparePositionTo(role) <= 0) {
      await interaction.editReply(
        `My highest role sits below ${role} in the role list, so I can't assign it. ` +
          'Move my role above it and try again.'
      );
      return;
    }

    const members = await guild.members.fetch();

    const targets = [];
    let departed = 0;
    let alreadyHas = 0;

    for (const entry of backup.members) {
      const member = members.get(entry.id);

      if (!member) departed += 1;
      else if (member.roles.cache.has(role.id)) alreadyHas += 1;
      else targets.push(member);
    }

    const skipped = [
      departed > 0 ? `${departed} no longer in the server` : null,
      alreadyHas > 0 ? `${alreadyHas} already have it` : null,
    ].filter(Boolean);

    if (targets.length === 0) {
      await interaction.editReply(
        `Nothing to restore from \`${backup.id}\`` +
          (skipped.length > 0 ? ` — ${skipped.join(', ')}.` : '.')
      );
      return;
    }

    const confirmId = `restore-lid:confirm:${interaction.id}`;
    const cancelId = `restore-lid:cancel:${interaction.id}`;

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(confirmId)
        .setLabel(`Yes, restore ${targets.length}`)
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(cancelId).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    );

    const prompt = await interaction.editReply({
      content:
        `**Are you sure?**\nRestoring backup \`${backup.id}\` (${describe(backup)}) ` +
        `gives ${role} back to **${targets.length}** member${targets.length === 1 ? '' : 's'}.` +
        (skipped.length > 0 ? `\nSkipping ${skipped.join(' and ')}.` : ''),
      components: [buttons],
    });

    let confirmation;
    try {
      confirmation = await prompt.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === interaction.user.id,
        time: CONFIRM_TIMEOUT_MS,
      });
    } catch {
      await interaction.editReply({
        content: 'Timed out waiting for a confirmation. No roles were restored.',
        components: [],
      });
      return;
    }

    if (confirmation.customId === cancelId) {
      await confirmation.update({ content: 'Cancelled. No roles were restored.', components: [] });
      return;
    }

    await confirmation.update({
      content: `Restoring ${role} to ${targets.length} member${targets.length === 1 ? '' : 's'}...`,
      components: [],
    });

    const reason =
      `/restore-lid of backup ${backup.id} run by ${interaction.user.tag} (${interaction.user.id})`;
    const failures = [];
    let restored = 0;

    for (const member of targets) {
      try {
        await member.roles.add(role, reason);
        restored += 1;
      } catch (error) {
        failures.push({ tag: member.user.tag, error: error.message });
      }

      const done = restored + failures.length;
      if (done % PROGRESS_EVERY === 0 && done < targets.length) {
        await interaction
          .editReply(`Restoring ${role}... ${done}/${targets.length} processed.`)
          .catch(() => {});
      }
    }

    let summary = `Done. Restored ${role} to **${restored}** of ${targets.length} member${
      targets.length === 1 ? '' : 's'
    }.`;

    if (skipped.length > 0) summary += `\nSkipped ${skipped.join(' and ')}.`;

    if (failures.length > 0) {
      const lines = failures.slice(0, 10).map((f) => `${f.tag}: ${f.error}`);
      summary += `\n\n**Failed (${failures.length}):**\n${lines.join('\n')}`;
      if (failures.length > 10) summary += `\n...and ${failures.length - 10} more.`;
      console.error(`/restore-lid failures in ${guild.name}:`, failures);
    }

    await interaction.editReply({ content: summary.slice(0, 2000), components: [] });
  },
};
