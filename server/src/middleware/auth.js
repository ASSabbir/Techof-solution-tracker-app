const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

exports.signToken = (user, remember = false) =>
  jwt.sign({ sub: String(user._id), tv: user.tokenVersion || 0 }, config.jwtSecret, {
    expiresIn: remember ? config.jwtRememberExpiresIn : config.jwtExpiresIn,
  });

exports.protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new AppError('Please sign in to continue.', 401, 'UNAUTHENTICATED');

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new AppError('Your session has expired. Please sign in again.', 401, 'SESSION_EXPIRED');
  }

  const user = await User.findById(payload.sub).select('+tokenVersion');
  if (!user || user.status !== 'ACTIVE' || (user.tokenVersion || 0) !== payload.tv) {
    throw new AppError('Your session is no longer valid. Please sign in again.', 401, 'SESSION_EXPIRED');
  }

  // Presence heartbeat (at most once a minute)
  if (!user.lastSeenAt || Date.now() - user.lastSeenAt.getTime() > 60_000) {
    User.updateOne({ _id: user._id }, { $set: { lastSeenAt: new Date() } }).catch(() => {});
  }
  req.user = user;
  next();
});
