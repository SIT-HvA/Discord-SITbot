const { InteractionContextType, MessageFlags, SlashCommandBuilder } = require('discord.js');

const pong = (isPrivate) => (isPrivate ? 'pong' : 'pong!');

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

    // Ephemeral replies are interaction-only, so a DM is the closest a prefix
    // command gets to "only viewable by you". The invoking message stays in the
    // channel either way — the user posted that themselves.
    try {
      await message.author.send(pong(true));
    } catch {
      await message.reply(
        "I couldn't DM you. Enable **Direct Messages** from server members, or use `/ping private:True`."
      );
    }
  },
};
