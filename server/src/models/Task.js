const mongoose = require('mongoose');
const guard = require('../utils/immutable');
const { TASK_STATUSES, PRIORITIES, COMPLETION_RESULTS } = require('../utils/constants');

const { ObjectId } = mongoose.Schema.Types;

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, default: '', trim: true, maxlength: 2000 },
    createdBy: { type: ObjectId, ref: 'User', required: true, immutable: true },
    assignedTo: { type: ObjectId, ref: 'User', required: true, immutable: true },
    priority: { type: String, enum: PRIORITIES, default: 'MEDIUM' },
    status: { type: String, enum: TASK_STATUSES, default: 'ACTIVE', index: true },

    startedAt: { type: Date, required: true, immutable: true },
    originalDeadline: { type: Date, required: true, immutable: true },
    originalDuration: { type: Number, required: true, immutable: true }, // minutes
    currentDeadline: { type: Date, required: true },

    completedAt: Date,
    completedBy: { type: ObjectId, ref: 'User' },
    completionResult: { type: String, enum: [...COMPLETION_RESULTS, null], default: null },
    completionMinutes: Number, // actual time from start to completion
    earlyFinish: { type: Boolean, default: false },
    score: { type: Number, default: 0 }, // snapshot of the score awarded at completion

    extensionCount: { type: Number, default: 0 },
    totalExtensionMinutes: { type: Number, default: 0 },
    remindersSent: { type: [Number], default: [] },

    wasOverdue: { type: Boolean, default: false },
    firstOverdueAt: Date,

    cancelledAt: Date,
    cancelledBy: { type: ObjectId, ref: 'User' },
    cancelReason: { type: String, default: '' },

    // Room for the future Projects module.
    projectId: { type: ObjectId, default: null },
  },
  { timestamps: true }
);

taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ createdBy: 1 });
taskSchema.index({ status: 1, currentDeadline: 1 });
taskSchema.index({ completedAt: -1 });

guard(taskSchema, {
  protectedPaths: ['originalDeadline', 'originalDuration', 'createdBy', 'assignedTo', 'createdAt', 'startedAt'],
});

module.exports = mongoose.model('Task', taskSchema);
