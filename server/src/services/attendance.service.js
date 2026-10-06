const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const T = require('../utils/time');
const { getSettings } = require('./settings.service');
const activity = require('./activity.service');

async function todayKey(settings, now = new Date()) {
  return T.dateKey(now, settings.timezone);
}

function stateOf(rec) {
  if (!rec) return 'NOT_STARTED';
  if (rec.entryTime && !rec.exitTime) return 'WORKING';
  if (rec.entryTime && rec.exitTime) return 'COMPLETED';
  return rec.status; // LEAVE / ABSENT
}

async function clockIn(user, { override = false } = {}) {
  const settings = await getSettings();
  const now = new Date();
  const key = T.dateKey(now, settings.timezone);
  const late = T.isWorkingDay(key, settings) && T.minutesOfDay(now, settings.timezone) > T.hhmmToMinutes(settings.lateAfter);
  const status = late ? 'LATE' : 'PRESENT';

  const existing = await Attendance.findOne({ userId: user._id, date: key });
  if (existing && existing.entryTime) throw new AppError('You’ve already clocked in today.', 409, 'ALREADY_CLOCKED_IN');

  if (existing && existing.status === 'LEAVE') {
    if (!override) {
      throw new AppError('You have approved leave today. Clock in anyway to override it?', 409, 'LEAVE_CONFLICT');
    }
    const rec = await Attendance.findOneAndUpdate(
      { _id: existing._id, entryTime: null },
      { $set: { entryTime: now, status, source: 'CLOCK', overrideLeave: true } },
      { new: true }
    );
    if (!rec) throw new AppError('You’ve already clocked in today.', 409, 'ALREADY_CLOCKED_IN');
    await activity.log(user._id, 'ATTENDANCE_LEAVE_OVERRIDE', 'Attendance', rec._id, `${user.name} clocked in over approved leave`, { date: key });
    await activity.log(user._id, 'CLOCK_IN', 'Attendance', rec._id, `${user.name} clocked in`, { date: key, status });
    return rec;
  }

  if (existing) {
    // A system-generated ABSENT mark can be corrected by a real clock-in.
    const rec = await Attendance.findOneAndUpdate(
      { _id: existing._id, entryTime: null },
      { $set: { entryTime: now, status: 'LATE', source: 'CLOCK' } },
      { new: true }
    );
    if (!rec) throw new AppError('You’ve already clocked in today.', 409, 'ALREADY_CLOCKED_IN');
    await activity.log(user._id, 'CLOCK_IN', 'Attendance', rec._id, `${user.name} clocked in`, { date: key, status: 'LATE' });
    return rec;
  }

  try {
    const rec = await Attendance.create({ userId: user._id, date: key, entryTime: now, status, source: 'CLOCK' });
    await activity.log(user._id, 'CLOCK_IN', 'Attendance', rec._id, `${user.name} clocked in`, { date: key, status });
    return rec;
  } catch (err) {
    if (err.code === 11000) throw new AppError('You’ve already clocked in today.', 409, 'ALREADY_CLOCKED_IN');
    throw err;
  }
}

async function clockOut(user) {
  const now = new Date();
  const open = await Attendance.findOne({
    userId: user._id, exitTime: null,
    entryTime: { $gte: new Date(now.getTime() - 20 * 3600_000) },
  }).sort({ date: -1 });
  if (!open) {
    const settings = await getSettings();
    const done = await Attendance.findOne({ userId: user._id, date: T.dateKey(now, settings.timezone), exitTime: { $ne: null } });
    if (done) throw new AppError('You’ve already clocked out today.', 409, 'ALREADY_CLOCKED_OUT');
    throw new AppError('You haven’t clocked in yet.', 409, 'NOT_CLOCKED_IN');
  }
  const minutes = Math.max(0, Math.round((now - open.entryTime) / 60000));
  const rec = await Attendance.findOneAndUpdate(
    { _id: open._id, exitTime: null },
    { $set: { exitTime: now, workingMinutes: minutes } },
    { new: true }
  );
  if (!rec) throw new AppError('You’ve already clocked out today.', 409, 'ALREADY_CLOCKED_OUT');
  await activity.log(user._id, 'CLOCK_OUT', 'Attendance', rec._id, `${user.name} clocked out`, { date: rec.date, workingMinutes: minutes });
  return rec;
}

async function today(user) {
  const settings = await getSettings();
  const now = new Date();
  const key = T.dateKey(now, settings.timezone);
  let rec = await Attendance.findOne({ userId: user._id, date: key }).lean();
  if (!rec || !rec.entryTime) {
    // Surface a still-open record from a previous day (forgot to clock out).
    const open = await Attendance.findOne({
      userId: user._id, entryTime: { $gte: new Date(now.getTime() - 20 * 3600_000) }, exitTime: null,
    }).lean();
    if (open) rec = open;
  }
  return {
    date: key, record: rec, state: stateOf(rec), isWorkingDay: T.isWorkingDay(key, settings),
    workday: { start: settings.workdayStart, lateAfter: settings.lateAfter, end: settings.workdayEnd },
  };
}

async function monthView(userId, month) {
  const settings = await getSettings();
  const { start, end } = T.monthRange(month);
  const records = await Attendance.find({ userId, date: { $gte: start, $lte: end } }).lean();
  const map = new Map(records.map((r) => [r.date, r]));
  const todayK = T.dateKey(new Date(), settings.timezone);
  const days = T.listDays(start, end).map((date) => ({
    date, weekday: T.weekdayOf(date), isWorkingDay: T.isWorkingDay(date, settings), isFuture: date > todayK, isToday: date === todayK,
    record: map.get(date) || null,
  }));
  return { month, days, records, stats: computeStats(records) };
}

function computeStats(records) {
  const c = { PRESENT: 0, LATE: 0, LEAVE: 0, ABSENT: 0, HALF_DAY: 0 };
  let workSum = 0, workN = 0;
  for (const r of records) {
    c[r.status] = (c[r.status] || 0) + 1;
    if (r.workingMinutes) { workSum += r.workingMinutes; workN++; }
  }
  const attended = c.PRESENT + c.LATE + c.HALF_DAY;
  const denom = attended + c.ABSENT;
  return {
    present: c.PRESENT, late: c.LATE, leave: c.LEAVE, absent: c.ABSENT, halfDay: c.HALF_DAY,
    attendanceRate: denom ? Math.round((attended / denom) * 1000) / 10 : null,
    avgWorkingMinutes: workN ? Math.round(workSum / workN) : 0,
  };
}

// Average entry time in minutes-of-day (in app timezone).
function averageEntryMinutes(records, tz) {
  const withEntry = records.filter((r) => r.entryTime);
  if (!withEntry.length) return null;
  const sum = withEntry.reduce((s, r) => s + T.minutesOfDay(new Date(r.entryTime), tz), 0);
  return Math.round(sum / withEntry.length);
}

async function stats(userId, { from, to } = {}) {
  const settings = await getSettings();
  const filter = { userId };
  if (from || to) filter.date = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  const records = await Attendance.find(filter).lean();
  const s = computeStats(records);
  s.avgEntryMinutes = averageEntryMinutes(records, settings.timezone);
  return s;
}

async function team(date) {
  const settings = await getSettings();
  const key = date || T.dateKey(new Date(), settings.timezone);
  const users = await User.find({ status: 'ACTIVE' }).select('name username').sort({ name: 1 }).lean();
  const records = await Attendance.find({ date: key, userId: { $in: users.map((u) => u._id) } }).lean();
  const map = new Map(records.map((r) => [String(r.userId), r]));
  return {
    date: key, isWorkingDay: T.isWorkingDay(key, settings),
    rows: users.map((u) => ({ user: u, record: map.get(String(u._id)) || null, state: stateOf(map.get(String(u._id))) })),
  };
}

// Mark missing working days as ABSENT once the workday is over (and catch up on recent days).
async function processAbsent(now = new Date()) {
  const settings = await getSettings();
  const tz = settings.timezone;
  const todayK = T.dateKey(now, tz);
  const endMinutes = T.hhmmToMinutes(settings.workdayEnd);
  const users = await User.find({ status: 'ACTIVE' }).select('name joinedAt').lean();
  let created = 0;

  for (let i = 7; i >= 0; i--) {
    const key = T.addDaysKey(todayK, -i);
    if (!T.isWorkingDay(key, settings)) continue;
    if (key === todayK && T.minutesOfDay(now, tz) < endMinutes) continue; // workday still running
    const dayEnd = T.zonedToUtc(key, '23:59', tz);
    for (const u of users) {
      if (u.joinedAt && new Date(u.joinedAt) > dayEnd) continue;
      const res = await Attendance.updateOne(
        { userId: u._id, date: key },
        { $setOnInsert: { status: 'ABSENT', source: 'SYSTEM', workingMinutes: 0 } },
        { upsert: true }
      );
      if (res.upsertedCount) {
        created++;
        await activity.log(u._id, 'ATTENDANCE_ABSENT', 'Attendance', res.upsertedId, `${u.name} was marked absent for ${key}`, { date: key });
      }
    }
  }
  return created;
}

async function leaveConflicts(userId, date) {
  return LeaveRequest.findOne({ userId, date, status: { $in: ['PENDING', 'APPROVED'] } }).lean();
}

module.exports = { clockIn, clockOut, today, monthView, stats, team, processAbsent, leaveConflicts, todayKey, computeStats, stateOf };
