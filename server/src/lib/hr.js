/** HR helpers: monthly salary cost. */
const { Employee } = require('../models');
const { monthStart, monthEnd, round2, today } = require('./util');

/** Is this employee on the payroll in year/month? (started on or before the month end, not left before the month start) */
const onPayroll = (e, y, m) => (!e.startDate || e.startDate <= monthEnd(y, m)) && (!e.endDate || e.endDate >= monthStart(y, m));
const isActive = (e) => !e.endDate || e.endDate >= today();

/** Total salaries for a month. */
async function salaryTotal(y, m) {
  const list = await Employee.find({}).lean();
  return round2(list.filter((e) => onPayroll(e, y, m)).reduce((a, e) => a + (Number(e.salary) || 0), 0));
}

module.exports = { onPayroll, isActive, salaryTotal };
