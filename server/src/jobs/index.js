const cron = require('node-cron');
const taskSvc = require('../services/task.service');
const attendance = require('../services/attendance.service');

function guarded(name, fn) {
  let running = false;
  return async () => {
    if (running) return;
    running = true;
    try {
      await fn();
    } catch (err) {
      console.error(`[jobs] ${name} failed:`, err.message);
    } finally {
      running = false;
    }
  };
}

exports.start = () => {
  // Deadline processing (ACTIVE/EXTENDED -> OVERDUE) + deadline reminders: every minute.
  const deadlines = guarded('deadlines', async () => {
    await taskSvc.processOverdue({ force: true });
    await taskSvc.processReminders();
  });
  // Attendance processing (no attendance -> ABSENT after the workday ends): every 10 minutes.
  const absent = guarded('absent', () => attendance.processAbsent());

  cron.schedule('* * * * *', deadlines);
  cron.schedule('*/10 * * * *', absent);
  deadlines();
  absent();
  console.log('[jobs] scheduled: deadlines (1m), attendance (10m)');
};
