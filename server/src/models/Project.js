const mongoose = require('mongoose');
const { PRIORITIES, PROJECT_STATUSES } = require('../utils/constants');

const { ObjectId } = mongoose.Schema.Types;

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    nameKey: { type: String, required: true, unique: true }, // lower-case name, keeps names unique
    clientName: { type: String, default: '', trim: true, maxlength: 100 },
    description: { type: String, default: '', trim: true, maxlength: 2000 },
    status: { type: String, enum: PROJECT_STATUSES, default: 'ACTIVE', index: true },
    priority: { type: String, enum: PRIORITIES, default: 'MEDIUM' },
    color: { type: String, default: '#6366f1', match: /^#[0-9a-fA-F]{6}$/ },
    lead: { type: ObjectId, ref: 'User', required: true },
    createdBy: { type: ObjectId, ref: 'User', required: true, immutable: true },
    startDate: { type: String, default: null }, // YYYY-MM-DD (team timezone, no time part)
    dueDate: { type: String, default: null },
    link: { type: String, default: '', trim: true, maxlength: 300 }, // live site / repo / drive folder
    tags: { type: [String], default: [] }, // e.g. Next.js, WordPress, Logo
    completedAt: Date,
    // Tasks are deleted 30 days after they close, so finished work is counted here to keep progress accurate.
    completedCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Project', projectSchema);