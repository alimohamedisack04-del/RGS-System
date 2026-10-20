/** Reports and monthly statements. */
const express = require('express');
const { MonthClosing, User } = require('../models');
const { requirePerm, can } = require('../lib/auth');
const { loadContext } = require('../lib/data');
const { closeMonth, monthFigures, getClosing } = require('../lib/closings');
const { monthFinance } = require('../lib/finance');
const R = require('../lib/rent');
const S = require('../lib/serialize');
const { wrap, period, fail, currentPeriod, shiftMonth, round2 } = require('../lib/util');

const router = express.Router();

router.get('/reports/monthly', wrap(async (req, res) => {
  const [y, m] = period(req.query);
  const ctx = await loadContext();
  const rows = R.rentRows(ctx.units, ctx.payments, y, m);
  const sum = R.rentSummary(rows);
  const byType = ['room', 'apartment', 'land'].map((t) => ({ type: t, ...R.rentSummary(rows.filter((r) => r.unitType === t)) }));
  const f = await monthFinance(ctx, y, m);
  res.json({ year: y, month: m, summary: sum, byType, rows: rows.map(S.rentRow), expenses: f.expenses, salaries: f.salaries, net: f.net, finance: f });
}));

router.get('/reports/malls', requirePerm('reports'), wrap(async (req, res) => {
  const [y, m] = period(req.query);
  const ctx = await loadContext();
  const out = [...ctx.malls].sort((a, b) => a.name.localeCompare(b.name)).map((ml) => {
    const id = String(ml._id);
    const rooms = ctx.units.filter((u) => u.unitType === 'room' && u.mallId === id);
    const s = R.rentSummary(R.rentRows(ctx.units, ctx.payments, y, m, { type: 'room', mallId: id }));
    return { id, name: ml.name, totalRooms: rooms.length, occupied: rooms.filter((u) => u.tenantId).length, vacant: rooms.filter((u) => !u.tenantId).length,
      potential: round2(rooms.reduce((a, u) => a + u.rent, 0)), ...s };
  });
  res.json({ year: y, month: m, malls: out });
}));

router.get('/reports/apartments', requirePerm('reports'), wrap(async (req, res) => {
  const [y, m] = period(req.query);
  const ctx = await loadContext();
  const apts = ctx.units.filter((u) => u.unitType === 'apartment');
  const buildings = [...new Set(apts.map((u) => u.location))].sort().map((b) => {
    const us = apts.filter((u) => u.location === b);
    const s = R.rentSummary(R.rentRows(ctx.units, ctx.payments, y, m, { type: 'apartment' }).filter((r) => r.location === b));
    return { name: b, total: us.length, occupied: us.filter((u) => u.tenantId).length, vacant: us.filter((u) => !u.tenantId).length, ...s };
  });
  const rows = R.rentRows(ctx.units, ctx.payments, y, m, { type: 'apartment' });
  res.json({ year: y, month: m, buildings, rows: rows.map(S.rentRow) });
}));

/** Monthly statements list (+ the open current month) */
router.get('/closings', wrap(async (req, res) => {
  const list = (await MonthClosing.find({}).lean()).sort((a, b) => b.periodYear - a.periodYear || b.periodMonth - a.periodMonth);
  const ctx = await loadContext();
  const users = new Map((await User.find({}).lean()).map((u) => [String(u._id), u.fullName]));
  const [cy, cm] = currentPeriod();
  const cur = R.rentSummary(R.rentRows(ctx.units, ctx.payments, cy, cm));
  const nowPaid = (y, m) => round2(ctx.payments.filter((p) => p.periodYear === y && p.periodMonth === m).reduce((a, p) => a + p.amountPaid, 0));
  res.json({
    current: { year: cy, month: cm, ...cur, next: shiftMonth(cy, cm, 1) },
    closings: list.map((c) => ({ id: String(c._id), year: c.periodYear, month: c.periodMonth, closedAt: c.closedAt, closedByName: c.closedBy ? users.get(String(c.closedBy)) || null : null,
      expected: c.expected, collected: c.collected, outstanding: c.outstanding, units: c.units, paidUnits: c.paidUnits, partialUnits: c.partialUnits, unpaidUnits: c.unpaidUnits,
      late: round2(nowPaid(c.periodYear, c.periodMonth) - c.collected) })),
  });
}));

router.get('/closings/:year/:month', wrap(async (req, res) => {
  const y = parseInt(req.params.year, 10), m = parseInt(req.params.month, 10);
  const c = await getClosing(y, m);
  if (!c) fail(404, 'This month has no statement yet. A month is closed automatically when it ends.');
  const ctx = await loadContext();
  const now = monthFigures(ctx, y, m);
  const f = await monthFinance(ctx, y, m);
  res.json({
    closing: { year: y, month: m, closedAt: c.closedAt, closedByName: c.closedByName, expected: c.expected, collected: c.collected, outstanding: c.outstanding,
      units: c.units, paidUnits: c.paidUnits, partialUnits: c.partialUnits, unpaidUnits: c.unpaidUnits, properties: c.properties || [] },
    now, expenses: f.expenses, salaries: f.salaries, net: f.net, finance: f, next: shiftMonth(y, m, 1), canRefresh: can(req.user, 'settings'),
  });
}));

/** Update a saved statement with today's numbers (late payments) */
router.post('/closings/:year/:month/refresh', requirePerm('settings'), wrap(async (req, res) => {
  const y = parseInt(req.params.year, 10), m = parseInt(req.params.month, 10);
  const [cy, cm] = currentPeriod();
  if (!(y * 12 + m < cy * 12 + cm)) fail(422, 'Only finished months can be closed.');
  await closeMonth(y, m, req.user._id);
  res.json({ message: `Statement updated with today's numbers.` });
}));

module.exports = router;
