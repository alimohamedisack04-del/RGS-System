/** Expenses: only a name and a price; the date is today. */
const express = require('express');
const { Expense } = require('../models');
const { requirePerm } = require('../lib/auth');
const { loadContext } = require('../lib/data');
const S = require('../lib/serialize');
const { userMap } = require('../lib/users');
const { monthFinance } = require('../lib/finance');
const { wrap, period, str, parseMoney, fail, invalid, isId, today, monthStart, monthEnd } = require('../lib/util');

const router = express.Router();

function readExpense(b) {
  const name = str(b.name, 150), amount = parseMoney(b.amount);
  const errors = [];
  if (!name) errors.push('Write the name of the expense.');
  if (amount === null || amount <= 0) errors.push('Write a price greater than 0.');
  else if (amount > 9999999999) errors.push('The price is too large.');
  if (errors.length) invalid(errors);
  return { name, amount };
}

router.get('/expenses', requirePerm('expense'), wrap(async (req, res) => {
  const [y, m] = period(req.query);
  const q = str(req.query.q, 100).toLowerCase();
  const all = await Expense.find({ expenseDate: { $gte: monthStart(y, m), $lte: monthEnd(y, m) } }).lean();
  const list = all.filter((x) => !q || x.name.toLowerCase().includes(q))
    .sort((a, b) => b.expenseDate.localeCompare(a.expenseDate) || String(b._id).localeCompare(String(a._id)));
  const f = await monthFinance(await loadContext(), y, m);
  const users = await userMap();
  res.json({ year: y, month: m, expenses: list.map((x) => S.expense(x, users)), total: f.expenses, collected: f.collected, salaries: f.salaries, net: f.net, finance: f, today: today() });
}));

router.get('/expenses/:id', requirePerm('manage'), wrap(async (req, res) => {
  if (!isId(req.params.id)) fail(404, 'Expense not found.');
  const x = await Expense.findById(req.params.id).lean();
  if (!x) fail(404, 'Expense not found.');
  res.json({ expense: S.expense(x) });
}));

router.post('/expenses', requirePerm('expense'), wrap(async (req, res) => {
  const d = readExpense(req.body || {});
  const x = await Expense.create({ ...d, expenseDate: today(), createdBy: req.user._id });
  res.status(201).json({ id: String(x._id), message: `Expense "${d.name}" ($${d.amount.toFixed(2)}) saved.` });
}));

router.put('/expenses/:id', requirePerm('manage'), wrap(async (req, res) => {
  if (!isId(req.params.id)) fail(404, 'Expense not found.');
  const x = await Expense.findById(req.params.id).lean();
  if (!x) fail(404, 'Expense not found.');
  await Expense.updateOne({ _id: x._id }, { $set: readExpense(req.body || {}) });
  res.json({ message: 'Expense updated.', expenseDate: x.expenseDate });
}));

router.delete('/expenses/:id', requirePerm('delete'), wrap(async (req, res) => {
  if (!isId(req.params.id)) fail(404, 'Expense not found.');
  const x = await Expense.findById(req.params.id).lean();
  if (!x) fail(404, 'Expense not found.');
  await Expense.deleteOne({ _id: x._id });
  res.json({ message: `Expense "${x.name}" deleted.`, expenseDate: x.expenseDate });
}));

module.exports = router;
