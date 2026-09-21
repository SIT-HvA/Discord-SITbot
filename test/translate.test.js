const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { translate, cachedTranslate, CACHE_MAX } = require('../lib/translate');

// Shape of the gtx endpoint's answer: segments of [translated, original, ...],
// detected source language at index 2.
const gtxBody = (segments, detected = 'nl') => [segments.map((s) => [s[0], s[1], null, null]), null, detected];
const jsonResponse = (body, status = 200) => ({ ok: status < 300, status, json: async () => body });

describe('translate', () => {
  test('calls the gtx endpoint with the target language and joins the segments', async () => {
    const calls = [];
    const fetch = async (url, init) => {
      calls.push({ url: new URL(url), init });
      return jsonResponse(gtxBody([['Hello ', 'Hallo '], ['world.', 'wereld.']]));
    };

    const result = await translate('Hallo wereld.', 'en', { fetch });

    assert.deepEqual(result, { ok: true, text: 'Hello world.', detected: 'nl' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url.origin + calls[0].url.pathname, 'https://translate.googleapis.com/translate_a/single');
    assert.equal(calls[0].url.searchParams.get('client'), 'gtx');
    assert.equal(calls[0].url.searchParams.get('sl'), 'auto');
    assert.equal(calls[0].url.searchParams.get('tl'), 'en');
    assert.equal(calls[0].url.searchParams.get('dt'), 't');
    assert.equal(calls[0].url.searchParams.get('q'), 'Hallo wereld.');
    assert.ok(calls[0].init.signal instanceof AbortSignal);
  });

  test('fails softly on http errors, network errors, broken bodies and timeouts', async () => {
    const cases = [
      async () => jsonResponse(null, 429),
      async () => jsonResponse(null, 500),
      async () => { throw new TypeError('fetch failed'); },
      async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad'); } }),
      async () => jsonResponse({ unexpected: true }),
      async () => jsonResponse([[], null, 'nl']),
      (_url, { signal }) => new Promise((_r, reject) => signal.addEventListener('abort', () => reject(signal.reason))),
    ];

    for (const fetch of cases) {
      assert.deepEqual(await translate('Hallo', 'en', { fetch, timeoutMs: 20 }), { ok: false });
    }
  });

  test('rejects empty text and unsupported languages without fetching', async () => {
    const fetch = async () => { throw new Error('must not be called'); };
    assert.deepEqual(await translate('', 'en', { fetch }), { ok: false });
    assert.deepEqual(await translate('Hallo', 'xx', { fetch }), { ok: false });
  });
});

describe('cachedTranslate', () => {
  test('fetches once per key and serves the cached result afterwards', async () => {
    let calls = 0;
    const fetch = async () => { calls += 1; return jsonResponse(gtxBody([['Hello', 'Hallo']])); };

    const first = await cachedTranslate('event-1:en', 'Hallo', 'en', { fetch });
    const second = await cachedTranslate('event-1:en', 'Hallo', 'en', { fetch });

    assert.deepEqual(first, { ok: true, text: 'Hello', detected: 'nl' });
    assert.deepEqual(second, first);
    assert.equal(calls, 1);
  });

  test('does not cache failures', async () => {
    let calls = 0;
    const fetch = async () => { calls += 1; return jsonResponse(null, 500); };

    await cachedTranslate('event-2:en', 'Hallo', 'en', { fetch });
    await cachedTranslate('event-2:en', 'Hallo', 'en', { fetch });

    assert.equal(calls, 2);
  });

  test('drops the oldest entry once the cache is full', async () => {
    let calls = 0;
    const fetch = async () => { calls += 1; return jsonResponse(gtxBody([['x', 'y']])); };

    await cachedTranslate('first:en', 'y', 'en', { fetch });
    for (let i = 0; i < CACHE_MAX; i += 1) {
      await cachedTranslate(`fill-${i}:en`, 'y', 'en', { fetch });
    }
    const before = calls;
    await cachedTranslate('first:en', 'y', 'en', { fetch });

    assert.equal(calls, before + 1, 'the first key was evicted and fetched again');
  });
});
