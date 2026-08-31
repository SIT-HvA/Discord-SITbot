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

const { createBackup, finalizeBackup } = require('../lib/lid-backups');

const LID_ROLE_ID = process.env.LID_ROLE_ID || '1279109484739952811';
const CONFIRM_TIMEOUT_MS = 30_000;
const PROGRESS_EVERY = 25;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear-lid')
    .setDescription('Removes the "lid" role from every member who has it.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    // Fetching every member can take a while, so buy time up front.
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const { guild } = interaction;
    const role = await guild.roles.fetch(LID_ROLE_ID).catch(() => null);

    if (!role) {
      await interaction.editReply(`No role with ID \`${LID_ROLE_ID}\` exists in this server.`);
      return;
    }

    const me = guild.members.me ?? (await guild.members.fetchMe());

    if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.editReply('I need the **Manage Roles** permission to do that.');
      return;
    }

    if (me.roles.highest.comparePositionTo(role) <= 0) {
      await interaction.editReply(
        `My highest role sits below ${role} in the role list, so I can't remove it. ` +
          'Move my role above it and try again.'
      );
      return;
    }

    const members = await guild.members.fetch();
    const targets = members.filter((member) => member.roles.cache.has(role.id));

    if (targets.size === 0) {
      await interaction.editReply(`Nobody currently has ${role}. Nothing to do.`);
      return;
    }

    const confirmId = `clear-lid:confirm:${interaction.id}`;
    const cancelId = `clear-lid:cancel:${interaction.id}`;

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(confirmId)
        .setLabel(`Yes, remove from ${targets.size}`)
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(cancelId).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    );

    const prompt = await interaction.editReply({
      content:
        `**Are you sure?**\nThis removes ${role} from **${targets.size}** member` +
        `${targets.size === 1 ? '' : 's'}. This cannot be undone.`,
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
        content: 'Timed out waiting for a confirmation. No roles were removed.',
        components: [],
      });
      return;
    }

    if (confirmation.customId === cancelId) {
      await confirmation.update({ content: 'Cancelled. No roles were removed.', components: [] });
      return;
    }

    await confirmation.update({
      content: `Removing ${role} from ${targets.size} member${targets.size === 1 ? '' : 's'}...`,
      components: [],
    });

    // Record who held the role before touching anything, so the run stays
    // reversible even if it crashes partway through.
    let backup;
    try {
      backup = await createBackup({
        guildId: guild.id,
        roleId: role.id,
        roleName: role.name,
        executedBy: { id: interaction.user.id, tag: interaction.user.tag },
        members: targets.map((member) => ({ id: member.id, tag: member.user.tag })),
      });
    } catch (error) {
      console.error('/clear-lid could not write a backup:', error);
      await interaction.editReply({
        content:
          `Aborted: could not write the backup that makes this reversible.\n\`${error.message}\`\n` +
          'No roles were removed.',
        components: [],
      });
      return;
    }

    const reason = `/clear-lid run by ${interaction.user.tag} (${interaction.user.id})`;
    const failures = [];
    const removed = [];

    for (const member of targets.values()) {
      try {
        await member.roles.remove(role, reason);
        removed.push(member.id);
      } catch (error) {
        failures.push({ id: member.id, tag: member.user.tag, error: error.message });
      }

      const done = removed.length + failures.length;
      if (done % PROGRESS_EVERY === 0 && done < targets.size) {
        await interaction
          .editReply(`Removing ${role}... ${done}/${targets.size} processed.`)
          .catch(() => {});
      }
    }

    await finalizeBackup(backup, { removed, failed: failures }).catch((error) => {
      console.error('/clear-lid could not finalize the backup:', error);
    });

    let summary = `Done. Removed ${role} from **${removed.length}** of ${targets.size} member${
      targets.size === 1 ? '' : 's'
    }.`;

    if (failures.length > 0) {
      const lines = failures.slice(0, 10).map((f) => `${f.tag}: ${f.error}`);
      summary += `\n\n**Failed (${failures.length}):**\n${lines.join('\n')}`;
      if (failures.length > 10) summary += `\n...and ${failures.length - 10} more.`;
      console.error(`/clear-lid failures in ${guild.name}:`, failures);
    }

    summary += `\n\nBacked up as \`${backup.id}\` — reverse with \`/restore-lid\`.`;

    await interaction.editReply({ content: summary.slice(0, 2000), components: [] });
  },
};
