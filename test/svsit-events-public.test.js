const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { fetchPublicEvents, buildEventCardEmbed } = require('../lib/svsit-events');

const ID = 'e06acbfd-13d1-4002-9546-7066420762ef';

const okResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

// Shape of one item from GET /api/events/public, checked live on 2026-09-24.
const baseItem = () => ({
  id: ID,
  name: 'Lets SIT editie 1',
  date: '2026-09-30T13:00:00+00:00',
  dateEnd: '2026-09-30T15:00:00+00:00',
  location: 'USC',
  description: 'De eerste editie van Lets SIT.',
  poster: 'https://example.supabase.co/storage/v1/object/public/event-posters/poster.png',
  category: 'Social',
});

describe('fetchPublicEvents', () => {
  test('returns ok with the events on 200', async () => {
    const items = [baseItem()];
    const calls = [];
    const fetch = async (url, init) => {
      calls.push({ url, init });
      return okResponse(items);
    };

    const result = await fetchPublicEvents({ fetch, baseUrl: 'https://svsit.nl' });

    assert.deepEqual(result, { ok: true, events: items });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://svsit.nl/api/events/public');
    assert.ok(calls[0].init.signal instanceof AbortSignal, 'request carries an abort signal');
  });

  test('returns unavailable on a 500 (DB failure returns [] with status 500)', async () => {
    const fetch = async () => okResponse([], 500);
    assert.deepEqual(await fetchPublicEvents({ fetch }), { ok: false, reason: 'unavailable' });
  });

  test('returns unavailable on a network error', async () => {
    const fetch = async () => { throw new TypeError('fetch failed'); };
    assert.deepEqual(await fetchPublicEvents({ fetch }), { ok: false, reason: 'unavailable' });
  });

  test('returns unavailable when the request times out', async () => {
    const fetch = (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason));
      });

    assert.deepEqual(await fetchPublicEvents({ fetch, timeoutMs: 20 }), { ok: false, reason: 'unavailable' });
  });

  test('returns unavailable when the body is not an array', async () => {
    const fetch = async () => okResponse({ data: [] });
    assert.deepEqual(await fetchPublicEvents({ fetch }), { ok: false, reason: 'unavailable' });
  });

  test('returns unavailable when an item is missing a string id or a parseable date', async () => {
    const missingId = async () => okResponse([{ ...baseItem(), id: undefined }]);
    const missingDate = async () => okResponse([{ ...baseItem(), date: undefined }]);
    const numericId = async () => okResponse([{ ...baseItem(), id: 123 }]);
    const numericDate = async () => okResponse([{ ...baseItem(), date: 123 }]);

    const unparseableDate = async () => okResponse([{ ...baseItem(), date: 'not-a-date' }]);

    for (const fetch of [missingId, missingDate, numericId, numericDate, unparseableDate]) {
      assert.deepEqual(await fetchPublicEvents({ fetch }), { ok: false, reason: 'unavailable' });
    }
  });

  test('returns unavailable when the response body is broken JSON', async () => {
    const fetch = async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad'); } });
    assert.deepEqual(await fetchPublicEvents({ fetch }), { ok: false, reason: 'unavailable' });
  });
});

const BEFORE = new Date('2026-09-29T10:00:00Z');
const AFTER = new Date('2026-10-01T10:00:00Z');

const field = (json, name) => json.fields.find((f) => f.name === name);

describe('buildEventCardEmbed', () => {
  test('maps name, url, description, color and the When/Where fields', () => {
    const json = buildEventCardEmbed(baseItem(), { now: BEFORE }).toJSON();
    const start = Math.floor(new Date('2026-09-30T13:00:00+00:00').getTime() / 1000);
    const end = Math.floor(new Date('2026-09-30T15:00:00+00:00').getTime() / 1000);

    assert.equal(json.title, 'Lets SIT editie 1');
    assert.equal(json.url, `https://svsit.nl/events/${ID}`);
    assert.equal(json.description, 'De eerste editie van Lets SIT.');
    assert.equal(json.color, 0xf29e18);
    assert.equal(field(json, 'When').value, `<t:${start}:F> to <t:${end}:t> (<t:${start}:R>)`);
    assert.equal(field(json, 'Where').value, 'USC');
    assert.equal(json.fields.find((f) => f.name === 'Where').inline, true);
  });

  test('sets the image when a poster is present, omits it otherwise', () => {
    const withPoster = buildEventCardEmbed(baseItem(), { now: BEFORE }).toJSON();
    assert.equal(withPoster.image.url, baseItem().poster);

    const withoutPoster = buildEventCardEmbed({ ...baseItem(), poster: undefined }, { now: BEFORE }).toJSON();
    assert.equal(withoutPoster.image, undefined);
  });

  test('falls back to TBA when there is no location', () => {
    const json = buildEventCardEmbed({ ...baseItem(), location: undefined }, { now: BEFORE }).toJSON();
    assert.equal(field(json, 'Where').value, 'TBA');
  });

  test('omits the description when it is missing or empty', () => {
    assert.equal(buildEventCardEmbed({ ...baseItem(), description: undefined }, { now: BEFORE }).toJSON().description, undefined);
    assert.equal(buildEventCardEmbed({ ...baseItem(), description: '   ' }, { now: BEFORE }).toJSON().description, undefined);
  });

  test('never adds Category, Price, Signups or Tickets fields', () => {
    const json = buildEventCardEmbed(baseItem(), { now: BEFORE }).toJSON();
    for (const name of ['Category', 'Price', 'Signups', 'Tickets']) {
      assert.equal(field(json, name), undefined);
    }
  });

  test('notes in the footer when the event has ended', () => {
    assert.equal(buildEventCardEmbed(baseItem(), { now: BEFORE }).toJSON().footer.text, 'svsit.nl');
    assert.equal(buildEventCardEmbed(baseItem(), { now: AFTER }).toJSON().footer.text, 'svsit.nl  This event has ended');
  });

  test('shows a single start time in When without dateEnd', () => {
    const json = buildEventCardEmbed({ ...baseItem(), dateEnd: undefined }, { now: BEFORE }).toJSON();
    const start = Math.floor(new Date('2026-09-30T13:00:00+00:00').getTime() / 1000);

    assert.equal(field(json, 'When').value, `<t:${start}:F> (<t:${start}:R>)`);
  });

  test('without dateEnd the event counts as ended 4 hours after it started', () => {
    const item = { ...baseItem(), dateEnd: undefined };
    const justBefore = new Date('2026-09-30T16:59:00Z');
    const justAfter = new Date('2026-09-30T17:01:00Z');

    assert.equal(buildEventCardEmbed(item, { now: justBefore }).toJSON().footer.text, 'svsit.nl');
    assert.equal(buildEventCardEmbed(item, { now: justAfter }).toJSON().footer.text, 'svsit.nl  This event has ended');
  });

  test('truncates description to 300 and title to 256', () => {
    const item = { ...baseItem(), name: 'N'.repeat(300), description: 'D'.repeat(3000) };
    const json = buildEventCardEmbed(item, { now: BEFORE }).toJSON();

    assert.equal(json.title.length, 256);
    assert.ok(json.title.endsWith('...'));
    assert.equal(json.description.length, 300);
    assert.ok(json.description.endsWith('...'));
  });

  test('falls back to the social colour for unknown or missing categories', () => {
    assert.equal(buildEventCardEmbed({ ...baseItem(), category: 'impact' }, { now: BEFORE }).toJSON().color, 0xf29e18);
    assert.equal(buildEventCardEmbed({ ...baseItem(), category: undefined }, { now: BEFORE }).toJSON().color, 0xf29e18);
  });

  test('picks the color for a known category, case-insensitively', () => {
    assert.equal(buildEventCardEmbed({ ...baseItem(), category: 'Code' }, { now: BEFORE }).toJSON().color, 0x22c55e);
  });
});
