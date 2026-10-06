const Task = require('../models/Task');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { ok } = require('../utils/respond');
const { OPEN_STATUSES } = require('../utils/constants');
const v = require('../validators');
const svc = require('../services/task.service');
const { getSettings } = require('../services/settings.service');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const csvList = (s) => String(s).split(',').map((x) => x.trim()).filter(Boolean);

async function tabCondition(tab, now, settings) {
  switch (tab) {
    case 'active': return { status: { $in: ['PENDING', 'ACTIVE', 'EXTENDED', 'EXTENSION_REQUESTED'] } };
    case 'dueSoon':
      return { status: { $in: ['ACTIVE', 'EXTENDED', 'EXTENSION_REQUESTED'] }, currentDeadline: { $gt: now, $lte: new Date(now.getTime() + settings.dueSoonMinutes * 60_000) } };
    case 'completed': return { status: 'COMPLETED' };
    case 'overdue': return { $or: [{ status: 'OVERDUE' }, { status: 'EXTENSION_REQUESTED', currentDeadline: { $lte: now } }] };
    case 'extended': return { extensionCount: { $gt: 0 } };
    default: return null;
  }
}

async function buildFilter(q, { mineOf } = {}) {
  const now = new Date();
  const settings = await getSettings();
  const and = [];
  if (mineOf) and.push({ assignedTo: mineOf });
  else if (q.assignedTo) and.push({ assignedTo: q.assignedTo });
  if (q.createdBy) and.push({ createdBy: q.createdBy });
  if (q.priority) and.push({ priority: { $in: csvList(q.priority) } });
  if (q.status) and.push({ status: { $in: csvList(q.status) } });
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    and.push({ $or: [{ title: rx }, { description: rx }] });
  }
  if (q.from || q.to) {
    const range = {};
    if (q.from) { const d = new Date(q.from); if (!Number.isNaN(d.getTime())) range.$gte = d; }
    if (q.to) { const d = new Date(q.to); if (!Number.isNaN(d.getTime())) range.$lte = d; }
    if (Object.keys(range).length) and.push({ currentDeadline: range });
  }
  if (q.completion === 'OPEN') and.push({ status: { $in: OPEN_STATUSES } });
  else if (q.completion) and.push({ status: 'COMPLETED', completionResult: q.completion });
  if (q.extension === 'true') and.push({ extensionCount: { $gt: 0 } });
  if (q.extension === 'false') and.push({ extensionCount: 0 });
  const tab = await tabCondition(q.tab, now, settings);
  if (tab) and.push(tab);
  return and.length ? { $and: and } : {};
}

const SORTS = {
  deadline: { currentDeadline: 1 }, '-deadline': { currentDeadline: -1 },
  created: { createdAt: 1 }, '-created': { createdAt: -1 }, '-completed': { completedAt: -1 },
};

async function listTasks(req, res, mine) {
  await svc.processOverdue();
  const q = v.taskQuery.parse(req.query);
  const filter = await buildFilter(q, { mineOf: mine ? req.user._id : null });
  const sortKey = q.sort || (q.tab === 'completed' ? '-completed' : q.tab && q.tab !== 'all' ? 'deadline' : '-created');
  const [total, docs] = await Promise.all([
    Task.countDocuments(filter),
    Task.find(filter).sort(SORTS[sortKey]).skip((q.page - 1) * q.limit).limit(q.limit).populate(svc.POPULATE),
  ]);
  const items = await svc.decorate(docs, req.user);

  let counts;
  if (mine) {
    const tabs = ['all', 'active', 'dueSoon', 'completed', 'overdue', 'extended'];
    const results = await Promise.all(tabs.map(async (t) => Task.countDocuments(await buildFilter({ tab: t }, { mineOf: req.user._id }))));
    counts = Object.fromEntries(tabs.map((t, i) => [t, results[i]]));
  }
  ok(res, { items, total, page: q.page, pages: Math.max(1, Math.ceil(total / q.limit)), counts });
}

exports.listTeam = asyncHandler((req, res) => listTasks(req, res, false));
exports.listMine = asyncHandler((req, res) => listTasks(req, res, true));

async function one(id, user, opts) {
  const doc = await Task.findById(id).populate(svc.POPULATE);
  if (!doc) throw new AppError('Task not found.', 404);
  const [task] = await svc.decorate([doc], user, opts);
  return task;
}

exports.get = asyncHandler(async (req, res) => {
  await svc.processOverdue();
  ok(res, { task: await one(v.oid.parse(req.params.id), req.user, { withTimeline: true }) });
});

exports.create = asyncHandler(async (req, res) => {
  const input = v.createTask.parse(req.body);
  const task = await svc.createTask(req.user, input);
  ok(res, { task: await one(task._id, req.user) }, 201);
});

exports.update = asyncHandler(async (req, res) => {
  const patch = v.updateTask.parse(req.body);
  const task = await svc.updateTask(req.user, v.oid.parse(req.params.id), patch);
  ok(res, { task: await one(task._id, req.user) });
});

exports.complete = asyncHandler(async (req, res) => {
  const task = await svc.completeTask(req.user, v.oid.parse(req.params.id));
  ok(res, { task: await one(task._id, req.user) });
});

exports.cancel = asyncHandler(async (req, res) => {
  const { reason } = v.cancelTask.parse(req.body || {});
  const task = await svc.cancelTask(req.user, v.oid.parse(req.params.id), reason);
  ok(res, { task: await one(task._id, req.user) });
});

exports.requestExtension = asyncHandler(async (req, res) => {
  const input = v.requestExtension.parse(req.body);
  const ext = await svc.requestExtension(req.user, v.oid.parse(req.params.id), input);
  ok(res, { extension: ext, task: await one(ext.taskId, req.user) }, 201);
});

exports.listExtensions = asyncHandler(async (req, res) => {
  const task = await one(v.oid.parse(req.params.id), req.user);
  ok(res, { extensions: task.extensions });
});
