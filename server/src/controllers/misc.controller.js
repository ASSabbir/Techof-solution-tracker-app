const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');
const Settings = require('../models/Settings');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/respond');
const { USER_FIELDS } = require('../utils/constants');
const v = require('../validators');
const leaderboard = require('../services/leaderboard.service');
const settingsSvc = require('../services/settings.service');
const activity = require('../services/activity.service');
const taskSvc = require('../services/task.service');
const dashboard = require('../services/dashboard.service');

/* leaderboard */
exports.leaderboard = asyncHandler(async (req, res) => {
  await taskSvc.processOverdue();
  const { period } = v.leaderboardQuery.parse(req.query);
  ok(res, await leaderboard.leaderboard(period));
});

/* notifications */
exports.notifications = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const filter = { userId: req.user._id, ...(req.query.unread === 'true' ? { readAt: null } : {}) };
  const [items, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),
    Notification.countDocuments({ userId: req.user._id, readAt: null }),
  ]);
  ok(res, { items, unread });
});
exports.markRead = asyncHandler(async (req, res) => {
  await Notification.updateOne({ _id: v.oid.parse(req.params.id), userId: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
  ok(res, { read: true });
});
exports.markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ userId: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
  ok(res, { read: true });
});

/* activity */
exports.activity = asyncHandler(async (req, res) => {
  const q = v.activityQuery.parse(req.query);
  const filter = {};
  if (q.userId) filter.userId = q.userId;
  if (q.entityType) filter.entityType = q.entityType;
  const [total, items] = await Promise.all([
    ActivityLog.countDocuments(filter),
    ActivityLog.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).populate('userId', USER_FIELDS).lean(),
  ]);
  ok(res, { items, total, page: q.page, pages: Math.max(1, Math.ceil(total / q.limit)) });
});

/* settings */
exports.getSettings = asyncHandler(async (_req, res) => ok(res, { settings: await settingsSvc.getSettings() }));
exports.updateSettings = asyncHandler(async (req, res) => {
  const patch = v.settings.parse(req.body);
  const current = await settingsSvc.getSettings();
  const $set = {};
  const flat = (obj, prefix = '') => {
    for (const [k, val] of Object.entries(obj)) {
      if (val && typeof val === 'object' && !Array.isArray(val)) flat(val, `${prefix}${k}.`);
      else $set[`${prefix}${k}`] = val;
    }
  };
  flat(patch);
  if (!Object.keys($set).length) return ok(res, { settings: current });
  await Settings.updateOne({ key: 'global' }, { $set });
  settingsSvc.invalidate();
  await activity.log(req.user._id, 'SETTINGS_UPDATED', 'Settings', current._id, `${req.user.name} updated team settings`, { changed: Object.keys($set) });
  ok(res, { settings: await settingsSvc.getSettings() });
});

/* dashboard */
exports.dashboard = asyncHandler(async (req, res) => {
  await taskSvc.processOverdue();
  ok(res, await dashboard.build(req.user));
});
