/**
 * RENT ENGINE (pure functions, no database) — same rules as the PHP version.
 *
 *   Paid     : amount paid >= monthly rent
 *   Partial  : 0 < amount paid < monthly rent
 *   Unpaid   : amount paid = 0
 *   Remaining = monthly rent - amount paid (never below 0)
 *
 * A "unit" is a mall room, an apartment or a land plot (see lib/data.js buildUnits()).
 */
const { round2, monthEnd, monthStart, shiftMonth, today } = require('./util');

const rentStatus = (rent, paid) => (paid <= 0 ? 'unpaid' : paid + 0.001 >= rent ? 'paid' : 'partial');
const rentRemaining = (rent, paid) => Math.max(0, round2(rent - paid));
const unitKey = (type, id) => `${type}:${id}`;
const TYPE_ORDER = { room: 1, apartment: 2, land: 3 };

function makeLabel(type, code, location) {
  if (type === 'land') return code + (location ? ` (${location})` : '');
  return (location ? location + ' - ' : '') + code;
}

/** Group payments of one month by unit: key -> {paid, rentSnap, lastDate, count} */
function monthPayments(payments, y, m) {
  const map = new Map();
  for (const p of payments) {
    if (p.periodYear !== y || p.periodMonth !== m) continue;
    const k = unitKey(p.unitType, String(p.unitId));
    const g = map.get(k) || { paid: 0, rentSnap: 0, lastDate: '', count: 0 };
    g.paid = round2(g.paid + p.amountPaid);
    g.rentSnap = Math.max(g.rentSnap, p.rentAmount || 0);
    if (p.paymentDate > g.lastDate) g.lastDate = p.paymentDate;
    g.count++;
    map.set(k, g);
  }
  return map;
}

/**
 * Rent rows for a month: every let unit (and every unit that received a payment for that month).
 * Filters: type, mallId, sectionId, status, q
 */
function rentRows(units, payments, y, m, f = {}) {
  const byUnit = monthPayments(payments, y, m);
  const end = monthEnd(y, m);
  const q = (f.q || '').toLowerCase().trim();
  const out = [];
  for (const u of units) {
    const g = byUnit.get(unitKey(u.unitType, u.unitId));
    if (!u.isLet && !g) continue;
    if (!g && u.tenantStart && u.tenantStart > end) continue;     // tenant had not started yet
    const rent = g && g.rentSnap > 0 ? g.rentSnap : u.rent;
    const paid = g ? g.paid : 0;
    const row = { ...u, rent, paid, remaining: rentRemaining(rent, paid), payStatus: rentStatus(rent, paid),
      lastDate: g ? g.lastDate : null, payCount: g ? g.count : 0 };
    if (f.type && row.unitType !== f.type) continue;
    if (f.mallId && row.mallId !== String(f.mallId)) continue;
    if (f.sectionId && row.sectionId !== String(f.sectionId)) continue;
    if (f.status && row.payStatus !== f.status) continue;
    if (q) {
      const hay = `${row.label} ${row.code} ${row.tenantName || ''} ${row.tenantPhone || ''}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }
    out.push(row);
  }
  out.sort((a, b) => (TYPE_ORDER[a.unitType] - TYPE_ORDER[b.unitType])
    || String(a.location).localeCompare(String(b.location))
    || String(a.code).localeCompare(String(b.code), undefined, { numeric: true }));
  return out;
}

function rentSummary(rows) {
  const s = { expected: 0, paid: 0, unpaid: 0, remaining: 0, units: rows.length, paidUnits: 0, partialUnits: 0, unpaidUnits: 0 };
  for (const r of rows) {
    s.expected += r.rent; s.paid += r.paid; s.remaining += r.remaining;
    if (r.payStatus === 'paid') s.paidUnits++;
    else if (r.payStatus === 'partial') s.partialUnits++;
    else { s.unpaidUnits++; s.unpaid += r.rent; }
  }
  for (const k of ['expected', 'paid', 'unpaid', 'remaining']) s[k] = round2(s[k]);
  s.collectionRate = s.expected > 0 ? Math.min(100, Math.round((s.paid / s.expected) * 1000) / 10) : 0;
  return s;
}

/** 12 months of one unit in a year: status paid|partial|unpaid|na */
function unitYearHistory(unit, payments, year) {
  const t = today();
  const out = [];
  for (let m = 1; m <= 12; m++) {
    const g = monthPayments(payments.filter((p) => p.unitType === unit.unitType && String(p.unitId) === unit.unitId), year, m)
      .get(unitKey(unit.unitType, unit.unitId));
    if (g) {
      const rent = g.rentSnap > 0 ? g.rentSnap : unit.rent;
      out.push({ month: m, rent, paid: g.paid, remaining: rentRemaining(rent, g.paid), status: rentStatus(rent, g.paid), lastDate: g.lastDate });
      continue;
    }
    const notDue = monthStart(year, m) > t || !unit.isLet || (unit.tenantStart && unit.tenantStart > monthEnd(year, m));
    out.push({ month: m, rent: notDue ? 0 : unit.rent, paid: 0, remaining: notDue ? 0 : unit.rent, status: notDue ? 'na' : 'unpaid', lastDate: null });
  }
  return out;
}

/** Expected vs collected for the last n months ending at y/m. */
function rentTrend(units, payments, y, m, n = 6, f = {}) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const [yy, mm] = shiftMonth(y, m, -i);
    const s = rentSummary(rentRows(units, payments, yy, mm, f));
    out.push({ y: yy, m: mm, expected: s.expected, collected: s.paid, rate: s.collectionRate });
  }
  return out;
}

/** Unpaid balances of the `back` months before y/m. */
function rentArrears(units, payments, y, m, back = 12) {
  let amount = 0; const set = new Set();
  for (let i = 1; i <= back; i++) {
    const [yy, mm] = shiftMonth(y, m, -i);
    for (const r of rentRows(units, payments, yy, mm)) {
      if (r.remaining > 0) { amount += r.remaining; set.add(unitKey(r.unitType, r.unitId)); }
    }
  }
  return { amount: round2(amount), units: set.size };
}

function occupancyStats(units) {
  const rooms = units.filter((u) => u.unitType === 'room' && u.category !== 'hall'), apts = units.filter((u) => u.unitType === 'apartment');
  const halls = units.filter((u) => u.unitType === 'room' && u.category === 'hall');
  const roomsOcc = rooms.filter((u) => u.tenantId).length, aptsOcc = apts.filter((u) => u.tenantId).length;
  const total = rooms.length + apts.length, occ = roomsOcc + aptsOcc;
  return {
    total, occ, rate: total ? Math.round((occ / total) * 1000) / 10 : 0,
    rooms: rooms.length, roomsOcc, roomsVacant: rooms.length - roomsOcc, roomsRate: rooms.length ? Math.round((roomsOcc / rooms.length) * 1000) / 10 : 0,
    apts: apts.length, aptsOcc, aptsVacant: apts.length - aptsOcc,
    halls: halls.length, hallsOcc: halls.filter((u) => u.tenantId).length, hallsVacant: halls.filter((u) => !u.tenantId).length,
  };
}

/** Each mall, each apartment building, and rented land: occupancy, expected, collected. */
function portfolioRows(units, payments, malls, y, m) {
  const rows = rentRows(units, payments, y, m);
  const out = [];
  for (const ml of [...malls].sort((a, b) => a.name.localeCompare(b.name))) {
    const id = String(ml._id);
    const rs = units.filter((u) => u.unitType === 'room' && u.mallId === id);
    const s = rentSummary(rows.filter((r) => r.unitType === 'room' && r.mallId === id));
    out.push({ kind: 'Mall', id, name: ml.name, units: rs.length, occ: rs.filter((u) => u.tenantId).length, expected: s.expected, collected: s.paid, rate: s.collectionRate });
  }
  const buildings = [...new Set(units.filter((u) => u.unitType === 'apartment').map((u) => u.location))].sort();
  for (const b of buildings) {
    const as = units.filter((u) => u.unitType === 'apartment' && u.location === b);
    const s = rentSummary(rows.filter((r) => r.unitType === 'apartment' && r.location === b));
    out.push({ kind: 'Apartments', name: b, units: as.length, occ: as.filter((u) => u.tenantId).length, expected: s.expected, collected: s.paid, rate: s.collectionRate });
  }
  const ls = units.filter((u) => u.unitType === 'land');
  const s = rentSummary(rows.filter((r) => r.unitType === 'land'));
  out.push({ kind: 'Lands', name: 'Rented land', units: ls.length, occ: ls.filter((u) => u.status === 'rented').length, expected: s.expected, collected: s.paid, rate: s.collectionRate });
  return out;
}

/** Rent income of one mall (month, January..month of that year, all time) + paid/partial breakdown. */
function mallIncome(units, payments, mallId, y, m, sectionId = null) {
  const f = { type: 'room', mallId };
  if (sectionId) f.sectionId = sectionId;
  const rows = rentRows(units, payments, y, m, f);
  const s = rentSummary(rows);
  let full = 0, part = 0;
  for (const r of rows) { if (r.payStatus === 'paid') full += r.paid; else if (r.payStatus === 'partial') part += r.paid; }
  const rooms = units.filter((u) => u.unitType === 'room' && u.mallId === String(mallId) && (!sectionId || u.sectionId === String(sectionId)));
  const ids = new Set(rooms.map((u) => u.unitId));
  const mine = payments.filter((p) => p.unitType === 'room' && ids.has(String(p.unitId)));
  return {
    month: s.paid, expected: s.expected, remaining: s.remaining, rate: s.collectionRate,
    paidUnits: s.paidUnits, partialUnits: s.partialUnits, unpaidUnits: s.unpaidUnits,
    fullAmount: round2(full), partialAmount: round2(part),
    potential: round2(rooms.reduce((a, u) => a + u.rent, 0)),
    potentialRooms: round2(rooms.filter((u) => u.category !== 'hall').reduce((a, u) => a + u.rent, 0)),
    potentialHalls: round2(rooms.filter((u) => u.category === 'hall').reduce((a, u) => a + u.rent, 0)),
    year: round2(mine.filter((p) => p.periodYear === y && p.periodMonth <= m).reduce((a, p) => a + p.amountPaid, 0)),
    all: round2(mine.reduce((a, p) => a + p.amountPaid, 0)),
  };
}

module.exports = { rentStatus, rentRemaining, unitKey, makeLabel, rentRows, rentSummary, unitYearHistory, rentTrend, rentArrears, occupancyStats, portfolioRows, mallIncome };
