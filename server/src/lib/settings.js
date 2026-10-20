/** Company settings (stored as key/value documents). */
const { Setting } = require('../models');

const DEFAULTS = {
  company_name: 'RGS',
  system_name: 'RGS Property Management System',
  company_phone: '',
  company_address: '',
  currency: '$',
  receipt_footer: 'Thank you for your payment.',
};

async function getSettings() {
  const out = { ...DEFAULTS };
  for (const s of await Setting.find({}).lean()) if (s.key in DEFAULTS) out[s.key] = s.value;
  return out;
}

async function saveSettings(values) {
  for (const k of Object.keys(DEFAULTS)) {
    if (values[k] === undefined) continue;
    const v = String(values[k]).trim().slice(0, k === 'receipt_footer' ? 500 : 150);
    const ex = await Setting.findOne({ key: k }).lean();
    if (ex) await Setting.updateOne({ _id: ex._id }, { $set: { value: v } });
    else await Setting.create({ key: k, value: v });
  }
}

module.exports = { DEFAULTS, getSettings, saveSettings };
