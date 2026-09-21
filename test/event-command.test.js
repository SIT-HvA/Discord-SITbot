const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { MessageFlags, PermissionFlagsBits, PermissionsBitField } = require('discord.js');
const command = require('../scripts/event');

const ID = 'e06acbfd-13d1-4002-9546-7066420762ef';
const LINK = `https://svsit.nl/events/${ID}`;
const EVENT = { id: ID, title: 'Lets SIT', date: '2026-09-30T13:00:00+00:00', category: 'social', status: 'upcoming', is_paid: false };

// Records every reply-style call so the tests can assert on the exact sequence.
function fakeInteraction(url, language = null, extras = {}) {
  const calls = [];
  const record = (name) => async (payload) => { calls.push([name, payload]); };
  const options = { url, language, announce: extras.announce ?? null };
  return {
    calls,
    memberPermissions: extras.memberPermissions ?? null,
    appPermissions: extras.appPermissions ?? null,
    options: {
      getString: (name) => options[name] ?? null,
      getBoolean: (name) => options[name] ?? null,
    },
    reply: record('reply'),
    deferReply: record('deferReply'),
    deleteReply: record('deleteReply'),
    followUp: record('followUp'),
    editReply: record('editReply'),
  };
}

function fakeMessage(extras = {}) {
  const calls = [];
  const me = { id: 'bot' };
  return {
    calls,
    reply: async (payload) => { calls.push(payload); },
    guild: extras.inGuild === false ? null : { members: { me } },
    member: extras.inGuild === false ? null : {
      permissionsIn: () => extras.memberPermissions ?? new PermissionsBitField(),
    },
    channel: { permissionsFor: () => extras.appPermissions ?? new PermissionsBitField() },
  };
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
    assert.deepEqual(json.options.map((o) => [o.name, o.required]), [['url', true], ['language', false], ['announce', false]]);
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
    // Own event id so the translation cache from the tests above cannot answer.
    const own = { ...DUTCH, id: '11111111-2222-4333-8444-999999999999' };
    const ownLink = `https://svsit.nl/events/${own.id}`;
    let tl;
    globalThis.fetch = async (url) => (String(url).startsWith('https://translate.googleapis.com/')
      ? (tl = new URL(url).searchParams.get('tl'), gtx('Hello'))
      : jsonResponse({ data: own, error: null, meta: null }));
    const message = fakeMessage();

    await command.runPrefix(message, [ownLink, 'EN']);
    assert.equal(tl, 'en');
    assert.equal(message.calls[0].embeds[0].toJSON().footer.text, 'svsit.nl  Translated with Google Translate');

    tl = undefined;
    await command.runPrefix(message, [ownLink, 'fr']);
    assert.equal(tl, undefined);
    assert.equal(message.calls[1].embeds[0].toJSON().footer.text, 'svsit.nl');
  });

  test('shows the original text without a note when it already is in the chosen language (M8)', async () => {
    const same = { ...DUTCH, id: '11111111-2222-4333-8444-888888888888' };
    globalThis.fetch = async (url) => (String(url).startsWith('https://translate.googleapis.com/')
      ? jsonResponse([[['Kom ook, het is gratis.', 'Kom ook, het is gratis.', null, null]], null, 'nl'])
      : jsonResponse({ data: same, error: null, meta: null }));
    const interaction = fakeInteraction(`https://svsit.nl/events/${same.id}`, 'nl');

    await command.execute(interaction);

    const json = interaction.calls[1][1].embeds[0].toJSON();
    assert.equal(json.description, 'Kom ook, het is gratis.');
    assert.equal(json.footer.text, 'svsit.nl');
  });

  test('registers language as an optional choice between Nederlands and English', () => {
    const option = command.data.toJSON().options.find((o) => o.name === 'language');
    assert.equal(option.required, false);
    assert.deepEqual(option.choices.map((c) => [c.name, c.value]), [['Nederlands', 'nl'], ['English', 'en']]);
  });
});

describe('/event announce option (M9)', () => {
  const everyone = new PermissionsBitField(PermissionFlagsBits.MentionEveryone);
  const nothing = new PermissionsBitField();
  const eventFetch = async () => jsonResponse({ data: EVENT, error: null, meta: null });

  test('prepends @everyone and allows the mention when the invoker and the bot may mention everyone', async () => {
    globalThis.fetch = eventFetch;
    const interaction = fakeInteraction(LINK, null, { announce: true, memberPermissions: everyone, appPermissions: everyone });

    await command.execute(interaction);

    assert.deepEqual(interaction.calls.map(([name]) => name), ['deferReply', 'editReply']);
    const payload = interaction.calls[1][1];
    assert.equal(payload.content, '@everyone');
    assert.deepEqual(payload.allowedMentions, { parse: ['everyone'] });
    assert.equal(payload.embeds[0].toJSON().title, 'Lets SIT');
  });

  test('leaves the payload untouched without announce', async () => {
    globalThis.fetch = eventFetch;
    const interaction = fakeInteraction(LINK, null, { announce: false, memberPermissions: nothing, appPermissions: nothing });

    await command.execute(interaction);

    const payload = interaction.calls[1][1];
    assert.equal(payload.content, undefined);
    assert.equal(payload.allowedMentions, undefined);
  });

  test('refuses ephemerally before deferring when the invoker lacks Mention Everyone', async () => {
    globalThis.fetch = async () => { throw new Error('must not be called'); };
    const interaction = fakeInteraction(LINK, null, { announce: true, memberPermissions: nothing, appPermissions: everyone });

    await command.execute(interaction);

    assert.deepEqual(interaction.calls, [[
      'reply',
      { content: 'You need the Mention Everyone permission to announce an event.', flags: MessageFlags.Ephemeral },
    ]]);
  });

  test('refuses ephemerally outside a server', async () => {
    globalThis.fetch = async () => { throw new Error('must not be called'); };
    const interaction = fakeInteraction(LINK, null, { announce: true });

    await command.execute(interaction);

    assert.deepEqual(interaction.calls, [[
      'reply',
      { content: 'Announcing only works in a server channel.', flags: MessageFlags.Ephemeral },
    ]]);
  });

  test('tells the invoker when the bot itself may not mention everyone here', async () => {
    globalThis.fetch = async () => { throw new Error('must not be called'); };
    const interaction = fakeInteraction(LINK, null, { announce: true, memberPermissions: everyone, appPermissions: nothing });

    await command.execute(interaction);

    assert.deepEqual(interaction.calls, [[
      'reply',
      { content: 'I need the Mention Everyone permission in this channel to announce.', flags: MessageFlags.Ephemeral },
    ]]);
  });

  test('prefix: announce argument in any position pings everyone when allowed', async () => {
    globalThis.fetch = eventFetch;
    const message = fakeMessage({ memberPermissions: everyone, appPermissions: everyone });

    await command.runPrefix(message, [LINK, 'ANNOUNCE']);
    await command.runPrefix(message, [LINK, 'announce', 'en']);

    for (const payload of message.calls) {
      assert.equal(payload.content, '@everyone');
      assert.deepEqual(payload.allowedMentions, { parse: ['everyone'], repliedUser: false });
      assert.equal(payload.embeds[0].toJSON().title, 'Lets SIT');
    }
  });

  test('prefix: refuses as a normal reply when the invoker lacks Mention Everyone', async () => {
    globalThis.fetch = async () => { throw new Error('must not be called'); };
    const message = fakeMessage({ memberPermissions: nothing, appPermissions: everyone });

    await command.runPrefix(message, [LINK, 'announce']);

    assert.equal(message.calls.length, 1);
    assert.equal(message.calls[0].content, 'You need the Mention Everyone permission to announce an event.');
    assert.equal(message.calls[0].embeds, undefined);
  });

  test('prefix: refuses in a DM', async () => {
    globalThis.fetch = async () => { throw new Error('must not be called'); };
    const message = fakeMessage({ inGuild: false });

    await command.runPrefix(message, [LINK, 'announce']);

    assert.equal(message.calls[0].content, 'Announcing only works in a server channel.');
  });

  test('registers announce as an optional boolean option', () => {
    const option = command.data.toJSON().options.find((o) => o.name === 'announce');
    assert.equal(option.required, false);
    assert.equal(option.type, 5);
  });
});
