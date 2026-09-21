// Translates text through the endpoint the Google Translate web page uses.
// It is unofficial and keyless: Google may throttle or close it, so every
// failure here is soft and the caller falls back to the original text.
const ENDPOINT = 'https://translate.googleapis.com/translate_a/single';
const LANGUAGES = new Set(['nl', 'en']);
const TIMEOUT_MS = 5_000;

const CACHE_MAX = 200;
const cache = new Map();

/**
 * Returns `{ ok: true, text, detected }` or `{ ok: false }`. Never throws.
 */
async function translate(text, targetLang, { fetch = globalThis.fetch, timeoutMs = TIMEOUT_MS } = {}) {
  if (typeof text !== 'string' || text.trim() === '' || !LANGUAGES.has(targetLang)) return { ok: false };

  const url = new URL(ENDPOINT);
  url.search = new URLSearchParams({ client: 'gtx', sl: 'auto', tl: targetLang, dt: 't', q: text });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`translation took longer than ${timeoutMs} ms`)), timeoutMs);

  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) throw new Error(`translate endpoint answered ${response.status}`);

    const body = await response.json();
    // body[0] holds segments of [translated, original, ...]; body[2] the detected source.
    const segments = Array.isArray(body) && Array.isArray(body[0]) ? body[0] : null;
    const translated = segments ? segments.map((segment) => segment?.[0] ?? '').join('') : '';
    if (translated === '') throw new Error('translate endpoint answered without text');

    return { ok: true, text: translated, detected: typeof body[2] === 'string' ? body[2] : null };
  } catch (error) {
    console.error(`Translating to ${targetLang} failed:`, error);
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Same as translate(), but remembers successful results per key so repeated
 * lookups of the same event do not hit Google again.
 */
async function cachedTranslate(key, text, targetLang, options) {
  if (cache.has(key)) return cache.get(key);

  const result = await translate(text, targetLang, options);
  if (!result.ok) return result;

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, result);
  return result;
}

module.exports = { translate, cachedTranslate, LANGUAGES, CACHE_MAX };
