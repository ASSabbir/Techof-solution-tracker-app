const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { ok } = require('../utils/respond');
const v = require('../validators');
const T = require('../utils/time');
const svc = require('../services/attendance.service');
const { getSettings } = require('../services/settings.service');

exports.clockIn = asyncHandler(async (req, res) => {
  const { override } = v.clockIn.parse(req.body || {});
  const rec = await svc.clockIn(req.user, { override });
  ok(res, { record: rec, today: await svc.today(req.user) }, 201);
});
exports.clockOut = asyncHandler(async (req, res) => {
  const rec = await svc.clockOut(req.user);
  ok(res, { record: rec, today: await svc.today(req.user) });
});
exports.today = asyncHandler(async (req, res) => ok(res, await svc.today(req.user)));

exports.history = asyncHandler(async (req, res) => {
  const { month, userId } = v.historyQuery.parse(req.query);
  const settings = await getSettings();
  const m = month || T.dateKey(new Date(), settings.timezone).slice(0, 7);
  const target = userId || req.user._id;
  const [view, stats] = await Promise.all([svc.monthView(target, m), svc.stats(target, T.monthRange(m).start ? { from: T.monthRange(m).start, to: T.monthRange(m).end } : {})]);
  ok(res, { ...view, stats, userId: String(target) });
});

exports.stats = asyncHandler(async (req, res) => {
  const { userId } = v.historyQuery.parse(req.query);
  ok(res, { stats: await svc.stats(userId || req.user._id) });
});

exports.team = asyncHandler(async (req, res) => ok(res, await svc.team()));

exports.day = asyncHandler(async (req, res) => {
  const date = v.dateStr.parse(req.params.date);
  ok(res, await svc.team(date));
});
