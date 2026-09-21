const { test } = require('node:test');
const assert = require('node:assert/strict');

// node:test runs each file in its own process, so setting the env before the
// first require is enough to exercise the module-load default (S1).
process.env.SVSIT_BASE_URL = 'http://localhost:3000/';
const { eventPageUrl, fetchEvent } = require('../lib/svsit-events');

const ID = 'e06acbfd-13d1-4002-9546-7066420762ef';

test('SVSIT_BASE_URL overrides the page link and the API origin (S1)', async () => {
  assert.equal(eventPageUrl(ID), `http://localhost:3000/events/${ID}`);

  let requested;
  const fetch = async (url) => { requested = url; return { ok: true, status: 200, json: async () => ({ data: { id: ID } }) }; };
  await fetchEvent(ID, { fetch });
  assert.equal(requested, `http://localhost:3000/api/events/${ID}`);
});
