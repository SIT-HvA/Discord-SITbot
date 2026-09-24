const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { MessageFlags } = require('discord.js');
const { weekDates } = require('../lib/week');
const command = require('../scripts/events');

// Records every reply-style call so the tests can assert on the exact sequence.
function fakeInteraction(week = null, view = null) {
  const calls = [];
  const record = (name) => async (payload) => { calls.push([name, payload]); };
  return {
    calls,
    options: { getString: (name) => (name === 'week' ? week : name === 'view' ? view : null) },
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

// fetchPublicEvents reads globalThis.fetch at call time, so a stub here keeps
// the command tests off the network.
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

// Anchor test event dates to the real current week/next week, since the
// command itself always uses `new Date()`.
const thisWeekDates = weekDates(new Date());
const nextWeekDates = weekDates(new Date(), { weeks: 1 });

let idCounter = 0;
const nextId = () => `e06acbfd-13d1-4002-9546-${String(idCounter++).padStart(12, '0')}`;

const item = (date, name, extra = {}) => ({
  id: nextId(),
  name,
  date,
  location: 'USC',
  category: 'Social',
  ...extra,
});

describe('/events execute (this week)', () => {
  test('defers, then edits the reply with this week\'s events sorted by date (M10)', async () => {
    const outOfWeek = item('2000-01-01T13:00:00+00:00', 'Old event');
    const first = item(`${thisWeekDates[0]}T09:00:00+00:00`, 'Monday event');
    const second = item(`${thisWeekDates[4]}T09:00:00+00:00`, 'Friday event');
    const third = item(`${thisWeekDates[2]}T09:00:00+00:00`, 'Wednesday event');
    const nextWeekEvent = item(`${nextWeekDates[1]}T13:00:00+00:00`, 'Next week event');

    globalThis.fetch = async () => jsonResponse([outOfWeek, second, nextWeekEvent, first, third]);
    const interaction = fakeInteraction();

    await command.execute(interaction);

    assert.equal(interaction.calls[0][0], 'deferReply');
    assert.equal(interaction.calls[1][0], 'editReply');
    const reply = interaction.calls[1][1];
    assert.ok(reply.content.startsWith('Events this week: '));
    assert.deepEqual(
      reply.embeds.map((embed) => embed.toJSON().title),
      ['Monday event', 'Wednesday event', 'Friday event']
    );
    assert.equal(interaction.calls.length, 2);
    assert.equal(reply.files, undefined);
  });

  test('says there are no events this week when the week is empty', async () => {
    globalThis.fetch = async () => jsonResponse([]);
    const interaction = fakeInteraction();

    await command.execute(interaction);

    assert.deepEqual(interaction.calls[1], ['editReply', { content: 'No events this week.' }]);
  });

  test('shows only the first 10 embeds and notes the total past 10 events', async () => {
    const events = Array.from({ length: 12 }, (_, i) => item(`${thisWeekDates[i % 7]}T0${i % 9}:00:00+00:00`, `Event ${i}`));
    globalThis.fetch = async () => jsonResponse(events);
    const interaction = fakeInteraction();

    await command.execute(interaction);

    const reply = interaction.calls[1][1];
    assert.equal(reply.embeds.length, 10);
    assert.ok(reply.content.endsWith(' Showing the first 10 of 12.'));
  });

  test('stops before the 6000 character total embed limit and notes the total', async () => {
    // Worst-case cards: title 256, description 300 and location 1024 each.
    const bulky = Array.from({ length: 8 }, (_, i) => ({
      ...item(`${thisWeekDates[1]}T${String(10 + i).padStart(2, '0')}:00:00+00:00`, 'N'.repeat(256)),
      description: 'D'.repeat(300),
      location: 'L'.repeat(1024),
    }));
    globalThis.fetch = async () => jsonResponse(bulky);
    const interaction = fakeInteraction();

    await command.execute(interaction);

    const reply = interaction.calls[1][1];
    const total = reply.embeds.reduce((sum, embed) => sum + embed.length, 0);
    assert.ok(total <= 6000, `total embed length ${total} exceeds 6000`);
    assert.ok(reply.embeds.length >= 3 && reply.embeds.length < 8, `kept ${reply.embeds.length} embeds`);
    assert.ok(reply.content.endsWith(` Showing the first ${reply.embeds.length} of 8.`), reply.content);
  });

  test('reports an unreachable svsit.nl ephemerally on a fetch failure', async () => {
    globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
    const interaction = fakeInteraction();

    await command.execute(interaction);

    assert.deepEqual(interaction.calls.map(([name]) => name), ['deferReply', 'deleteReply', 'followUp']);
    assert.deepEqual(interaction.calls[2][1], {
      content: 'svsit.nl did not respond. Try again in a minute.',
      flags: MessageFlags.Ephemeral,
    });
  });
});

describe('/events execute (next week)', () => {
  test('week: next shows next week\'s events', async () => {
    const thisWeekEvent = item(`${thisWeekDates[2]}T09:00:00+00:00`, 'This week event');
    const nextEvent = item(`${nextWeekDates[1]}T09:00:00+00:00`, 'Next week event');
    globalThis.fetch = async () => jsonResponse([thisWeekEvent, nextEvent]);
    const interaction = fakeInteraction('next');

    await command.execute(interaction);

    const reply = interaction.calls[1][1];
    assert.ok(reply.content.startsWith('Events next week: '));
    assert.deepEqual(reply.embeds.map((embed) => embed.toJSON().title), ['Next week event']);
  });

  test('week: next says there are no events next week when empty', async () => {
    globalThis.fetch = async () => jsonResponse([]);
    const interaction = fakeInteraction('next');

    await command.execute(interaction);

    assert.deepEqual(interaction.calls[1], ['editReply', { content: 'No events next week.' }]);
  });
});

describe('/events execute (compact view)', () => {
  test('view: compact replies with one compact embed per event, in date order, with thumbnails set (M11)', async () => {
    const poster = 'https://example.com/poster.png';
    const first = item(`${thisWeekDates[0]}T09:00:00+00:00`, 'Monday event', { poster });
    const second = item(`${thisWeekDates[4]}T09:00:00+00:00`, 'Friday event', { poster });
    globalThis.fetch = async () => jsonResponse([second, first]);
    const interaction = fakeInteraction(null, 'compact');

    await command.execute(interaction);

    assert.equal(interaction.calls[0][0], 'deferReply');
    assert.equal(interaction.calls[1][0], 'editReply');
    const reply = interaction.calls[1][1];
    assert.ok(reply.content.startsWith('Events this week: '), reply.content);
    assert.deepEqual(
      reply.embeds.map((embed) => embed.toJSON().title),
      ['Monday event', 'Friday event']
    );
    for (const embed of reply.embeds) {
      const json = embed.toJSON();
      assert.equal(json.thumbnail.url, poster);
      assert.equal(json.image.url, 'attachment://spacer.png');
    }
    assert.equal(reply.files.length, 1);
    assert.equal(reply.files[0].name, 'spacer.png');
  });

  test('12 compact events shows only the first 10 and notes the total', async () => {
    const events = Array.from({ length: 12 }, (_, i) => item(`${thisWeekDates[i % 7]}T0${i % 9}:00:00+00:00`, `Event ${i}`));
    globalThis.fetch = async () => jsonResponse(events);
    const interaction = fakeInteraction(null, 'compact');

    await command.execute(interaction);

    const reply = interaction.calls[1][1];
    assert.equal(reply.embeds.length, 10);
    assert.ok(reply.content.endsWith(' Showing the first 10 of 12.'), reply.content);
    assert.equal(reply.files.length, 1);
  });

  test('view: compact with week: next uses the next week title', async () => {
    const nextEvent = item(`${nextWeekDates[1]}T09:00:00+00:00`, 'Next week event');
    globalThis.fetch = async () => jsonResponse([nextEvent]);
    const interaction = fakeInteraction('next', 'compact');

    await command.execute(interaction);

    const reply = interaction.calls[1][1];
    assert.ok(reply.content.startsWith('Events next week: '), reply.content);
    assert.equal(reply.files.length, 1);
  });

  test('view: compact with an empty week gives the same "no events" message', async () => {
    globalThis.fetch = async () => jsonResponse([]);
    const interaction = fakeInteraction(null, 'compact');

    await command.execute(interaction);

    assert.deepEqual(interaction.calls[1], ['editReply', { content: 'No events this week.' }]);
  });
});

describe('%events prefix (compact view)', () => {
  test('"%events compact" replies with a compact embed, thumbnail set and no image', async () => {
    const poster = 'https://example.com/poster.png';
    const event = item(`${thisWeekDates[2]}T09:00:00+00:00`, 'This week event', { poster });
    globalThis.fetch = async () => jsonResponse([event]);
    const message = fakeMessage();

    await command.runPrefix(message, ['compact']);

    assert.ok(message.calls[0].content.startsWith('Events this week: '), message.calls[0].content);
    assert.equal(message.calls[0].embeds.length, 1);
    const json = message.calls[0].embeds[0].toJSON();
    assert.equal(json.title, 'This week event');
    assert.equal(json.thumbnail.url, poster);
    assert.equal(json.image.url, 'attachment://spacer.png');
    assert.equal(message.calls[0].files.length, 1);
    assert.equal(message.calls[0].files[0].name, 'spacer.png');
    assert.deepEqual(message.calls[0].allowedMentions, { repliedUser: false });
  });

  test('"%events next compact" shows next week compact', async () => {
    const nextEvent = item(`${nextWeekDates[1]}T09:00:00+00:00`, 'Next week event');
    globalThis.fetch = async () => jsonResponse([nextEvent]);
    const message = fakeMessage();

    await command.runPrefix(message, ['next', 'compact']);

    assert.ok(message.calls[0].content.startsWith('Events next week: '), message.calls[0].content);
    assert.equal(message.calls[0].embeds[0].toJSON().image.url, 'attachment://spacer.png');
    assert.equal(message.calls[0].files.length, 1);
  });

  test('"%events COMPACT next" is case-insensitive and order-independent', async () => {
    const nextEvent = item(`${nextWeekDates[1]}T09:00:00+00:00`, 'Next week event');
    globalThis.fetch = async () => jsonResponse([nextEvent]);
    const message = fakeMessage();

    await command.runPrefix(message, ['COMPACT', 'next']);

    assert.ok(message.calls[0].content.startsWith('Events next week: '), message.calls[0].content);
    assert.equal(message.calls[0].embeds[0].toJSON().image.url, 'attachment://spacer.png');
    assert.equal(message.calls[0].files.length, 1);
  });
});

describe('%events prefix', () => {
  test('posts the same payload as a normal reply without pinging the author', async () => {
    const event = item(`${thisWeekDates[2]}T09:00:00+00:00`, 'This week event');
    globalThis.fetch = async () => jsonResponse([event]);
    const message = fakeMessage();

    await command.runPrefix(message, []);

    assert.equal(message.calls.length, 1);
    assert.ok(message.calls[0].content.startsWith('Events this week: '));
    assert.equal(message.calls[0].embeds[0].toJSON().title, 'This week event');
    assert.equal(message.calls[0].files, undefined);
    assert.deepEqual(message.calls[0].allowedMentions, { repliedUser: false });
  });

  test('"%events NEXT" is case-insensitive and shows next week', async () => {
    const nextEvent = item(`${nextWeekDates[1]}T09:00:00+00:00`, 'Next week event');
    globalThis.fetch = async () => jsonResponse([nextEvent]);
    const message = fakeMessage();

    await command.runPrefix(message, ['NEXT']);

    assert.ok(message.calls[0].content.startsWith('Events next week: '));
    assert.equal(message.calls[0].embeds[0].toJSON().title, 'Next week event');
    assert.deepEqual(message.calls[0].allowedMentions, { repliedUser: false });
  });

  test('replies with the error text and repliedUser: false on a fetch failure', async () => {
    globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
    const message = fakeMessage();

    await command.runPrefix(message, []);

    assert.deepEqual(message.calls[0], {
      content: 'svsit.nl did not respond. Try again in a minute.',
      allowedMentions: { repliedUser: false },
    });
  });
});

describe('command registration', () => {
  test('exposes /events with optional week and view choices and the events prefix', () => {
    const json = command.data.toJSON();
    assert.equal(json.name, 'events');
    assert.deepEqual(json.options.map((o) => [o.name, o.required]), [['week', false], ['view', false]]);

    const [weekOption, viewOption] = json.options;
    assert.deepEqual(weekOption.choices.map((c) => [c.name, c.value]), [['This week', 'this'], ['Next week', 'next']]);
    assert.deepEqual(viewOption.choices.map((c) => [c.name, c.value]), [['Full', 'full'], ['Compact', 'compact']]);
    assert.equal(command.prefix, 'events');
  });
});
