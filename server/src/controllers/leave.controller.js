const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/respond');
const v = require('../validators');
const svc = require('../services/leave.service');

exports.create = asyncHandler(async (req, res) => ok(res, { leave: await svc.create(req.user, v.leaveCreate.parse(req.body)) }, 201));
exports.list = asyncHandler(async (req, res) => ok(res, { leaves: await svc.list(req.user, v.leaveQuery.parse(req.query)) }));
exports.approve = asyncHandler(async (req, res) => {
  const { note } = v.decision.parse(req.body || {});
  ok(res, { leave: await svc.decide(req.user, v.oid.parse(req.params.id), 'approve', note) });
});
exports.reject = asyncHandler(async (req, res) => {
  const { note } = v.decision.parse(req.body || {});
  ok(res, { leave: await svc.decide(req.user, v.oid.parse(req.params.id), 'reject', note) });
});
exports.cancel = asyncHandler(async (req, res) => ok(res, { leave: await svc.cancel(req.user, v.oid.parse(req.params.id)) }));
