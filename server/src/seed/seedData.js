/**
 * Demo data (same as the PHP version's database.sql): Mumtaaz Mall with sections A–H (205 rooms) + Hall A and Hall B,
 * 8 apartments, 4 lands, 11 tenants, 6 months of payments, expenses and 4 users.
 * Dates are calculated from today, so the dashboard always has a current month and history.
 */
const data = require('./demo-data.json');
const M = require('../models');
const { hashPassword } = require('../lib/auth');
const { currentPeriod, shiftMonth, daysIn, pad, today } = require('../lib/util');

const PASSWORDS = { admin: 'Admin@123', editor: 'Editor@123', cashier: 'Cashier@123' };
const HALLS = ['Hall A', 'Hall B'];
const HR = [
  ['MANAGEMENT', [['Abdirahman Hassan Ali', 'General Manager', '+252 61 520 0001', 500], ['Faadumo Ahmed Nur', 'Accountant', '+252 61 520 0002', 400], ['Mohamed Abdi Warsame', 'Mall Supervisor', '+252 61 520 0003', 350], ['Hibo Yusuf Omar', 'Office Administrator', '+252 61 520 0004', 300]]],
  ['SECURITY', [['Ali Osman Farah', 'Head of Security', '+252 61 520 0011', 250], ['Abdullahi Nur Aden', 'Security Guard', '+252 61 520 0012', 200], ['Hassan Ibrahim Mohamed', 'Security Guard', '+252 61 520 0013', 200], ['Yusuf Ahmed Jama', 'Night Guard', '+252 61 520 0014', 200]]],
  ['CLEANING', [['Halima Abdi Hassan', 'Cleaner', '+252 61 520 0021', 150], ['Sahra Mohamed Ali', 'Cleaner', '+252 61 520 0022', 150], ['Ismail Omar Nur', 'Cleaner', '+252 61 520 0023', 150]]],
];
const HALL_RENT = 500;   // example monthly rent for each hall

function dateMonthsAgo(n, day) {
  if (day === 'today') return today();
  const [cy, cm] = currentPeriod();
  const [y, m] = shiftMonth(cy, cm, -n);
  return `${y}-${pad(m)}-${pad(Math.min(day, daysIn(y, m)))}`;
}

async function seedDemo() {
  for (const Model of [M.User, M.Setting, M.Mall, M.Section, M.Room, M.Apartment, M.Land, M.Tenant, M.Payment, M.Expense, M.Department, M.Employee, M.MonthClosing, M.LoginAttempt, M.Counter]) {
    await Model.deleteMany({});
  }
  const ids = { users: {}, malls: {}, sections: {}, rooms: {}, apartments: {}, lands: {}, tenants: {} };
  const keep = (map, oldId, doc) => { map[oldId] = doc._id; return doc; };

  for (const u of data.users) {
    keep(ids.users, u.id, await M.User.create({ fullName: u.full_name, username: u.username, email: u.email || '', role: u.role, passwordHash: hashPassword(PASSWORDS[u.role]), isActive: true }));
  }
  for (const [key, value] of Object.entries(data.settings)) await M.Setting.create({ key, value: value || '' });
  for (const t of data.tenants) {
    keep(ids.tenants, t.id, await M.Tenant.create({ fullName: t.full_name, phone: t.phone || '', email: t.email || '', address: t.address || '', notes: t.notes || '', startDate: dateMonthsAgo(t.start_months_ago, t.start_day) }));
  }
  for (const x of data.malls) keep(ids.malls, x.id, await M.Mall.create({ name: x.name, location: x.location || '', description: x.description || '' }));
  for (const s of data.sections) keep(ids.sections, s.id, await M.Section.create({ mall: ids.malls[s.mall_id], name: s.name, description: s.description || '', sortOrder: s.sort_order }));
  const rooms = await M.Room.insertMany(data.rooms.map((r) => ({
    mall: ids.malls[r.mall_id], section: r.section_id ? ids.sections[r.section_id] : null, roomNumber: r.room_number, roomType: r.room_type || '',
    tenant: r.tenant_id ? ids.tenants[r.tenant_id] : null, monthlyRent: r.monthly_rent,
  })));
  data.rooms.forEach((r, i) => { ids.rooms[r.id] = rooms[i]._id; });
  // Mumtaaz Mall halls: Hall A and Hall B (rented monthly like rooms; rent is an example - change it in Edit)
  const mumtaaz = data.malls.find((m) => /mumtaaz|mumtaz/i.test(m.name));
  if (mumtaaz) {
    await M.Room.insertMany(HALLS.map((h) => ({ mall: ids.malls[mumtaaz.id], section: null, category: 'hall', roomNumber: h, roomType: 'Hall', tenant: null, monthlyRent: HALL_RENT })));
  }
  for (const a of data.apartments) {
    keep(ids.apartments, a.id, await M.Apartment.create({ apartmentNumber: a.apartment_number, building: a.building, apartmentType: a.apartment_type || '', tenant: a.tenant_id ? ids.tenants[a.tenant_id] : null, monthlyRent: a.monthly_rent }));
  }
  for (const l of data.lands) {
    keep(ids.lands, l.id, await M.Land.create({ name: l.name, location: l.location || '', size: l.size || '', sizeUnit: l.size_unit || 'm', amount: l.amount, amountPeriod: l.amount_period,
      tenant: l.tenant_id ? ids.tenants[l.tenant_id] : null, ownerName: l.owner_name || '', ownerPhone: l.owner_phone || '', status: l.status, notes: l.notes || '' }));
  }
  // labels like the PHP version
  const tenantName = new Map(data.tenants.map((t) => [t.id, t.full_name]));
  const roomBy = new Map(data.rooms.map((r) => [r.id, r])), aptBy = new Map(data.apartments.map((a) => [a.id, a])), landBy = new Map(data.lands.map((l) => [l.id, l]));
  const mallName = new Map(data.malls.map((m) => [m.id, m.name]));
  const label = (p) => p.unit_type === 'room' ? `${mallName.get(roomBy.get(p.unit_id).mall_id)} - ${roomBy.get(p.unit_id).room_number}`
    : p.unit_type === 'apartment' ? `${aptBy.get(p.unit_id).building} - ${aptBy.get(p.unit_id).apartment_number}`
      : `${landBy.get(p.unit_id).name} (${landBy.get(p.unit_id).location})`;
  const tenantOfUnit = (p) => (p.unit_type === 'room' ? roomBy.get(p.unit_id).tenant_id : p.unit_type === 'apartment' ? aptBy.get(p.unit_id).tenant_id : landBy.get(p.unit_id).tenant_id);
  const [cy, cm] = currentPeriod();
  let n = 0;
  const payments = data.payments.map((p) => {
    const [py, pm] = shiftMonth(cy, cm, -p.period_months_ago);
    const tid = tenantOfUnit(p);
    n++;
    return {
      receiptNo: 'RGS-' + String(n).padStart(6, '0'), unitType: p.unit_type, unitId: ids[p.unit_type === 'room' ? 'rooms' : p.unit_type === 'apartment' ? 'apartments' : 'lands'][p.unit_id],
      tenant: tid ? ids.tenants[tid] : null, tenantName: tid ? tenantName.get(tid) : '', unitLabel: label(p), periodYear: py, periodMonth: pm,
      rentAmount: p.rent_amount, amountPaid: p.amount_paid, paymentDate: dateMonthsAgo(p.paid_months_ago, p.paid_day),
      paymentMethod: p.payment_method || 'Cash', reference: p.reference || '', receivedBy: ids.users[p.received_by] || null,
    };
  });
  await M.Payment.insertMany(payments);
  await M.Counter.create({ _id: 'receipt', seq: n });
  for (const e of data.expenses) {
    await M.Expense.create({ name: e.name, amount: e.amount, expenseDate: dateMonthsAgo(e.months_ago, e.day), createdBy: ids.users[e.created_by] || null });
  }
  // HR: departments and staff (demo names - replace with your real staff)
  const start = dateMonthsAgo(5, 1);
  let order = 1;
  for (const [dep, staff] of HR) {
    const d = await M.Department.create({ name: dep, sortOrder: order++ });
    for (const [fullName, title, phone, salary] of staff) await M.Employee.create({ department: d._id, fullName, title, phone, salary, startDate: start });
  }
  return { rooms: rooms.length, payments: payments.length };
}

module.exports = { seedDemo, PASSWORDS, HALLS, HALL_RENT };
