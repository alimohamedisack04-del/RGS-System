/** Express application (API + the built React app). */
const path = require('path');
const fs = require('fs');
const express = require('express');
const config = require('./config');
const { requireAuth } = require('./lib/auth');
const { ensureMonthClosings } = require('./lib/closings');
const { HttpError } = require('./lib/util');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Security headers
  app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });

  app.use('/api', express.json({ limit: '200kb' }));

  // CSRF protection: every change must come from our own React app (custom header + JSON).
  // Browsers do not let other websites send custom headers without permission (CORS is not enabled).
  app.use('/api', (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') return next();
    if (req.headers['x-requested-with'] !== 'RGS') return res.status(403).json({ error: 'Invalid request.' });
    next();
  });

  // Public routes
  app.use('/api/auth', require('./routes/auth'));

  // Everything below needs a login; a new month is closed automatically on the first request
  app.use('/api', requireAuth, async (req, res, next) => {
    try { await ensureMonthClosings(); } catch (e) { console.error('Month closing failed:', e.message); }
    next();
  });
  app.use('/api', require('./routes/meta'));
  app.use('/api', require('./routes/rent'));
  app.use('/api', require('./routes/properties'));
  app.use('/api', require('./routes/tenants'));
  app.use('/api', require('./routes/expenses'));
  app.use('/api', require('./routes/reports'));
  app.use('/api', require('./routes/admin'));
  app.use('/api', require('./routes/hr'));

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

  // React app (client/dist) — any other GET returns index.html (client-side routing)
  if (fs.existsSync(config.clientDist)) {
    app.use(express.static(config.clientDist, { index: false, maxAge: '1h' }));
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.sendFile(path.join(config.clientDist, 'index.html'));
    });
  }

  // Errors
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...(err.extra || {}) });
    if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON.' });
    if (err && err.name === 'CastError') return res.status(404).json({ error: 'Not found.' });
    console.error(err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  });
  return app;
}

module.exports = { createApp };
