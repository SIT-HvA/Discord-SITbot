const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { MessageFlags } = require('discord.js');
const command = require('../scripts/event');

const ID = 'e06acbfd-13d1-4002-9546-7066420762ef';
const LINK = `https://svsit.nl/events/${ID}`;
const EVENT = { id: ID, title: 'Lets SIT', date: '2026-09-30T13:00:00+00:00', category: 'social', status: 'upcoming', is_paid: false };

// Records every reply-style call so the tests can assert on the exact sequence.
function fakeInteraction(url) {
  const calls = [];
  const record = (name) => async (payload) => { calls.push([name, payload]); };
  return {
    calls,
    options: { getString: (name) => (name === 'url' ? url : null) },
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
    assert.deepEqual(json.options.map((o) => [o.name, o.required]), [['url', true]]);
    assert.equal(command.prefix, 'event');
  });
});
