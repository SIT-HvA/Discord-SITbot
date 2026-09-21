const { InteractionContextType, MessageFlags, SlashCommandBuilder } = require('discord.js');
const { parseEventUrl, fetchEvent, buildEventEmbed } = require('../lib/svsit-events');
const { cachedTranslate, LANGUAGES } = require('../lib/translate');

const MESSAGES = {
  invalid_url: 'That is not a svsit.nl event link. Expected https://svsit.nl/events/<id>.',
  not_found: 'No event found at that link.',
  unavailable: 'svsit.nl did not respond. Try again in a minute.',
};

const FOOTER_TRANSLATED = 'Translated with Google Translate';
const FOOTER_NOT_TRANSLATED = 'Translation unavailable, showing the original text';

// Translating a text Discord would cut off anyway is wasted characters.
const DESCRIPTION_MAX = 1000;

/**
 * Picks the embed options for a language choice: the translated description
 * and a footer note, or the original text with a note when translation fails.
 */
async function translationOptions(event, language) {
  if (!language || !event.description) return {};

  const original = event.description.trim().slice(0, DESCRIPTION_MAX);
  const result = await cachedTranslate(`${event.id}:${language}`, original, language);

  if (!result.ok) return { footerNote: FOOTER_NOT_TRANSLATED };
  // Already in the requested language: nothing was translated, so say nothing.
  if (result.detected === language) return {};
  return { description: result.text, footerNote: FOOTER_TRANSLATED };
}

/**
 * Turns a pasted link into the reply payload: the event embed, or the error
 * text explaining why not. Shared by the slash and the prefix path.
 */
async function eventReply(link, language) {
  const id = parseEventUrl(link);
  if (!id) return { error: MESSAGES.invalid_url };

  const result = await fetchEvent(id);
  if (!result.ok) return { error: MESSAGES[result.reason] };

  const options = await translationOptions(result.event, language);
  return { embeds: [buildEventEmbed(result.event, options)] };
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
    )
    .addStringOption((option) =>
      option
        .setName('language')
        .setDescription('Translate the description into this language.')
        .addChoices({ name: 'Nederlands', value: 'nl' }, { name: 'English', value: 'en' })
    ),

  async execute(interaction) {
    const link = interaction.options.getString('url', true);
    const language = interaction.options.getString('language') ?? null;

    // Reject a bad link before deferring: an ephemeral error needs the first
    // reply to be ephemeral, and a defer decides that for the whole exchange.
    if (!parseEventUrl(link)) {
      await interaction.reply({ content: MESSAGES.invalid_url, flags: MessageFlags.Ephemeral });
      return;
    }

    // The fetch can take longer than Discord's 3 second reply window.
    await interaction.deferReply();
    const reply = await eventReply(link, language);

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
    // `%event <link> nl` or `%event <link> en`; anything else means no translation.
    const wanted = args[1]?.toLowerCase();
    const language = LANGUAGES.has(wanted) ? wanted : null;

    const reply = await eventReply(args[0], language);
    await message.reply({
      ...(reply.error ? { content: reply.error } : reply),
      allowedMentions: { repliedUser: false },
    });
  },
};
