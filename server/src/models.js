/**
 * MongoDB collections (Mongoose models).
 * Dates that are calendar days (payment date, tenant start date, expense date) are stored as
 * 'YYYY-MM-DD' strings so they never shift because of time zones.
 */
const mongoose = require('mongoose');
const { Schema } = mongoose;
const ref = (model) => ({ type: Schema.Types.ObjectId, ref: model, default: null });
const opts = { timestamps: true, versionKey: false };

const User = mongoose.model('User', new Schema({
  fullName: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, default: '' },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'editor', 'cashier'], default: 'cashier' },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: String, default: null },
}, opts));

const Setting = mongoose.model('Setting', new Schema({
  key: { type: String, required: true, unique: true },
  value: { type: String, default: '' },
}, opts));

const Mall = mongoose.model('Mall', new Schema({
  name: { type: String, required: true },
  location: { type: String, default: '' },
  description: { type: String, default: '' },
}, opts));

const Section = mongoose.model('Section', new Schema({
  mall: ref('Mall'),
  name: { type: String, required: true },
  description: { type: String, default: '' },
  sortOrder: { type: Number, default: 0 },
}, opts));

const Room = mongoose.model('Room', new Schema({
  mall: ref('Mall'),
  section: ref('Section'),
  roomNumber: { type: String, required: true },
  category: { type: String, enum: ['room', 'hall'], default: 'room' },   // hall = big hall (e.g. Hall A, Hall B)
  roomType: { type: String, default: '' },
  tenant: ref('Tenant'),
  monthlyRent: { type: Number, default: 0 },
  notes: { type: String, default: '' },
}, opts));

const Apartment = mongoose.model('Apartment', new Schema({
  apartmentNumber: { type: String, required: true },
  building: { type: String, default: '' },
  apartmentType: { type: String, default: '' },
  tenant: ref('Tenant'),
  monthlyRent: { type: Number, default: 0 },
  notes: { type: String, default: '' },
}, opts));

const Land = mongoose.model('Land', new Schema({
  name: { type: String, required: true },
  location: { type: String, default: '' },
  size: { type: String, default: '' },
  sizeUnit: { type: String, default: 'm' },
  amount: { type: Number, default: 0 },
  amountPeriod: { type: String, enum: ['monthly', 'annual', 'total'], default: 'monthly' },
  tenant: ref('Tenant'),
  ownerName: { type: String, default: '' },
  ownerPhone: { type: String, default: '' },
  status: { type: String, enum: ['available', 'rented', 'sold', 'reserved'], default: 'available' },
  notes: { type: String, default: '' },
}, opts));

const Tenant = mongoose.model('Tenant', new Schema({
  fullName: { type: String, required: true },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  address: { type: String, default: '' },
  startDate: { type: String, default: null },
  notes: { type: String, default: '' },
}, opts));

const Payment = mongoose.model('Payment', new Schema({
  receiptNo: { type: String, default: '' },
  unitType: { type: String, enum: ['room', 'apartment', 'land'], required: true },
  unitId: { type: Schema.Types.ObjectId, required: true },
  tenant: ref('Tenant'),
  tenantName: { type: String, default: '' },
  unitLabel: { type: String, default: '' },
  periodYear: { type: Number, required: true },
  periodMonth: { type: Number, required: true },
  rentAmount: { type: Number, default: 0 },
  amountPaid: { type: Number, required: true },
  paymentDate: { type: String, required: true },
  paymentMethod: { type: String, default: '' },
  reference: { type: String, default: '' },
  notes: { type: String, default: '' },
  receivedBy: ref('User'),
}, opts));

const Expense = mongoose.model('Expense', new Schema({
  name: { type: String, required: true },
  amount: { type: Number, required: true },
  expenseDate: { type: String, required: true },
  createdBy: ref('User'),
}, opts));

// HR: departments (Management, Security, Cleaning …) and staff with a monthly salary
const Department = mongoose.model('Department', new Schema({
  name: { type: String, required: true },
  sortOrder: { type: Number, default: 0 },
}, opts));

const Employee = mongoose.model('Employee', new Schema({
  department: ref('Department'),
  fullName: { type: String, required: true },
  title: { type: String, default: '' },
  phone: { type: String, default: '' },
  salary: { type: Number, default: 0 },          // monthly salary
  startDate: { type: String, default: null },     // salary counts from this month
  endDate: { type: String, default: null },       // left the job: salary stops after this month
  notes: { type: String, default: '' },
}, opts));

const MonthClosing = mongoose.model('MonthClosing', new Schema({
  periodYear: { type: Number, required: true },
  periodMonth: { type: Number, required: true },
  closedAt: { type: String, required: true },
  closedBy: ref('User'),
  expected: Number, collected: Number, outstanding: Number,
  units: Number, paidUnits: Number, partialUnits: Number, unpaidUnits: Number,
  properties: { type: Array, default: [] },
}, opts));

const LoginAttempt = mongoose.model('LoginAttempt', new Schema({
  ip: String, username: String, at: Date,
}, { versionKey: false }));

const Counter = mongoose.model('Counter', new Schema({
  _id: String, seq: { type: Number, default: 0 },
}, { versionKey: false }));

/** Next receipt number: RGS-000001, RGS-000002, ... */
async function nextReceiptNo() {
  const c = await Counter.findOneAndUpdate({ _id: 'receipt' }, { $inc: { seq: 1 } }, { new: true, upsert: true }).lean();
  return 'RGS-' + String(c.seq).padStart(6, '0');
}

module.exports = { mongoose, User, Setting, Mall, Section, Room, Apartment, Land, Tenant, Payment, Expense, Department, Employee, MonthClosing, LoginAttempt, Counter, nextReceiptNo };
