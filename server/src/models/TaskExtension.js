const mongoose = require('mongoose');
const guard = require('../utils/immutable');

const { ObjectId } = mongoose.Schema.Types;

const extensionSchema = new mongoose.Schema({
  taskId: { type: ObjectId, ref: 'Task', required: true, immutable: true },
  requestedBy: { type: ObjectId, ref: 'User', required: true, immutable: true },
  approvedBy: { type: ObjectId, ref: 'User' },
  decidedBy: { type: ObjectId, ref: 'User' },
  requestedMinutes: { type: Number, required: true, immutable: true },
  reason: { type: String, required: true, trim: true, maxlength: 500, immutable: true },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'], default: 'PENDING' },
  sequence: { type: Number, required: true, immutable: true },
  previousDeadline: { type: Date, required: true, immutable: true },
  newDeadline: Date,
  decisionNote: { type: String, default: '' },
  autoApproved: { type: Boolean, default: false },
  requestedAt: { type: Date, default: Date.now, immutable: true },
  approvedAt: Date,
  rejectedAt: Date,
  cancelledAt: Date,
});

// Only one open request per task at a time.
extensionSchema.index({ taskId: 1 }, { unique: true, partialFilterExpression: { status: 'PENDING' } });
extensionSchema.index({ status: 1, requestedAt: -1 });

guard(extensionSchema, {
  protectedPaths: ['taskId', 'requestedBy', 'requestedMinutes', 'reason', 'sequence', 'previousDeadline', 'requestedAt'],
});

module.exports = mongoose.model('TaskExtension', extensionSchema);