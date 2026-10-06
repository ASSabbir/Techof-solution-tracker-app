const mongoose = require('mongoose');
const config = require('../config');

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: 'global' },
    timezone: { type: String, default: config.timezone },
    workdayStart: { type: String, default: '09:00' },
    lateAfter: { type: String, default: '09:15' },
    workdayEnd: { type: String, default: '18:00' },
    workingDays: { type: [Number], default: [6, 0, 1, 2, 3, 4] }, // 0 = Sunday ... 6 = Saturday (Sat-Thu)
    requireExtensionApproval: { type: Boolean, default: true },
    maxExtensionsPerTask: { type: Number, default: 3 },
    maxExtensionMinutes: { type: Number, default: 480 },
    dueSoonMinutes: { type: Number, default: 180 },
    reminderLevels: { type: [Number], default: [60, 30, 10] },
    scoring: {
      points: {
        LOW: { type: Number, default: 1 },
        MEDIUM: { type: Number, default: 3 },
        HIGH: { type: Number, default: 5 },
        URGENT: { type: Number, default: 8 },
      },
      multipliers: {
        ON_TIME: { type: Number, default: 1 },
        WITHIN_EXTENSION: { type: Number, default: 0.6 },
        LATE: { type: Number, default: 0.3 },
      },
      earlyBonus: { type: Number, default: 0.2 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);
