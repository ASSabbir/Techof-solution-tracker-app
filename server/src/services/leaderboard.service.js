const Task = require('../models/Task');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const T = require('../utils/time');
const { OPEN_STATUSES } = require('../utils/constants');
const { getSettings } = require('./settings.service');

const sum = (cond) => ({ $sum: { $cond: [cond, 1, 0] } });

function periodMatch(period) {
  if (period === 'all') return {};
  const days = period === 'week' ? 7 : 30;
  const since = new Date(Date.now() - days * 86_400_000);
  return { $or: [{ completedAt: { $gte: since } }, { status: { $in: OPEN_STATUSES } }] };
}

async function aggregate(match = {}) {
  const now = new Date();
  const rows = await Task.aggregate([
    { $match: { status: { $ne: 'CANCELLED' }, ...match } },
    {
      $group: {
        _id: '$assignedTo',
        total: { $sum: 1 },
        completed: sum({ $eq: ['$status', 'COMPLETED'] }),
        onTime: sum({ $eq: ['$completionResult', 'ON_TIME'] }),
        withinExtension: sum({ $eq: ['$completionResult', 'WITHIN_EXTENSION'] }),
        late: sum({ $eq: ['$completionResult', 'LATE'] }),
        earlyFinishes: sum({ $eq: ['$earlyFinish', true] }),
        extendedTasks: sum({ $gt: ['$extensionCount', 0] }),
        overdueOpen: sum({ $or: [{ $eq: ['$status', 'OVERDUE'] }, { $and: [{ $eq: ['$status', 'EXTENSION_REQUESTED'] }, { $lte: ['$currentDeadline', now] }] }] }),
        extraMinutes: { $sum: '$totalExtensionMinutes' },
        score: { $sum: { $ifNull: ['$score', 0] } },
        openTasks: sum({ $in: ['$status', OPEN_STATUSES] }),
      },
    },
  ]);
  return new Map(rows.map((r) => [String(r._id), r]));
}

function shape(r = {}) {
  const completed = r.completed || 0;
  const overdueOpen = r.overdueOpen || 0;
  const late = r.late || 0;
  const due = completed + overdueOpen;
  return {
    total: r.total || 0,
    completed,
    onTime: r.onTime || 0,
    withinExtension: r.withinExtension || 0,
    late,
    overdueOpen,
    overdue: late + overdueOpen,
    extendedTasks: r.extendedTasks || 0,
    extraMinutes: r.extraMinutes || 0,
    earlyFinishes: r.earlyFinishes || 0,
    openTasks: r.openTasks || 0,
    score: Math.round((r.score || 0) * 10) / 10,
    completionRate: due ? Math.round((completed / due) * 1000) / 10 : null,
    onTimeRate: completed ? Math.round(((r.onTime || 0) / completed) * 1000) / 10 : null,
  };
}

async function attendanceStreak(userId, settings) {
  const recs = await Attendance.find({ userId, status: { $in: ['PRESENT', 'LATE', 'HALF_DAY'] } }).select('date').sort({ date: -1 }).limit(60).lean();
  const have = new Set(recs.map((r) => r.date));
  let key = T.dateKey(new Date(), settings.timezone);
  let streak = 0;
  // Walk back over working days; today may not be clocked in yet.
  for (let i = 0; i < 60; i++) {
    if (T.isWorkingDay(key, settings)) {
      if (have.has(key)) streak++;
      else if (!(i === 0)) break;
    }
    key = T.addDaysKey(key, -1);
  }
  return streak;
}

function achievements(all, streak) {
  return [
    { key: 'on-time-master', title: 'On-Time Master', description: '10 tasks completed on time.', progress: Math.min(all.onTime, 10), target: 10, earned: all.onTime >= 10 },
    { key: 'fast-finisher', title: 'Fast Finisher', description: 'Finished a task with half the time still left.', progress: Math.min(all.earlyFinishes, 1), target: 1, earned: all.earlyFinishes >= 1 },
    { key: 'consistency', title: 'Consistency', description: '5 consecutive working days with attendance.', progress: Math.min(streak, 5), target: 5, earned: streak >= 5 },
    { key: 'reliable', title: 'Reliable', description: '90%+ completion rate across at least 5 tasks.', progress: Math.min(all.completed, 5), target: 5, earned: all.completed >= 5 && (all.completionRate || 0) >= 90 },
    { key: 'deadline-survivor', title: 'Deadline Survivor', description: 'Completed a task within its approved extension.', progress: Math.min(all.withinExtension, 1), target: 1, earned: all.withinExtension >= 1 },
  ];
}

async function userStats(userId, match = {}) {
  const map = await aggregate({ assignedTo: userId, ...match });
  return shape(map.get(String(userId)));
}

async function userAchievements(userId) {
  const settings = await getSettings();
  const [all, streak] = await Promise.all([userStats(userId), attendanceStreak(userId, settings)]);
  return achievements(all, streak);
}

async function leaderboard(period = 'all') {
  const settings = await getSettings();
  const [users, periodRows, allRows] = await Promise.all([
    User.find({ status: 'ACTIVE' }).select('name username avatar').lean(),
    aggregate(periodMatch(period)),
    aggregate(),
  ]);
  const entries = [];
  for (const u of users) {
    const stats = shape(periodRows.get(String(u._id)));
    const all = shape(allRows.get(String(u._id)));
    const streak = await attendanceStreak(u._id, settings);
    entries.push({ user: u, stats, achievements: achievements(all, streak), streak });
  }
  entries.sort((a, b) => b.stats.score - a.stats.score || b.stats.onTime - a.stats.onTime || b.stats.completed - a.stats.completed || a.user.name.localeCompare(b.user.name));
  entries.forEach((e, i) => { e.rank = i + 1; });
  const maxScore = Math.max(1, ...entries.map((e) => e.stats.score));
  entries.forEach((e) => { e.scoreShare = Math.round((e.stats.score / maxScore) * 100); });
  return { period, entries, team: await teamPerformance(periodMatch(period)), scoring: settings.scoring };
}

async function teamPerformance(match = {}) {
  const map = await aggregate(match);
  const totals = { completed: 0, onTime: 0, extendedTasks: 0, overdue: 0, withinExtension: 0, late: 0, overdueOpen: 0 };
  for (const r of map.values()) {
    const s = shape(r);
    totals.completed += s.completed;
    totals.onTime += s.onTime;
    totals.extendedTasks += s.extendedTasks;
    totals.overdue += s.overdue;
    totals.withinExtension += s.withinExtension;
    totals.late += s.late;
    totals.overdueOpen += s.overdueOpen;
  }
  return { ...totals, onTimeRate: totals.completed ? Math.round((totals.onTime / totals.completed) * 1000) / 10 : null };
}

module.exports = { leaderboard, userStats, userAchievements, teamPerformance };
