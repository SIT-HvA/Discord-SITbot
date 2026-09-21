const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { buildEventEmbed } = require('../lib/svsit-events');

const ID = 'e06acbfd-13d1-4002-9546-7066420762ef';

// Shape of GET /api/events/<id> on svsit.nl, checked live on 2026-09-21.
const baseEvent = () => ({
  signup_required: true,
  id: ID,
  title: 'De Digitale Schijf van Vijf',
  description: 'AI, mental health, screen-life balance.',
  date: '2026-09-21T12:30:00+00:00',
  end_date: '2026-09-21T16:00:00+00:00',
  location: 'REC Impact (Roeterseiland)',
  category: 'career',
  tags: [],
  status: 'upcoming',
  is_paid: false,
  price_members: 0,
  price_nonmembers: 0,
  capacity: null,
  external_ticket_url: 'https://www.hva.nl/evenementen/schijf-van-vijf',
  recap_description: null,
  recap_photos: null,
  recap_published: false,
  form_fields: [],
  poster_url: 'https://example.supabase.co/storage/v1/object/public/event-posters/poster.png',
  ticketCount: 12,
});

const BEFORE = new Date('2026-09-20T10:00:00Z');
const AFTER = new Date('2026-09-22T10:00:00Z');

const field = (json, name) => json.fields.find((f) => f.name === name);

describe('buildEventEmbed', () => {
  test('maps title, link, description, poster and category colour', () => {
    const json = buildEventEmbed(baseEvent(), { now: BEFORE }).toJSON();

    assert.equal(json.title, 'De Digitale Schijf van Vijf');
    assert.equal(json.url, `https://svsit.nl/events/${ID}`);
    assert.equal(json.description, 'AI, mental health, screen-life balance.');
    assert.equal(json.image.url, baseEvent().poster_url);
    assert.equal(json.color, 0x3b82f6);
    assert.equal(json.footer.text, 'svsit.nl');
  });

  test('renders when, where, category, price, signups and tickets fields', () => {
    const json = buildEventEmbed(baseEvent(), { now: BEFORE }).toJSON();
    const start = Math.floor(new Date('2026-09-21T12:30:00+00:00').getTime() / 1000);
    const end = Math.floor(new Date('2026-09-21T16:00:00+00:00').getTime() / 1000);

    assert.equal(field(json, 'When').value, `<t:${start}:F> to <t:${end}:t> (<t:${start}:R>)`);
    assert.equal(field(json, 'Where').value, 'REC Impact (Roeterseiland)');
    assert.equal(field(json, 'Category').value, 'Career');
    assert.equal(field(json, 'Price').value, 'Free');
    assert.equal(field(json, 'Signups').value, '12');
    assert.equal(field(json, 'Tickets').value, 'https://www.hva.nl/evenementen/schijf-van-vijf');
  });

  test('shows member and non-member prices in euros for paid events', () => {
    const event = { ...baseEvent(), is_paid: true, price_members: 500, price_nonmembers: 1250 };
    const json = buildEventEmbed(event, { now: BEFORE }).toJSON();
    assert.equal(field(json, 'Price').value, 'Members EUR 5,00 / non-members EUR 12,50');
  });

  test('shows capacity next to the signup count when set', () => {
    const event = { ...baseEvent(), capacity: 40 };
    assert.equal(field(buildEventEmbed(event, { now: BEFORE }).toJSON(), 'Signups').value, '12 / 40');
  });

  test('omits optional parts that are missing', () => {
    const event = {
      ...baseEvent(),
      description: null,
      end_date: null,
      location: null,
      external_ticket_url: null,
      poster_url: undefined,
      signup_required: false,
    };
    const json = buildEventEmbed(event, { now: BEFORE }).toJSON();
    const start = Math.floor(new Date(event.date).getTime() / 1000);

    assert.equal(json.description, undefined);
    assert.equal(json.image, undefined);
    assert.equal(field(json, 'When').value, `<t:${start}:F> (<t:${start}:R>)`);
    assert.equal(field(json, 'Where').value, 'TBA');
    assert.equal(field(json, 'Signups'), undefined);
    assert.equal(field(json, 'Tickets'), undefined);
  });

  test('falls back to the social colour for unknown categories', () => {
    assert.equal(buildEventEmbed({ ...baseEvent(), category: 'impact' }).toJSON().color, 0xf29e18);
    assert.equal(buildEventEmbed({ ...baseEvent(), category: null }).toJSON().color, 0xf29e18);
  });

  test('marks cancelled events in the title', () => {
    const json = buildEventEmbed({ ...baseEvent(), status: 'cancelled' }, { now: BEFORE }).toJSON();
    assert.equal(json.title, '[Cancelled] De Digitale Schijf van Vijf');
  });

  test('notes in the footer when the event has ended', () => {
    assert.equal(buildEventEmbed(baseEvent(), { now: AFTER }).toJSON().footer.text, 'svsit.nl  This event has ended');

    // No end_date: ended once date + 4h has passed, same rule as the site.
    const noEnd = { ...baseEvent(), end_date: null };
    const justUnder4h = new Date('2026-09-21T16:29:00Z');
    const justOver4h = new Date('2026-09-21T16:31:00Z');
    assert.equal(buildEventEmbed(noEnd, { now: justUnder4h }).toJSON().footer.text, 'svsit.nl');
    assert.equal(buildEventEmbed(noEnd, { now: justOver4h }).toJSON().footer.text, 'svsit.nl  This event has ended');
  });

  test('truncates long text to the Discord limits', () => {
    const event = {
      ...baseEvent(),
      title: 'T'.repeat(300),
      description: 'D'.repeat(3000),
      location: 'L'.repeat(2000),
    };
    const json = buildEventEmbed(event, { now: BEFORE }).toJSON();

    assert.equal(json.title.length, 256);
    assert.ok(json.title.endsWith('...'));
    assert.equal(json.description.length, 1000);
    assert.equal(field(json, 'Where').value.length, 1024);
  });
});
