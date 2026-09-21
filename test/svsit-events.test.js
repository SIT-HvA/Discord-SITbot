const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { parseEventUrl, eventPageUrl, fetchEvent } = require('../lib/svsit-events');

const ID = 'e06acbfd-13d1-4002-9546-7066420762ef';

describe('parseEventUrl', () => {
  test('returns the uuid from a plain svsit.nl event link', () => {
    assert.equal(parseEventUrl(`https://svsit.nl/events/${ID}`), ID);
  });

  test('accepts the www host, trailing slash, query and hash', () => {
    assert.equal(parseEventUrl(`https://www.svsit.nl/events/${ID}/`), ID);
    assert.equal(parseEventUrl(`https://svsit.nl/events/${ID}?utm_source=discord`), ID);
    assert.equal(parseEventUrl(`https://svsit.nl/events/${ID}#tickets`), ID);
    assert.equal(parseEventUrl(`http://svsit.nl/events/${ID}`), ID);
  });

  test('tolerates surrounding whitespace and Discord angle brackets', () => {
    assert.equal(parseEventUrl(`  <https://svsit.nl/events/${ID}>  `), ID);
  });

  test('rejects other hosts, other paths, bare ids and garbage', () => {
    assert.equal(parseEventUrl(`https://example.com/events/${ID}`), null);
    assert.equal(parseEventUrl(`https://svsit.nl/admin/events/${ID}`), null);
    assert.equal(parseEventUrl(`https://svsit.nl/events/not-a-uuid`), null);
    assert.equal(parseEventUrl(ID), null);
    assert.equal(parseEventUrl('https://svsit.nl/events'), null);
    assert.equal(parseEventUrl(''), null);
    assert.equal(parseEventUrl(undefined), null);
  });
});

describe('eventPageUrl', () => {
  test('builds the public event page link', () => {
    assert.equal(eventPageUrl(ID), `https://svsit.nl/events/${ID}`);
  });
});

describe('fetchEvent', () => {
  const okResponse = (body, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });

  test('returns the event from the data envelope on 200', async () => {
    const calls = [];
    const fetch = async (url, init) => {
      calls.push({ url, init });
      return okResponse({ data: { id: ID, title: 'Lets SIT' }, error: null, meta: null });
    };

    const result = await fetchEvent(ID, { fetch, baseUrl: 'https://svsit.nl' });

    assert.deepEqual(result, { ok: true, event: { id: ID, title: 'Lets SIT' } });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, `https://svsit.nl/api/events/${ID}`);
    assert.ok(calls[0].init.signal instanceof AbortSignal, 'request carries an abort signal');
  });

  test('returns not_found on 404', async () => {
    const fetch = async () => okResponse({ data: null, error: 'Event niet gevonden', meta: null }, 404);
    assert.deepEqual(await fetchEvent(ID, { fetch }), { ok: false, reason: 'not_found' });
  });

  test('returns unavailable on 5xx, network errors and broken JSON', async () => {
    const serverError = async () => okResponse({ data: null, error: 'boom', meta: null }, 500);
    const networkError = async () => { throw new TypeError('fetch failed'); };
    const brokenJson = async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad'); } });
    const emptyData = async () => okResponse({ data: null, error: null, meta: null });

    for (const fetch of [serverError, networkError, brokenJson, emptyData]) {
      assert.deepEqual(await fetchEvent(ID, { fetch }), { ok: false, reason: 'unavailable' });
    }
  });

  test('aborts when the request exceeds the timeout', async () => {
    const fetch = (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason));
      });

    const result = await fetchEvent(ID, { fetch, timeoutMs: 20 });
    assert.deepEqual(result, { ok: false, reason: 'unavailable' });
  });
});
