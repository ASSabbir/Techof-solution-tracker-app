const mongoose = require('mongoose');
const guard = require('../utils/immutable');

const { ObjectId } = mongoose.Schema.Types;

// Extra work outside the main shift. A person can have several of these per day (morning, evening...).
const overtimeSchema = new mongoose.Schema({
  entryTime: { type: Date, required: true },
  exitTime: Date,
  minutes: { type: Number, default: 0 },
  summary: { type: String, default: '', maxlength: 500 },
  autoClosed: { type: Boolean, default: false }, // clock-out was forgotten; closed at the 5 hour limit
});

const attendanceSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true, immutable: true },
    date: { type: String, required: true, immutable: true }, // YYYY-MM-DD in the app timezone
    entryTime: Date,
    exitTime: Date,
    workingMinutes: { type: Number, default: 0 },
    // OVERTIME = the person did overtime work for this day but did not clock in for the main shift (shown as "Overtime present").
    status: { type: String, enum: ['PRESENT', 'LATE', 'ABSENT', 'LEAVE', 'HALF_DAY', 'OVERTIME'], required: true },
    source: { type: String, enum: ['CLOCK', 'LEAVE', 'SYSTEM'], default: 'CLOCK' },
    leaveId: { type: ObjectId, ref: 'LeaveRequest' },
    overrideLeave: { type: Boolean, default: false },
    note: { type: String, default: '' },
    workSummary: { type: String, default: '', maxlength: 500 }, // what the person did, written at clock-out
    autoClosed: { type: Boolean, default: false }, // clock-out was forgotten; closed at shift end
    autoPresent: { type: Boolean, default: false }, // made PRESENT automatically by 3+ hours of overtime (no main clock-in)
    overtime: { type: [overtimeSchema], default: [] },
    overtimeMinutes: { type: Number, default: 0 }, // total of the finished overtime sessions
  },
  { timestamps: true }
);

// One attendance record per user per day.
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1 });
guard(attendanceSchema, { protectedPaths: ['userId', 'date'] });

module.exports = mongoose.model('Attendance', attendanceSchema);