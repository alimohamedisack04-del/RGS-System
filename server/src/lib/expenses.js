const { Expense } = require('../models');
const { monthStart, monthEnd, round2 } = require('./util');
/** Total expenses of a month. */
async function expenseTotal(y, m) {
  const list = await Expense.find({ expenseDate: { $gte: monthStart(y, m), $lte: monthEnd(y, m) } }).lean();
  return round2(list.reduce((a, x) => a + x.amount, 0));
}
module.exports = { expenseTotal };
