const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const rsvpSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true },
    response: { type: String, enum: ['GOING', 'MAYBE', 'NOT_GOING'], required: true },
    note: { type: String, default: '', maxlength: 200 },
    respondedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const meetingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 }, // what the meeting is about
    projectName: { type: String, required: true, trim: true, maxlength: 100 },
    companyName: { type: String, required: true, trim: true, maxlength: 100 },
    personName: { type: String, required: true, trim: true, maxlength: 100 }, // the person we are meeting
    responsible: { type: ObjectId, ref: 'User', required: true }, // the teammate who leads / is accountable
    createdBy: { type: ObjectId, ref: 'User', required: true, immutable: true },

    startsAt: { type: Date, required: true },
    durationMinutes: { type: Number, default: 60, min: 5, max: 720 },
    mode: { type: String, enum: ['ONLINE', 'IN_PERSON', 'PHONE'], default: 'ONLINE' },
    location: { type: String, default: '', trim: true, maxlength: 300 }, // meeting link, address or phone number
    agenda: { type: String, default: '', trim: true, maxlength: 2000 },
    notes: { type: String, default: '', trim: true, maxlength: 3000 }, // minutes / outcome, written afterwards

    status: { type: String, enum: ['SCHEDULED', 'CANCELLED'], default: 'SCHEDULED' },
    cancelledAt: Date,
    cancelledBy: { type: ObjectId, ref: 'User' },
    cancelReason: { type: String, default: '' },

    rsvps: { type: [rsvpSchema], default: [] },
    remindersSent: { type: [Number], default: [] },

    // Removed automatically 30 days after the meeting (MongoDB TTL).
    expireAt: Date,
  },
  { timestamps: true }
);

meetingSchema.index({ startsAt: 1 });
meetingSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Meeting', meetingSchema);