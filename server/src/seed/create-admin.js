/**
 * Start with an empty system (no demo data): create the first administrator.
 *   npm run create-admin -- --username admin --password "YourStrongPassword" --name "Office Admin"
 */
const config = require('../config');
const { mongoose, User } = require('../models');
const { hashPassword } = require('../lib/auth');

const arg = (k) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : ''; };
(async () => {
  const username = arg('username') || 'admin', password = arg('password'), fullName = arg('name') || 'System Administrator';
  if (!password || password.length < 8) { console.log('Give a password of at least 8 characters:  --password "..."'); process.exit(1); }
  await mongoose.connect(config.mongoUri);
  if (await User.findOne({ username }).lean()) { console.log(`User "${username}" already exists.`); process.exit(1); }
  await User.create({ fullName, username, role: 'admin', passwordHash: hashPassword(password), isActive: true });
  console.log(`Administrator "${username}" created. You can log in now.`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
