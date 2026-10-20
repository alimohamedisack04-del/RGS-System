/** Small helpers shared by the server. */
const pad = (n) => String(n).padStart(2, '0');

/** Today as 'YYYY-MM-DD' in the server time zone (TZ). */
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function nowStamp() {
  const d = new Date();
  return `${today()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function currentPeriod() {
  const d = new Date();
  return [d.getFullYear(), d.getMonth() + 1];
}
/** Move a year/month by d months. */
function shiftMonth(y, m, d) {
  const t = y * 12 + (m - 1) + d;
  return [Math.floor(t / 12), (t % 12) + 1];
}
function daysIn(y, m) {
  return new Date(y, m, 0).getDate();
}
function monthEnd(y, m) {
  return `${y}-${pad(m)}-${pad(daysIn(y, m))}`;
}
function monthStart(y, m) {
  return `${y}-${pad(m)}-01`;
}
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const periodLabel = (y, m) => `${MONTHS[m - 1]} ${y}`;

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Read year/month from a query, defaulting to the current month. */
function period(q) {
  const [cy, cm] = currentPeriod();
  let y = parseInt(q.year, 10), m = parseInt(q.month, 10);
  if (!(m >= 1 && m <= 12)) m = cm;
  if (!(y >= 2000 && y <= 2100)) y = cy;
  return [y, m];
}

/** Money value from user input: "1,200.50" -> 1200.5 (null if invalid). */
function parseMoney(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/[,$\s]/g, '');
  if (s === '' || !/^-?\d+(\.\d+)?$/.test(s)) return null;
  return round2(Number(s));
}
const str = (v, max = 255) => (v === null || v === undefined ? '' : String(v).trim().slice(0, max));
const validDate = (d) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '')) return false;
  const t = new Date(d + 'T00:00:00Z');
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
};
const sameId = (a, b) => a != null && b != null && String(a) === String(b);
const idStr = (v) => (v == null ? null : String(v));
const oneOf = (v, list, def = '') => (list.includes(v) ? v : def);
/** A valid MongoDB id (24 hex characters) or '' */
const isId = (v) => /^[a-f0-9]{24}$/i.test(String(v || ''));
const idOrEmpty = (v) => (isId(v) ? String(v) : '');

class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}
const fail = (status, message, extra) => { throw new HttpError(status, message, extra); };
/** 422 with a list of form errors */
const invalid = (errors) => fail(422, errors[0], { errors });

/** Wrap async route handlers so errors reach the error handler (Express 4 and 5). */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = {
  pad, today, nowStamp, currentPeriod, shiftMonth, daysIn, monthEnd, monthStart, MONTHS, periodLabel, round2, period,
  parseMoney, str, validDate, sameId, idStr, oneOf, isId, idOrEmpty, HttpError, fail, invalid, wrap,
};
