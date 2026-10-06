const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/respond');
const v = require('../validators');
const { signToken } = require('../middleware/auth');

// Compared against when the account doesn't exist so response time doesn't reveal valid usernames.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);
const INVALID = 'The email/username or password is incorrect.';

exports.login = asyncHandler(async (req, res) => {
  const { identifier, password, remember } = v.login.parse(req.body);
  const id = identifier.toLowerCase();
  const user = await User.findOne({ $or: [{ email: id }, { username: id }] }).select('+passwordHash +tokenVersion');
  const valid = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !valid || user.status !== 'ACTIVE') throw new AppError(INVALID, 401, 'INVALID_CREDENTIALS');

  user.lastLoginAt = new Date();
  user.lastSeenAt = new Date();
  await user.save();
  ok(res, { token: signToken(user, remember), user: user.toJSON(), remember });
});

// Bumping tokenVersion invalidates every token issued before this moment.
exports.logout = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
  ok(res, { loggedOut: true });
});

exports.me = asyncHandler(async (req, res) => ok(res, { user: req.user.toJSON() }));

exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = v.changePassword.parse(req.body);
  const user = await User.findById(req.user._id).select('+passwordHash +tokenVersion');
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw new AppError('Your current password is incorrect.', 400, 'WRONG_PASSWORD');
  if (currentPassword === newPassword) throw new AppError('Choose a password different from the current one.', 400);
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  ok(res, { token: signToken(user, true), changed: true });
});
