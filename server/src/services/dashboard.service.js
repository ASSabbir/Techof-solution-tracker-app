const Task = require('../models/Task');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const TaskExtension = require('../models/TaskExtension');
const LeaveRequest = require('../models/LeaveRequest');
const ActivityLog = require('../models/ActivityLog');
const { OPEN_STATUSES, USER_FIELDS } = require('../utils/constants');
const { getSettings } = require('./settings.service');
const attendance = require('./attendance.service');
const leaderboard = require('./leaderboard.service');
const taskSvc = require('./task.service');
const T = require('../utils/time');

const overdueCond = (now) => ({
  $or: [{ $eq: ['$status', 'OVERDUE'] }, { $and: [{ $eq: ['$status', 'EXTENSION_REQUESTED'] }, { $lte: ['$currentDeadline', now] }] }],
});

async function presenceMap(users) {
  const now = new Date();
  const ids = users.map((u) => u._id);
  const [counts, open] = await Promise.all([
    Task.aggregate([
      { $match: { assignedTo: { $in: ids }, status: { $in: OPEN_STATUSES } } },
      { $group: { _id: '$assignedTo', active: { $sum: 1 }, overdue: { $sum: { $cond: [overdueCond(now), 1, 0] } } } },
    ]),
    Attendance.find({ userId: { $in: ids }, exitTime: null, entryTime: { $gte: new Date(now.getTime() - 20 * 3600_000) } }).lean(),
  ]);
  const c = new Map(counts.map((r) => [String(r._id), r]));
  const working = new Set(open.map((r) => String(r.userId)));
  const out = new Map();
  for (const u of users) {
    const k = String(u._id);
    const row = c.get(k) || { active: 0, overdue: 0 };
    const isWorking = working.has(k);
    const recentlySeen = u.lastSeenAt && now - new Date(u.lastSeenAt) < 10 * 60_000;
    let status = 'NOT_ACTIVE';
    if (row.overdue > 0) status = 'OVERDUE_TASK';
    else if (isWorking) status = recentlySeen ? 'ACTIVE' : 'AWAY';
    out.set(k, { status, activeTasks: row.active, overdueTasks: row.overdue, working: isWorking });
  }
  return out;
}

async function build(user) {
  const now = new Date();
  const settings = await getSettings();
  const mine = { assignedTo: user._id };

  const [total, active, completed, overdue, todayAtt, users, upcoming, recent, extPending, leavePending, team] = await Promise.all([
    Task.countDocuments({ ...mine, status: { $ne: 'CANCELLED' } }),
    Task.countDocuments({ ...mine, status: { $in: ['PENDING', 'ACTIVE', 'EXTENDED', 'EXTENSION_REQUESTED'] } }),
    Task.countDocuments({ ...mine, status: 'COMPLETED' }),
    Task.countDocuments({ ...mine, $or: [{ status: 'OVERDUE' }, { status: 'EXTENSION_REQUESTED', currentDeadline: { $lte: now } }] }),
    attendance.today(user),
    User.find({ status: 'ACTIVE' }).sort({ name: 1 }).select('name username lastSeenAt').lean(),
    Task.find({ ...mine, status: { $in: OPEN_STATUSES } }).sort({ currentDeadline: 1 }).limit(6).populate(taskSvc.POPULATE),
    ActivityLog.find({}).sort({ createdAt: -1 }).limit(10).populate('userId', USER_FIELDS).lean(),
    TaskExtension.find({ status: 'PENDING', requestedBy: { $ne: user._id } })
      .sort({ requestedAt: 1 }).populate('requestedBy', USER_FIELDS).populate({ path: 'taskId', select: 'title createdBy priority currentDeadline' }).lean(),
    LeaveRequest.find({ status: 'PENDING', userId: { $ne: user._id } }).sort({ date: 1 }).populate('userId', USER_FIELDS).lean(),
    leaderboard.teamPerformance(),
  ]);

  const presence = await presenceMap(users);
  const decorated = await taskSvc.decorate(upcoming, user);
  const approvals = extPending.filter(
    (e) => e.taskId && (String(e.taskId.createdBy) === String(user._id) || String(e.taskId.createdBy) === String(e.requestedBy._id))
  );

  return {
    greetingName: user.name,
    today: T.dateKey(now, settings.timezone),
    timezone: settings.timezone,
    summary: { total, active, completed, overdue },
    attendance: todayAtt,
    team: users.map((u) => ({ _id: u._id, name: u.name, username: u.username, ...presence.get(String(u._id)) })),
    upcoming: decorated,
    recentActivity: recent,
    approvals: { extensions: approvals, leaves: leavePending },
    performance: team,
  };
}

module.exports = { build, presenceMap };
