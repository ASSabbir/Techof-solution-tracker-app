const mongoose = require('mongoose');
const guard = require('../utils/immutable');

const { ObjectId } = mongoose.Schema.Types;

const attendanceSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true, immutable: true },
    date: { type: String, required: true, immutable: true }, // YYYY-MM-DD in the app timezone
    entryTime: Date,
    exitTime: Date,
    workingMinutes: { type: Number, default: 0 },
    status: { type: String, enum: ['PRESENT', 'LATE', 'ABSENT', 'LEAVE', 'HALF_DAY'], required: true },
    source: { type: String, enum: ['CLOCK', 'LEAVE', 'SYSTEM'], default: 'CLOCK' },
    leaveId: { type: ObjectId, ref: 'LeaveRequest' },
    overrideLeave: { type: Boolean, default: false },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

// One attendance record per user per day.
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1 });
guard(attendanceSchema, { protectedPaths: ['userId', 'date'] });

module.exports = mongoose.model('Attendance', attendanceSchema);
