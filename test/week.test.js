const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { TIME_ZONE, localDate, weekDates, weekLabel } = require('../lib/week');

describe('localDate', () => {
  test('formats an ISO string in the given time zone', () => {
    assert.equal(localDate('2026-09-21T09:00:00Z', TIME_ZONE), '2026-09-21');
  });

  test('formats a Date object', () => {
    assert.equal(localDate(new Date('2026-09-21T09:00:00Z'), TIME_ZONE), '2026-09-21');
  });

  test('rolls over to the next day once CEST pushes past midnight', () => {
    // 22:30 UTC + 2h (CEST) = 00:30 the next day in Amsterdam.
    assert.equal(localDate('2026-09-30T22:30:00Z'), '2026-10-01');
  });

  test('defaults to Europe/Amsterdam', () => {
    assert.equal(localDate('2026-09-21T09:00:00Z'), '2026-09-21');
  });
});

describe('weekDates', () => {
  const SEP21_TO_27 = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'];
  const SEP28_TO_OCT4 = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'];
  const OCT19_TO_25 = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'];
  const OCT26_TO_NOV1 = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'];

  test('returns Monday to Sunday for a now on Monday (Amsterdam)', () => {
    assert.deepEqual(weekDates(new Date('2026-09-21T09:00:00Z')), SEP21_TO_27);
  });

  test('returns the same week for a now on Wednesday (Amsterdam)', () => {
    assert.deepEqual(weekDates(new Date('2026-09-23T09:00:00Z')), SEP21_TO_27);
  });

  test('returns the same week for a now on Sunday (Amsterdam)', () => {
    assert.deepEqual(weekDates(new Date('2026-09-27T09:00:00Z')), SEP21_TO_27);
  });

  test('uses the Amsterdam date when UTC midnight already rolled to the next day', () => {
    // 2026-09-27T22:30:00Z is Sunday in UTC but Monday 00:30 in Amsterdam (CEST).
    assert.deepEqual(weekDates(new Date('2026-09-27T22:30:00Z')), SEP28_TO_OCT4);
  });

  test('handles the week that contains the DST switch (2026-10-25)', () => {
    assert.deepEqual(weekDates(new Date('2026-10-19T09:00:00Z')), OCT19_TO_25);
  });

  test('handles a now just after the DST switch (2026-10-25 23:30 UTC = Monday CET in Amsterdam)', () => {
    assert.deepEqual(weekDates(new Date('2026-10-25T23:30:00Z')), OCT26_TO_NOV1);
  });

  test('weeks: 1 returns the following week', () => {
    assert.deepEqual(weekDates(new Date('2026-09-21T09:00:00Z'), { weeks: 1 }), SEP28_TO_OCT4);
  });

  test('accepts an ISO string for now', () => {
    assert.deepEqual(weekDates('2026-09-21T09:00:00Z'), SEP21_TO_27);
  });
});

describe('weekLabel', () => {
  test('formats the first and last date with short English month names', () => {
    const dates = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'];
    assert.equal(weekLabel(dates), '21 Sep to 27 Sep');
  });

  test('formats a week that crosses a month boundary', () => {
    const dates = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'];
    assert.equal(weekLabel(dates), '28 Sep to 4 Oct');
  });
});
