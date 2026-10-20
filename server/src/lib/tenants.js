/** Tenant helpers shared by rooms, apartments and lands forms. */
const { Tenant, Room, Apartment, Land } = require('../models');
const { str, today, isId } = require('./util');

/**
 * Tenant chosen in a form: a new name creates a new tenant, otherwise the selected existing one.
 * Returns tenant id (string) or null (vacant).
 */
async function tenantFromBody(b) {
  const name = str(b.newTenantName, 150);
  if (name) {
    const t = await Tenant.create({ fullName: name, phone: str(b.newTenantPhone, 30), startDate: today() });
    return String(t._id);
  }
  if (isId(b.tenantId) && (await Tenant.findById(b.tenantId).lean())) return String(b.tenantId);
  return null;
}

async function assignTenant(tenantId, type, unitId) {
  if (type === 'room') await Room.updateOne({ _id: unitId }, { $set: { tenant: tenantId } });
  else if (type === 'apartment') await Apartment.updateOne({ _id: unitId }, { $set: { tenant: tenantId } });
  else if (type === 'land') await Land.updateOne({ _id: unitId }, { $set: { tenant: tenantId, status: 'rented' } });
}

/** Free one unit (or all units) of a tenant. */
async function releaseTenant(tenantId, type = null, unitId = null) {
  const one = (t) => !type || type === t;
  const f = (extra = {}) => (unitId ? { _id: unitId, tenant: tenantId, ...extra } : { tenant: tenantId, ...extra });
  if (one('room')) await Room.updateMany(f(), { $set: { tenant: null } });
  if (one('apartment')) await Apartment.updateMany(f(), { $set: { tenant: null } });
  if (one('land')) {
    await Land.updateMany(f({ status: 'rented' }), { $set: { tenant: null, status: 'available' } });
    await Land.updateMany(f(), { $set: { tenant: null } });
  }
}

module.exports = { tenantFromBody, assignTenant, releaseTenant };
