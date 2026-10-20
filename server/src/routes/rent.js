/** Rent collection, units, payments, receipts. */
const express = require('express');
const { Payment, Section, Mall, nextReceiptNo } = require('../models');
const { requirePerm, can } = require('../lib/auth');
const { loadContext, loadUnits, findUnit, parseUnitKey } = require('../lib/data');
const R = require('../lib/rent');
const S = require('../lib/serialize');
const { userMap } = require('../lib/users');
const { getSettings } = require('../lib/settings');
const { wrap, period, periodLabel, today, validDate, parseMoney, str, oneOf, fail, invalid, round2, nowStamp, idOrEmpty, isId } = require('../lib/util');

const router = express.Router();
const METHODS = ['Cash', 'EVC Plus', 'eDahab', 'Zaad', 'Bank', 'Cheque', 'Other'];

function rentFilters(q) {
  return {
    type: oneOf(q.type, ['room', 'apartment', 'land']), mallId: idOrEmpty(q.mallId), sectionId: idOrEmpty(q.sectionId),
    status: oneOf(q.status, ['paid', 'partial', 'unpaid']), q: str(q.q, 100),
  };
}

/** Rent Collection list for a month */
router.get('/rent', wrap(async (req, res) => {
  const [y, m] = period(req.query);
  const f = rentFilters(req.query);
  const ctx = await loadContext();
  if (f.sectionId) {
    const sec = await Section.findById(f.sectionId).lean();
    if (!sec || (f.mallId && String(sec.mall) !== f.mallId)) f.sectionId = '';
  }
  const rows = R.rentRows(ctx.units, ctx.payments, y, m, f);
  const sections = f.mallId ? (await Section.find({ mall: f.mallId }).sort({ sortOrder: 1, name: 1 }).lean()).map(S.section) : [];
  res.json({ year: y, month: m, filters: f, rows: rows.map(S.rentRow), summary: R.rentSummary(rows), sections });
}));

/** Units that can receive payments (dropdown) */
router.get('/units/payable', wrap(async (req, res) => {
  const units = (await loadUnits()).filter((u) => u.isLet);
  units.sort((a, b) => a.unitType.localeCompare(b.unitType) || String(a.location).localeCompare(String(b.location)) || String(a.code).localeCompare(String(b.code), undefined, { numeric: true }));
  res.json({ units: units.map(S.unit), methods: METHODS });
}));

/** Rent status of one unit for a month (payment form panel) */
router.get('/units/:type/:id/status', wrap(async (req, res) => {
  const [y, m] = period(req.query);
  const ctx = await loadContext();
  const u = ctx.units.find((x) => x.unitType === req.params.type && x.unitId === req.params.id);
  if (!u) fail(404, 'Unit not found.');
  const row = R.rentRows([u], ctx.payments, y, m)[0];
  const rent = row ? row.rent : u.rent, paid = row ? row.paid : 0;
  res.json({ unit: S.unit(u), year: y, month: m, rent, paid, remaining: R.rentRemaining(rent, paid), status: R.rentStatus(rent, paid) });
}));

/** One unit: details, 12-month grid and payments */
router.get('/units/:type/:id', wrap(async (req, res) => {
  const ctx = await loadContext();
  const u = ctx.units.find((x) => x.unitType === req.params.type && x.unitId === req.params.id);
  if (!u) fail(404, 'Unit not found.');
  const year = parseInt(req.query.year, 10) || new Date().getFullYear();
  const [y, m] = period(req.query);
  const mine = ctx.payments.filter((p) => p.unitType === u.unitType && String(p.unitId) === u.unitId);
  const users = await userMap();
  const row = R.rentRows([u], ctx.payments, y, m)[0];
  mine.sort((a, b) => b.periodYear - a.periodYear || b.periodMonth - a.periodMonth || String(b._id).localeCompare(String(a._id)));
  res.json({
    unit: S.unit(u), year, history: R.unitYearHistory(u, ctx.payments, year),
    current: { year: y, month: m, rent: row ? row.rent : u.rent, paid: row ? row.paid : 0, remaining: row ? row.remaining : (u.isLet ? u.rent : 0), status: row ? row.payStatus : (u.isLet ? 'unpaid' : 'na') },
    payments: mine.slice(0, 100).map((p) => S.payment(p, users)),
  });
}));

/** All units (unit picker on Payment History) */
router.get('/units/all', wrap(async (req, res) => {
  const units = await loadUnits();
  units.sort((a, b) => a.unitType.localeCompare(b.unitType) || String(a.location).localeCompare(String(b.location)) || String(a.code).localeCompare(String(b.code), undefined, { numeric: true }));
  res.json({ units: units.map(S.unit) });
}));

/** Month-by-month status list (Payment History without a unit) */
router.get('/history', wrap(async (req, res) => {
  const q = req.query;
  const [cy, cm] = require('../lib/util').currentPeriod();
  const year = parseInt(q.year, 10) || cy;
  const month = parseInt(q.month, 10) || 0;
  const f = rentFilters(q);
  const ctx = await loadContext();
  const months = month >= 1 && month <= 12 ? [month] : Array.from({ length: year < cy ? 12 : year === cy ? cm : 0 }, (_, i) => i + 1).reverse();
  const rows = [];
  for (const m of months) for (const r of R.rentRows(ctx.units, ctx.payments, year, m, f)) rows.push({ ...S.rentRow(r), year, month: m });
  const per = 50, page = Math.max(1, parseInt(q.page, 10) || 1);
  res.json({ year, month, total: rows.length, page, pages: Math.max(1, Math.ceil(rows.length / per)), rows: q.all ? rows : rows.slice((page - 1) * per, page * per),
    summary: R.rentSummary(rows.map((r) => ({ rent: r.rent, paid: r.paid, remaining: r.remaining, payStatus: r.payStatus }))) });
}));

/** Vacant units a tenant can be assigned to */
router.get('/units-vacant', wrap(async (req, res) => {
  const units = (await loadUnits()).filter((u) => !u.tenantId && (u.unitType !== 'land' || ['available', 'rented'].includes(u.status)));
  res.json({ units: units.map(S.unit) });
}));

/** Save a payment (keeps the rent of the first payment of the month as the month's rent). */
async function savePayment(u, y, m, amount, date, method, reference, notes, userId) {
  const prev = await Payment.find({ unitType: u.unitType, unitId: u.unitId, periodYear: y, periodMonth: m }).lean();
  const snap = prev.reduce((a, p) => Math.max(a, p.rentAmount || 0), 0);
  const doc = await Payment.create({
    receiptNo: await nextReceiptNo(), unitType: u.unitType, unitId: u.unitId, tenant: u.tenantId || null, tenantName: u.tenantName || '',
    unitLabel: u.label, periodYear: y, periodMonth: m, rentAmount: snap > 0 ? snap : u.rent, amountPaid: amount,
    paymentDate: date, paymentMethod: method, reference, notes, receivedBy: userId,
  });
  return doc.toObject ? doc.toObject() : doc;
}

async function monthState(u, y, m) {
  const pays = await Payment.find({ unitType: u.unitType, unitId: u.unitId, periodYear: y, periodMonth: m }).lean();
  const snap = pays.reduce((a, p) => Math.max(a, p.rentAmount || 0), 0);
  const rent = snap > 0 ? snap : u.rent;
  const paid = round2(pays.reduce((a, p) => a + p.amountPaid, 0));
  return { rent, paid, remaining: R.rentRemaining(rent, paid), status: R.rentStatus(rent, paid), count: pays.length };
}

router.post('/payments', requirePerm('pay'), wrap(async (req, res) => {
  const b = req.body || {};
  const [y, m] = period(b);
  const key = parseUnitKey(b.unit);
  const u = key ? await findUnit(key.type, key.id) : null;
  const amount = parseMoney(b.amount);
  const date = str(b.paymentDate, 10) || today();
  const errors = [];
  if (!u) errors.push('Please select the room / apartment / land.');
  if (amount === null || amount <= 0) errors.push('Amount paid must be more than 0.');
  if (!validDate(date)) errors.push('Please enter a valid payment date.');
  if (!errors.length) {
    const st = await monthState(u, y, m);
    if (!u.isLet && st.paid <= 0) errors.push('This unit has no tenant. Assign a tenant first.');
    else if (st.remaining <= 0) errors.push(`Rent for ${periodLabel(y, m)} is already fully paid for this unit.`);
    else if (amount > st.remaining + 0.001) errors.push(`Amount ($${amount.toFixed(2)}) is more than the remaining balance ($${st.remaining.toFixed(2)}). For advance rent, record a payment for the next month.`);
  }
  if (errors.length) invalid(errors);
  const method = oneOf(b.paymentMethod, METHODS, 'Other');
  const p = await savePayment(u, y, m, amount, date, method, str(b.reference, 100), str(b.notes, 500), req.user._id);
  const st = await monthState(u, y, m);
  res.status(201).json({ payment: S.payment(p), state: st, message: `Payment saved. ${u.label} is now ${st.status.toUpperCase()} for ${periodLabel(y, m)}.` });
}));

/** Quick actions from Rent Collection: mark paid (full remaining, today) / mark unpaid (admin: delete the month's payments) */
router.post('/payments/mark', requirePerm('pay'), wrap(async (req, res) => {
  const b = req.body || {};
  const [y, m] = period(b);
  const key = parseUnitKey(b.unit);
  const u = key ? await findUnit(key.type, key.id) : null;
  if (!u) fail(404, 'Unit not found.');
  if (b.action === 'paid') {
    const st = await monthState(u, y, m);
    if (st.remaining <= 0) return res.json({ message: `${u.label} is already paid for ${periodLabel(y, m)}.`, type: 'info' });
    if (!u.isLet) fail(422, 'This unit has no tenant.');
    const p = await savePayment(u, y, m, st.remaining, today(), 'Cash', '', 'Marked as paid from Rent Collection', req.user._id);
    return res.json({ message: `${u.label} marked as PAID for ${periodLabel(y, m)} ($${st.remaining.toFixed(2)}). Receipt: ${p.receiptNo}`, payment: S.payment(p) });
  }
  if (b.action === 'unpaid') {
    if (!can(req.user, 'unpay')) fail(403, 'Only an administrator can mark rent as unpaid.');
    await Payment.deleteMany({ unitType: u.unitType, unitId: u.unitId, periodYear: y, periodMonth: m });
    return res.json({ message: `${u.label} marked as UNPAID for ${periodLabel(y, m)}.` });
  }
  fail(422, 'Unknown action.');
}));

/** Payments list (receipts) */
router.get('/payments', wrap(async (req, res) => {
  const q = req.query;
  const year = parseInt(q.year, 10) || new Date().getFullYear();
  const month = parseInt(q.month, 10) || 0;
  const filter = { periodYear: year };
  if (month >= 1 && month <= 12) filter.periodMonth = month;
  const type = oneOf(q.type, ['room', 'apartment', 'land']);
  if (type) filter.unitType = type;
  let list = await Payment.find(filter).lean();
  if (isId(q.mallId)) {
    const units = await loadUnits();
    const ids = new Set(units.filter((u) => u.unitType === 'room' && u.mallId === String(q.mallId)).map((u) => u.unitId));
    list = list.filter((p) => p.unitType === 'room' && ids.has(String(p.unitId)));
  }
  const search = str(q.q, 100).toLowerCase();
  if (search) list = list.filter((p) => `${p.tenantName} ${p.unitLabel} ${p.receiptNo} ${p.reference}`.toLowerCase().includes(search));
  if (validDate(q.from)) list = list.filter((p) => p.paymentDate >= q.from);
  if (validDate(q.to)) list = list.filter((p) => p.paymentDate <= q.to);
  // month status of each payment's unit/month
  const totals = new Map();
  for (const p of await Payment.find({ periodYear: year }).lean()) {
    const k = `${p.unitType}:${p.unitId}:${p.periodYear}:${p.periodMonth}`;
    totals.set(k, round2((totals.get(k) || 0) + p.amountPaid));
  }
  const status = oneOf(q.status, ['paid', 'partial']);
  const users = await userMap();
  let rows = list.map((p) => {
    const tot = totals.get(`${p.unitType}:${p.unitId}:${p.periodYear}:${p.periodMonth}`) || 0;
    return { ...S.payment(p, users), monthTotal: tot, monthStatus: R.rentStatus(p.rentAmount, tot) };
  });
  if (status) rows = rows.filter((r) => r.monthStatus === status);
  rows.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate) || String(b.id).localeCompare(String(a.id)));
  const page = Math.max(1, parseInt(q.page, 10) || 1), per = q.all ? 100000 : 30;
  res.json({
    total: rows.length, amount: round2(rows.reduce((a, r) => a + r.amountPaid, 0)), page, pages: Math.max(1, Math.ceil(rows.length / per)),
    rows: rows.slice((page - 1) * per, page * per), methods: METHODS,
  });
}));

/** Receipt */
router.get('/payments/:id', wrap(async (req, res) => {
  if (!isId(req.params.id)) fail(404, 'Payment not found.');
  const p = await Payment.findById(req.params.id).lean();
  if (!p) fail(404, 'Payment not found.');
  const units = await loadUnits();
  const u = units.find((x) => x.unitType === p.unitType && x.unitId === String(p.unitId));
  const pays = await Payment.find({ unitType: p.unitType, unitId: p.unitId, periodYear: p.periodYear, periodMonth: p.periodMonth }).lean();
  pays.sort((a, b) => String(a._id).localeCompare(String(b._id)));
  const upto = round2(pays.filter((x) => String(x._id) <= String(p._id)).reduce((a, x) => a + x.amountPaid, 0));
  const users = await userMap();
  const t = p.tenant ? await require('../models').Tenant.findById(p.tenant).lean() : null;
  const mall = u && u.mallId ? await Mall.findById(u.mallId).lean() : null;
  res.json({
    payment: S.payment(p, users), unit: u ? S.unit(u) : null, tenantPhone: t ? t.phone : '', mallName: mall ? mall.name : null,
    paidUpTo: upto, remaining: R.rentRemaining(p.rentAmount, upto), status: R.rentStatus(p.rentAmount, upto),
    settings: await getSettings(), printedAt: nowStamp(),
  });
}));

router.delete('/payments/:id', requirePerm('unpay'), wrap(async (req, res) => {
  const p = await Payment.findById(req.params.id).lean();
  if (!p) fail(404, 'Payment not found.');
  await Payment.deleteOne({ _id: p._id });
  res.json({ message: `Payment ${p.receiptNo} (${p.unitLabel}, ${periodLabel(p.periodYear, p.periodMonth)}) deleted.` });
}));

module.exports = router;
module.exports.METHODS = METHODS;
