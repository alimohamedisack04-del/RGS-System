/**
 * For a database that already has data (installed before halls and HR existed):
 *   - adds Hall A and Hall B to Mumtaaz Mall (only if missing)
 *   - adds the HR departments MANAGEMENT, SECURITY, CLEANING (only if there are no departments yet)
 * Run once:   npm run upgrade --prefix server
 * Optional:   npm run upgrade --prefix server -- --hall-rent 800    (monthly rent for each hall; default 500)
 */
const config = require('../config');
const { mongoose, Mall, Room, Department } = require('../models');
const { HALLS, HALL_RENT } = require('./seedData');

const arg = (k) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : ''; };
(async () => {
  await mongoose.connect(config.mongoUri);
  const mall = (await Mall.find({}).lean()).find((m) => /mumtaaz|mumtaz/i.test(m.name));
  const rent = Number(arg('hall-rent')) || HALL_RENT;
  if (!mall) console.log('Mumtaaz Mall not found - add halls in the app: Malls > (mall) > Add hall.');
  else {
    for (const name of HALLS) {
      if (await Room.findOne({ mall: mall._id, roomNumber: name }).lean()) { console.log(`${name}: already exists.`); continue; }
      await Room.create({ mall: mall._id, section: null, category: 'hall', roomNumber: name, roomType: 'Hall', tenant: null, monthlyRent: rent });
      console.log(`${name} added to ${mall.name} ($${rent.toFixed(2)} / month - change it in Edit).`);
    }
  }
  if (await Department.countDocuments({})) console.log('HR departments: already set up.');
  else {
    let i = 1;
    for (const name of ['MANAGEMENT', 'SECURITY', 'CLEANING']) await Department.create({ name, sortOrder: i++ });
    console.log('HR departments added: MANAGEMENT, SECURITY, CLEANING. Add your staff in HR.');
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
