/** Load data from MongoDB into the plain shapes used by the rent engine. */
const { Room, Apartment, Land, Tenant, Mall, Section, Payment } = require('../models');
const { makeLabel } = require('./rent');
const { idStr } = require('./util');

/** All rentable units (rooms + apartments + lands) with tenant details. */
async function loadUnits() {
  const [rooms, apts, lands, tenants, malls, sections] = await Promise.all([
    Room.find({}).lean(), Apartment.find({}).lean(), Land.find({}).lean(),
    Tenant.find({}).lean(), Mall.find({}).lean(), Section.find({}).lean(),
  ]);
  return buildUnits({ rooms, apts, lands, tenants, malls, sections });
}

function buildUnits({ rooms, apts, lands, tenants, malls, sections }) {
  const T = new Map(tenants.map((t) => [String(t._id), t]));
  const M = new Map(malls.map((x) => [String(x._id), x]));
  const S = new Map(sections.map((x) => [String(x._id), x]));
  const units = [];
  const tenantOf = (id) => (id ? T.get(String(id)) : null);
  for (const r of rooms) {
    const t = tenantOf(r.tenant), ml = M.get(String(r.mall)), sec = r.section ? S.get(String(r.section)) : null;
    if (!ml) continue;
    units.push({
      unitType: 'room', unitId: String(r._id), code: r.roomNumber, kind: r.roomType || '', mallId: String(r.mall), category: r.category || 'room',
      sectionId: sec ? String(sec._id) : null, sectionName: sec ? sec.name : null, sectionOrder: sec ? sec.sortOrder : 0,
      location: ml.name, rent: Number(r.monthlyRent) || 0, tenantId: t ? String(t._id) : null,
      tenantName: t ? t.fullName : null, tenantPhone: t ? t.phone : null, tenantStart: t ? t.startDate : null,
      status: t ? 'occupied' : 'vacant', isLet: !!t, label: makeLabel('room', r.roomNumber, ml.name),
    });
  }
  for (const a of apts) {
    const t = tenantOf(a.tenant);
    units.push({
      unitType: 'apartment', unitId: String(a._id), code: a.apartmentNumber, kind: a.apartmentType || '', mallId: null,
      sectionId: null, sectionName: null, location: a.building, rent: Number(a.monthlyRent) || 0,
      tenantId: t ? String(t._id) : null, tenantName: t ? t.fullName : null, tenantPhone: t ? t.phone : null,
      tenantStart: t ? t.startDate : null, status: t ? 'occupied' : 'vacant', isLet: !!t,
      label: makeLabel('apartment', a.apartmentNumber, a.building),
    });
  }
  for (const l of lands) {
    const t = tenantOf(l.tenant);
    units.push({
      unitType: 'land', unitId: String(l._id), code: l.name, kind: l.size || '', mallId: null, sectionId: null, sectionName: null,
      location: l.location, rent: Number(l.amount) || 0, tenantId: t ? String(t._id) : null,
      tenantName: t ? t.fullName : (l.ownerName || null), tenantPhone: t ? t.phone : (l.ownerPhone || null),
      tenantStart: t ? t.startDate : null, status: l.status, isLet: l.status === 'rented' && l.amountPeriod === 'monthly',
      label: makeLabel('land', l.name, l.location),
    });
  }
  return units;
}

async function loadPayments(filter = {}) {
  return Payment.find(filter).lean();
}

/** Everything the rent engine needs. */
async function loadContext() {
  const [units, payments, malls] = await Promise.all([loadUnits(), loadPayments(), Mall.find({}).lean()]);
  return { units, payments, malls };
}

async function findUnit(type, id) {
  const units = await loadUnits();
  return units.find((u) => u.unitType === type && u.unitId === idStr(id)) || null;
}

/** "room:<id>" -> {type, id} */
function parseUnitKey(v) {
  const m = String(v || '').match(/^(room|apartment|land):([A-Za-z0-9]+)$/);
  return m ? { type: m[1], id: m[2] } : null;
}

module.exports = { loadUnits, buildUnits, loadPayments, loadContext, findUnit, parseUnitKey };
