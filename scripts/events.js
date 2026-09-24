const { InteractionContextType, MessageFlags, SlashCommandBuilder } = require('discord.js');
const { fetchPublicEvents, buildEventCardEmbed } = require('../lib/svsit-events');
const { weekDates, weekLabel, localDate } = require('../lib/week');

const MESSAGES = {
  unavailable: 'svsit.nl did not respond. Try again in a minute.',
};

// Discord caps a single message at 10 embeds and 6000 characters across all of them.
const MAX_EMBEDS = 10;
const MAX_EMBED_CHARS = 6000;
const WEEK_OFFSETS = { this: 0, next: 1 };
const WEEK_LABELS = { this: 'this week', next: 'next week' };
const NEXT_ARG = 'next';

/**
 * Keeps the leading embeds that fit in one Discord message: at most
 * MAX_EMBEDS and MAX_EMBED_CHARS in total, so a long week never makes the
 * whole reply fail.
 */
function fitEmbeds(embeds) {
  const kept = [];
  let total = 0;
  for (const embed of embeds) {
    if (kept.length === MAX_EMBEDS || total + embed.length > MAX_EMBED_CHARS) break;
    total += embed.length;
    kept.push(embed);
  }
  return kept;
}

/**
 * Builds the reply payload for the weekly overview: the list of events for
 * `weekKey` (`'this'` or `'next'`), or `{ error }` when svsit.nl is
 * unreachable. Shared by the slash and the prefix path.
 */
async function eventsReply(weekKey, now = new Date()) {
  const result = await fetchPublicEvents();
  if (!result.ok) return { error: MESSAGES.unavailable };

  const dates = weekDates(now, { weeks: WEEK_OFFSETS[weekKey] });
  const events = result.events
    .filter((event) => dates.includes(localDate(event.date)))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const label = WEEK_LABELS[weekKey];
  if (events.length === 0) return { content: `No events ${label}.` };

  const embeds = fitEmbeds(events.map((event) => buildEventCardEmbed(event, { now })));
  const note = embeds.length < events.length ? ` Showing the first ${embeds.length} of ${events.length}.` : '';
  return { content: `Events ${label}: ${weekLabel(dates)}${note}`, embeds };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('events')
    .setDescription('Shows the svsit.nl events of this week.')
    .setContexts(
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel
    )
    .addStringOption((option) =>
      option
        .setName('week')
        .setDescription('Which week to show.')
        .addChoices({ name: 'This week', value: 'this' }, { name: 'Next week', value: 'next' })
    ),

  async execute(interaction) {
    const weekKey = interaction.options.getString('week') ?? 'this';

    // The list fetch can take longer than Discord's 3 second reply window.
    await interaction.deferReply();
    const reply = await eventsReply(weekKey);

    if (reply.error) {
      // The public deferred reply cannot become ephemeral, so clear it and
      // send the error where only the invoker sees it.
      await interaction.deleteReply().catch(() => {});
      await interaction.followUp({ content: reply.error, flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.editReply(reply);
  },

  prefix: 'events',

  async runPrefix(message, args) {
    // `%events [next]`, case-insensitive, anything else is ignored.
    const weekKey = args.some((arg) => arg.toLowerCase() === NEXT_ARG) ? 'next' : 'this';
    const reply = await eventsReply(weekKey);

    await message.reply({
      ...(reply.error ? { content: reply.error } : reply),
      allowedMentions: { repliedUser: false },
    });
  },
};
