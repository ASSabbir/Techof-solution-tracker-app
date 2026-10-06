const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const notificationSchema = new mongoose.Schema({
  userId: { type: ObjectId, ref: 'User', required: true },
  type: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, default: '' },
  entityType: String,
  entityId: ObjectId,
  link: String,
  readAt: Date,
  createdAt: { type: Date, default: Date.now },
});
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, readAt: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
