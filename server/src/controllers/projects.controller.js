const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/respond');
const v = require('../validators');
const svc = require('../services/project.service');

exports.list = asyncHandler(async (req, res) => ok(res, { projects: await svc.list(req.user) }));
exports.get = asyncHandler(async (req, res) => ok(res, { project: await svc.getOne(req.user, v.oid.parse(req.params.id)) }));
exports.create = asyncHandler(async (req, res) => ok(res, { project: await svc.create(req.user, v.projectCreate.parse(req.body)) }, 201));
exports.update = asyncHandler(async (req, res) => ok(res, { project: await svc.update(req.user, v.oid.parse(req.params.id), v.projectUpdate.parse(req.body)) }));