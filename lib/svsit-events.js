// Reads public events from svsit.nl for the /event command. Pure module: no
// Discord client in here, `fetch` is injectable so the tests never hit the network.
const { EmbedBuilder } = require('discord.js');

// Overridable so a local checkout of svsit-site can be used for testing.
const BASE_URL = (process.env.SVSIT_BASE_URL || 'https://svsit.nl').replace(/\/+$/, '');
const PUBLIC_HOSTS = new Set(['svsit.nl', 'www.svsit.nl']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FETCH_TIMEOUT_MS = 8_000;

// Discord embed limits.
const TITLE_MAX = 256;
const DESCRIPTION_MAX = 1000;
const FIELD_MAX = 1024;

// Same palette as svsit.nl (src/lib/constants.ts), social is the site's fallback too.
const CATEGORY_COLORS = {
  social: 0xf29e18,
  code: 0x22c55e,
  career: 0x3b82f6,
  game: 0xef4444,
};

// Events without an end_date count as 4 hours long, same rule as the site.
const DEFAULT_DURATION_MS = 4 * 60 * 60 * 1000;

/**
 * Pulls the event id out of a svsit.nl event link. Returns null for anything
 * that is not `https://(www.)svsit.nl/events/<uuid>`.
 */
function parseEventUrl(input) {
  if (typeof input !== 'string') return null;

  // Discord users often paste `<url>` to suppress the link preview.
  const trimmed = input.trim().replace(/^<|>$/g, '');
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (!['http:', 'https:'].includes(url.protocol)) return null;
  if (!PUBLIC_HOSTS.has(url.hostname.toLowerCase())) return null;

  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length !== 2 || segments[0] !== 'events') return null;

  return UUID.test(segments[1]) ? segments[1].toLowerCase() : null;
}

function eventPageUrl(id) {
  return `${BASE_URL}/events/${id}`;
}

/**
 * Fetches one event from the public API. Never throws: the caller gets
 * `{ ok: true, event }` or `{ ok: false, reason }` where reason is `not_found`
 * (404) or `unavailable` (network error, timeout, 5xx, malformed body).
 */
async function fetchEvent(id, { fetch = globalThis.fetch, baseUrl = BASE_URL, timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  const url = `${baseUrl.replace(/\/+$/, '')}/api/events/${id}`;

  // Own controller instead of AbortSignal.timeout(): that one uses an unref'd
  // timer, so a hung request could never abort once nothing else keeps the
  // event loop alive.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`svsit.nl took longer than ${timeoutMs} ms`)), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (response.status === 404) return { ok: false, reason: 'not_found' };
    if (!response.ok) throw new Error(`svsit.nl answered ${response.status}`);

    const body = await response.json();
    if (!body || typeof body !== 'object' || !body.data || typeof body.data !== 'object') {
      throw new Error('svsit.nl answered without event data');
    }

    return { ok: true, event: body.data };
  } catch (error) {
    console.error(`Fetching event ${id} from svsit.nl failed:`, error);
    return { ok: false, reason: 'unavailable' };
  } finally {
    clearTimeout(timer);
  }
}

const truncate = (text, max) => (text.length > max ? `${text.slice(0, max - 3).trimEnd()}...` : text);

const toUnix = (iso) => Math.floor(new Date(iso).getTime() / 1000);

const euros = (cents) => `EUR ${(cents / 100).toFixed(2).replace('.', ',')}`;

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

function hasEnded(event, now) {
  const end = event.end_date
    ? new Date(event.end_date).getTime()
    : new Date(event.date).getTime() + DEFAULT_DURATION_MS;
  return end < now.getTime();
}

function whenField(event) {
  const start = toUnix(event.date);
  const range = event.end_date ? `<t:${start}:F> to <t:${toUnix(event.end_date)}:t>` : `<t:${start}:F>`;
  return `${range} (<t:${start}:R>)`;
}

function priceField(event) {
  if (!event.is_paid) return 'Free';
  return `Members ${euros(event.price_members ?? 0)} / non-members ${euros(event.price_nonmembers ?? 0)}`;
}

function signupsField(event) {
  const count = event.ticketCount ?? 0;
  return event.capacity ? `${count} / ${event.capacity}` : String(count);
}

/**
 * Builds the Discord embed for one event as returned by the public API.
 */
function buildEventEmbed(event, { now = new Date() } = {}) {
  const category = String(event.category || 'social').toLowerCase();
  const title = event.status === 'cancelled' ? `[Cancelled] ${event.title}` : event.title;

  const embed = new EmbedBuilder()
    .setTitle(truncate(title, TITLE_MAX))
    .setURL(eventPageUrl(event.id))
    .setColor(CATEGORY_COLORS[category] ?? CATEGORY_COLORS.social)
    .addFields(
      { name: 'When', value: whenField(event) },
      { name: 'Where', value: truncate(event.location || 'TBA', FIELD_MAX), inline: true },
      { name: 'Category', value: capitalize(category), inline: true },
      { name: 'Price', value: priceField(event), inline: true }
    )
    .setFooter({ text: hasEnded(event, now) ? 'svsit.nl  This event has ended' : 'svsit.nl' });

  if (event.description) embed.setDescription(truncate(event.description.trim(), DESCRIPTION_MAX));
  if (event.signup_required !== false) embed.addFields({ name: 'Signups', value: signupsField(event), inline: true });
  if (event.external_ticket_url) embed.addFields({ name: 'Tickets', value: truncate(event.external_ticket_url, FIELD_MAX) });
  if (event.poster_url) embed.setImage(event.poster_url);

  return embed;
}

module.exports = { parseEventUrl, eventPageUrl, fetchEvent, buildEventEmbed };
