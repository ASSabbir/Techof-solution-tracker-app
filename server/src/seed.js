/* Seeds the three team members (and optionally demo data).
   npm run seed        -> users + settings only
   npm run seed:demo   -> also wipes tasks/attendance/etc. and loads realistic sample data */
const bcrypt = require('bcryptjs');
const config = require('./config');
const connectDB = require('./config/db');
const User = require('./models/User');
const Task = require('./models/Task');
const TaskExtension = require('./models/TaskExtension');
const Attendance = require('./models/Attendance');
const LeaveRequest = require('./models/LeaveRequest');
const Notification = require('./models/Notification');
const ActivityLog = require('./models/ActivityLog');
const Settings = require('./models/Settings');
const T = require('./utils/time');
const { completionResult, isEarlyFinish, computeScore } = require('./utils/scoring');

const TEAM = [
  { name: 'Sabbir', username: 'sabbir', email: 'sabbir@techof.dev' },
  { name: 'Billah', username: 'billah', email: 'billah@techof.dev' },
  { name: 'Noman', username: 'noman', email: 'noman@techof.dev' },
];
const H = 3600_000;
const M = 60_000;
const D = 24 * H;

async function seedUsers() {
  const hash = await bcrypt.hash(config.seedPassword, 12);
  const out = {};
  for (const u of TEAM) {
    let doc = await User.findOne({ username: u.username }).select('+passwordHash');
    if (!doc) {
      doc = await User.create({ ...u, passwordHash: hash });
      console.log(`  + created ${u.name} (${u.email})`);
    } else {
      console.log(`  = ${u.name} already exists (password unchanged)`);
    }
    out[u.username] = doc;
  }
  if (!(await Settings.findOne({ key: 'global' }))) await Settings.create({ key: 'global' });
  return out;
}

async function wipe() {
  // Direct collection access: the models intentionally forbid deleting history.
  await Promise.all([Task, TaskExtension, Attendance, LeaveRequest, Notification, ActivityLog].map((m) => m.collection.deleteMany({})));
}

async function seedDemo(u) {
  const settings = await Settings.findOne({ key: 'global' }).lean();
  const tz = settings.timezone;
  const now = Date.now();
  const at = (ms) => new Date(ms);
  const log = (userId, action, taskId, message, createdAt, metadata = {}) =>
    ActivityLog.create({ userId, action, entityType: 'Task', entityId: taskId, message, metadata, createdAt });

  async function makeTask(o) {
    const startedAt = at(o.start);
    const originalDeadline = at(o.start + o.durationMin * M);
    const extra = (o.extMinutes || 0) * M;
    const currentDeadline = at(originalDeadline.getTime() + extra);
    const task = new Task({
      title: o.title, description: o.description || '', createdBy: o.by._id, assignedTo: o.to._id, priority: o.priority || 'MEDIUM',
      status: o.status || 'ACTIVE', startedAt, originalDeadline, currentDeadline, originalDuration: o.durationMin,
      extensionCount: o.extMinutes ? 1 : 0, totalExtensionMinutes: o.extMinutes || 0,
      wasOverdue: !!o.wasOverdue, firstOverdueAt: o.wasOverdue ? originalDeadline : undefined,
      createdAt: startedAt, updatedAt: startedAt,
    });
    if (o.completedAt) {
      const completedAt = at(o.completedAt);
      const result = completionResult({ now: completedAt, originalDeadline, currentDeadline });
      const early = isEarlyFinish({ now: completedAt, startedAt, originalDeadline, result });
      Object.assign(task, {
        status: 'COMPLETED', completedAt, completedBy: o.to._id, completionResult: result, earlyFinish: early,
        completionMinutes: Math.round((completedAt - startedAt) / M),
        score: computeScore({ priority: task.priority, result, early }, settings),
      });
    }
    await task.save({ timestamps: false });
    await log(o.by._id, 'TASK_CREATED', task._id, `${o.by.name} created “${task.title}”`, startedAt);
    if (o.by._id.toString() !== o.to._id.toString()) await log(o.by._id, 'TASK_ASSIGNED', task._id, `${o.by.name} assigned “${task.title}” to ${o.to.name}`, startedAt);
    if (o.extMinutes) {
      const reqAt = at(originalDeadline.getTime() - 25 * M);
      const ext = await TaskExtension.create({
        taskId: task._id, requestedBy: o.to._id, approvedBy: o.by._id, decidedBy: o.by._id, requestedMinutes: o.extMinutes,
        reason: o.extReason || 'Client provided additional changes.', status: 'APPROVED', sequence: 1,
        previousDeadline: originalDeadline, newDeadline: currentDeadline, requestedAt: reqAt, approvedAt: at(reqAt.getTime() + 8 * M),
      });
      await log(o.to._id, 'EXTENSION_REQUESTED', task._id, `${o.to.name} requested +${o.extMinutes / 60}h on “${task.title}”`, reqAt, { extensionId: String(ext._id), minutes: o.extMinutes, reason: ext.reason });
      await log(o.by._id, 'EXTENSION_APPROVED', task._id, `${o.by.name} approved +${o.extMinutes / 60}h on “${task.title}”`, ext.approvedAt, { extensionId: String(ext._id), newDeadline: currentDeadline.toISOString() });
    }
    if (o.completedAt) await log(o.to._id, 'TASK_COMPLETED', task._id, `${o.to.name} completed “${task.title}”`, at(o.completedAt), { result: task.completionResult });
    if (o.wasOverdue && !o.completedAt && !o.extMinutes) await log(o.to._id, 'TASK_OVERDUE', task._id, `“${task.title}” passed its deadline`, originalDeadline);
    return task;
  }

  const { sabbir, billah, noman } = u;

  // --- Live tasks
  await makeTask({ title: 'Complete Sattar & Co. Homepage', description: 'Finish responsive version and animation implementation.', by: billah, to: sabbir, priority: 'HIGH', start: now - 6 * H, durationMin: 6 * 60 + 102 });
  await makeTask({ title: 'Homepage Animation Polish', by: noman, to: sabbir, priority: 'MEDIUM', start: now - 1 * H, durationMin: 6 * 60 });
  await makeTask({ title: 'Database Cleanup', description: 'Remove stale sessions and orphaned uploads.', by: billah, to: noman, priority: 'MEDIUM', start: now - 9 * H, durationMin: 9 * 60 - 84, status: 'OVERDUE', wasOverdue: true });
  await makeTask({ title: 'Client Revision Round 2', by: noman, to: sabbir, priority: 'URGENT', start: now - 8 * H, durationMin: 6 * 60, extMinutes: 180, status: 'EXTENDED', wasOverdue: false, extReason: 'Client provided additional design changes.' });
  await makeTask({ title: 'Dashboard API Hardening', by: sabbir, to: billah, priority: 'HIGH', start: now - 2 * H, durationMin: 28 * 60 });
  await makeTask({ title: 'Prepare Q4 Proposal Deck', by: sabbir, to: noman, priority: 'LOW', start: now - 30 * M, durationMin: 3 * D / M });

  // --- Pending extension request (Noman asked Billah)
  const pendingTask = await makeTask({ title: 'Landing Page Copy', by: billah, to: noman, priority: 'MEDIUM', start: now - 5 * H, durationMin: 5 * 60 + 20, status: 'EXTENSION_REQUESTED' });
  const reqAt = at(now - 12 * M);
  const pext = await TaskExtension.create({
    taskId: pendingTask._id, requestedBy: noman._id, requestedMinutes: 120, reason: 'Waiting for brand assets from the client.',
    sequence: 1, previousDeadline: pendingTask.currentDeadline, requestedAt: reqAt,
  });
  await log(noman._id, 'EXTENSION_REQUESTED', pendingTask._id, `${noman.name} requested +2h on “${pendingTask.title}”`, reqAt, { extensionId: String(pext._id), minutes: 120, reason: pext.reason });
  await Notification.create({ userId: billah._id, type: 'EXTENSION_REQUESTED', title: 'Extension requested', message: `Noman asked for +2h on “Landing Page Copy”.`, entityType: 'Task', entityId: pendingTask._id, link: `/tasks/${pendingTask._id}` });

  // --- History (deterministic spread over the last 24 days)
  const people = [sabbir, billah, noman];
  const titles = ['Fix login redirect', 'Invoice template', 'SEO audit', 'Hero section build', 'Pricing page', 'Stripe webhook', 'Mobile nav bug', 'Blog CMS setup', 'Email templates', 'Analytics events', 'Logo variations', 'Contact form', 'Deploy pipeline', 'Image optimisation', 'Footer redesign', 'Accessibility pass', 'Client onboarding doc', 'Backup script', 'Search filters', 'Dark mode tokens', 'Cache layer', 'Sitemap', 'Error pages', 'Newsletter signup'];
  const priorities = ['LOW', 'MEDIUM', 'HIGH', 'MEDIUM', 'URGENT', 'HIGH'];
  for (let i = 0; i < titles.length; i++) {
    const to = people[i % 3];
    const by = people[(i + 1 + (i % 2)) % 3] === to ? people[(i + 2) % 3] : people[(i + 1 + (i % 2)) % 3];
    const start = now - (24 - i) * D + 2 * H;
    const dur = (4 + (i % 5) * 3) * 60;
    const kind = i % 8 === 3 ? 'ext' : i % 11 === 7 ? 'late' : i % 4 === 0 ? 'early' : 'ontime';
    const o = { title: titles[i], by, to, priority: priorities[i % 6], start, durationMin: dur };
    if (kind === 'early') o.completedAt = start + dur * M * 0.35;
    else if (kind === 'ontime') o.completedAt = start + dur * M * 0.9;
    else if (kind === 'ext') { o.extMinutes = 120; o.completedAt = start + (dur + 90) * M; o.wasOverdue = true; }
    else { o.completedAt = start + (dur + 75) * M; o.wasOverdue = true; }
    await makeTask(o);
  }

  // --- Attendance for the last 3 weeks of working days
  const todayK = T.dateKey(new Date(), tz);
  let n = 0;
  for (let i = 21; i >= 1; i--) {
    const key = T.addDaysKey(todayK, -i);
    if (!T.isWorkingDay(key, settings)) continue;
    n++;
    for (const [idx, user] of people.entries()) {
      if (key >= T.addDaysKey(todayK, -1) && false) continue;
      const roll = (n * 7 + idx * 5) % 17;
      if (roll === 0 && idx === 2) { await Attendance.create({ userId: user._id, date: key, status: 'ABSENT', source: 'SYSTEM' }); continue; }
      if (roll === 4 && idx === 1) { await Attendance.create({ userId: user._id, date: key, status: 'LEAVE', source: 'LEAVE', note: 'Personal work' }); continue; }
      const late = (n + idx) % 6 === 0;
      const entry = T.zonedToUtc(key, late ? `09:${20 + ((n * 3) % 25)}` : `08:${50 + ((n + idx * 3) % 10)}`, tz);
      const worked = 8 * 60 + ((n * 11 + idx * 17) % 70);
      await Attendance.create({ userId: user._id, date: key, entryTime: entry, exitTime: new Date(entry.getTime() + worked * M), workingMinutes: worked, status: late ? 'LATE' : 'PRESENT', source: 'CLOCK' });
    }
  }
  // Today: Billah is already in.
  if (T.isWorkingDay(todayK, settings)) {
    const entry = new Date(now - 2 * H);
    await Attendance.create({ userId: billah._id, date: todayK, entryTime: entry, status: 'PRESENT', source: 'CLOCK' });
    await ActivityLog.create({ userId: billah._id, action: 'CLOCK_IN', entityType: 'Attendance', message: 'Billah clocked in', createdAt: entry });
  }

  // A pending leave request from Noman (Sabbir/Billah can approve it)
  const leaveDate = T.addDaysKey(todayK, 3);
  const lv = await LeaveRequest.create({ userId: noman._id, date: leaveDate, type: 'PERSONAL', reason: 'Personal work' });
  await ActivityLog.create({ userId: noman._id, action: 'LEAVE_SUBMITTED', entityType: 'Leave', entityId: lv._id, message: `Noman applied for leave on ${leaveDate}`, metadata: { date: leaveDate } });
  await Notification.create({ userId: sabbir._id, type: 'TASK_ASSIGNED', title: 'New task assigned', message: 'Billah assigned you “Complete Sattar & Co. Homepage”.', entityType: 'Task', link: '/tasks/my' });
  console.log('  + demo tasks, extensions, attendance and activity loaded');
}

(async () => {
  const demo = process.argv.includes('--demo');
  await connectDB();
  console.log('Seeding users…');
  const users = await seedUsers();
  if (demo) {
    console.log('Loading demo data (existing tasks/attendance will be replaced)…');
    await wipe();
    await seedDemo(users);
  }
  console.log(`\nDone. Sign in with username "sabbir", "billah" or "noman".`);
  console.log(`Password: ${config.seedPassword}   (change it from Profile → Security)\n`);
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
