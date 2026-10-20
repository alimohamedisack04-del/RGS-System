/** Users (admin), company settings, change my password. */
const express = require('express');
const { User } = require('../models');
const { requirePerm, hashPassword, verifyPassword, publicUser, ROLES } = require('../lib/auth');
const { getSettings, saveSettings } = require('../lib/settings');
const { wrap, str, oneOf, fail, invalid, isId } = require('../lib/util');

const router = express.Router();
const users = requirePerm('users');
const ORDER = { admin: 1, editor: 2, cashier: 3 };

router.get('/users', users, wrap(async (req, res) => {
  const list = (await User.find({}).lean()).sort((a, b) => (ORDER[a.role] || 9) - (ORDER[b.role] || 9) || a.fullName.localeCompare(b.fullName));
  res.json({ users: list.map(publicUser), roles: ROLES, me: String(req.user._id) });
}));
router.get('/users/:id', users, wrap(async (req, res) => {
  if (!isId(req.params.id)) fail(404, 'User not found.');
  const u = await User.findById(req.params.id).lean();
  if (!u) fail(404, 'User not found.');
  res.json({ user: publicUser(u) });
}));

const activeAdmins = async (exceptId) => (await User.find({ role: 'admin', isActive: true }).lean()).filter((u) => String(u._id) !== String(exceptId)).length;

async function userSave(id, b, me) {
  const d = { fullName: str(b.fullName, 100), username: str(b.username, 50), email: str(b.email, 150), role: oneOf(b.role, Object.keys(ROLES), 'cashier'), isActive: b.isActive !== false };
  const password = String(b.password || '');
  const errors = [];
  if (!d.fullName) errors.push('Full name is required.');
  if (!/^[A-Za-z0-9_.-]{3,50}$/.test(d.username)) errors.push('Username must be 3-50 characters: letters, numbers, dot, dash or underscore.');
  else if ((await User.find({ username: d.username }).lean()).some((u) => String(u._id) !== String(id))) errors.push('This username is already used.');
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) errors.push('Email is not valid.');
  if (!id && password.length < 8) errors.push('Password must be at least 8 characters.');
  if (id && password && password.length < 8) errors.push('New password must be at least 8 characters.');
  if (id && (d.role !== 'admin' || !d.isActive) && (await activeAdmins(id)) === 0) errors.push('There must be at least one active administrator.');
  if (id && String(id) === String(me._id) && !d.isActive) errors.push('You cannot deactivate your own account.');
  if (errors.length) invalid(errors);
  if (password) d.passwordHash = hashPassword(password);
  if (id) { await User.updateOne({ _id: id }, { $set: d }); return id; }
  return String((await User.create(d))._id);
}
router.post('/users', users, wrap(async (req, res) => res.status(201).json({ id: await userSave(null, req.body || {}, req.user), message: 'User created.' })));
router.put('/users/:id', users, wrap(async (req, res) => {
  if (!isId(req.params.id) || !(await User.findById(req.params.id).lean())) fail(404, 'User not found.');
  res.json({ id: await userSave(req.params.id, req.body || {}, req.user), message: 'User updated.' });
}));
router.delete('/users/:id', users, wrap(async (req, res) => {
  if (!isId(req.params.id)) fail(404, 'User not found.');
  const u = await User.findById(req.params.id).lean();
  if (!u) fail(404, 'User not found.');
  if (String(u._id) === String(req.user._id)) fail(422, 'You cannot delete your own account.');
  if (u.role === 'admin' && (await activeAdmins(u._id)) === 0) fail(422, 'You cannot delete the last administrator.');
  await User.deleteOne({ _id: u._id });
  res.json({ message: `User "${u.username}" deleted. Their recorded payments are kept.` });
}));

router.get('/settings', wrap(async (req, res) => res.json({ settings: await getSettings() })));
router.put('/settings', requirePerm('settings'), wrap(async (req, res) => {
  await saveSettings(req.body || {});
  res.json({ message: 'Settings saved.', settings: await getSettings() });
}));

router.put('/me/password', wrap(async (req, res) => {
  const b = req.body || {};
  const errors = [];
  if (!verifyPassword(String(b.current || ''), req.user.passwordHash)) errors.push('Current password is wrong.');
  if (String(b.newPassword || '').length < 8) errors.push('New password must be at least 8 characters.');
  if (String(b.newPassword || '') !== String(b.confirm || '')) errors.push('The two new passwords do not match.');
  if (errors.length) invalid(errors);
  await User.updateOne({ _id: req.user._id }, { $set: { passwordHash: hashPassword(b.newPassword) } });
  res.json({ message: 'Your password was changed.' });
}));

module.exports = router;
