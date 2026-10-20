/** Tenants */
const express = require('express');
const { Tenant, Payment } = require('../models');
const { requirePerm } = require('../lib/auth');
const { loadUnits, parseUnitKey } = require('../lib/data');
const { assignTenant, releaseTenant } = require('../lib/tenants');
const S = require('../lib/serialize');
const { userMap } = require('../lib/users');
const { wrap, str, oneOf, fail, invalid, isId, validDate } = require('../lib/util');

const router = express.Router();
const byId = async (id) => {
  if (!isId(id)) fail(404, 'Tenant not found.');
  const t = await Tenant.findById(id).lean();
  if (!t) fail(404, 'Tenant not found.');
  return t;
};

router.get('/tenants', wrap(async (req, res) => {
  const q = str(req.query.q, 100).toLowerCase(), type = oneOf(req.query.type, ['room', 'apartment', 'land']);
  const units = await loadUnits();
  const byTenant = new Map();
  for (const u of units) if (u.tenantId) byTenant.set(u.tenantId, [...(byTenant.get(u.tenantId) || []), S.unit(u)]);
  const list = (await Tenant.find({}).sort({ fullName: 1 }).lean()).map((t) => ({ ...S.tenant(t), units: byTenant.get(String(t._id)) || [] }))
    .filter((t) => (!type || t.units.some((u) => u.unitType === type))
      && (!q || `${t.fullName} ${t.phone} ${t.email} ${t.units.map((u) => u.label).join(' ')}`.toLowerCase().includes(q)));
  res.json({ tenants: list });
}));

router.get('/tenants/options', wrap(async (req, res) => {
  res.json({ tenants: (await Tenant.find({}).sort({ fullName: 1 }).lean()).map((t) => ({ id: String(t._id), fullName: t.fullName, phone: t.phone || '' })) });
}));

router.get('/tenants/:id', wrap(async (req, res) => {
  const t = await byId(req.params.id);
  const units = (await loadUnits()).filter((u) => u.tenantId === String(t._id)).map(S.unit);
  const users = await userMap();
  const pays = (await Payment.find({ tenant: t._id }).lean()).sort((a, b) => b.paymentDate.localeCompare(a.paymentDate) || String(b._id).localeCompare(String(a._id)));
  res.json({ tenant: S.tenant(t), units, payments: pays.slice(0, 50).map((p) => S.payment(p, users)), totalPaid: pays.reduce((a, p) => a + p.amountPaid, 0) });
}));

async function tenantSave(id, b) {
  const d = { fullName: str(b.fullName, 150), phone: str(b.phone, 30), email: str(b.email, 150), address: str(b.address, 255), startDate: str(b.startDate, 10) || null, notes: str(b.notes, 2000) };
  const errors = [];
  if (!d.fullName) errors.push('Full name is required.');
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) errors.push('Email address is not valid.');
  if (d.startDate && !validDate(d.startDate)) errors.push('Start date is not valid.');
  let assign = null;
  if (b.assignUnit) {
    assign = parseUnitKey(b.assignUnit);
    const u = assign ? (await loadUnits()).find((x) => x.unitType === assign.type && x.unitId === assign.id) : null;
    if (!u) errors.push('Selected unit was not found.');
    else if (u.tenantId) errors.push('Selected unit already has a tenant.');
  }
  if (errors.length) invalid(errors);
  if (id) await Tenant.updateOne({ _id: id }, { $set: d });
  else id = String((await Tenant.create(d))._id);
  if (assign) await assignTenant(id, assign.type, assign.id);
  return id;
}
router.post('/tenants', requirePerm('manage'), wrap(async (req, res) => res.status(201).json({ id: await tenantSave(null, req.body || {}), message: 'Tenant saved.' })));
router.put('/tenants/:id', requirePerm('manage'), wrap(async (req, res) => {
  const t = await byId(req.params.id);
  res.json({ id: await tenantSave(String(t._id), req.body || {}), message: 'Tenant updated.' });
}));

/** Move out: remove the tenant from one unit */
router.post('/tenants/:id/release', requirePerm('manage'), wrap(async (req, res) => {
  const t = await byId(req.params.id);
  const k = parseUnitKey(req.body && req.body.unit);
  if (!k) fail(422, 'Unit not found.');
  await releaseTenant(t._id, k.type, k.id);
  res.json({ message: 'Tenant removed from the unit. The unit is now vacant.' });
}));

router.delete('/tenants/:id', requirePerm('delete'), wrap(async (req, res) => {
  const t = await byId(req.params.id);
  await releaseTenant(t._id);
  await Payment.updateMany({ tenant: t._id }, { $set: { tenant: null } });
  await Tenant.deleteOne({ _id: t._id });
  res.json({ message: `Tenant "${t.fullName}" deleted. Their units are now vacant; payment history was kept.` });
}));

module.exports = router;
