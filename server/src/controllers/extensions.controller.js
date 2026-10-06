const TaskExtension = require('../models/TaskExtension');
const Task = require('../models/Task');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/respond');
const { USER_FIELDS } = require('../utils/constants');
const v = require('../validators');
const svc = require('../services/task.service');

// Pending requests the current user is allowed to decide on.
exports.pending = asyncHandler(async (req, res) => {
  const pending = await TaskExtension.find({ status: 'PENDING', requestedBy: { $ne: req.user._id } })
    .sort({ requestedAt: 1 })
    .populate('requestedBy', USER_FIELDS)
    .populate({ path: 'taskId', select: 'title createdBy assignedTo currentDeadline originalDeadline priority' })
    .lean();
  const mine = pending.filter((e) => e.taskId && (String(e.taskId.createdBy) === String(req.user._id) || String(e.taskId.createdBy) === String(e.requestedBy._id)));
  ok(res, { extensions: mine });
});

async function decide(req, res, action) {
  const { note } = v.decision.parse(req.body || {});
  const ext = await svc.decideExtension(req.user, v.oid.parse(req.params.id), action, note);
  const task = await Task.findById(ext.taskId).populate(svc.POPULATE);
  const [out] = await svc.decorate([task], req.user);
  ok(res, { extension: ext, task: out });
}
exports.approve = asyncHandler((req, res) => decide(req, res, 'approve'));
exports.reject = asyncHandler((req, res) => decide(req, res, 'reject'));
