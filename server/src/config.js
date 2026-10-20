/**
 * Settings from environment variables (.env).
 * server/.env is read automatically (see .env.example).
 */
const fs = require('fs');
const path = require('path');

// Load server/.env if present (simple parser, no extra package needed)
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

process.env.TZ = process.env.TZ || 'Africa/Mogadishu';

const config = {
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/rgs',
  jwtSecret: process.env.JWT_SECRET || '',
  port: Number(process.env.PORT) || 5000,
  production: process.env.NODE_ENV === 'production',
  tokenHours: 12,
  // Show the demo test accounts on the login page (for testing on your laptop). Set to false on the live server.
  showDemoLogins: process.env.SHOW_DEMO_LOGINS === 'true',
  clientDist: process.env.CLIENT_DIST || path.join(__dirname, '..', '..', 'client', 'dist'),
};

if (!config.jwtSecret || config.jwtSecret.length < 32) {
  if (config.production) {
    throw new Error('JWT_SECRET must be set to a random string of at least 32 characters in production.');
  }
  config.jwtSecret = 'dev-only-secret-change-me-dev-only-secret-change-me';
}

module.exports = config;
