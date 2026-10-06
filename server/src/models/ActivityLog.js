const mongoose = require('mongoose');
const guard = require('../utils/immutable');

const { ObjectId } = mongoose.Schema.Types;

const activitySchema = new mongoose.Schema({
  userId: { type: ObjectId, ref: 'User', required: true },
  action: { type: String, required: true },
  entityType: { type: String, required: true },
  entityId: { type: ObjectId },
  message: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now, immutable: true },
});
activitySchema.index({ entityType: 1, entityId: 1, createdAt: 1 });
activitySchema.index({ createdAt: -1 });
activitySchema.index({ userId: 1, createdAt: -1 });

// The audit trail is strictly append-only.
guard(activitySchema, { blockUpdate: true });

module.exports = mongoose.model('ActivityLog', activitySchema);
