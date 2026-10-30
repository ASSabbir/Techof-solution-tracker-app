const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const T = require('../utils/time');
const S = require('../utils/shift');
const { getSettings } = require('./settings.service');
const activity = require('./activity.service');

const HOUR = 3600_000;

async function todayKey(settings, now = new Date()) {
  return T.dateKey(now, settings.timezone);
}

function stateOf(rec) {
  if (!rec) return 'NOT_STARTED';
  if (rec.entryTime && !rec.exitTime) return 'WORKING';
  if (rec.entryTime && rec.exitTime) return 'COMPLETED';
  return rec.status; // LEAVE / ABSENT / OVERTIME
}

// Forgotten clock-outs are closed automatically:
//  - main shift: 5 hours after the shift ends, recorded as if they left at shift end
//  - overtime session: 5 hours after it started, recorded as a 5 hour session
const LIMIT_MS = 5 * HOUR;

/* Every unfinished session of one person: the main shift and/or overtime sessions. */
async function openSessions(userId) {
  const recs = await Attendance.find({
    userId,
    $or: [{ entryTime: { $ne: null }, exitTime: null }, { overtime: { $elemMatch: { exitTime: null } } }],
  });
  const out = [];
  for (const rec of recs) {
    if (rec.entryTime && !rec.exitTime) out.push({ kind: 'MAIN', rec, entryTime: rec.entryTime });
    for (const s of rec.overtime || []) if (!s.exitTime) out.push({ kind: 'OVERTIME', rec, session: s, entryTime: s.entryTime });
  }
  return out.sort((a, b) => b.entryTime - a.entryTime);
}

async function closeStale(user, settings, now = new Date()) {
  const open = await openSessions(user._id);
  if (!open.length) return;
  const shift = S.userShift(user, settings);
  for (const o of open) {
    const entry = o.entryTime.getTime();
    if (o.kind === 'MAIN') {
      const w = S.windowFor(o.rec.date, shift, settings.timezone);
      // Shift end if it is after clock-in, otherwise 8h after clock-in.
      const autoExit = w.endUtc.getTime() > entry ? w.endUtc.getTime() : entry + 8 * HOUR;
      if (now.getTime() <= autoExit + LIMIT_MS) continue;
      const minutes = Math.max(0, Math.round((autoExit - entry) / 60000));
      const upd = await Attendance.findOneAndUpdate(
        { _id: o.rec._id, exitTime: null },
        { $set: { exitTime: new Date(autoExit), workingMinutes: minutes, autoClosed: true } },
        { new: true }
      );
      if (upd) await activity.log(user._id, 'CLOCK_OUT_AUTO', 'Attendance', o.rec._id, `${user.name || 'Someone'} forgot to clock out — closed at shift end`, { date: o.rec.date, workingMinutes: minutes });
    } else {
      if (now.getTime() < entry + LIMIT_MS) continue;
      const minutes = Math.round(LIMIT_MS / 60000);
      const upd = await Attendance.findOneAndUpdate(
        { _id: o.rec._id, overtime: { $elemMatch: { _id: o.session._id, exitTime: null } } },
        { $set: { 'overtime.$.exitTime': new Date(entry + LIMIT_MS), 'overtime.$.minutes': minutes, 'overtime.$.autoClosed': true }, $inc: { overtimeMinutes: minutes } },
        { new: true }
      );
      if (upd) await activity.log(user._id, 'CLOCK_OUT_AUTO', 'Attendance', o.rec._id, `${user.name || 'Someone'} forgot to clock out of overtime — closed after 5 hours`, { date: o.rec.date, overtime: true, minutes });
    }
  }
}

/* Extra work outside the main shift. It is credited to the attendance date whose 24 hours it falls in. */
async function startOvertime(user, now, shift, tz) {
  const day = S.dayFor(now, shift, tz);
  const session = { entryTime: now, exitTime: null, minutes: 0 };
  const push = () => Attendance.findOneAndUpdate({ userId: user._id, date: day.date }, { $push: { overtime: session } }, { new: true });

  let rec = await push();
  if (!rec) {
    // First thing recorded for this date: an "overtime present" placeholder that holds the session.
    try {
      rec = await Attendance.create({ userId: user._id, date: day.date, status: 'OVERTIME', source: 'CLOCK', workingMinutes: 0, overtime: [session] });
    } catch (err) {
      if (err.code !== 11000) throw err;
      rec = await push(); // two requests created the day at the same moment; this one just adds its session
    }
  }
  // A system "absent" mark with no main clock-in becomes overtime-present.
  if (rec && rec.status === 'ABSENT' && !rec.entryTime) {
    rec = (await Attendance.findOneAndUpdate({ _id: rec._id, status: 'ABSENT', entryTime: null }, { $set: { status: 'OVERTIME', source: 'CLOCK' } }, { new: true })) || rec;
  }
  if (!rec) throw new AppError('Could not start overtime. Please try again.', 500);
  await activity.log(user._id, 'CLOCK_IN', 'Attendance', rec._id, `${user.name} started overtime`, { date: day.date, overtime: true });
  return rec;
}

async function clockIn(user, { override = false } = {}) {
  const settings = await getSettings();
  const tz = settings.timezone;
  const now = new Date();
  await closeStale(user, settings, now);

  if ((await openSessions(user._id)).length) throw new AppError('You’re already clocked in. Clock out first.', 409, 'ALREADY_CLOCKED_IN');

  const shift = S.userShift(user, settings);
  const win = S.currentWindow(now, shift, settings);
  const existing = win ? await Attendance.findOne({ userId: user._id, date: win.date }) : null;

  // Anything outside the main shift (or after the main shift is already done) is overtime.
  if (!win || (existing && existing.entryTime)) return startOvertime(user, now, shift, tz);

  const key = win.date; // the date the shift STARTED on (matters for overnight shifts)
  const late = T.isWorkingDay(key, settings) && now.getTime() > win.startUtc.getTime() + settings.lateGraceMinutes * 60_000;
  const status = late ? 'LATE' : 'PRESENT';

  if (existing && existing.status === 'LEAVE') {
    if (!override) {
      throw new AppError('You have approved leave today. Clock in anyway to override it?', 409, 'LEAVE_CONFLICT');
    }
    const rec = await Attendance.findOneAndUpdate(
      { _id: existing._id, entryTime: null },
      { $set: { entryTime: now, status, source: 'CLOCK', overrideLeave: true } },
      { new: true }
    );
    if (!rec) throw new AppError('You’ve already clocked in for this shift.', 409, 'ALREADY_CLOCKED_IN');
    await activity.log(user._id, 'ATTENDANCE_LEAVE_OVERRIDE', 'Attendance', rec._id, `${user.name} clocked in over approved leave`, { date: key });
    await activity.log(user._id, 'CLOCK_IN', 'Attendance', rec._id, `${user.name} clocked in`, { date: key, status });
    return rec;
  }

  if (existing) {
    // An "overtime present" placeholder gets the real status; a system ABSENT mark is corrected to LATE.
    const next = existing.status === 'OVERTIME' ? status : 'LATE';
    const rec = await Attendance.findOneAndUpdate(
      { _id: existing._id, entryTime: null },
      { $set: { entryTime: now, status: next, source: 'CLOCK' } },
      { new: true }
    );
    if (!rec) throw new AppError('You’ve already clocked in for this shift.', 409, 'ALREADY_CLOCKED_IN');
    await activity.log(user._id, 'CLOCK_IN', 'Attendance', rec._id, `${user.name} clocked in`, { date: key, status: next });
    return rec;
  }

  try {
    const rec = await Attendance.create({ userId: user._id, date: key, entryTime: now, status, source: 'CLOCK' });
    await activity.log(user._id, 'CLOCK_IN', 'Attendance', rec._id, `${user.name} clocked in`, { date: key, status });
    return rec;
  } catch (err) {
    if (err.code === 11000) throw new AppError('You’ve already clocked in for this shift.', 409, 'ALREADY_CLOCKED_IN');
    throw err;
  }
}

async function clockOut(user, summary = '') {
  const settings = await getSettings();
  const now = new Date();
  await closeStale(user, settings, now);
  const open = (await openSessions(user._id))[0];
  if (!open) {
    const done = await Attendance.findOne({ userId: user._id, date: T.dateKey(now, settings.timezone), exitTime: { $ne: null } });
    if (done) throw new AppError('You’ve already clocked out.', 409, 'ALREADY_CLOCKED_OUT');
    throw new AppError('You’re not clocked in. A session left open for more than 5 hours is closed automatically.', 409, 'NOT_CLOCKED_IN');
  }
  const minutes = Math.max(0, Math.round((now - open.entryTime) / 60000));

  if (open.kind === 'MAIN') {
    const rec = await Attendance.findOneAndUpdate(
      { _id: open.rec._id, exitTime: null },
      { $set: { exitTime: now, workingMinutes: minutes, workSummary: summary || '' } },
      { new: true }
    );
    if (!rec) throw new AppError('You’ve already clocked out.', 409, 'ALREADY_CLOCKED_OUT');
    await activity.log(user._id, 'CLOCK_OUT', 'Attendance', rec._id, `${user.name} clocked out`, { date: rec.date, workingMinutes: minutes, hasSummary: !!summary });
    return rec;
  }

  const rec = await Attendance.findOneAndUpdate(
    { _id: open.rec._id, overtime: { $elemMatch: { _id: open.session._id, exitTime: null } } },
    { $set: { 'overtime.$.exitTime': now, 'overtime.$.minutes': minutes, 'overtime.$.summary': summary || '' }, $inc: { overtimeMinutes: minutes } },
    { new: true }
  );
  if (!rec) throw new AppError('You’ve already clocked out.', 409, 'ALREADY_CLOCKED_OUT');
  await activity.log(user._id, 'CLOCK_OUT', 'Attendance', rec._id, `${user.name} finished overtime`, { date: rec.date, overtime: true, minutes, hasSummary: !!summary });
  return rec;
}

async function today(user) {
  const settings = await getSettings();
  const tz = settings.timezone;
  const now = new Date();
  await closeStale(user, settings, now);

  const shift = S.userShift(user, settings);
  const todayK = T.dateKey(now, tz);
  const win = S.currentWindow(now, shift, settings);
  const early = (settings.clockInEarlyMinutes ?? 60) * 60_000;

  const day = win || S.dayFor(now, shift, tz);
  let rec = await Attendance.findOne({ userId: user._id, date: day.date }).lean();
  if (!win && !(rec && (rec.entryTime || (rec.overtime || []).length))) {
    // Between shifts with nothing recorded yet: show the shift that just ended.
    const last = S.lastEndedWindow(now, shift, settings);
    if (last) rec = (await Attendance.findOne({ userId: user._id, date: last.date }).lean()) || rec;
  }

  const open = (await openSessions(user._id))[0] || null;
  const show = win || S.upcomingWindow(now, shift, settings);
  const mainDone = !!(rec && rec.entryTime);
  // Clocking in is always possible. Inside the shift (and before the main clock-in) it is the main shift, otherwise overtime.
  const mode = win && !mainDone ? 'MAIN' : 'OVERTIME';

  return {
    date: day.date,
    record: rec,
    state: open ? 'WORKING' : stateOf(rec),
    isWorkingDay: T.isWorkingDay(day.date, settings),
    openSession: open ? { kind: open.kind, entryTime: open.entryTime } : null,
    overtime: { minutes: rec ? rec.overtimeMinutes || 0 : 0, sessions: rec ? rec.overtime || [] : [] },
    shift: {
      start: shift.start,
      end: shift.end,
      overnight: S.isOvernight(shift),
      inWindow: !!win,
      canClockIn: !open,
      mode,
      startsAt: show ? show.startUtc : null,
      endsAt: show ? show.endUtc : null,
      opensAt: show ? new Date(show.startUtc.getTime() - early) : null,
    },
    workday: { start: shift.start, end: shift.end },
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
  const c = { PRESENT: 0, LATE: 0, LEAVE: 0, ABSENT: 0, HALF_DAY: 0, OVERTIME: 0 };
  let workSum = 0, workN = 0, overtimeMinutes = 0, overtimeDays = 0;
  for (const r of records) {
    c[r.status] = (c[r.status] || 0) + 1;
    if (r.workingMinutes) { workSum += r.workingMinutes; workN++; }
    if (r.overtimeMinutes > 0 || r.status === 'OVERTIME') overtimeDays++;
    overtimeMinutes += r.overtimeMinutes || 0;
  }
  // "Overtime present" days are shown on the calendar but count neither for nor against the attendance rate.
  const attended = c.PRESENT + c.LATE + c.HALF_DAY;
  const denom = attended + c.ABSENT;
  return {
    present: c.PRESENT, late: c.LATE, leave: c.LEAVE, absent: c.ABSENT, halfDay: c.HALF_DAY, overtimePresent: c.OVERTIME,
    overtimeDays, overtimeMinutes,
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
  const users = await User.find({ status: 'ACTIVE', role: { $ne: 'MANAGER' } }).select('name username shiftStart shiftEnd').sort({ name: 1 }).lean();
  const records = await Attendance.find({ date: key, userId: { $in: users.map((u) => u._id) } }).lean();
  const map = new Map(records.map((r) => [String(r.userId), r]));
  return {
    date: key, isWorkingDay: T.isWorkingDay(key, settings),
    rows: users.map((u) => ({ user: u, record: map.get(String(u._id)) || null, state: stateOf(map.get(String(u._id))), shift: S.userShift(u, settings) })),
  };
}

// Mark missing working days as ABSENT once each person's own shift is over (and catch up on recent days).
// A day that already has an "overtime present" record is left alone.
async function processAbsent(now = new Date()) {
  const settings = await getSettings();
  const tz = settings.timezone;
  const todayK = T.dateKey(now, tz);
  const users = await User.find({ status: 'ACTIVE', role: { $ne: 'MANAGER' } }).select('name joinedAt shiftStart shiftEnd').lean();
  let created = 0;

  for (const u of users) {
    await closeStale(u, settings, now);
    const shift = S.userShift(u, settings);
    for (let i = 7; i >= 0; i--) {
      const key = T.addDaysKey(todayK, -i);
      if (!T.isWorkingDay(key, settings)) continue;
      const w = S.windowFor(key, shift, tz);
      if (now.getTime() < w.endUtc.getTime()) continue; // this shift is still running or hasn't started
      if (u.joinedAt && new Date(u.joinedAt) > w.endUtc) continue;
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

module.exports = { clockIn, clockOut, today, monthView, stats, team, processAbsent, closeStale, leaveConflicts, todayKey, computeStats, stateOf };