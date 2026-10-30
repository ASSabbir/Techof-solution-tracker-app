const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { OPEN_STATUSES, USER_FIELDS } = require('../utils/constants');
const { notify } = require('./notification.service');
const activity = require('./activity.service');

const STATUS_TEXT = { PLANNING: 'Planning', ACTIVE: 'Active', ON_HOLD: 'On hold', COMPLETED: 'Completed', ARCHIVED: 'Archived' };
const idOf = (v) => String(v && v._id ? v._id : v);
const keyOf = (name) => String(name).trim().toLowerCase();

const populate = (q) => q.populate('lead', USER_FIELDS).populate('createdBy', USER_FIELDS);
const activeIds = () => User.find({ status: 'ACTIVE' }).distinct('_id');

/* Live numbers from open tasks, plus the lifetime "completed" counter kept on the project. */
async function openStats(ids) {
  const now = new Date();
  const rows = await Task.aggregate([
    { $match: { projectId: { $in: ids }, status: { $in: OPEN_STATUSES } } },
    {
      $group: {
        _id: '$projectId',
        open: { $sum: 1 },
        overdue: { $sum: { $cond: [{ $or: [{ $eq: ['$status', 'OVERDUE'] }, { $and: [{ $eq: ['$status', 'EXTENSION_REQUESTED'] }, { $lte: ['$currentDeadline', now] }] }] }, 1, 0] } },
        nextDeadline: { $min: '$currentDeadline' },
      },
    },
  ]);
  return new Map(rows.map((r) => [String(r._id), r]));
}

function decorate(p, viewer, statsMap) {
  const obj = p.toObject ? p.toObject() : p;
  const s = statsMap.get(String(obj._id)) || {};
  const open = s.open || 0;
  const completed = obj.completedCount || 0;
  const total = open + completed;
  const { nameKey, ...rest } = obj;
  return {
    ...rest,
    stats: {
      open, completed, total, overdue: s.overdue || 0,
      nextDeadline: s.nextDeadline || null,
      progress: total ? Math.round((completed / total) * 100) : null,
    },
    canManage: idOf(obj.createdBy) === String(viewer._id) || idOf(obj.lead) === String(viewer._id) || viewer.role === 'MANAGER',
  };
}

async function list(viewer) {
  const items = await populate(Project.find({}).sort({ updatedAt: -1 }));
  const stats = await openStats(items.map((p) => p._id));
  return items.map((p) => decorate(p, viewer, stats));
}

async function getOne(viewer, id) {
  const p = await populate(Project.findById(id));
  if (!p) throw new AppError('Project not found.', 404);
  const stats = await openStats([p._id]);
  const out = decorate(p, viewer, stats);

  // Who is carrying how many open tasks on this project.
  const rows = await Task.aggregate([
    { $match: { projectId: p._id, status: { $in: OPEN_STATUSES } } },
    { $group: { _id: '$assignedTo', open: { $sum: 1 } } },
  ]);
  const users = await User.find({ _id: { $in: rows.map((r) => r._id) } }).select(USER_FIELDS).lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  out.workload = rows
    .map((r) => ({ user: byId.get(String(r._id)), open: r.open }))
    .filter((r) => r.user)
    .sort((a, b) => b.open - a.open);
  return out;
}

function checkDates(startDate, dueDate) {
  if (startDate && dueDate && dueDate < startDate) throw new AppError('The due date can’t be before the start date.', 400);
}

async function checkLead(id) {
  const lead = await User.findOne({ _id: id, status: 'ACTIVE' }).select('name').lean();
  if (!lead) throw new AppError('Please choose a valid project lead.', 400);
  return lead;
}

async function create(user, input) {
  const lead = await checkLead(input.lead);
  const startDate = input.startDate || null;
  const dueDate = input.dueDate || null;
  checkDates(startDate, dueDate);
  if (await Project.exists({ nameKey: keyOf(input.name) })) throw new AppError('A project with this name already exists.', 409);

  let p;
  try {
    p = await Project.create({ ...input, startDate, dueDate, nameKey: keyOf(input.name), createdBy: user._id });
  } catch (err) {
    if (err.code === 11000) throw new AppError('A project with this name already exists.', 409);
    throw err;
  }

  await activity.log(user._id, 'PROJECT_CREATED', 'Project', p._id, `${user.name} started the project “${p.name}”`, { name: p.name, lead: String(p.lead) });
  const everyone = await activeIds();
  await notify(everyone.filter((i) => String(i) !== String(p.lead)), {
    type: 'PROJECT_CREATED', title: 'New project',
    message: `${user.name} added “${p.name}”${input.clientName ? ` for ${input.clientName}` : ''}.`, entityType: 'Project', entityId: p._id, link: `/projects/${p._id}`,
  }, user._id);
  if (String(p.lead) !== String(user._id)) {
    await notify(p.lead, {
      type: 'PROJECT_LEAD', title: 'You’re leading a project',
      message: `${user.name} made you the lead of “${p.name}”.`, entityType: 'Project', entityId: p._id, link: `/projects/${p._id}`,
    });
  }
  return getOne(user, p._id);
}

async function update(user, id, patch) {
  const p = await Project.findById(id);
  if (!p) throw new AppError('Project not found.', 404);
  const allowed = idOf(p.createdBy) === String(user._id) || idOf(p.lead) === String(user._id) || user.role === 'MANAGER';
  if (!allowed) throw new AppError('Only the person who added this project, or its lead, can edit it.', 403);

  const before = {};
  const set = {};
  for (const k of ['name', 'clientName', 'description', 'status', 'priority', 'color', 'link', 'tags']) {
    if (patch[k] === undefined) continue;
    const cur = p[k];
    const same = Array.isArray(cur) ? JSON.stringify([...cur]) === JSON.stringify(patch[k]) : cur === patch[k];
    if (!same) { before[k] = cur; set[k] = patch[k]; }
  }
  for (const k of ['startDate', 'dueDate']) {
    if (patch[k] === undefined) continue;
    const next = patch[k] || null;
    if (next !== (p[k] || null)) { before[k] = p[k]; set[k] = next; }
  }
  if (patch.lead !== undefined && String(patch.lead) !== idOf(p.lead)) {
    await checkLead(patch.lead);
    before.lead = String(p.lead);
    set.lead = patch.lead;
  }
  if (!Object.keys(set).length) return getOne(user, id);

  checkDates(set.startDate !== undefined ? set.startDate : p.startDate, set.dueDate !== undefined ? set.dueDate : p.dueDate);
  if (set.name) {
    const clash = await Project.exists({ nameKey: keyOf(set.name), _id: { $ne: p._id } });
    if (clash) throw new AppError('A project with this name already exists.', 409);
    set.nameKey = keyOf(set.name);
  }
  if (set.status === 'COMPLETED') set.completedAt = new Date();
  else if (set.status) set.completedAt = undefined;

  const oldName = p.name;
  p.set(set);
  try { await p.save(); } catch (err) {
    if (err.code === 11000) throw new AppError('A project with this name already exists.', 409);
    throw err;
  }

  const everyone = await activeIds();
  if (set.status) {
    await activity.log(user._id, 'PROJECT_STATUS', 'Project', p._id, `${user.name} marked “${p.name}” as ${STATUS_TEXT[set.status]}`, { from: before.status, to: set.status });
    await notify(everyone, {
      type: 'PROJECT_STATUS', title: 'Project status changed',
      message: `${user.name} marked “${p.name}” as ${STATUS_TEXT[set.status].toLowerCase()}.`, entityType: 'Project', entityId: p._id, link: `/projects/${p._id}`,
    }, user._id);
  }
  const others = Object.keys(set).filter((k) => !['status', 'nameKey', 'completedAt'].includes(k));
  if (others.length) {
    await activity.log(user._id, 'PROJECT_UPDATED', 'Project', p._id, `${user.name} updated “${oldName}”`, { before, after: set });
  }
  if (set.lead && String(set.lead) !== String(user._id)) {
    await notify(set.lead, {
      type: 'PROJECT_LEAD', title: 'You’re leading a project',
      message: `${user.name} made you the lead of “${p.name}”.`, entityType: 'Project', entityId: p._id, link: `/projects/${p._id}`,
    });
  }
  return getOne(user, p._id);
}

/* Used by tasks: returns the project if tasks may be added to it, otherwise throws. Live and archived projects are fine; only completed ones are closed. */
async function assertOpenForTasks(projectId) {
  const p = await Project.findById(projectId).select('name status').lean();
  if (!p) throw new AppError('Please choose a valid project.', 400);
  if (p.status === 'COMPLETED') throw new AppError(`“${p.name}” is completed. Reopen it first to add tasks.`, 409);
  return p;
}

async function countCompletion(projectId) {
  if (!projectId) return;
  try { await Project.updateOne({ _id: projectId }, { $inc: { completedCount: 1 } }); } catch (err) { console.error('[project] could not count completion:', err.message); }
}

module.exports = { list, getOne, create, update, assertOpenForTasks, countCompletion };