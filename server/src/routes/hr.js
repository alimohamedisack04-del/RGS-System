/** HR: departments, staff and salaries (admin + editor). */
const express = require('express');
const { Department, Employee } = require('../models');
const { requirePerm } = require('../lib/auth');
const { onPayroll, isActive } = require('../lib/hr');
const { wrap, period, str, parseMoney, fail, invalid, isId, validDate, round2, today, idStr } = require('../lib/util');

const router = express.Router();
const hr = requirePerm('hr');

const empOut = (e) => ({ id: idStr(e._id), departmentId: idStr(e.department), fullName: e.fullName, title: e.title || '', phone: e.phone || '',
  salary: Number(e.salary) || 0, startDate: e.startDate || '', endDate: e.endDate || '', notes: e.notes || '', active: isActive(e) });

/** Whole HR sheet: departments with their staff, totals per department and all total (for one month). */
router.get('/hr', hr, wrap(async (req, res) => {
  const [y, m] = period(req.query);
  const showLeft = req.query.showLeft === '1';
  const [deps, emps] = await Promise.all([Department.find({}).sort({ sortOrder: 1, name: 1 }).lean(), Employee.find({}).lean()]);
   const ts = (d) => (d ? new Date(d).getTime() : 0);   // createdAt is a Date in MongoDB
   const sortEmp = (a, b) => (ts(a.createdAt) - ts(b.createdAt)) || String(a._id).localeCompare(String(b._id));
     // const sortEmp = (a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') || String(a._id).localeCompare(String(b._id));
  const departments = deps.map((d) => {
    const mine = emps.filter((e) => String(e.department) === String(d._id)).sort(sortEmp);
    const paid = mine.filter((e) => onPayroll(e, y, m));
    return { id: String(d._id), name: d.name, sortOrder: d.sortOrder || 0,
      employees: mine.filter((e) => showLeft || isActive(e) || onPayroll(e, y, m)).map((e) => ({ ...empOut(e), onPayroll: onPayroll(e, y, m) })),
      staff: paid.length, total: round2(paid.reduce((a, e) => a + (Number(e.salary) || 0), 0)) };
  });
  res.json({ year: y, month: m, departments, allTotal: round2(departments.reduce((a, d) => a + d.total, 0)), staff: departments.reduce((a, d) => a + d.staff, 0), today: today() });
}));

// ---------- departments
const depName = async (b, id) => {
  const name = str(b.name, 80);
  const errors = [];
  if (!name) errors.push('Department name is required.');
  else if ((await Department.find({}).lean()).some((d) => d.name.toLowerCase() === name.toLowerCase() && String(d._id) !== String(id))) errors.push(`Department "${name}" already exists.`);
  if (errors.length) invalid(errors);
  return name.toUpperCase();
};
router.post('/hr/departments', hr, wrap(async (req, res) => {
  const name = await depName(req.body || {});
  const max = (await Department.find({}).lean()).reduce((a, d) => Math.max(a, d.sortOrder || 0), 0);
  const d = await Department.create({ name, sortOrder: max + 1 });
  res.status(201).json({ id: String(d._id), message: `Department ${name} added.` });
}));
router.put('/hr/departments/:id', hr, wrap(async (req, res) => {
  if (!isId(req.params.id) || !(await Department.findById(req.params.id).lean())) fail(404, 'Department not found.');
  const name = await depName(req.body || {}, req.params.id);
  const set = { name };
  if (req.body.sortOrder !== undefined && req.body.sortOrder !== '') set.sortOrder = parseInt(req.body.sortOrder, 10) || 0;
  await Department.updateOne({ _id: req.params.id }, { $set: set });
  res.json({ message: 'Department saved.' });
}));
router.delete('/hr/departments/:id', requirePerm('delete'), wrap(async (req, res) => {
  if (!isId(req.params.id)) fail(404, 'Department not found.');
  const d = await Department.findById(req.params.id).lean();
  if (!d) fail(404, 'Department not found.');
  if (await Employee.countDocuments({ department: d._id })) fail(422, `Department ${d.name} still has staff. Move or delete them first.`);
  await Department.deleteOne({ _id: d._id });
  res.json({ message: `Department ${d.name} deleted.` });
}));

// ---------- employees
async function readEmployee(b) {
  const d = {
    department: isId(b.departmentId) ? String(b.departmentId) : '', fullName: str(b.fullName, 150), title: str(b.title, 100), phone: str(b.phone, 30),
    salary: parseMoney(b.salary), startDate: str(b.startDate, 10) || null, endDate: str(b.endDate, 10) || null, notes: str(b.notes, 1000),
  };
  const errors = [];
  if (!d.department || !(await Department.findById(d.department).lean())) errors.push('Choose a department.');
  if (!d.fullName) errors.push('Name is required.');
  if (d.salary === null || d.salary < 0) errors.push('Salary must be a number (0 or more).');
  if (d.startDate && !validDate(d.startDate)) errors.push('Start date is not valid.');
  if (d.endDate && !validDate(d.endDate)) errors.push('Left date is not valid.');
  if (d.startDate && d.endDate && d.endDate < d.startDate) errors.push('Left date cannot be before the start date.');
  if (errors.length) invalid(errors);
  return d;
}
router.get('/hr/employees/:id', hr, wrap(async (req, res) => {
  if (!isId(req.params.id)) fail(404, 'Staff member not found.');
  const e = await Employee.findById(req.params.id).lean();
  if (!e) fail(404, 'Staff member not found.');
  res.json({ employee: empOut(e) });
}));
router.post('/hr/employees', hr, wrap(async (req, res) => {
  const d = await readEmployee(req.body || {});
  if (!d.startDate) d.startDate = today();
  const e = await Employee.create(d);
  res.status(201).json({ id: String(e._id), message: `${d.fullName} added.` });
}));
router.put('/hr/employees/:id', hr, wrap(async (req, res) => {
  if (!isId(req.params.id) || !(await Employee.findById(req.params.id).lean())) fail(404, 'Staff member not found.');
  const d = await readEmployee(req.body || {});
  await Employee.updateOne({ _id: req.params.id }, { $set: d });
  res.json({ message: `${d.fullName} saved.` });
}));
router.delete('/hr/employees/:id', requirePerm('delete'), wrap(async (req, res) => {
  if (!isId(req.params.id)) fail(404, 'Staff member not found.');
  const e = await Employee.findById(req.params.id).lean();
  if (!e) fail(404, 'Staff member not found.');
  await Employee.deleteOne({ _id: e._id });
  res.json({ message: `${e.fullName} deleted. (To keep past salary totals, set a "left" date instead of deleting.)` });
}));

module.exports = router;
