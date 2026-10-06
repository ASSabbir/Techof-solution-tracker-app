const LeaveRequest = require('../models/LeaveRequest');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const T = require('../utils/time');
const { USER_FIELDS } = require('../utils/constants');
const { getSettings } = require('./settings.service');
const activity = require('./activity.service');
const { notify } = require('./notification.service');

async function create(user, { date, type, reason }) {
  const settings = await getSettings();
  const todayK = T.dateKey(new Date(), settings.timezone);
  if (date < todayK) throw new AppError('Leave can only be requested for today or a future date.', 400);

  const dup = await LeaveRequest.findOne({ userId: user._id, date, status: { $in: ['PENDING', 'APPROVED'] } });
  if (dup) throw new AppError('You already have a leave request for that date.', 409);
  const present = await Attendance.findOne({ userId: user._id, date, entryTime: { $ne: null } });
  if (present) throw new AppError('You’re already marked present on that date.', 409);

  const leave = await LeaveRequest.create({ userId: user._id, date, type, reason });
  await activity.log(user._id, 'LEAVE_SUBMITTED', 'Leave', leave._id, `${user.name} applied for leave on ${date}`, { date, type, reason });
  const others = await User.find({ status: 'ACTIVE', _id: { $ne: user._id } }).distinct('_id');
  await notify(others, {
    type: 'LEAVE_SUBMITTED', title: 'Leave request',
    message: `${user.name} applied for leave on ${date}.`, entityType: 'Leave', entityId: leave._id, link: '/leave',
  });
  return leave;
}

async function decide(user, id, action, note = '') {
  const leave = await LeaveRequest.findById(id);
  if (!leave) throw new AppError('Leave request not found.', 404);
  if (String(leave.userId) === String(user._id)) throw new AppError('You can’t approve or reject your own leave.', 403);
  if (leave.status !== 'PENDING') throw new AppError('This request has already been decided.', 409);
  const now = new Date();

  const set = action === 'approve'
    ? { status: 'APPROVED', approvedBy: user._id, approvedAt: now, decisionNote: note }
    : { status: 'REJECTED', approvedBy: user._id, rejectedAt: now, decisionNote: note };
  const updated = await LeaveRequest.findOneAndUpdate({ _id: leave._id, status: 'PENDING' }, { $set: set }, { new: true });
  if (!updated) throw new AppError('This request has already been decided.', 409);

  if (action === 'approve') {
    try {
      // Reflect approved leave in attendance; never overwrite real presence (explicit override only).
      await Attendance.updateOne(
        { userId: leave.userId, date: leave.date, entryTime: null },
        { $set: { status: 'LEAVE', source: 'LEAVE', leaveId: leave._id, note: leave.reason }, $setOnInsert: { workingMinutes: 0 } },
        { upsert: true }
      );
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }
  const verb = action === 'approve' ? 'approved' : 'rejected';
  await activity.log(user._id, action === 'approve' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED', 'Leave', leave._id,
    `${user.name} ${verb} leave for ${leave.date}`, { date: leave.date, forUser: String(leave.userId), note });
  await notify(leave.userId, {
    type: action === 'approve' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED', title: `Leave ${verb}`,
    message: `${user.name} ${verb} your leave on ${leave.date}.`, entityType: 'Leave', entityId: leave._id, link: '/leave',
  });
  return updated;
}

async function cancel(user, id) {
  const leave = await LeaveRequest.findById(id);
  if (!leave) throw new AppError('Leave request not found.', 404);
  if (String(leave.userId) !== String(user._id)) throw new AppError('You can only cancel your own request.', 403);
  const updated = await LeaveRequest.findOneAndUpdate({ _id: leave._id, status: 'PENDING' }, { $set: { status: 'CANCELLED' } }, { new: true });
  if (!updated) throw new AppError('Only pending requests can be cancelled.', 409);
  await activity.log(user._id, 'LEAVE_CANCELLED', 'Leave', leave._id, `${user.name} cancelled a leave request for ${leave.date}`, { date: leave.date });
  return updated;
}

async function list(user, { scope, status }) {
  const filter = scope === 'team' ? { userId: { $ne: user._id } } : { userId: user._id };
  if (status) filter.status = status;
  return LeaveRequest.find(filter)
    .sort({ date: -1, createdAt: -1 })
    .limit(200)
    .populate('userId', USER_FIELDS)
    .populate('approvedBy', USER_FIELDS)
    .lean();
}

module.exports = { create, decide, cancel, list };
