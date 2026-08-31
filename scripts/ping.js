const { InteractionContextType, MessageFlags, SlashCommandBuilder } = require('discord.js');

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
    const payload = { content: isPrivate ? 'pong' : 'pong!' };

    // Ephemeral: renders as "Only you can see this - Dismiss message".
    if (isPrivate) payload.flags = MessageFlags.Ephemeral;

    await interaction.reply(payload);
  },
};
