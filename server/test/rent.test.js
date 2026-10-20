/** Unit tests for the rent engine (no database needed):  npm test */
const test = require('node:test');
const assert = require('node:assert');
const R = require('../src/lib/rent');

const unit = (id, rent, extra = {}) => ({ unitType: 'room', unitId: id, code: 'A-' + id, kind: 'Shop', mallId: 'm1', sectionId: 's1', location: 'Mumtaaz Mall', rent, tenantId: 't' + id, tenantName: 'Tenant ' + id, tenantPhone: '+252 61 511 00' + id, tenantStart: '2026-01-01', status: 'occupied', isLet: true, label: 'Mumtaaz Mall - A-' + id, ...extra });
const pay = (id, y, m, amount, rentAmount = 95.12, date = `${y}-${String(m).padStart(2, '0')}-05`) => ({ unitType: 'room', unitId: id, periodYear: y, periodMonth: m, amountPaid: amount, rentAmount, paymentDate: date });

test('status rules: paid / partial / unpaid', () => {
  assert.equal(R.rentStatus(95.12, 95.12), 'paid');
  assert.equal(R.rentStatus(95.12, 50), 'partial');
  assert.equal(R.rentStatus(95.12, 0), 'unpaid');
  assert.equal(R.rentRemaining(95.12, 50), 45.12);
  assert.equal(R.rentRemaining(95.12, 200), 0);
});

test('rent rows and summary for a month', () => {
  const units = [unit('1', 95.12), unit('2', 95.12), unit('3', 95.12), unit('4', 95.12, { tenantId: null, isLet: false, status: 'vacant' })];
  const payments = [pay('1', 2026, 10, 95.12), pay('2', 2026, 10, 40)];
  const rows = R.rentRows(units, payments, 2026, 10);
  assert.equal(rows.length, 3, 'vacant room is not expected to pay');
  const s = R.rentSummary(rows);
  assert.equal(s.expected, 285.36);
  assert.equal(s.paid, 135.12);
  assert.equal(s.remaining, 150.24);
  assert.deepEqual([s.paidUnits, s.partialUnits, s.unpaidUnits], [1, 1, 1]);
});

test('tenant who starts later is not expected for earlier months', () => {
  const rows = R.rentRows([unit('1', 100, { tenantStart: '2026-11-01' })], [], 2026, 10);
  assert.equal(rows.length, 0);
});

test('first payment keeps the month rent even if the rent changes later', () => {
  const rows = R.rentRows([unit('1', 150)], [pay('1', 2026, 9, 95.12, 95.12)], 2026, 9);
  assert.equal(rows[0].rent, 95.12);
  assert.equal(rows[0].payStatus, 'paid');
});

test('arrears add up unpaid balances of earlier months', () => {
  const units = [unit('1', 100)];
  const payments = [pay('1', 2026, 8, 60, 100), pay('1', 2026, 9, 100, 100)];
  const a = R.rentArrears(units, payments, 2026, 10, 2);
  assert.equal(a.amount, 40);
  assert.equal(a.units, 1);
});

test('mall income: month, year and all-time', () => {
  const units = [unit('1', 95.12), unit('2', 95.12)];
  const payments = [pay('1', 2026, 9, 95.12), pay('1', 2026, 10, 95.12), pay('2', 2026, 10, 50), pay('1', 2025, 12, 95.12)];
  const inc = R.mallIncome(units, payments, 'm1', 2026, 10);
  assert.equal(inc.month, 145.12);
  assert.equal(inc.fullAmount, 95.12);
  assert.equal(inc.partialAmount, 50);
  assert.equal(inc.year, 240.24);
  assert.equal(inc.all, 335.36);
  assert.equal(inc.potential, 190.24);
});

test('occupancy counts occupied and vacant rooms', () => {
  const o = R.occupancyStats([unit('1', 1), unit('2', 1, { tenantId: null })]);
  assert.equal(o.roomsOcc, 1);
  assert.equal(o.roomsVacant, 1);
});
