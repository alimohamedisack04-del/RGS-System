/** Start the server: connect to MongoDB, then listen. */
const config = require('./config');
const { mongoose, User } = require('./models');
const { hashPassword } = require('./lib/auth');
const { createApp } = require('./app');

/** Empty database + ADMIN_PASSWORD set (e.g. on Render): create the first administrator automatically. */
async function firstAdmin() {
  const password = process.env.ADMIN_PASSWORD || '';
  if (!password || (await User.countDocuments({})) > 0) return;
  if (password.length < 8) { console.log('ADMIN_PASSWORD must be at least 8 characters — no administrator created.'); return; }
  const username = (process.env.ADMIN_USERNAME || 'admin').trim();
  await User.create({ fullName: 'System Administrator', username, role: 'admin', passwordHash: hashPassword(password), isActive: true });
  console.log(`First administrator "${username}" created.`);
}

async function main() {
  await mongoose.connect(config.mongoUri);
  console.log('Connected to MongoDB');
  await firstAdmin();
  const app = createApp();
  const server = app.listen(config.port, () => console.log(`RGS server running on http://localhost:${config.port}`));
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`Port ${config.port} is already in use — the server is probably still running in another terminal.`);
      console.error('Close the other terminal (trash icon) or press Ctrl+C there, then start again.');
    } else console.error('Could not start the server:', e.message);
    process.exit(1);
  });
}

main().catch((e) => {
  console.error('Could not start the server:', e.message);
  if (/ECONNREFUSED|ServerSelection/i.test(String(e.message) + e.name)) console.error('MongoDB is not running. Windows: press Win+R, type services.msc, start "MongoDB Server".');
  process.exit(1);
});
