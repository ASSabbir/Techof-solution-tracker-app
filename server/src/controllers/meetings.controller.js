const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/respond');
const v = require('../validators');
const svc = require('../services/meeting.service');

exports.list = asyncHandler(async (req, res) => {
  await svc.processReminders().catch(() => {});
  ok(res, { meetings: await svc.list(req.user) });
});
exports.get = asyncHandler(async (req, res) => ok(res, { meeting: await svc.getOne(req.user, v.oid.parse(req.params.id)) }));
exports.create = asyncHandler(async (req, res) => ok(res, { meeting: await svc.create(req.user, v.meetingCreate.parse(req.body)) }, 201));
exports.update = asyncHandler(async (req, res) => ok(res, { meeting: await svc.update(req.user, v.oid.parse(req.params.id), v.meetingUpdate.parse(req.body)) }));
exports.rsvp = asyncHandler(async (req, res) => ok(res, { meeting: await svc.rsvp(req.user, v.oid.parse(req.params.id), v.meetingRsvp.parse(req.body)) }));
exports.cancel = asyncHandler(async (req, res) => {
  const { reason } = v.cancelTask.parse(req.body || {});
  ok(res, { meeting: await svc.cancel(req.user, v.oid.parse(req.params.id), reason) });
});