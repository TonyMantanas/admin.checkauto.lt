/* ==========================================================================
   Shared display formatting

   One way to show dates, times and money across the admin, always in
   Vilnius time:
     appointments   "Fri 6 Nov, 10:00–11:00"
     record times   "6 Nov, 10:00"            (year added outside this year)
     relative       "today 14:15", "tomorrow 00:11", "Sat 7 Nov, 14:15"
     money          "1 120,00 €"               (whole: "1 120 €")
   Machine values (YYYY-MM-DD keys, input values) stay with the runtime.
   ========================================================================== */

export const TIME_ZONE = 'Europe/Vilnius';
const DAY_MS = 24 * 60 * 60 * 1000;
const formatterCache = new Map();

function formatter(locale, options) {
  const key = locale + JSON.stringify(options);
  if (!formatterCache.has(key)) formatterCache.set(key, new Intl.DateTimeFormat(locale, options));
  return formatterCache.get(key);
}

function toDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

// A YYYY-MM-DD string is a calendar day, not an instant: read it at UTC noon
// and format it in UTC so no time zone can move it to another day.
function dayOnly(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(value + 'T12:00:00Z')
    : null;
}

export function vilniusYmd(value) {
  const date = toDate(value);
  if (!date) return '';
  const parts = formatter('lt-LT', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(date)
    .reduce((map, part) => (part.type === 'literal' ? map : { ...map, [part.type]: part.value }), {});
  return parts.year + '-' + parts.month + '-' + parts.day;
}

function ordinal(ymd) {
  const [year, month, day] = ymd.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

// Whole days from today to the value's day, both in Vilnius.
export function dayDifference(value, now) {
  const ymd = dayOnly(value) ? value : vilniusYmd(value);
  if (!ymd) return null;
  return ordinal(ymd) - ordinal(vilniusYmd(now || new Date()));
}

export function formatTime(value) {
  const date = toDate(value);
  if (!date) return '';
  return formatter('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}

// "Fri 6 Nov", "6 Nov", "6 Nov 2025". Accepts instants and YYYY-MM-DD days.
export function formatDay(value, options) {
  const opts = options || {};
  const calendarDay = dayOnly(value);
  const date = calendarDay || toDate(value);
  if (!date) return '';
  const zone = calendarDay ? 'UTC' : TIME_ZONE;
  const thisYear = vilniusYmd(new Date()).slice(0, 4);
  const year = (calendarDay ? value : vilniusYmd(date)).slice(0, 4);
  return formatter('en-GB', {
    timeZone: zone,
    weekday: opts.weekday ? 'short' : undefined,
    day: 'numeric',
    month: 'short',
    year: opts.year === true || (opts.year !== false && year !== thisYear) ? 'numeric' : undefined
  }).format(date);
}

export function formatDateTime(value, options) {
  const date = toDate(value);
  if (!date) return '';
  return formatDay(date, options) + ', ' + formatTime(date);
}

// Appointments: "Fri 6 Nov, 10:00–11:00", or both ends when they span days.
export function formatRange(start, end, options) {
  const opts = { weekday: true, ...(options || {}) };
  const from = toDate(start);
  const to = toDate(end);
  if (!from) return '';
  if (!to) return formatDateTime(from, opts);
  if (vilniusYmd(from) === vilniusYmd(to)) return formatDay(from, opts) + ', ' + formatTime(from) + '–' + formatTime(to);
  return formatDateTime(from, opts) + ' – ' + formatDateTime(to, opts);
}

export function formatTimeRange(start, end) {
  const from = toDate(start);
  const to = toDate(end);
  if (!from) return '';
  return to ? formatTime(from) + '–' + formatTime(to) : formatTime(from);
}

// "today", "tomorrow", "yesterday", then "Sat 7 Nov" within a week, else "7 Oct".
export function relativeDay(value) {
  const difference = dayDifference(value);
  if (difference === null) return '';
  if (difference === 0) return 'today';
  if (difference === 1) return 'tomorrow';
  if (difference === -1) return 'yesterday';
  return formatDay(value, { weekday: Math.abs(difference) <= 6 });
}

// "today 14:15", "Sat 7 Nov, 14:15".
export function relativeDateTime(value) {
  const date = toDate(value);
  if (!date) return '';
  const day = relativeDay(date);
  return day + (/^[a-z]/.test(day) ? ' ' : ', ') + formatTime(date);
}

export function capitalise(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

const moneyCache = new Map();

// The admin's one money style: Lithuanian grouping, symbol after ("1 120,00 €").
export function formatMoney(cents, currency, options) {
  const code = String(currency || 'EUR').trim().toUpperCase() || 'EUR';
  const whole = Boolean(options && options.whole);
  const amount = (Number(cents) || 0) / 100;
  const key = code + (whole ? ':whole' : '');
  try {
    if (!moneyCache.has(key)) {
      moneyCache.set(key, new Intl.NumberFormat('lt-LT', {
        style: 'currency',
        currency: code,
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: whole ? 0 : 2,
        maximumFractionDigits: whole ? 0 : 2
      }));
    }
    return moneyCache.get(key).format(whole ? Math.round(amount) : amount);
  } catch (_) {
    return amount.toFixed(whole ? 0 : 2).replace('.', ',') + ' ' + code;
  }
}

export const formatters = Object.freeze({
  vilniusYmd,
  dayDifference,
  formatTime,
  formatDay,
  formatDateTime,
  formatRange,
  formatTimeRange,
  relativeDay,
  relativeDateTime,
  capitalise,
  formatMoney
});
