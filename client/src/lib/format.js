/** Formatting helpers (money, dates, months). */
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthName = (m, short) => (short ? MONTHS[m - 1].slice(0, 3) : MONTHS[m - 1]);
export const periodLabel = (y, m) => `${MONTHS[m - 1]} ${y}`;
export const pad = (n) => String(n).padStart(2, '0');

let CURRENCY = '$';
export const setCurrency = (c) => { CURRENCY = c || '$'; };
export const currency = () => CURRENCY;

export function money(n) {
  n = Number(n) || 0;
  return (n < 0 ? '-' : '') + CURRENCY + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function moneyShort(n) {
  n = Number(n) || 0;
  if (n >= 1e6) return CURRENCY + (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return CURRENCY + (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K';
  return CURRENCY + Math.round(n);
}
export function fmtDate(d, withTime) {
  if (!d) return '-';
  const [y, m, dd] = String(d).slice(0, 10).split('-').map(Number);
  let s = `${pad(dd)} ${monthName(m, true)} ${y}`;
  if (withTime && String(d).length > 10) s += ' ' + String(d).slice(11, 16);
  return s;
}
export function shiftMonth(y, m, d) {
  const t = y * 12 + (m - 1) + d;
  return [Math.floor(t / 12), (t % 12) + 1];
}
export function initials(name) {
  return String(name || '').trim().split(/\s+/).slice(0, 2).map((p) => p[0] || '').join('').toUpperCase() || '?';
}
export const unitTypeLabel = (t, category) => (category === 'hall' ? 'Mall Hall' : { room: 'Mall Room', apartment: 'Apartment', land: 'Land' }[t] || t);
export const rateClass = (r) => (r >= 90 ? 'good' : r >= 60 ? '' : r > 0 ? 'warn' : 'bad');

/** Download rows as a CSV file Excel can open. */
export function downloadCsv(name, header, rows) {
  const q = (v) => {
    v = String(v ?? '');
    if (/^[=+\-@]/.test(v) && Number.isNaN(Number(v))) v = "'" + v;
    return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  };
  const text = '﻿' + [header, ...rows].map((r) => r.map(q).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}
export const daysInMonth = (y, m) => new Date(y, m, 0).getDate();
