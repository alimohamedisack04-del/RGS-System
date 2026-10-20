/** Profit / loss of a month: rent collected − expenses − staff salaries (one formula used everywhere). */
const R = require('./rent');
const { expenseTotal } = require('./expenses');
const { salaryTotal } = require('./hr');
const { round2 } = require('./util');

/** ctx = loadContext() result. Every expense dated in the month and every salary on the payroll that month is subtracted. */
async function monthFinance(ctx, y, m) {
  const collected = R.rentSummary(R.rentRows(ctx.units, ctx.payments, y, m)).paid;
  const [expenses, salaries] = await Promise.all([expenseTotal(y, m), salaryTotal(y, m)]);
  const costs = round2(expenses + salaries);
  const net = round2(collected - costs);
  return { collected, expenses, salaries, costs, net, result: net > 0 ? 'profit' : net < 0 ? 'loss' : 'even' };
}

module.exports = { monthFinance };
