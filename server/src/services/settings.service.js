const Settings = require('../models/Settings');

let cached = null;
let cachedAt = 0;

// Fields added after the first release: old settings documents won't have them, and lean() skips schema defaults.
const FALLBACKS = { lateGraceMinutes: 15, clockInEarlyMinutes: 60 };

async function getSettings() {
  if (cached && Date.now() - cachedAt < 15_000) return cached;
  let doc = await Settings.findOne({ key: 'global' }).lean();
  if (!doc) {
    try {
      await Settings.create({ key: 'global' });
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
    doc = await Settings.findOne({ key: 'global' }).lean();
  }
  for (const [k, v] of Object.entries(FALLBACKS)) if (doc[k] == null) doc[k] = v;
  cached = doc;
  cachedAt = Date.now();
  return doc;
}

function invalidate() {
  cached = null;
}

module.exports = { getSettings, invalidate };