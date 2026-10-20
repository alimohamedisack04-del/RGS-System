/**
 * Login, passwords and roles.
 *   Passwords : scrypt (Node built-in) with a random salt per user
 *   Login     : signed JWT (HS256) in an httpOnly, SameSite=Lax cookie
 *   Roles     : admin   - everything (only role that can delete / undo and manage users)
 *               editor  - everything (incl. HR / salaries) except deleting records, undoing payments and managing users
 *               cashier - view, record payments, add expenses, monthly report
 */
const crypto = require('crypto');
const config = require('../config');
const { User } = require('../models');
const { fail } = require('./util');

const COOKIE = 'rgs_token';
const ROLES = { admin: 'Admin', editor: 'Editor', cashier: 'Cashier' };
const PERMS = {
  admin: ['*'],
  editor: ['view', 'pay', 'expense', 'manage', 'reports', 'settings', 'hr'],
  cashier: ['view', 'pay', 'expense'],
};
function can(user, perm) {
  if (!user) return false;
  const p = PERMS[user.role] || ['view'];
  return p.includes('*') || p.includes(perm);
}
const permsOf = (user) => ['view', 'pay', 'expense', 'manage', 'reports', 'settings', 'hr', 'delete', 'unpay', 'users'].filter((p) => can(user, p));

// ---------- passwords ----------
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pw), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}
function verifyPassword(pw, stored) {
  const [alg, salt, hash] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const test = crypto.scryptSync(String(pw), salt, 64);
  const want = Buffer.from(hash, 'hex');
  return want.length === test.length && crypto.timingSafeEqual(test, want);
}

// ---------- tokens (JWT HS256) ----------
const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
function signToken(payload, hours = config.tokenHours) {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + hours * 3600 };
  const data = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(body)}`;
  const sig = crypto.createHmac('sha256', config.jwtSecret).update(data).digest('base64url');
  return `${data}.${sig}`;
}
function verifyToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const sig = crypto.createHmac('sha256', config.jwtSecret).update(`${parts[0]}.${parts[1]}`).digest();
  const got = Buffer.from(parts[2], 'base64url');
  if (got.length !== sig.length || !crypto.timingSafeEqual(got, sig)) return null;
  try {
    const body = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    return body.exp > Date.now() / 1000 ? body : null;
  } catch { return null; }
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function setLoginCookie(res, token) {
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: config.production, maxAge: config.tokenHours * 3600 * 1000, path: '/' });
}
function clearLoginCookie(res) {
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'lax', secure: config.production, path: '/' });
}

const publicUser = (u) => u && ({
  id: String(u._id), fullName: u.fullName, username: u.username, email: u.email || '', role: u.role,
  roleLabel: ROLES[u.role] || u.role, isActive: u.isActive, lastLogin: u.lastLogin || null,
});

/** Middleware: requires a valid login. Sets req.user (lean user). */
async function requireAuth(req, res, next) {
  try {
    const tok = verifyToken(parseCookies(req.headers.cookie)[COOKIE]);
    if (!tok) return res.status(401).json({ error: 'Please log in.' });
    const user = await User.findById(tok.sub).lean();
    if (!user || !user.isActive) {
      clearLoginCookie(res);
      return res.status(401).json({ error: 'Please log in.' });
    }
    req.user = user;
    next();
  } catch (e) { next(e); }
}

/** Middleware factory: requires a permission. */
const requirePerm = (perm) => (req, res, next) => {
  if (!can(req.user, perm)) return res.status(403).json({ error: 'Access denied. You do not have permission for this action.' });
  next();
};
const assertCan = (user, perm) => { if (!can(user, perm)) fail(403, 'Access denied. You do not have permission for this action.'); };

module.exports = { COOKIE, ROLES, PERMS, can, permsOf, hashPassword, verifyPassword, signToken, verifyToken, parseCookies, setLoginCookie, clearLoginCookie, publicUser, requireAuth, requirePerm, assertCan };
