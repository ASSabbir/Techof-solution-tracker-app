const Task = require('../models/Task');
const TaskExtension = require('../models/TaskExtension');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const AppError = require('../utils/AppError');
const { OPEN_STATUSES, USER_FIELDS } = require('../utils/constants');
const { fmtDuration } = require('../utils/time');
const { completionResult, isEarlyFinish, computeScore } = require('../utils/scoring');
const { getSettings } = require('./settings.service');
const projects = require('./project.service');
const activity = require('./activity.service');
const { notify } = require('./notification.service');

const EXTENDABLE = ['ACTIVE', 'EXTENDED', 'OVERDUE'];
const POPULATE = [
  { path: 'createdBy', select: USER_FIELDS },
  { path: 'assignedTo', select: USER_FIELDS },
  { path: 'completedBy', select: USER_FIELDS },
  { path: 'projectId', select: 'name color status' },
];
const idOf = (v) => String(v && v._id ? v._id : v);

/* Turns { type: 'hours'|'days'|'custom', ... } into a checked deadline date. */
function resolveDeadline(d, now) {
  let deadline;
  if (d.type === 'hours') deadline = new Date(now.getTime() + d.value * 3600_000);
  else if (d.type === 'days') deadline = new Date(now.getTime() + d.value * 86_400_000);
  else deadline = new Date(d.at);
  if (Number.isNaN(deadline.getTime())) throw new AppError('Please choose a valid deadline.', 400);
  if (deadline.getTime() < now.getTime() + 60_000) throw new AppError('The deadline must be at least a minute from now.', 400);
  if (deadline.getTime() - now.getTime() > 366 * 86_400_000) throw new AppError('The deadline is too far in the future.', 400);
  return deadline;
}

/* ------------------------------------------------------------------ create */
// One task per assigned person, all sharing the same title, priority, project and deadline.
async function createTasks(user, input) {
  const now = new Date();
  const ids = [...new Set([].concat(input.assignedTo).map(String))];
  const assignees = await User.find({ _id: { $in: ids }, status: 'ACTIVE' });
  if (!ids.length || assignees.length !== ids.length) throw new AppError('Please choose valid team members.', 400);
  const ordered = ids.map((id) => assignees.find((u) => String(u._id) === id));

  const project = input.projectId ? await projects.assertOpenForTasks(input.projectId) : null;
  const deadline = resolveDeadline(input.deadline, now);
  const group = ordered.length > 1 ? ordered.map((u) => u.name) : null;

  const tasks = [];
  for (const assignee of ordered) {
    const task = await Task.create({
      title: input.title,
      description: input.description,
      createdBy: user._id,
      assignedTo: assignee._id,
      priority: input.priority,
      projectId: project ? input.projectId : null,
      status: 'ACTIVE',
      startedAt: now,
      originalDeadline: deadline,
      currentDeadline: deadline,
      originalDuration: Math.round((deadline - now) / 60000),
    });
    tasks.push(task);

    const meta = { title: task.title, priority: task.priority, assignedTo: String(assignee._id), deadline: deadline.toISOString(), project: project ? project.name : null, sharedWith: group };
    await activity.log(user._id, 'TASK_CREATED', 'Task', task._id, `${user.name} created “${task.title}”${project ? ` in ${project.name}` : ''}`, meta);
    if (String(assignee._id) !== String(user._id)) {
      await activity.log(user._id, 'TASK_ASSIGNED', 'Task', task._id, `${user.name} assigned “${task.title}” to ${assignee.name}`, meta);
      await notify(assignee._id, {
        type: 'TASK_ASSIGNED', title: 'New task assigned',
        message: `${user.name} assigned you “${task.title}”${project ? ` (${project.name})` : ''}${group ? `, together with ${group.filter((n) => n !== assignee.name).join(' and ')}` : ''}.`,
        entityType: 'Task', entityId: task._id, link: `/tasks/${task._id}`,
      });
    }
    await activity.log(user._id, 'DEADLINE_SET', 'Task', task._id, `Deadline set for “${task.title}”`, { deadline: deadline.toISOString() });
  }
  return tasks;
}

/* ---------------------------------------------------------------- complete */
async function completeTask(user, taskId) {
  const task = await Task.findById(taskId);
  if (!task) throw new AppError('Task not found.', 404);
  if (String(task.assignedTo) !== String(user._id)) throw new AppError('Only the assigned person can complete this task.', 403);
  if (!OPEN_STATUSES.includes(task.status)) throw new AppError('This task is already closed.', 409);

  const settings = await getSettings();
  const now = new Date();
  const result = completionResult({ now, originalDeadline: task.originalDeadline, currentDeadline: task.currentDeadline });
  const early = isEarlyFinish({ now, startedAt: task.startedAt, originalDeadline: task.originalDeadline, result });
  const score = computeScore({ priority: task.priority, result, early }, settings);

  const updated = await Task.findOneAndUpdate(
    { _id: task._id, assignedTo: user._id, status: { $in: OPEN_STATUSES } },
    {
      $set: {
        status: 'COMPLETED', completedAt: now, completedBy: user._id, completionResult: result,
        completionMinutes: Math.round((now - task.startedAt) / 60000), earlyFinish: early, score,
      },
    },
    { new: true }
  );
  if (!updated) throw new AppError('This task was just updated. Please refresh and try again.', 409);
  await projects.countCompletion(updated.projectId);

  await TaskExtension.updateMany({ taskId: task._id, status: 'PENDING' }, { $set: { status: 'CANCELLED', cancelledAt: now } });
  await activity.log(user._id, 'TASK_COMPLETED', 'Task', task._id, `${user.name} completed “${task.title}”`, {
    result, score, early, completedAt: now.toISOString(),
    originalDeadline: task.originalDeadline.toISOString(), currentDeadline: task.currentDeadline.toISOString(),
    extensionCount: task.extensionCount, totalExtensionMinutes: task.totalExtensionMinutes,
  });
  await notify(task.createdBy, {
    type: 'TASK_COMPLETED', title: 'Task completed',
    message: `${user.name} completed “${task.title}”.`, entityType: 'Task', entityId: task._id, link: `/tasks/${task._id}`,
  }, user._id);
  return updated;
}

/* ------------------------------------------------------------------ cancel */
async function cancelTask(user, taskId, reason) {
  const task = await Task.findById(taskId);
  if (!task) throw new AppError('Task not found.', 404);
  if (String(task.createdBy) !== String(user._id)) throw new AppError('Only the person who created this task can cancel it.', 403);
  const now = new Date();
  const updated = await Task.findOneAndUpdate(
    { _id: task._id, status: { $in: OPEN_STATUSES } },
    { $set: { status: 'CANCELLED', cancelledAt: now, cancelledBy: user._id, cancelReason: reason || '' } },
    { new: true }
  );
  if (!updated) throw new AppError('This task is already closed.', 409);
  await TaskExtension.updateMany({ taskId: task._id, status: 'PENDING' }, { $set: { status: 'CANCELLED', cancelledAt: now } });
  await activity.log(user._id, 'TASK_CANCELLED', 'Task', task._id, `${user.name} cancelled “${task.title}”`, { reason });
  await notify(task.assignedTo, {
    type: 'TASK_CANCELLED', title: 'Task cancelled',
    message: `${user.name} cancelled “${task.title}”.`, entityType: 'Task', entityId: task._id, link: `/tasks/${task._id}`,
  }, user._id);
  return updated;
}

/* ------------------------------------------------------------------ reopen */
// A cancelled task can be brought back by the person who created it, with a NEW deadline.
// It starts over: the clock, the deadline and the extension allowance are all reset.
async function reopenTask(user, taskId, deadlineInput) {
  const task = await Task.findById(taskId);
  if (!task) throw new AppError('Task not found.', 404);
  if (String(task.createdBy) !== String(user._id)) throw new AppError('Only the person who created this task can reopen it.', 403);
  if (task.status !== 'CANCELLED') throw new AppError('Only cancelled tasks can be reopened.', 409);

  const now = new Date();
  const deadline = resolveDeadline(deadlineInput, now);

  // The start time and original deadline are protected from normal updates, so this one deliberate reset
  // goes straight to the collection. The status filter makes sure it only ever happens to a cancelled task.
  const res = await Task.collection.updateOne(
    { _id: task._id, status: 'CANCELLED' },
    {
      $set: {
        status: 'ACTIVE', startedAt: now, originalDeadline: deadline, currentDeadline: deadline,
        originalDuration: Math.round((deadline - now) / 60000),
        extensionCount: 0, totalExtensionMinutes: 0, remindersSent: [], wasOverdue: false, updatedAt: now,
      },
      $unset: { firstOverdueAt: '', cancelledAt: '', cancelledBy: '', cancelReason: '', expireAt: '' },
    }
  );
  if (!res.modifiedCount) throw new AppError('This task was just updated. Please refresh and try again.', 409);
  // Cancelling scheduled the old extension records for deletion too; keep them while the task is alive.
  await TaskExtension.updateMany({ taskId: task._id }, { $unset: { expireAt: 1 } });

  await activity.log(user._id, 'TASK_REOPENED', 'Task', task._id, `${user.name} reopened “${task.title}” with a new deadline`, { deadline: deadline.toISOString() });
  await notify(task.assignedTo, {
    type: 'TASK_REOPENED', title: 'Task reopened',
    message: `${user.name} reopened “${task.title}” with a new deadline.`, entityType: 'Task', entityId: task._id, link: `/tasks/${task._id}`,
  }, user._id);
  return Task.findById(task._id);
}

/* ------------------------------------------------------------------ update */
async function updateTask(user, taskId, patch) {
  const task = await Task.findById(taskId);
  if (!task) throw new AppError('Task not found.', 404);
  if (String(task.createdBy) !== String(user._id)) throw new AppError('Only the person who created this task can edit it.', 403);
  if (!OPEN_STATUSES.includes(task.status)) throw new AppError('Closed tasks can’t be edited.', 409);

  const before = {};
  const set = {};
  for (const key of ['title', 'description', 'priority']) {
    if (patch[key] !== undefined && patch[key] !== task[key]) {
      before[key] = task[key];
      set[key] = patch[key];
    }
  }
  if (patch.projectId !== undefined) {
    const next = patch.projectId || null;
    if (String(next || '') !== String(task.projectId || '')) {
      if (next) await projects.assertOpenForTasks(next);
      before.projectId = task.projectId ? String(task.projectId) : null;
      set.projectId = next;
    }
  }
  if (!Object.keys(set).length) return task;
  const updated = await Task.findOneAndUpdate({ _id: task._id }, { $set: set }, { new: true });
  await activity.log(user._id, 'TASK_UPDATED', 'Task', task._id, `${user.name} edited “${task.title}”`, { before, after: set });
  return updated;
}

/* -------------------------------------------------------------- extensions */
function approversFor(task, requesterId) {
  return String(task.createdBy) === String(requesterId) ? null : task.createdBy;
}

async function requestExtension(user, taskId, { minutes, reason }) {
  const settings = await getSettings();
  const task = await Task.findById(taskId);
  if (!task) throw new AppError('Task not found.', 404);
  if (String(task.assignedTo) !== String(user._id)) throw new AppError('Only the assigned person can request more time.', 403);
  if (task.status === 'EXTENSION_REQUESTED') throw new AppError('An extension request is already waiting for approval.', 409);
  if (!EXTENDABLE.includes(task.status)) throw new AppError('Extensions can only be requested on open tasks.', 409);
  if (task.extensionCount >= settings.maxExtensionsPerTask) {
    throw new AppError(`This task has reached the maximum of ${settings.maxExtensionsPerTask} extensions.`, 409);
  }
  if (minutes > settings.maxExtensionMinutes) {
    throw new AppError(`You can request at most ${fmtDuration(settings.maxExtensionMinutes)} at a time.`, 400);
  }

  let ext;
  try {
    ext = await TaskExtension.create({
      taskId: task._id, requestedBy: user._id, requestedMinutes: minutes, reason,
      sequence: task.extensionCount + 1, previousDeadline: task.currentDeadline,
    });
  } catch (err) {
    if (err.code === 11000) throw new AppError('An extension request is already waiting for approval.', 409);
    throw err;
  }

  const flipped = await Task.findOneAndUpdate(
    { _id: task._id, assignedTo: user._id, status: { $in: EXTENDABLE } },
    { $set: { status: 'EXTENSION_REQUESTED' } },
    { new: true }
  );
  if (!flipped) {
    await TaskExtension.updateOne({ _id: ext._id, status: 'PENDING' }, { $set: { status: 'CANCELLED', cancelledAt: new Date() } });
    throw new AppError('This task was just updated. Please refresh and try again.', 409);
  }

  await activity.log(user._id, 'EXTENSION_REQUESTED', 'Task', task._id,
    `${user.name} requested +${fmtDuration(minutes)} on “${task.title}”`, { extensionId: String(ext._id), minutes, reason, sequence: ext.sequence });

  // Self-assigned tasks can be approved by any teammate; otherwise the assigner decides.
  const approver = approversFor(task, user._id);
  const recipients = approver || (await User.find({ status: 'ACTIVE', _id: { $ne: user._id } }).distinct('_id'));
  await notify(recipients, {
    type: 'EXTENSION_REQUESTED', title: 'Extension requested',
    message: `${user.name} asked for +${fmtDuration(minutes)} on “${task.title}”.`, entityType: 'Task', entityId: task._id, link: `/tasks/${task._id}`,
  });

  if (!settings.requireExtensionApproval) {
    return decideExtension(null, ext._id, 'approve', 'Auto-approved (approval not required)', { auto: true });
  }
  return ext;
}

function canDecide(task, ext, user) {
  if (String(ext.requestedBy) === String(user._id)) return false; // never approve your own extension
  return String(task.createdBy) === String(user._id) || String(task.createdBy) === String(ext.requestedBy);
}

async function decideExtension(user, extId, action, note = '', { auto = false } = {}) {
  const ext = await TaskExtension.findById(extId);
  if (!ext) throw new AppError('Extension request not found.', 404);
  const task = await Task.findById(ext.taskId);
  if (!task) throw new AppError('Task not found.', 404);
  if (!auto && !canDecide(task, ext, user)) {
    throw new AppError(String(ext.requestedBy) === String(user._id)
      ? 'You can’t approve or reject your own extension request.'
      : 'Only the person who assigned this task can decide on its extension.', 403);
  }
  if (ext.status !== 'PENDING') throw new AppError('This request has already been decided.', 409);

  const now = new Date();
  const actorId = user ? user._id : undefined;
  const actorName = user ? user.name : 'The system';

  if (action === 'approve') {
    const base = Math.max(task.currentDeadline.getTime(), now.getTime());
    const newDeadline = new Date(base + ext.requestedMinutes * 60_000);
    const claimed = await TaskExtension.findOneAndUpdate(
      { _id: ext._id, status: 'PENDING' },
      { $set: { status: 'APPROVED', approvedBy: actorId, decidedBy: actorId, approvedAt: now, newDeadline, decisionNote: note, autoApproved: auto } },
      { new: true }
    );
    if (!claimed) throw new AppError('This request has already been decided.', 409);
    const updated = await Task.findOneAndUpdate(
      { _id: task._id, status: 'EXTENSION_REQUESTED' },
      { $set: { status: 'EXTENDED', currentDeadline: newDeadline, remindersSent: [] }, $inc: { extensionCount: 1, totalExtensionMinutes: ext.requestedMinutes } },
      { new: true }
    );
    if (!updated) throw new AppError('This task was just updated. Please refresh.', 409);
    await activity.log(actorId || ext.requestedBy, 'EXTENSION_APPROVED', 'Task', task._id,
      `${actorName} approved +${fmtDuration(ext.requestedMinutes)} on “${task.title}”`,
      { extensionId: String(ext._id), minutes: ext.requestedMinutes, previousDeadline: ext.previousDeadline.toISOString(), newDeadline: newDeadline.toISOString(), auto });
    await notify(ext.requestedBy, {
      type: 'EXTENSION_APPROVED', title: 'Extension approved',
      message: `${actorName} approved +${fmtDuration(ext.requestedMinutes)} on “${task.title}”.`, entityType: 'Task', entityId: task._id, link: `/tasks/${task._id}`,
    });
    return claimed;
  }

  // reject
  const claimed = await TaskExtension.findOneAndUpdate(
    { _id: ext._id, status: 'PENDING' },
    { $set: { status: 'REJECTED', decidedBy: actorId, rejectedAt: now, decisionNote: note } },
    { new: true }
  );
  if (!claimed) throw new AppError('This request has already been decided.', 409);
  const next = task.currentDeadline.getTime() > now.getTime() ? (task.extensionCount > 0 ? 'EXTENDED' : 'ACTIVE') : 'OVERDUE';
  await Task.findOneAndUpdate({ _id: task._id, status: 'EXTENSION_REQUESTED' }, { $set: { status: next } });
  await activity.log(actorId, 'EXTENSION_REJECTED', 'Task', task._id,
    `${actorName} rejected +${fmtDuration(ext.requestedMinutes)} on “${task.title}”`, { extensionId: String(ext._id), note });
  await notify(ext.requestedBy, {
    type: 'EXTENSION_REJECTED', title: 'Extension rejected',
    message: `${actorName} rejected your extension on “${task.title}”.`, entityType: 'Task', entityId: task._id, link: `/tasks/${task._id}`,
  });
  return claimed;
}

/* ---------------------------------------------------------- scheduled work */
let lastOverdueRun = 0;
async function processOverdue({ force = false } = {}) {
  if (!force && Date.now() - lastOverdueRun < 5000) return 0;
  lastOverdueRun = Date.now();
  const now = new Date();
  const due = await Task.find({
    currentDeadline: { $lte: now },
    $or: [{ status: { $in: ['ACTIVE', 'EXTENDED'] } }, { status: 'EXTENSION_REQUESTED', wasOverdue: false }],
  }).lean();

  let changed = 0;
  for (const t of due) {
    const toOverdue = t.status !== 'EXTENSION_REQUESTED';
    const filter = { _id: t._id, status: t.status, currentDeadline: { $lte: now } };
    const set = { wasOverdue: true };
    if (toOverdue) set.status = 'OVERDUE';
    if (!t.firstOverdueAt) set.firstOverdueAt = now;
    const res = await Task.findOneAndUpdate(filter, { $set: set });
    if (!res) continue;
    changed++;
    await activity.log(t.assignedTo, 'TASK_OVERDUE', 'Task', t._id, `“${t.title}” passed its deadline`, { deadline: t.currentDeadline.toISOString() });
    await notify([t.assignedTo, t.createdBy], {
      type: 'TASK_OVERDUE', title: 'Task overdue',
      message: `“${t.title}” has reached its deadline.`, entityType: 'Task', entityId: t._id, link: `/tasks/${t._id}`,
    });
  }
  return changed;
}

async function processReminders() {
  const settings = await getSettings();
  const levels = [...settings.reminderLevels].sort((a, b) => a - b);
  if (!levels.length) return 0;
  const now = new Date();
  const horizon = new Date(now.getTime() + levels[levels.length - 1] * 60_000);
  const tasks = await Task.find({ status: { $in: ['ACTIVE', 'EXTENDED'] }, currentDeadline: { $gt: now, $lte: horizon } }).lean();

  let sent = 0;
  for (const t of tasks) {
    const remaining = (t.currentDeadline - now) / 60_000;
    const crossed = levels.filter((l) => remaining <= l);
    if (!crossed.length) continue;
    const level = crossed[0]; // tightest crossed level
    const already = (t.remindersSent || []).some((l) => l <= level);
    if (already) continue;
    const marked = await Task.findOneAndUpdate(
      { _id: t._id, remindersSent: { $nin: crossed } },
      { $addToSet: { remindersSent: { $each: levels.filter((l) => l >= level) } } }
    );
    if (!marked) continue;
    sent++;
    await notify(t.assignedTo, {
      type: 'TASK_REMINDER', title: 'Task deadline approaching',
      message: `“${t.title}” — only ${level} minutes remaining.`, entityType: 'Task', entityId: t._id, link: `/tasks/${t._id}`,
    });
  }
  return sent;
}

/* -------------------------------------------------------------- decoration */
async function decorate(tasks, viewer, { withTimeline = false } = {}) {
  const now = new Date();
  const settings = await getSettings();
  const list = tasks.map((t) => (t.toObject ? t.toObject() : t));
  const ids = list.map((t) => t._id);

  const exts = await TaskExtension.find({ taskId: { $in: ids } })
    .sort({ requestedAt: 1 })
    .populate('requestedBy', USER_FIELDS)
    .populate('approvedBy', USER_FIELDS)
    .populate('decidedBy', USER_FIELDS)
    .lean();
  const byTask = new Map();
  for (const e of exts) {
    const k = String(e.taskId);
    if (!byTask.has(k)) byTask.set(k, []);
    byTask.get(k).push(e);
  }

  let timelines = new Map();
  if (withTimeline) {
    const logs = await ActivityLog.find({ entityType: 'Task', entityId: { $in: ids } }).sort({ createdAt: 1 }).populate('userId', USER_FIELDS).lean();
    for (const l of logs) {
      const k = String(l.entityId);
      if (!timelines.has(k)) timelines.set(k, []);
      timelines.get(k).push(l);
    }
  }

  const viewerId = viewer ? String(viewer._id) : null;
  return list.map((o) => {
    const open = OPEN_STATUSES.includes(o.status);
    const history = (byTask.get(String(o._id)) || []).filter((e) => new Date(e.requestedAt) >= new Date(o.startedAt)); // records from before a reopen stay in the log, not on the task
    const pending = history.find((e) => e.status === 'PENDING') || null;
    const remainingMs = new Date(o.currentDeadline).getTime() - now.getTime();
    const isAssignee = viewerId && idOf(o.assignedTo) === viewerId;
    const isCreator = viewerId && idOf(o.createdBy) === viewerId;
    const out = {
      ...o,
      project: o.projectId && o.projectId.name ? { _id: o.projectId._id, name: o.projectId.name, color: o.projectId.color, status: o.projectId.status } : null,
      remainingMs: open ? remainingMs : null,
      overdueMs: open && remainingMs < 0 ? -remainingMs : 0,
      isPastDeadline: open && remainingMs <= 0,
      extensions: history,
      pendingExtension: pending,
      limits: { maxExtensions: settings.maxExtensionsPerTask, maxExtensionMinutes: settings.maxExtensionMinutes },
      permissions: {
        canComplete: !!(isAssignee && open),
        canRequestExtension: !!(isAssignee && EXTENDABLE.includes(o.status) && o.extensionCount < settings.maxExtensionsPerTask),
        canCancel: !!(isCreator && open),
        canReopen: !!(isCreator && o.status === 'CANCELLED'),
        canEdit: !!(isCreator && open),
        canDecideExtension: !!(pending && viewerId && String(idOf(pending.requestedBy)) !== viewerId &&
          (idOf(o.createdBy) === viewerId || idOf(o.createdBy) === idOf(pending.requestedBy))),
      },
    };
    if (withTimeline) out.timeline = timelines.get(String(o._id)) || [];
    return out;
  });
}

module.exports = {
  POPULATE, EXTENDABLE, createTasks, completeTask, cancelTask, reopenTask, updateTask,
  requestExtension, decideExtension, processOverdue, processReminders, decorate,
};