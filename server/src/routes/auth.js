/** /api/auth — login, logout, current user. */
const express = require('express');
const { User, LoginAttempt } = require('../models');
const { verifyPassword, signToken, setLoginCookie, clearLoginCookie, requireAuth, publicUser, permsOf } = require('../lib/auth');
const { wrap, str, nowStamp } = require('../lib/util');

const config = require('../config');

const router = express.Router();

// Demo test accounts shown on the login page only when SHOW_DEMO_LOGINS=true (local testing)
const DEMO_LOGINS = [
  { username: 'admin', password: 'Admin@123', role: 'Administrator', can: 'Everything, including users, settings and deleting' },
  { username: 'editor', password: 'Editor@123', role: 'Editor', can: 'Add and edit everything, HR and reports — cannot delete or manage users' },
  { username: 'cashier1', password: 'Cashier@123', role: 'Cashier', can: 'Record payments, receipts, expenses and the monthly report' },
  { username: 'cashier2', password: 'Cashier@123', role: 'Cashier', can: 'Same as cashier1' },
];
router.get('/login-info', (req, res) => res.json({ demoLogins: config.showDemoLogins ? DEMO_LOGINS : [] }));
const MAX_TRIES = 5, LOCK_MINUTES = 15;

router.post('/login', wrap(async (req, res) => {
  const ip = req.ip || 'unknown';
  const since = new Date(Date.now() - LOCK_MINUTES * 60 * 1000);
  const tries = await LoginAttempt.countDocuments({ ip, at: { $gte: since } });
  if (tries >= MAX_TRIES) return res.status(429).json({ error: `Too many failed attempts. Please wait ${LOCK_MINUTES} minutes and try again.` });

  const username = str(req.body.username, 50), password = String(req.body.password || '');
  if (!username || !password) return res.status(422).json({ error: 'Please enter your username and password.' });

  const user = await User.findOne({ username }).lean();
  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
    await LoginAttempt.create({ ip, username, at: new Date() });
    const left = MAX_TRIES - tries - 1;
    return res.status(401).json({ error: left <= 0 ? `Too many failed attempts. Please wait ${LOCK_MINUTES} minutes and try again.` : 'Wrong username or password.' });
  }
  await LoginAttempt.deleteMany({ ip });
  await User.updateOne({ _id: user._id }, { $set: { lastLogin: nowStamp() } });
  setLoginCookie(res, signToken({ sub: String(user._id) }));
  res.json({ user: publicUser(user), perms: permsOf(user) });
}));

router.post('/logout', (req, res) => {
  clearLoginCookie(res);
  res.json({ ok: true, message: 'You have been logged out.' });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user), perms: permsOf(req.user) });
});

module.exports = router;
