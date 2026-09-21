const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { MessageFlags } = require('discord.js');
const command = require('../scripts/event');

const ID = 'e06acbfd-13d1-4002-9546-7066420762ef';
const LINK = `https://svsit.nl/events/${ID}`;
const EVENT = { id: ID, title: 'Lets SIT', date: '2026-09-30T13:00:00+00:00', category: 'social', status: 'upcoming', is_paid: false };

// Records every reply-style call so the tests can assert on the exact sequence.
function fakeInteraction(url, language = null) {
  const calls = [];
  const record = (name) => async (payload) => { calls.push([name, payload]); };
  const options = { url, language };
  return {
    calls,
    options: { getString: (name) => options[name] ?? null },
    reply: record('reply'),
    deferReply: record('deferReply'),
    deleteReply: record('deleteReply'),
    followUp: record('followUp'),
    editReply: record('editReply'),
  };
}

function fakeMessage() {
  const calls = [];
  return { calls, reply: async (payload) => { calls.push(payload); } };
}

const jsonResponse = (body, status = 200) => ({ ok: status < 300, status, json: async () => body });

// fetchEvent reads globalThis.fetch at call time, so a stub here keeps the
// command tests off the network.
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

describe('/event execute', () => {
  test('rejects a non svsit.nl link ephemerally without deferring (M5)', async () => {
    globalThis.fetch = async () => { throw new Error('must not be called'); };
    const interaction = fakeInteraction('https://example.com/events/' + ID);

    await command.execute(interaction);

    assert.deepEqual(interaction.calls, [[
      'reply',
      { content: 'That is not a svsit.nl event link. Expected https://svsit.nl/events/<id>.', flags: MessageFlags.Ephemeral },
    ]]);
  });

  test('defers, then edits the reply with the event embed (M1)', async () => {
    globalThis.fetch = async (url) => {
      assert.equal(url, `https://svsit.nl/api/events/${ID}`);
      return jsonResponse({ data: EVENT, error: null, meta: null });
    };
    const interaction = fakeInteraction(LINK);

    await command.execute(interaction);

    assert.equal(interaction.calls[0][0], 'deferReply');
    assert.equal(interaction.calls[1][0], 'editReply');
    const [embed] = interaction.calls[1][1].embeds;
    assert.equal(embed.toJSON().title, 'Lets SIT');
    assert.equal(embed.toJSON().url, LINK);
    assert.equal(interaction.calls.length, 2);
  });

  test('clears the public defer and answers ephemerally when the event is missing (M5)', async () => {
    globalThis.fetch = async () => jsonResponse({ data: null, error: 'Event niet gevonden', meta: null }, 404);
    const interaction = fakeInteraction(LINK);

    await command.execute(interaction);

    assert.deepEqual(interaction.calls.map(([name]) => name), ['deferReply', 'deleteReply', 'followUp']);
    assert.deepEqual(interaction.calls[2][1], { content: 'No event found at that link.', flags: MessageFlags.Ephemeral });
  });

  test('reports an unreachable svsit.nl ephemerally (M5)', async () => {
    globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
    const interaction = fakeInteraction(LINK);

    await command.execute(interaction);

    assert.deepEqual(interaction.calls[2][1], { content: 'svsit.nl did not respond. Try again in a minute.', flags: MessageFlags.Ephemeral });
  });
});

describe('%event prefix', () => {
  test('posts the embed as a public reply without pinging the author (M6)', async () => {
    globalThis.fetch = async () => jsonResponse({ data: EVENT, error: null, meta: null });
    const message = fakeMessage();

    await command.runPrefix(message, [`<${LINK}>`]);

    assert.equal(message.calls.length, 1);
    assert.equal(message.calls[0].embeds[0].toJSON().title, 'Lets SIT');
    assert.deepEqual(message.calls[0].allowedMentions, { repliedUser: false });
  });

  test('replies with the error text for a bad or missing link (M6)', async () => {
    globalThis.fetch = async () => jsonResponse({ data: null, error: 'Event niet gevonden', meta: null }, 404);
    const message = fakeMessage();

    await command.runPrefix(message, []);
    await command.runPrefix(message, [LINK]);

    assert.equal(message.calls[0].content, 'That is not a svsit.nl event link. Expected https://svsit.nl/events/<id>.');
    assert.equal(message.calls[1].content, 'No event found at that link.');
  });
});

describe('command registration', () => {
  test('exposes /event with a required url option and the event prefix', () => {
    const json = command.data.toJSON();
    assert.equal(json.name, 'event');
    assert.deepEqual(json.options.map((o) => [o.name, o.required]), [['url', true], ['language', false]]);
    assert.equal(command.prefix, 'event');
  });
});

describe('/event language option', () => {
  const gtx = (text) => jsonResponse([[[text, 'orig', null, null]], null, 'nl']);
  const DUTCH = { ...EVENT, id: '11111111-2222-4333-8444-555555555555', description: 'Kom ook, het is gratis.' };
  const DUTCH_LINK = `https://svsit.nl/events/${DUTCH.id}`;

  function routedFetch(onTranslate) {
    return async (url) => {
      if (String(url).startsWith('https://translate.googleapis.com/')) return onTranslate(url);
      return jsonResponse({ data: DUTCH, error: null, meta: null });
    };
  }

  test('translates the description and says so in the footer (M8)', async () => {
    let translateUrl;
    globalThis.fetch = routedFetch((url) => { translateUrl = new URL(url); return gtx('Come along, it is free.'); });
    const interaction = fakeInteraction(DUTCH_LINK, 'en');

    await command.execute(interaction);

    const json = interaction.calls[1][1].embeds[0].toJSON();
    assert.equal(json.description, 'Come along, it is free.');
    assert.equal(json.footer.text, 'svsit.nl  Translated with Google Translate');
    assert.equal(translateUrl.searchParams.get('tl'), 'en');
    assert.equal(translateUrl.searchParams.get('q'), 'Kom ook, het is gratis.');
  });

  test('falls back to the original text when translation fails (M8)', async () => {
    // Own event id: the translation cache is per event and the test above filled it.
    const uncached = { ...DUTCH, id: '11111111-2222-4333-8444-777777777777' };
    globalThis.fetch = async (url) => (String(url).startsWith('https://translate.googleapis.com/')
      ? jsonResponse(null, 429)
      : jsonResponse({ data: uncached, error: null, meta: null }));
    const interaction = fakeInteraction(`https://svsit.nl/events/${uncached.id}`, 'en');

    await command.execute(interaction);

    assert.equal(interaction.calls[1][0], 'editReply');
    const json = interaction.calls[1][1].embeds[0].toJSON();
    assert.equal(json.description, 'Kom ook, het is gratis.');
    assert.equal(json.footer.text, 'svsit.nl  Translation unavailable, showing the original text');
  });

  test('does not translate without a language or without a description', async () => {
    let translateCalls = 0;
    globalThis.fetch = routedFetch(() => { translateCalls += 1; return gtx('x'); });

    await command.execute(fakeInteraction(DUTCH_LINK));
    globalThis.fetch = async (url) => (String(url).startsWith('https://translate.googleapis.com/')
      ? (translateCalls += 1, gtx('x'))
      : jsonResponse({ data: { ...DUTCH, id: '11111111-2222-4333-8444-666666666666', description: null }, error: null, meta: null }));
    await command.execute(fakeInteraction('https://svsit.nl/events/11111111-2222-4333-8444-666666666666', 'en'));

    assert.equal(translateCalls, 0);
  });

  test('accepts nl or en as second prefix argument and ignores anything else (M8)', async () => {
    let tl;
    globalThis.fetch = routedFetch((url) => { tl = new URL(url).searchParams.get('tl'); return gtx('Hallo'); });
    const message = fakeMessage();

    await command.runPrefix(message, [DUTCH_LINK, 'NL']);
    assert.equal(tl, 'nl');
    assert.equal(message.calls[0].embeds[0].toJSON().footer.text, 'svsit.nl  Translated with Google Translate');

    tl = undefined;
    await command.runPrefix(message, [DUTCH_LINK, 'fr']);
    assert.equal(tl, undefined);
    assert.equal(message.calls[1].embeds[0].toJSON().footer.text, 'svsit.nl');
  });

  test('registers language as an optional choice between Nederlands and English', () => {
    const option = command.data.toJSON().options.find((o) => o.name === 'language');
    assert.equal(option.required, false);
    assert.deepEqual(option.choices.map((c) => [c.name, c.value]), [['Nederlands', 'nl'], ['English', 'en']]);
  });
});
