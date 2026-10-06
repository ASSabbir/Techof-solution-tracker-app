const User = require('../models/User');
const Task = require('../models/Task');
const TaskExtension = require('../models/TaskExtension');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { ok } = require('../utils/respond');
const { OPEN_STATUSES } = require('../utils/constants');
const v = require('../validators');
const T = require('../utils/time');
const { getSettings } = require('../services/settings.service');
const attendance = require('../services/attendance.service');
const leaderboard = require('../services/leaderboard.service');
const activity = require('../services/activity.service');
const { presenceMap } = require('../services/dashboard.service');

exports.list = asyncHandler(async (_req, res) => {
  const users = await User.find({ status: 'ACTIVE' }).sort({ name: 1 }).lean();
  const presence = await presenceMap(users);
  ok(res, { users: users.map((u) => ({ ...u, presence: presence.get(String(u._id)) })) });
});

exports.profile = asyncHandler(async (req, res) => {
  const user = await User.findById(v.oid.parse(req.params.id)).lean();
  if (!user || user.status !== 'ACTIVE') throw new AppError('Team member not found.', 404);
  const id = user._id;
  const settings = await getSettings();
  const [stats, att, achievements, created, assigned, activeTasks, completedTasks, extReq, extApproved, leaveDays, attendanceDays] = await Promise.all([
    leaderboard.userStats(id),
    attendance.stats(id),
    leaderboard.userAchievements(id),
    Task.countDocuments({ createdBy: id }),
    Task.countDocuments({ createdBy: id, assignedTo: { $ne: id } }),
    Task.countDocuments({ assignedTo: id, status: { $in: OPEN_STATUSES } }),
    Task.countDocuments({ assignedTo: id, status: 'COMPLETED' }),
    TaskExtension.countDocuments({ requestedBy: id }),
    TaskExtension.countDocuments({ approvedBy: id, status: 'APPROVED' }),
    LeaveRequest.countDocuments({ userId: id, status: 'APPROVED' }),
    Attendance.countDocuments({ userId: id, status: { $in: ['PRESENT', 'LATE', 'HALF_DAY'] } }),
  ]);
  ok(res, {
    user,
    summary: { activeTasks, completedTasks, attendanceRate: att.attendanceRate },
    stats, attendance: att, achievements,
    activity: { tasksCreated: created, tasksAssigned: assigned, tasksCompleted: completedTasks, extensionsRequested: extReq, extensionsApproved: extApproved, attendanceDays, leaveDays },
    timezone: settings.timezone,
    today: T.dateKey(new Date(), settings.timezone),
  });
});

exports.updateMe = asyncHandler(async (req, res) => {
  const patch = v.profile.parse(req.body);
  const user = await User.findById(req.user._id);
  const changed = [];
  if (patch.name !== undefined && patch.name !== user.name) { user.name = patch.name; changed.push('name'); }
  if (patch.avatar !== undefined) { user.avatar = patch.avatar; changed.push('avatar'); }
  if (changed.length) {
    await user.save();
    await activity.log(user._id, 'PROFILE_UPDATED', 'User', user._id, `${user.name} updated their profile`, { changed });
  }
  ok(res, { user: user.toJSON() });
});
