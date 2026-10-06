const mongoose = require('mongoose');
const guard = require('../utils/immutable');

const { ObjectId } = mongoose.Schema.Types;

const leaveSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true, immutable: true },
    date: { type: String, required: true, immutable: true },
    type: { type: String, enum: ['CASUAL', 'SICK', 'PERSONAL', 'EMERGENCY', 'OTHER'], default: 'PERSONAL' },
    reason: { type: String, required: true, trim: true, maxlength: 500, immutable: true },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'], default: 'PENDING' },
    approvedBy: { type: ObjectId, ref: 'User' },
    approvedAt: Date,
    rejectedAt: Date,
    decisionNote: { type: String, default: '' },
  },
  { timestamps: true }
);

leaveSchema.index({ userId: 1, date: 1 });
leaveSchema.index({ status: 1, createdAt: -1 });
guard(leaveSchema, { protectedPaths: ['userId', 'date', 'reason'] });

module.exports = mongoose.model('LeaveRequest', leaveSchema);
