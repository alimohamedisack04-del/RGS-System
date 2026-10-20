/** /api/meta (app shell data) and /api/dashboard */
const express = require('express');
const { Mall, Payment, Tenant, Expense } = require('../models');
const { publicUser, permsOf, ROLES } = require('../lib/auth');
const { getSettings } = require('../lib/settings');
const { loadContext } = require('../lib/data');
const R = require('../lib/rent');
const S = require('../lib/serialize');
const { getClosing } = require('../lib/closings');
const { monthFinance } = require('../lib/finance');
const { userMap } = require('../lib/users');
const { wrap, period, currentPeriod, shiftMonth, today } = require('../lib/util');

const router = express.Router();

router.get('/meta', wrap(async (req, res) => {
  const [settings, malls, ctx] = await Promise.all([getSettings(), Mall.find({}).sort({ name: 1 }).lean(), loadContext()]);
  const [cy, cm] = currentPeriod();
  const due = R.rentRows(ctx.units, ctx.payments, cy, cm).filter((r) => r.payStatus !== 'paid').length;
  res.json({
    user: publicUser(req.user), perms: permsOf(req.user), roles: ROLES, settings,
    malls: malls.map(S.mall), dueCount: due, today: today(), year: cy, month: cm,
  });
}));

router.get('/dashboard', wrap(async (req, res) => {
  const [y, m] = period(req.query);
  const [cy, cm] = currentPeriod();
  const isCurrent = y === cy && m === cm;
  const ctx = await loadContext();
  const { units, payments, malls } = ctx;
  const rows = R.rentRows(units, payments, y, m);
  const sum = R.rentSummary(rows);
  const [py, pm] = shiftMonth(y, m, -1);
  const prev = R.rentSummary(R.rentRows(units, payments, py, pm));
  const users = await userMap();
  const recent = [...payments].sort((a, b) => (b.paymentDate.localeCompare(a.paymentDate)) || String(b._id).localeCompare(String(a._id))).slice(0, 6);
  const notPaid = rows.filter((r) => r.payStatus !== 'paid').sort((a, b) => b.remaining - a.remaining);
  const outstanding = notPaid.slice(0, 8);
  const tenants = await Tenant.find({}).lean();
  const activeTenants = tenants.filter((t) => units.some((u) => u.tenantId === String(t._id))).length;
  const [lcY, lcM] = shiftMonth(cy, cm, -1);
  const lastClosing = isCurrent && new Date().getDate() <= 10 ? await getClosing(lcY, lcM) : null;
  const viewClosing = !isCurrent && y * 12 + m < cy * 12 + cm ? await getClosing(y, m) : null;
  const [finance, prevFinance] = await Promise.all([monthFinance(ctx, y, m), monthFinance(ctx, py, pm)]);
  const paidAmt = rows.filter((r) => r.payStatus === 'paid').reduce((a, r) => a + r.paid, 0);
  const partAmt = rows.filter((r) => r.payStatus === 'partial').reduce((a, r) => a + r.paid, 0);
  res.json({
    year: y, month: m, isCurrent, summary: sum, prev,
    trend: R.rentTrend(units, payments, y, m, 6),
    arrears: R.rentArrears(units, payments, y, m, 12),
    occupancy: R.occupancyStats(units),
    portfolio: R.portfolioRows(units, payments, malls, y, m),
    outstanding: outstanding.map(S.rentRow), outstandingCount: notPaid.length,
    recent: recent.map((p) => S.payment(p, users)),
    monthPayCount: payments.filter((p) => p.periodYear === y && p.periodMonth === m).length,
    todayAmount: payments.filter((p) => p.paymentDate === today()).reduce((a, p) => a + p.amountPaid, 0),
    paidAmount: paidAmt, partialAmount: partAmt,
    activeTenants,
    counts: {
      malls: malls.length, buildings: new Set(units.filter((u) => u.unitType === 'apartment').map((u) => u.location)).size,
      rooms: units.filter((u) => u.unitType === 'room').length, apartments: units.filter((u) => u.unitType === 'apartment').length,
      lands: units.filter((u) => u.unitType === 'land').length,
    },
    finance, prevFinance, expenses: finance.expenses, salaries: finance.salaries, net: finance.net,
    lastClosing: lastClosing && { year: lcY, month: lcM, expected: lastClosing.expected, collected: lastClosing.collected, outstanding: lastClosing.outstanding },
    viewClosing: viewClosing && { closedAt: viewClosing.closedAt },
  });
}));

module.exports = router;
