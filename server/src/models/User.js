const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    avatar: { type: String, default: '', maxlength: 200000 },
    status: { type: String, enum: ['ACTIVE', 'DISABLED'], default: 'ACTIVE' },
    // Reserved for the future role system (Admin / Manager / Team Lead / Member). Not used by the UI in v1.
    role: { type: String, enum: ['ADMIN', 'MANAGER', 'TEAM_LEAD', 'MEMBER'], default: 'MEMBER' },
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
