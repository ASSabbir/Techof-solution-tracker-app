const { ZodError } = require('zod');
const mongoose = require('mongoose');
const AppError = require('../utils/AppError');

exports.notFound = (_req, _res, next) => next(new AppError('That page could not be found.', 404, 'NOT_FOUND'));

// Never leak raw backend errors to the client.
exports.errorHandler = (err, _req, res, _next) => {
  let status = 500;
  let message = 'Something went wrong. Please try again.';
  let code = 'SERVER_ERROR';
  let fields;

  if (err instanceof AppError) {
    ({ status, message, code, fields } = err);
  } else if (err instanceof ZodError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    fields = {};
    for (const issue of err.issues) fields[issue.path.join('.') || '_'] = issue.message;
    message = err.issues[0]?.message || 'Please check the details and try again.';
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    code = 'INVALID_ID';
    message = 'That request referenced something invalid.';
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = Object.values(err.errors)[0]?.message || 'Please check the details and try again.';
  } else if (err && err.code === 11000) {
    status = 409;
    code = 'DUPLICATE';
    message = 'That record already exists.';
  } else if (err && /permanent history|append-only|Protected history/.test(err.message || '')) {
    status = 403;
    code = 'IMMUTABLE_HISTORY';
    message = 'Historical records can’t be changed or removed.';
  } else if (err && err.type === 'entity.too.large') {
    status = 413;
    code = 'TOO_LARGE';
    message = 'That upload is too large.';
  } else if (err && err.type === 'entity.parse.failed') {
    status = 400;
    code = 'BAD_JSON';
    message = 'The request could not be read.';
  }

  if (status >= 500) console.error('[error]', err);
  res.status(status).json({ ok: false, code, message, ...(fields ? { fields } : {}) });
};
