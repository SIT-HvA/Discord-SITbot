const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} = require('discord.js');

const pong = (isPrivate) => (isPrivate ? 'pong' : 'pong!');

const REVEAL_TIMEOUT_MS = 60_000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with pong!')
    .setContexts(
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel
    )
    .addBooleanOption((option) =>
      option
        .setName('private')
        .setDescription('Reply only to you — nobody else in the channel sees it.')
    ),

  async execute(interaction) {
    // `private` is an option rather than a subcommand: Discord won't let a bare
    // `/ping` be invoked once a command has subcommands, and a bare `/ping` is
    // the point. The client still shows this as `/ping private:True`.
    const isPrivate = interaction.options.getBoolean('private') ?? false;
    const payload = { content: pong(isPrivate) };

    // Ephemeral: renders as "Only you can see this - Dismiss message".
    if (isPrivate) payload.flags = MessageFlags.Ephemeral;

    await interaction.reply(payload);
  },

  prefix: 'ping',

  async runPrefix(message, args) {
    const isPrivate = args[0]?.toLowerCase() === 'private';

    if (!isPrivate) {
      await message.reply(pong(false));
      return;
    }

    // An ephemeral reply needs an interaction token and a plain message has none.
    // A button click, however, IS an interaction — so offer a button and answer
    // the click ephemerally. That is the only way a prefix command reaches the
    // real "Only you can see this - Dismiss message" reply.
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ping:reveal:${message.id}`)
        .setLabel('Show me pong')
        .setStyle(ButtonStyle.Primary)
    );

    const prompt = await message.reply({
      content: `Only ${message.author.username} can use this button.`,
      components: [buttons],
      allowedMentions: { repliedUser: false },
    });

    const collector = prompt.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: REVEAL_TIMEOUT_MS,
    });

    collector.on('collect', async (interaction) => {
      // Answer bystanders privately too, rather than leaving the click to fail.
      if (interaction.user.id !== message.author.id) {
        await interaction
          .reply({
            content: 'That button is not for you — run `%ping private` yourself.',
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});
        return;
      }

      await interaction
        .reply({ content: pong(true), flags: MessageFlags.Ephemeral })
        .catch(() => {});
      collector.stop('revealed');
    });

    // Clear the public prompt whether it was used or timed out, so the channel
    // is left with nothing but the user's own message.
    collector.on('end', () => {
      prompt.delete().catch(() => {});
    });
  },
};
