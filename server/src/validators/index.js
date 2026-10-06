const { z } = require('zod');
const { PRIORITIES } = require('../utils/constants');

const oid = z.string().regex(/^[a-fA-F0-9]{24}$/, 'That request referenced something invalid.');
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD.');
const monthStr = z.string().regex(/^\d{4}-\d{2}$/, 'Use the format YYYY-MM.');
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use the format HH:MM.');
const csv = z.string().optional();
const bool = z.enum(['true', 'false']).optional();

const login = z.object({
  identifier: z.string().trim().min(1, 'Enter your email or username.').max(120),
  password: z.string().min(1, 'Enter your password.').max(200),
  remember: z.boolean().optional().default(false),
});

const changePassword = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  newPassword: z.string().min(8, 'Use at least 8 characters.').max(100),
});

const deadline = z.discriminatedUnion('type', [
  z.object({ type: z.literal('hours'), value: z.number().positive().max(24 * 30) }),
  z.object({ type: z.literal('days'), value: z.number().positive().max(365) }),
  z.object({ type: z.literal('custom'), at: z.string().datetime({ offset: true }) }),
]);

const createTask = z.object({
  title: z.string().trim().min(2, 'Give the task a title.').max(140),
  description: z.string().trim().max(2000).optional().default(''),
  assignedTo: oid,
  priority: z.enum(PRIORITIES).default('MEDIUM'),
  deadline,
});

// Deadlines, status and timestamps can never be edited directly.
const updateTask = z
  .object({
    title: z.string().trim().min(2).max(140).optional(),
    description: z.string().trim().max(2000).optional(),
    priority: z.enum(PRIORITIES).optional(),
  })
  .strict('Deadlines, status and completion details can’t be edited. Request an extension instead.');

const requestExtension = z.object({
  minutes: z.number().int().min(5, 'Request at least 5 minutes.'),
  reason: z.string().trim().min(5, 'Please explain why you need more time.').max(500),
});
const decision = z.object({ note: z.string().trim().max(300).optional().default('') });
const cancelTask = z.object({ reason: z.string().trim().max(300).optional().default('') });

const taskQuery = z.object({
  search: z.string().trim().max(100).optional(),
  assignedTo: oid.optional(),
  createdBy: oid.optional(),
  status: csv,
  priority: csv,
  from: z.string().optional(),
  to: z.string().optional(),
  completion: z.enum(['OPEN', 'ON_TIME', 'WITHIN_EXTENSION', 'LATE']).optional(),
  extension: bool,
  tab: z.enum(['all', 'active', 'dueSoon', 'completed', 'overdue', 'extended']).optional(),
  sort: z.enum(['deadline', '-deadline', 'created', '-created', '-completed']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const leaveCreate = z.object({
  date: dateStr,
  type: z.enum(['CASUAL', 'SICK', 'PERSONAL', 'EMERGENCY', 'OTHER']).default('PERSONAL'),
  reason: z.string().trim().min(3, 'Please add a short reason.').max(500),
});
const leaveQuery = z.object({
  scope: z.enum(['mine', 'team']).default('mine'),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
});

const clockIn = z.object({ override: z.boolean().optional().default(false) });
const historyQuery = z.object({ month: monthStr.optional(), userId: oid.optional() });

const profile = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  avatar: z.string().max(200000).refine((v) => v === '' || v.startsWith('data:image/'), 'Invalid image.').optional(),
});

const settings = z
  .object({
    workdayStart: hhmm,
    lateAfter: hhmm,
    workdayEnd: hhmm,
    workingDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    requireExtensionApproval: z.boolean(),
    maxExtensionsPerTask: z.number().int().min(0).max(20),
    maxExtensionMinutes: z.number().int().min(5).max(7 * 24 * 60),
    dueSoonMinutes: z.number().int().min(5).max(7 * 24 * 60),
    scoring: z.object({
      points: z.object({
        LOW: z.number().min(0).max(100), MEDIUM: z.number().min(0).max(100),
        HIGH: z.number().min(0).max(100), URGENT: z.number().min(0).max(100),
      }).partial(),
      multipliers: z.object({
        ON_TIME: z.number().min(0).max(5), WITHIN_EXTENSION: z.number().min(0).max(5), LATE: z.number().min(0).max(5),
      }).partial(),
      earlyBonus: z.number().min(0).max(2),
    }).partial(),
  })
  .partial()
  .strict();

const activityQuery = z.object({
  userId: oid.optional(),
  entityType: z.enum(['Task', 'Attendance', 'Leave', 'User', 'Settings']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
const leaderboardQuery = z.object({ period: z.enum(['all', 'month', 'week']).default('all') });

module.exports = {
  oid, login, changePassword, createTask, updateTask, requestExtension, decision, cancelTask,
  taskQuery, leaveCreate, leaveQuery, clockIn, historyQuery, profile, settings, activityQuery,
  leaderboardQuery, monthStr, dateStr,
};
