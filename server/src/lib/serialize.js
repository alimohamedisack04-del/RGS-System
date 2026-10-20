/** Turn MongoDB documents into the JSON shapes the React app uses (string ids). */
const { idStr } = require('./util');

const payment = (p, users = new Map()) => ({
  id: idStr(p._id), receiptNo: p.receiptNo, unitType: p.unitType, unitId: idStr(p.unitId), tenantId: idStr(p.tenant),
  tenantName: p.tenantName, unitLabel: p.unitLabel, periodYear: p.periodYear, periodMonth: p.periodMonth,
  rentAmount: p.rentAmount, amountPaid: p.amountPaid, paymentDate: p.paymentDate, paymentMethod: p.paymentMethod || '',
  reference: p.reference || '', notes: p.notes || '', receivedBy: idStr(p.receivedBy),
  receivedByName: p.receivedBy && users.get(String(p.receivedBy)) ? users.get(String(p.receivedBy)).fullName : null,
});
const tenant = (t) => t && ({ id: idStr(t._id), fullName: t.fullName, phone: t.phone || '', email: t.email || '', address: t.address || '', startDate: t.startDate || '', notes: t.notes || '' });
const mall = (m) => m && ({ id: idStr(m._id), name: m.name, location: m.location || '', description: m.description || '' });
const section = (s) => s && ({ id: idStr(s._id), mallId: idStr(s.mall), name: s.name, description: s.description || '', sortOrder: s.sortOrder || 0 });
const room = (r) => r && ({ id: idStr(r._id), mallId: idStr(r.mall), sectionId: idStr(r.section), roomNumber: r.roomNumber, category: r.category || 'room', roomType: r.roomType || '', tenantId: idStr(r.tenant), monthlyRent: r.monthlyRent, notes: r.notes || '', status: r.tenant ? 'occupied' : 'vacant' });
const apartment = (a) => a && ({ id: idStr(a._id), apartmentNumber: a.apartmentNumber, building: a.building || '', apartmentType: a.apartmentType || '', tenantId: idStr(a.tenant), monthlyRent: a.monthlyRent, notes: a.notes || '', status: a.tenant ? 'occupied' : 'vacant' });
const land = (l) => l && ({ id: idStr(l._id), name: l.name, location: l.location || '', size: l.size || '', sizeUnit: l.sizeUnit || '', amount: l.amount, amountPeriod: l.amountPeriod, tenantId: idStr(l.tenant), ownerName: l.ownerName || '', ownerPhone: l.ownerPhone || '', status: l.status, notes: l.notes || '' });
const expense = (x, users = new Map()) => ({ id: idStr(x._id), name: x.name, amount: x.amount, expenseDate: x.expenseDate, createdBy: idStr(x.createdBy), createdByName: x.createdBy && users.get(String(x.createdBy)) ? users.get(String(x.createdBy)).fullName : null });

/** Unit (engine shape) without internal fields */
const unit = (u) => u && ({ unitType: u.unitType, unitId: u.unitId, category: u.category || null, key: `${u.unitType}:${u.unitId}`, code: u.code, kind: u.kind, label: u.label, location: u.location, mallId: u.mallId, sectionId: u.sectionId, sectionName: u.sectionName, rent: u.rent, tenantId: u.tenantId, tenantName: u.tenantName, tenantPhone: u.tenantPhone, tenantStart: u.tenantStart, status: u.status, isLet: u.isLet });
const rentRow = (r) => ({ ...unit(r), paid: r.paid, remaining: r.remaining, payStatus: r.payStatus, lastDate: r.lastDate, payCount: r.payCount });

module.exports = { payment, tenant, mall, section, room, apartment, land, expense, unit, rentRow };
