/** Malls, sections, rooms, apartments, lands. */
const express = require('express');
const { Mall, Section, Room, Apartment, Land, Tenant, Payment } = require('../models');
const { requirePerm } = require('../lib/auth');
const { loadContext } = require('../lib/data');
const R = require('../lib/rent');
const S = require('../lib/serialize');
const { tenantFromBody } = require('../lib/tenants');
const { roomMatches, pickRoom } = require('../lib/search');
const { wrap, period, str, parseMoney, oneOf, fail, invalid, isId, idOrEmpty, round2 } = require('../lib/util');

const router = express.Router();
const manage = requirePerm('manage'), del = requirePerm('delete');
const byId = async (Model, id, what) => {
  if (!isId(id)) fail(404, `${what} not found.`);
  const d = await Model.findById(id).lean();
  if (!d) fail(404, `${what} not found.`);
  return d;
};
const sortRooms = (a, b) => String(a.roomNumber).localeCompare(String(b.roomNumber), undefined, { numeric: true });

/** Sections of a mall with room statistics. */
async function mallSections(mallId, rooms = null) {
  const secs = await Section.find({ mall: mallId }).sort({ sortOrder: 1, name: 1 }).lean();
  rooms = rooms || (await Room.find({ mall: mallId }).lean());
  return secs.map((s) => {
    const rs = rooms.filter((r) => String(r.section) === String(s._id));
    const rents = rs.map((r) => r.monthlyRent);
    const occupied = rs.filter((r) => r.tenant).length;
    return { ...S.section(s), rooms: rs.length, occupied, vacant: rs.length - occupied,
      potential: round2(rents.reduce((a, b) => a + b, 0)), minRent: rents.length ? Math.min(...rents) : null, maxRent: rents.length ? Math.max(...rents) : null };
  });
}

// =================================================================== LOOKUPS (malls + sections for forms)
router.get('/lookups', wrap(async (req, res) => {
  const [malls, sections] = await Promise.all([Mall.find({}).sort({ name: 1 }).lean(), Section.find({}).sort({ sortOrder: 1, name: 1 }).lean()]);
  res.json({ malls: malls.map(S.mall), sections: sections.map(S.section) });
}));

// =================================================================== MALLS
router.get('/malls', wrap(async (req, res) => {
  const [y, m] = period(req.query);
  const ctx = await loadContext();
  const q = str(req.query.q, 100).toLowerCase();
  const malls = (await Mall.find({}).sort({ name: 1 }).lean()).filter((x) => !q || `${x.name} ${x.location}`.toLowerCase().includes(q));
  const sections = await Section.find({}).lean();
  res.json({
    year: y, month: m,
    malls: malls.map((ml) => {
      const id = String(ml._id);
      const rooms = ctx.units.filter((u) => u.unitType === 'room' && u.mallId === id && u.category !== 'hall');
      const halls = ctx.units.filter((u) => u.unitType === 'room' && u.mallId === id && u.category === 'hall');
      const occupied = rooms.filter((u) => u.tenantId).length;
      const s = R.rentSummary(R.rentRows(ctx.units, ctx.payments, y, m, { type: 'room', mallId: id }));
      const inc = R.mallIncome(ctx.units, ctx.payments, id, y, m);
      return { ...S.mall(ml), totalRooms: rooms.length, occupied, vacant: rooms.length - occupied, potential: inc.potential, potentialRooms: inc.potentialRooms, potentialHalls: inc.potentialHalls,
        halls: halls.length, hallsOccupied: halls.filter((u) => u.tenantId).length,
        sections: sections.filter((x) => String(x.mall) === id).length, expected: s.expected, paid: s.paid, remaining: s.remaining,
        collectionRate: s.collectionRate, incomeYear: inc.year };
    }),
  });
}));

router.get('/malls/:id', wrap(async (req, res) => res.json({ mall: S.mall(await byId(Mall, req.params.id, 'Mall')) })));

/** Mall page: income, sections, rooms (+ search that opens one room) */
router.get('/malls/:id/overview', wrap(async (req, res) => {
  const mall = await byId(Mall, req.params.id, 'Mall');
  const id = String(mall._id);
  const [y, m] = period(req.query);
  const ctx = await loadContext();
  const allDocs = await Room.find({ mall: id }).lean();
  const roomDocs = allDocs.filter((r) => r.category !== 'hall');
  const hallDocs = allDocs.filter((r) => r.category === 'hall').sort(sortRooms);
  const sections = await mallSections(id, roomDocs);
  let sectionId = idOrEmpty(req.query.section);
  if (sectionId && !sections.some((s) => s.id === sectionId)) sectionId = '';
  const search = str(req.query.q, 100);
  const tenants = new Map((await Tenant.find({}).lean()).map((t) => [String(t._id), t]));
  const rentRows = R.rentRows(ctx.units, ctx.payments, y, m, { type: 'room', mallId: id });
  const rentBy = new Map(rentRows.map((r) => [r.unitId, r]));
  const secName = new Map(sections.map((s) => [s.id, s]));
  let rooms = roomDocs.filter((r) => (!sectionId || String(r.section) === sectionId) && roomMatches(r, r.tenant ? tenants.get(String(r.tenant)) : null, search));
  rooms.sort((a, b) => ((secName.get(String(a.section)) || { sortOrder: 0 }).sortOrder - (secName.get(String(b.section)) || { sortOrder: 0 }).sortOrder) || sortRooms(a, b));
  const out = rooms.map((r) => {
    const t = r.tenant ? tenants.get(String(r.tenant)) : null;
    return { ...S.room(r), sectionName: r.section && secName.get(String(r.section)) ? secName.get(String(r.section)).name : null,
      tenantName: t ? t.fullName : null, tenantPhone: t ? t.phone : null, rent: rentBy.get(String(r._id)) ? S.rentRow(rentBy.get(String(r._id))) : null };
  });
  const halls = hallDocs.map((r) => {
    const t = r.tenant ? tenants.get(String(r.tenant)) : null;
    return { ...S.room(r), tenantName: t ? t.fullName : null, tenantPhone: t ? t.phone : null, rent: rentBy.get(String(r._id)) ? S.rentRow(rentBy.get(String(r._id))) : null };
  });
  const matchingHalls = search ? halls.filter((h) => roomMatches(h, h.tenantId ? tenants.get(h.tenantId) : null, search)) : [];
  const pick = search && req.query.list !== '1' ? pickRoom([...out, ...matchingHalls], search) : null;
  const scope = sectionId ? rentRows.filter((r) => r.sectionId === sectionId) : rentRows;
  const collectedBySection = {};
  for (const r of rentRows) collectedBySection[r.sectionId || ''] = round2((collectedBySection[r.sectionId || ''] || 0) + r.paid);
  res.json({
    year: y, month: m, mall: S.mall(mall), sections, sectionId: sectionId || null, search, pick,
    rooms: out, halls, totalRooms: roomDocs.length, summary: R.rentSummary(scope), collectedBySection,
    income: R.mallIncome(ctx.units, ctx.payments, id, y, m, sectionId || null),
    trend: R.rentTrend(ctx.units, ctx.payments, y, m, 6, { type: 'room', mallId: id, ...(sectionId ? { sectionId } : {}) }),
  });
}));

async function mallSave(id, b) {
  const name = str(b.name, 150), location = str(b.location, 255), description = str(b.description, 2000);
  const errors = [];
  if (!name) errors.push('Mall name is required.');
  else if ((await Mall.find({ name }).lean()).some((x) => String(x._id) !== String(id))) errors.push('A mall with this name already exists.');
  if (errors.length) invalid(errors);
  if (id) { await Mall.updateOne({ _id: id }, { $set: { name, location, description } }); return id; }
  return String((await Mall.create({ name, location, description }))._id);
}
router.post('/malls', manage, wrap(async (req, res) => {
  const id = await mallSave(null, req.body || {});
  res.status(201).json({ id, message: 'Mall created. Now add its sections or rooms.' });
}));
router.put('/malls/:id', manage, wrap(async (req, res) => {
  const mall = await byId(Mall, req.params.id, 'Mall');
  await mallSave(String(mall._id), req.body || {});
  res.json({ id: String(mall._id), message: 'Mall updated.' });
}));
router.delete('/malls/:id', del, wrap(async (req, res) => {
  const mall = await byId(Mall, req.params.id, 'Mall');
  const rooms = await Room.find({ mall: mall._id }).lean();
  await Payment.deleteMany({ unitType: 'room', unitId: { $in: rooms.map((r) => r._id) } });
  await Room.deleteMany({ mall: mall._id });
  await Section.deleteMany({ mall: mall._id });
  await Mall.deleteOne({ _id: mall._id });
  res.json({ message: `Mall "${mall.name}" and its rooms were deleted.` });
}));

// =================================================================== SECTIONS
const SECTION_NAME = /^[A-Z0-9][A-Z0-9 _.-]*$/;
async function createSectionRooms(mallId, sectionId, prefix, count, start, rent, type) {
  let created = 0, skipped = 0;
  const digits = Math.max(2, String(start + count - 1).length);
  const existing = new Set((await Room.find({ mall: mallId }).lean()).map((r) => r.roomNumber));
  const docs = [];
  for (let n = start; n < start + count; n++) {
    const number = `${prefix.toUpperCase()}-${String(n).padStart(digits, '0')}`;
    if (existing.has(number)) { skipped++; continue; }
    docs.push({ mall: mallId, section: sectionId, roomNumber: number, roomType: type, tenant: null, monthlyRent: rent });
    created++;
  }
  if (docs.length) await Room.insertMany(docs);
  return [created, skipped];
}
async function nextNumber(sectionId) {
  let max = 0;
  for (const r of await Room.find({ section: sectionId }).lean()) {
    const mm = String(r.roomNumber).match(/(\d+)\s*$/);
    if (mm) max = Math.max(max, parseInt(mm[1], 10));
  }
  return max + 1;
}

router.get('/malls/:id/sections', wrap(async (req, res) => {
  const mall = await byId(Mall, req.params.id, 'Mall');
  res.json({ mall: S.mall(mall), sections: await mallSections(mall._id) });
}));

router.post('/malls/:id/sections', manage, wrap(async (req, res) => {
  const mall = await byId(Mall, req.params.id, 'Mall');
  const b = req.body || {};
  const name = str(b.name, 50).toUpperCase(), count = parseInt(b.rooms ?? 0, 10), start = Math.max(1, parseInt(b.start ?? 1, 10) || 1);
  const rent = parseMoney(b.rent), roomType = str(b.roomType, 50) || 'Shop';
  const errors = [];
  if (!name || !SECTION_NAME.test(name)) errors.push('Section name is required (letters or numbers, e.g. A).');
  else if (await Section.findOne({ mall: mall._id, name }).lean()) errors.push(`Section ${name} already exists in this mall.`);
  if (!(count >= 0 && count <= 500)) errors.push('Number of rooms must be between 0 and 500.');
  if (count > 0 && (rent === null || rent < 0)) errors.push('Enter the monthly rent per room.');
  if (errors.length) invalid(errors);
  const maxOrder = (await Section.find({ mall: mall._id }).lean()).reduce((a, s) => Math.max(a, s.sortOrder || 0), 0);
  const sec = await Section.create({ mall: mall._id, name, description: str(b.description, 255), sortOrder: maxOrder + 1 });
  const [created, skipped] = count > 0 ? await createSectionRooms(mall._id, sec._id, name, count, start, rent, roomType) : [0, 0];
  res.status(201).json({ id: String(sec._id), message: `Section ${name} created with ${created} room(s)${skipped ? ` (${skipped} already existed and were skipped)` : ''}.` });
}));

router.get('/sections/:id', wrap(async (req, res) => {
  const sec = await byId(Section, req.params.id, 'Section');
  const mall = await Mall.findById(sec.mall).lean();
  const stats = (await mallSections(sec.mall)).find((s) => s.id === String(sec._id));
  res.json({ section: stats, mall: S.mall(mall), nextNumber: await nextNumber(sec._id) });
}));

router.put('/sections/:id', manage, wrap(async (req, res) => {
  const sec = await byId(Section, req.params.id, 'Section');
  const b = req.body || {};
  if (b.action === 'details') {
    const name = str(b.name, 50).toUpperCase();
    const errors = [];
    if (!name || !SECTION_NAME.test(name)) errors.push('Section name is required (letters or numbers).');
    else if ((await Section.find({ mall: sec.mall, name }).lean()).some((x) => String(x._id) !== String(sec._id))) errors.push('Another section already uses this name.');
    if (errors.length) invalid(errors);
    await Section.updateOne({ _id: sec._id }, { $set: { name, description: str(b.description, 255), sortOrder: parseInt(b.sortOrder, 10) || 0 } });
    return res.json({ message: 'Section saved. (Room numbers were not changed.)' });
  }
  if (b.action === 'rent') {
    const rent = parseMoney(b.rent);
    if (rent === null || rent < 0) invalid(['Enter a valid monthly rent.']);
    const f = b.scope === 'vacant' ? { section: sec._id, tenant: null } : { section: sec._id };
    const n = await Room.countDocuments(f);
    await Room.updateMany(f, { $set: { monthlyRent: rent } });
    return res.json({ message: `Rent set to $${rent.toFixed(2)} for ${n} room(s) in section ${sec.name}. Months already paid keep their old rent.` });
  }
  if (b.action === 'rooms') {
    const count = parseInt(b.rooms, 10), rent = parseMoney(b.rent), start = Math.max(1, parseInt(b.start, 10) || (await nextNumber(sec._id)));
    const errors = [];
    if (!(count >= 1 && count <= 500)) errors.push('Number of rooms must be between 1 and 500.');
    if (rent === null || rent < 0) errors.push('Enter the monthly rent per room.');
    if (errors.length) invalid(errors);
    const [created, skipped] = await createSectionRooms(sec.mall, sec._id, sec.name, count, start, rent, str(b.roomType, 50) || 'Shop');
    return res.json({ message: `${created} room(s) added to section ${sec.name}${skipped ? ` (${skipped} already existed and were skipped)` : ''}.` });
  }
  fail(422, 'Unknown action.');
}));

router.delete('/sections/:id', del, wrap(async (req, res) => {
  const sec = await byId(Section, req.params.id, 'Section');
  await Room.updateMany({ section: sec._id }, { $set: { section: null } });
  await Section.deleteOne({ _id: sec._id });
  res.json({ mallId: String(sec.mall), message: `Section ${sec.name} deleted. Its rooms are still in the mall (without a section).` });
}));

// =================================================================== ROOMS
router.get('/rooms', wrap(async (req, res) => {
  const [y, m] = period(req.query);
  const q = req.query;
  const search = str(q.q, 100), mallId = idOrEmpty(q.mallId);
  let sectionId = idOrEmpty(q.sectionId);
  const status = oneOf(q.status, ['occupied', 'vacant']), pay = oneOf(q.pay, ['paid', 'partial', 'unpaid']), category = oneOf(q.category, ['room', 'hall']);
  const [malls, sections, tenantsL, ctx] = await Promise.all([Mall.find({}).sort({ name: 1 }).lean(), Section.find({}).sort({ sortOrder: 1, name: 1 }).lean(), Tenant.find({}).lean(), loadContext()]);
  if (sectionId && mallId && !sections.some((s) => String(s._id) === sectionId && String(s.mall) === mallId)) sectionId = '';
  const tenants = new Map(tenantsL.map((t) => [String(t._id), t]));
  const M = new Map(malls.map((x) => [String(x._id), x])), SEC = new Map(sections.map((x) => [String(x._id), x]));
  const rentBy = new Map(R.rentRows(ctx.units, ctx.payments, y, m, { type: 'room' }).map((r) => [r.unitId, r]));
  let rooms = (await Room.find(mallId ? { mall: mallId } : {}).lean()).filter((r) => {
    const t = r.tenant ? tenants.get(String(r.tenant)) : null;
    if (sectionId && String(r.section) !== sectionId) return false;
    if (category && (r.category || 'room') !== category) return false;
    if (status === 'occupied' && !r.tenant) return false;
    if (status === 'vacant' && r.tenant) return false;
    if (pay && !(rentBy.get(String(r._id)) && rentBy.get(String(r._id)).payStatus === pay)) return false;
    return roomMatches(r, t, search);
  });
  rooms.sort((a, b) => String((M.get(String(a.mall)) || {}).name).localeCompare(String((M.get(String(b.mall)) || {}).name))
    || ((SEC.get(String(a.section)) || { sortOrder: 0 }).sortOrder - (SEC.get(String(b.section)) || { sortOrder: 0 }).sortOrder)
    || sortRooms(a, b));
  const shape = (r) => {
    const t = r.tenant ? tenants.get(String(r.tenant)) : null, sec = r.section ? SEC.get(String(r.section)) : null;
    return { ...S.room(r), mallName: (M.get(String(r.mall)) || {}).name || '', sectionName: sec ? sec.name : null,
      tenantName: t ? t.fullName : null, tenantPhone: t ? t.phone : null, rent: rentBy.get(String(r._id)) ? S.rentRow(rentBy.get(String(r._id))) : null };
  };
  const all = rooms.map(shape);
  const pick = search && q.list !== '1' ? pickRoom(all, search) : null;
  const per = 50, page = Math.max(1, parseInt(q.page, 10) || 1);
  res.json({
    year: y, month: m, total: all.length, page, pages: Math.max(1, Math.ceil(all.length / per)), pick,
    rooms: all.slice((page - 1) * per, page * per),
    malls: malls.map(S.mall), sections: sections.filter((s) => !mallId || String(s.mall) === mallId).map((s) => ({ ...S.section(s), mallName: (M.get(String(s.mall)) || {}).name })),
    sectionId: sectionId || null,
  });
}));

router.get('/rooms/:id', wrap(async (req, res) => {
  const r = await byId(Room, req.params.id, 'Room');
  const [mall, sec, t] = await Promise.all([Mall.findById(r.mall).lean(), r.section ? Section.findById(r.section).lean() : null, r.tenant ? Tenant.findById(r.tenant).lean() : null]);
  res.json({ room: S.room(r), mall: S.mall(mall), section: S.section(sec), tenant: S.tenant(t) });
}));

async function roomSave(id, b) {
  const category = oneOf(b.category, ['room', 'hall'], 'room');
  const raw = str(b.roomNumber, 30);
  // Halls are named "Hall A", "Hall B" … (typing "A" or "hall a" gives "Hall A")
  const number = category === 'hall' ? (raw ? 'Hall ' + raw.replace(/^hall\s*/i, '').toUpperCase() : '') : raw.toUpperCase();
  const mallId = idOrEmpty(b.mallId), rent = parseMoney(b.monthlyRent);
  const sectionId = category === 'hall' ? '' : idOrEmpty(b.sectionId);
  const errors = [];
  if (!mallId || !(await Mall.findById(mallId).lean())) errors.push('Please select a mall.');
  if (!number) errors.push(category === 'hall' ? 'Hall name is required (e.g. Hall A).' : 'Room number is required.');
  if (rent === null || rent < 0) errors.push('Monthly rent must be a number (0 or more).');
  if (sectionId) {
    const sec = await Section.findById(sectionId).lean();
    if (!sec || String(sec.mall) !== mallId) errors.push('The selected section does not belong to this mall.');
  }
  if (mallId && number && (await Room.find({ mall: mallId, roomNumber: number }).lean()).some((x) => String(x._id) !== String(id))) {
    errors.push(`${number.startsWith('Hall') ? '' : 'Room '}${number} already exists in this mall.`);
  }
  if (errors.length) invalid(errors);
  const doc = { mall: mallId, section: sectionId || null, category, roomNumber: number, roomType: str(b.roomType, 50), monthlyRent: rent, notes: str(b.notes, 2000), tenant: await tenantFromBody(b) };
  if (id) { await Room.updateOne({ _id: id }, { $set: doc }); return id; }
  return String((await Room.create(doc))._id);
}
router.post('/rooms', manage, wrap(async (req, res) => res.status(201).json({ id: await roomSave(null, req.body || {}), message: 'Room saved.' })));
router.put('/rooms/:id', manage, wrap(async (req, res) => {
  const r = await byId(Room, req.params.id, 'Room');
  res.json({ id: await roomSave(String(r._id), req.body || {}), message: 'Room saved.' });
}));
router.delete('/rooms/:id', del, wrap(async (req, res) => {
  const r = await byId(Room, req.params.id, 'Room');
  await Payment.deleteMany({ unitType: 'room', unitId: r._id });
  await Room.deleteOne({ _id: r._id });
  res.json({ mallId: String(r.mall), message: `Room ${r.roomNumber} deleted.` });
}));

// =================================================================== APARTMENTS
async function unitListing(type, req) {
  const [y, m] = period(req.query);
  const ctx = await loadContext();
  const rentBy = new Map(R.rentRows(ctx.units, ctx.payments, y, m, { type }).map((r) => [r.unitId, r]));
  return { y, m, ctx, rentBy };
}
router.get('/apartments', wrap(async (req, res) => {
  const { y, m, ctx, rentBy } = await unitListing('apartment', req);
  const q = str(req.query.q, 100).toLowerCase(), status = oneOf(req.query.status, ['occupied', 'vacant']),
    pay = oneOf(req.query.pay, ['paid', 'partial', 'unpaid']), building = str(req.query.building, 150);
  const units = ctx.units.filter((u) => u.unitType === 'apartment')
    .filter((u) => (!status || u.status === status) && (!building || u.location === building)
      && (!pay || (rentBy.get(u.unitId) && rentBy.get(u.unitId).payStatus === pay))
      && (!q || `${u.code} ${u.location} ${u.kind} ${u.tenantName || ''} ${u.tenantPhone || ''}`.toLowerCase().includes(q)))
    .sort((a, b) => a.location.localeCompare(b.location) || a.code.localeCompare(b.code, undefined, { numeric: true }));
  const buildings = [...new Set(ctx.units.filter((u) => u.unitType === 'apartment').map((u) => u.location))].sort();
  res.json({ year: y, month: m, buildings, apartments: units.map((u) => ({ ...S.unit(u), rent: u.rent, rentRow: rentBy.get(u.unitId) ? S.rentRow(rentBy.get(u.unitId)) : null })) });
}));
router.get('/apartments/:id', wrap(async (req, res) => {
  const a = await byId(Apartment, req.params.id, 'Apartment');
  const t = a.tenant ? await Tenant.findById(a.tenant).lean() : null;
  const buildings = [...new Set((await Apartment.find({}).lean()).map((x) => x.building))].sort();
  res.json({ apartment: S.apartment(a), tenant: S.tenant(t), buildings });
}));
async function aptSave(id, b) {
  const number = str(b.apartmentNumber, 30), building = str(b.building, 150), rent = parseMoney(b.monthlyRent);
  const errors = [];
  if (!number) errors.push('Apartment number is required.');
  if (!building) errors.push('Building / location is required.');
  if (rent === null || rent < 0) errors.push('Monthly rent must be a number (0 or more).');
  if (number && building && (await Apartment.find({ apartmentNumber: number, building }).lean()).some((x) => String(x._id) !== String(id))) errors.push(`Apartment ${number} already exists in ${building}.`);
  if (errors.length) invalid(errors);
  const doc = { apartmentNumber: number, building, apartmentType: str(b.apartmentType, 50), monthlyRent: rent, notes: str(b.notes, 2000), tenant: await tenantFromBody(b) };
  if (id) { await Apartment.updateOne({ _id: id }, { $set: doc }); return id; }
  return String((await Apartment.create(doc))._id);
}
router.post('/apartments', manage, wrap(async (req, res) => res.status(201).json({ id: await aptSave(null, req.body || {}), message: 'Apartment saved.' })));
router.put('/apartments/:id', manage, wrap(async (req, res) => {
  const a = await byId(Apartment, req.params.id, 'Apartment');
  res.json({ id: await aptSave(String(a._id), req.body || {}), message: 'Apartment saved.' });
}));
router.delete('/apartments/:id', del, wrap(async (req, res) => {
  const a = await byId(Apartment, req.params.id, 'Apartment');
  await Payment.deleteMany({ unitType: 'apartment', unitId: a._id });
  await Apartment.deleteOne({ _id: a._id });
  res.json({ message: `Apartment ${a.apartmentNumber} deleted.` });
}));

// =================================================================== LANDS
const LAND_STATUSES = ['available', 'rented', 'sold', 'reserved'], LAND_PERIODS = ['monthly', 'annual', 'total'], LAND_UNITS = ['m', 'sq m', 'acre', 'hectare', 'plot'];
router.get('/lands', wrap(async (req, res) => {
  const { y, m, rentBy } = await unitListing('land', req);
  const q = str(req.query.q, 100).toLowerCase(), status = oneOf(req.query.status, LAND_STATUSES);
  const tenants = new Map((await Tenant.find({}).lean()).map((t) => [String(t._id), t]));
  const lands = (await Land.find({}).lean()).filter((l) => {
    const t = l.tenant ? tenants.get(String(l.tenant)) : null;
    return (!status || l.status === status) && (!q || `${l.name} ${l.location} ${l.ownerName} ${l.ownerPhone} ${t ? t.fullName + ' ' + t.phone : ''}`.toLowerCase().includes(q));
  }).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  res.json({
    year: y, month: m,
    lands: lands.map((l) => { const t = l.tenant ? tenants.get(String(l.tenant)) : null; return { ...S.land(l), tenantName: t ? t.fullName : null, tenantPhone: t ? t.phone : null, rentRow: rentBy.get(String(l._id)) ? S.rentRow(rentBy.get(String(l._id))) : null }; }),
  });
}));
router.get('/lands/:id', wrap(async (req, res) => {
  const l = await byId(Land, req.params.id, 'Land');
  const t = l.tenant ? await Tenant.findById(l.tenant).lean() : null;
  res.json({ land: S.land(l), tenant: S.tenant(t) });
}));
async function landSave(id, b) {
  const d = {
    name: str(b.name, 150), location: str(b.location, 150), size: str(b.size, 50), sizeUnit: oneOf(b.sizeUnit, LAND_UNITS, 'm'),
    amount: parseMoney(b.amount), amountPeriod: oneOf(b.amountPeriod, LAND_PERIODS, 'monthly'), ownerName: str(b.ownerName, 150),
    ownerPhone: str(b.ownerPhone, 30), status: oneOf(b.status, LAND_STATUSES, 'available'), notes: str(b.notes, 2000),
  };
  const errors = [];
  if (!d.name) errors.push('Plot / property name is required.');
  if (d.amount === null || d.amount < 0) errors.push('Amount must be a number (0 or more).');
  if (errors.length) invalid(errors);
  const hasPick = str(b.newTenantName) || (isId(b.tenantId) && (await Tenant.findById(b.tenantId).lean()));
  if (d.status === 'rented' && !hasPick && !d.ownerName) invalid(['A rented land needs a tenant (select or add one) or a tenant/owner name.']);
  d.tenant = ['rented', 'reserved'].includes(d.status) ? await tenantFromBody(b) : null;
  if (id) { await Land.updateOne({ _id: id }, { $set: d }); return id; }
  return String((await Land.create(d))._id);
}
router.post('/lands', manage, wrap(async (req, res) => res.status(201).json({ id: await landSave(null, req.body || {}), message: 'Land saved.' })));
router.put('/lands/:id', manage, wrap(async (req, res) => {
  const l = await byId(Land, req.params.id, 'Land');
  res.json({ id: await landSave(String(l._id), req.body || {}), message: 'Land saved.' });
}));
router.delete('/lands/:id', del, wrap(async (req, res) => {
  const l = await byId(Land, req.params.id, 'Land');
  await Payment.deleteMany({ unitType: 'land', unitId: l._id });
  await Land.deleteOne({ _id: l._id });
  res.json({ message: `Land "${l.name}" deleted.` });
}));

module.exports = router;
