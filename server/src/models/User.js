const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    avatar: { type: String, default: '', maxlength: 200000 },
    status: { type: String, enum: ['ACTIVE', 'DISABLED'], default: 'ACTIVE' },
    // MANAGER (Arman Sir) is left out of attendance and the leaderboard. Everyone else is MEMBER.
    role: { type: String, enum: ['ADMIN', 'MANAGER', 'TEAM_LEAD', 'MEMBER'], default: 'MEMBER' },
    // Personal shift (HH:MM, app timezone). Empty = use the team default from Settings. End <= start means the shift crosses midnight.
    shiftStart: { type: String, default: null },
    shiftEnd: { type: String, default: null },
    tokenVersion: { type: Number, default: 0, select: false },
    lastLoginAt: Date,
    lastSeenAt: Date,
    joinedAt: { type: Date, default: Date.now, immutable: true },
  },
  { timestamps: true }
);

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.tokenVersion;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);