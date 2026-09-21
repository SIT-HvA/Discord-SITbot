const { InteractionContextType, MessageFlags, SlashCommandBuilder } = require('discord.js');
const { parseEventUrl, fetchEvent, buildEventEmbed } = require('../lib/svsit-events');

const MESSAGES = {
  invalid_url: 'That is not a svsit.nl event link. Expected https://svsit.nl/events/<id>.',
  not_found: 'No event found at that link.',
  unavailable: 'svsit.nl did not respond. Try again in a minute.',
};

/**
 * Turns a pasted link into the reply payload: the event embed, or the error
 * text explaining why not. Shared by the slash and the prefix path.
 */
async function eventReply(link) {
  const id = parseEventUrl(link);
  if (!id) return { error: MESSAGES.invalid_url };

  const result = await fetchEvent(id);
  if (!result.ok) return { error: MESSAGES[result.reason] };

  return { embeds: [buildEventEmbed(result.event)] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('event')
    .setDescription('Shows an event from svsit.nl as an embed.')
    .setContexts(
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel
    )
    .addStringOption((option) =>
      option
        .setName('url')
        .setDescription('Link to the event, like https://svsit.nl/events/<id>')
        .setRequired(true)
    ),

  async execute(interaction) {
    const link = interaction.options.getString('url', true);

    // Reject a bad link before deferring: an ephemeral error needs the first
    // reply to be ephemeral, and a defer decides that for the whole exchange.
    if (!parseEventUrl(link)) {
      await interaction.reply({ content: MESSAGES.invalid_url, flags: MessageFlags.Ephemeral });
      return;
    }

    // The fetch can take longer than Discord's 3 second reply window.
    await interaction.deferReply();
    const reply = await eventReply(link);

    if (reply.error) {
      // The public deferred reply cannot become ephemeral, so clear it and
      // send the error where only the invoker sees it.
      await interaction.deleteReply().catch(() => {});
      await interaction.followUp({ content: reply.error, flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.editReply(reply);
  },

  prefix: 'event',

  async runPrefix(message, args) {
    const reply = await eventReply(args[0]);
    await message.reply({
      ...(reply.error ? { content: reply.error } : reply),
      allowedMentions: { repliedUser: false },
    });
  },
};
