/**
 * Load the demo data:   npm run seed -- --yes
 * WARNING: this deletes everything in the database first.
 */
const config = require('../config');
const { mongoose } = require('../models');
const { seedDemo, PASSWORDS } = require('./seedData');

(async () => {
  if (!process.argv.includes('--yes')) {
    console.log('This DELETES all data in the database and loads the demo data.\nRun again with:  npm run seed -- --yes');
    process.exit(1);
  }
  await mongoose.connect(config.mongoUri);
  const r = await seedDemo();
  console.log(`Demo data loaded: ${r.rooms} rooms, ${r.payments} payments.`);
  console.log(`Logins: admin / ${PASSWORDS.admin} · editor / ${PASSWORDS.editor} · cashier1, cashier2 / ${PASSWORDS.cashier}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
