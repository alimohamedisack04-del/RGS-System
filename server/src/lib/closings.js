/**
 * MONTH CLOSING — when a month ends its final numbers are saved as a monthly statement
 * and every screen moves on to the new month (which starts from $0 collected).
 * Runs automatically on the first request of a new month (no cron job needed).
 * Late payments for a closed month are allowed; the statement shows "at closing" vs "now".
 */
const { MonthClosing, Payment, User } = require('../models');
const { rentRows, rentSummary, portfolioRows } = require('./rent');
const { loadContext } = require('./data');
const { shiftMonth, currentPeriod, nowStamp, round2 } = require('./util');

function monthFigures(ctx, y, m) {
  const summary = rentSummary(rentRows(ctx.units, ctx.payments, y, m));
  const properties = portfolioRows(ctx.units, ctx.payments, ctx.malls, y, m).map((p) => ({
    kind: p.kind, name: p.name, units: p.units, occ: p.occ, expected: round2(p.expected), collected: round2(p.collected), rate: p.rate,
  }));
  return { summary, properties };
}

async function closeMonth(y, m, userId = null, ctx = null) {
  ctx = ctx || (await loadContext());
  const { summary: s, properties } = monthFigures(ctx, y, m);
  const doc = {
    periodYear: y, periodMonth: m, closedAt: nowStamp(), closedBy: userId || null,
    expected: s.expected, collected: s.paid, outstanding: s.remaining,
    units: s.units, paidUnits: s.paidUnits, partialUnits: s.partialUnits, unpaidUnits: s.unpaidUnits, properties,
  };
  const existing = await MonthClosing.findOne({ periodYear: y, periodMonth: m }).lean();
  if (existing) await MonthClosing.updateOne({ _id: existing._id }, { $set: doc });
  else await MonthClosing.create(doc);
}

let lastChecked = '';
/** Close every finished month without a statement (up to 24 months back). */
async function ensureMonthClosings() {
  const [cy, cm] = currentPeriod();
  const key = `${cy}-${cm}`;
  if (lastChecked === key) return;
  const [py, pm] = shiftMonth(cy, cm, -1);
  if (await MonthClosing.findOne({ periodYear: py, periodMonth: pm }).lean()) { lastChecked = key; return; }
  const first = await Payment.find({}).sort({ periodYear: 1, periodMonth: 1 }).limit(1).lean();
  const last = py * 12 + pm - 1;
  const start = first.length ? Math.max(first[0].periodYear * 12 + first[0].periodMonth - 1, last - 23) : last;
  const ctx = await loadContext();
  for (let t = start; t <= last; t++) {
    const y = Math.floor(t / 12), m = (t % 12) + 1;
    if (!(await MonthClosing.findOne({ periodYear: y, periodMonth: m }).lean())) await closeMonth(y, m, null, ctx);
  }
  lastChecked = key;
}
const resetClosingCache = () => { lastChecked = ''; };

async function getClosing(y, m) {
  const c = await MonthClosing.findOne({ periodYear: y, periodMonth: m }).lean();
  if (!c) return null;
  const by = c.closedBy ? await User.findById(c.closedBy).lean() : null;
  return { ...c, id: String(c._id), closedByName: by ? by.fullName : null };
}

module.exports = { monthFigures, closeMonth, ensureMonthClosings, resetClosingCache, getClosing };
