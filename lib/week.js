// Pure date logic for the weekly event overview. No Discord import here:
// only date-string arithmetic so we never have to reason about DST offsets.
const TIME_ZONE = 'Europe/Amsterdam';

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Monday = 0 .. Sunday = 6, matching Intl's 'short' weekday output.
const WEEKDAY_INDEX = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

const DAY_MS = 86_400_000;

const toDate = (instant) => (typeof instant === 'string' ? new Date(instant) : instant);

/**
 * Formats an instant as the local `YYYY-MM-DD` date in `timeZone`. `en-CA`
 * is the one Intl locale whose short numeric date format is already ISO order.
 */
function localDate(instant, timeZone = TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  return formatter.format(toDate(instant));
}

/**
 * Returns the 7 `YYYY-MM-DD` dates from Monday to Sunday of the week `now`
 * falls in, in `timeZone`. `weeks` shifts by whole weeks (1 = the week after).
 *
 * Works entirely on date strings turned into UTC-midnight `Date` objects, so
 * there is no DST arithmetic: each day is exactly 24h apart in this space.
 */
function weekDates(now, { weeks = 0, timeZone = TIME_ZONE } = {}) {
  const date = toDate(now);
  const [year, month, day] = localDate(date, timeZone).split('-').map(Number);
  const weekdayShort = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);
  const mondayIndex = WEEKDAY_INDEX[weekdayShort];

  const monday = Date.UTC(year, month - 1, day) - mondayIndex * DAY_MS + weeks * 7 * DAY_MS;

  return Array.from({ length: 7 }, (_, i) => new Date(monday + i * DAY_MS).toISOString().slice(0, 10));
}

/**
 * Formats the first and last of a `weekDates()` result, e.g. '22 Sep to 28 Sep'.
 * Own month names instead of Intl: date-string parts only, so this never
 * disagrees with `weekDates` about which calendar day is meant.
 */
function weekLabel(dates) {
  const label = (isoDate) => {
    const [, month, day] = isoDate.split('-').map(Number);
    return `${Number(day)} ${SHORT_MONTHS[month - 1]}`;
  };

  return `${label(dates[0])} to ${label(dates[dates.length - 1])}`;
}

module.exports = { TIME_ZONE, localDate, weekDates, weekLabel };
