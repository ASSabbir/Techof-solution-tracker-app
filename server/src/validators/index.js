const { z } = require('zod');
const { PRIORITIES, PROJECT_STATUSES } = require('../utils/constants');

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

// Optional project: an id, or null / empty for "no project".
const projectRef = z.union([oid, z.literal(''), z.null()]).optional();

const createTask = z.object({
  title: z.string().trim().min(2, 'Give the task a title.').max(140),
  description: z.string().trim().max(2000).optional().default(''),
  // One person, or several: every person gets their own copy of the task (own deadline clock, completion and score).
  assignedTo: z.union([oid, z.array(oid).min(1, 'Choose who this is for.').max(10)]),
  priority: z.enum(PRIORITIES).default('MEDIUM'),
  projectId: projectRef,
  deadline,
});

// Deadlines, status and timestamps can never be edited directly.
const updateTask = z
  .object({
    title: z.string().trim().min(2).max(140).optional(),
    description: z.string().trim().max(2000).optional(),
    priority: z.enum(PRIORITIES).optional(),
    projectId: projectRef,
  })
  .strict('Deadlines, status and completion details can’t be edited. Request an extension instead.');

const requestExtension = z.object({
  minutes: z.number().int().min(5, 'Request at least 5 minutes.'),
  reason: z.string().trim().min(5, 'Please explain why you need more time.').max(500),
});
const decision = z.object({ note: z.string().trim().max(300).optional().default('') });
const cancelTask = z.object({ reason: z.string().trim().max(300).optional().default('') });
const reopenTask = z.object({ deadline });

const taskQuery = z.object({
  search: z.string().trim().max(100).optional(),
  assignedTo: oid.optional(),
  createdBy: oid.optional(),
  projectId: z.union([oid, z.literal('none')]).optional(),
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
const clockOut = z.object({ summary: z.string().trim().max(500, 'Keep it under 500 characters.').optional().default('') });
const historyQuery = z.object({ month: monthStr.optional(), userId: oid.optional() });

const profile = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  avatar: z.string().max(200000).refine((v) => v === '' || v.startsWith('data:image/'), 'Invalid image.').optional(),
  // Personal shift; empty string resets to the team default.
  shiftStart: z.union([hhmm, z.literal('')]).optional(),
  shiftEnd: z.union([hhmm, z.literal('')]).optional(),
});

const settings = z
  .object({
    workdayStart: hhmm,
    lateGraceMinutes: z.number().int().min(0).max(180),
    clockInEarlyMinutes: z.number().int().min(0).max(360),
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
  entityType: z.enum(['Task', 'Attendance', 'Leave', 'User', 'Settings', 'Meeting', 'Project']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

const meetingBase = {
  title: z.string().trim().min(3, 'What is the meeting about?').max(140),
  projectName: z.string().trim().min(1, 'Add the project name.').max(100),
  companyName: z.string().trim().min(1, 'Add the company name.').max(100),
  personName: z.string().trim().min(1, 'Who are we meeting?').max(100),
  responsible: oid,
  startsAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().min(5).max(720),
  mode: z.enum(['ONLINE', 'IN_PERSON', 'PHONE']),
  location: z.string().trim().max(300),
  agenda: z.string().trim().max(2000),
};
const meetingCreate = z.object({
  ...meetingBase,
  durationMinutes: meetingBase.durationMinutes.default(60),
  mode: meetingBase.mode.default('ONLINE'),
  location: meetingBase.location.optional().default(''),
  agenda: meetingBase.agenda.optional().default(''),
});
const meetingUpdate = z.object({ ...meetingBase, notes: z.string().trim().max(3000) }).partial().strict();
const meetingRsvp = z.object({
  response: z.enum(['GOING', 'MAYBE', 'NOT_GOING']),
  note: z.string().trim().max(200).optional().default(''),
});

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick one of the colours.');
const optionalDate = z.union([dateStr, z.literal(''), z.null()]).optional();
const projectBase = {
  name: z.string().trim().min(2, 'Give the project a name.').max(100),
  clientName: z.string().trim().max(100),
  description: z.string().trim().max(2000),
  status: z.enum(PROJECT_STATUSES),
  priority: z.enum(PRIORITIES),
  color: hexColor,
  lead: oid,
  startDate: optionalDate,
  dueDate: optionalDate,
  link: z.string().trim().max(300).refine((s) => s === '' || /^https?:\/\//i.test(s), 'Start the link with http:// or https://'),
  tags: z.array(z.string().trim().min(1).max(24)).max(8),
};
const projectCreate = z.object({
  ...projectBase,
  clientName: projectBase.clientName.optional().default(''),
  description: projectBase.description.optional().default(''),
  status: projectBase.status.default('ACTIVE'),
  priority: projectBase.priority.default('MEDIUM'),
  color: projectBase.color.default('#6366f1'),
  link: projectBase.link.optional().default(''),
  tags: projectBase.tags.optional().default([]),
});
const projectUpdate = z.object(projectBase).partial().strict();

const leaderboardQuery = z.object({ period: z.enum(['all', 'month', 'week']).default('all') });

module.exports = {
  oid, login, changePassword, createTask, updateTask, requestExtension, decision, cancelTask, reopenTask,
  taskQuery, leaveCreate, leaveQuery, clockIn, clockOut, historyQuery, profile, settings, activityQuery,
  leaderboardQuery, monthStr, dateStr, meetingCreate, meetingUpdate, meetingRsvp,
  projectCreate, projectUpdate,
};