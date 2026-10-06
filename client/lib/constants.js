// Visual language for statuses, priorities and attendance. Colours come from CSS variables so they follow the theme.
export const OPEN_STATUSES = ['PENDING', 'ACTIVE', 'EXTENDED', 'OVERDUE', 'EXTENSION_REQUESTED'];

export const STATUS_META = {
  PENDING: { label: 'Pending', tone: 'muted' },
  ACTIVE: { label: 'Active', tone: 'info' },
  COMPLETED: { label: 'Completed', tone: 'success' },
  OVERDUE: { label: 'Overdue', tone: 'danger' },
  EXTENSION_REQUESTED: { label: 'Extension requested', tone: 'warning' },
  EXTENDED: { label: 'Extended', tone: 'accent' },
  CANCELLED: { label: 'Cancelled', tone: 'muted' },
};

export const PRIORITY_META = {
  LOW: { label: 'Low', tone: 'muted', points: 1 },
  MEDIUM: { label: 'Medium', tone: 'info', points: 3 },
  HIGH: { label: 'High', tone: 'warning', points: 5 },
  URGENT: { label: 'Urgent', tone: 'danger', points: 8 },
};

export const RESULT_META = {
  ON_TIME: { label: 'Completed on time', short: 'On time', tone: 'success' },
  WITHIN_EXTENSION: { label: 'Completed within approved extension', short: 'Within extension', tone: 'accent' },
  LATE: { label: 'Completed after the deadline', short: 'Late', tone: 'danger' },
};

export const ATTENDANCE_META = {
  PRESENT: { label: 'Present', tone: 'success' },
  LATE: { label: 'Late', tone: 'warning' },
  LEAVE: { label: 'Leave', tone: 'info' },
  ABSENT: { label: 'Absent', tone: 'danger' },
  HALF_DAY: { label: 'Half day', tone: 'accent' },
};

export const PRESENCE_META = {
  ACTIVE: { label: 'Active', tone: 'success' },
  AWAY: { label: 'Away', tone: 'warning' },
  OVERDUE_TASK: { label: 'Overdue task', tone: 'danger' },
  NOT_ACTIVE: { label: 'Not active', tone: 'muted' },
};

export const LEAVE_META = {
  PENDING: { label: 'Pending', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  CANCELLED: { label: 'Cancelled', tone: 'muted' },
};
export const LEAVE_TYPES = [
  { value: 'PERSONAL', label: 'Personal' },
  { value: 'CASUAL', label: 'Casual' },
  { value: 'SICK', label: 'Sick' },
  { value: 'EMERGENCY', label: 'Emergency' },
  { value: 'OTHER', label: 'Other' },
];

// Tailwind classes per tone (kept literal so Tailwind's scanner sees them).
export const TONE = {
  success: { text: 'text-success', bg: 'bg-success/12', ring: 'ring-success/30', solid: 'bg-success', border: 'border-success/30' },
  danger: { text: 'text-danger', bg: 'bg-danger/12', ring: 'ring-danger/30', solid: 'bg-danger', border: 'border-danger/30' },
  warning: { text: 'text-warning', bg: 'bg-warning/12', ring: 'ring-warning/30', solid: 'bg-warning', border: 'border-warning/30' },
  info: { text: 'text-info', bg: 'bg-info/12', ring: 'ring-info/30', solid: 'bg-info', border: 'border-info/30' },
  accent: { text: 'text-accent', bg: 'bg-accent/12', ring: 'ring-accent/30', solid: 'bg-accent', border: 'border-accent/30' },
  muted: { text: 'text-muted', bg: 'bg-muted/12', ring: 'ring-muted/30', solid: 'bg-muted', border: 'border-muted/30' },
};

export const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/tasks/my', label: 'My Tasks', icon: 'mine' },
  { href: '/tasks/team', label: 'Team Tasks', icon: 'team' },
  { href: '/leaderboard', label: 'Leaderboard', icon: 'trophy' },
  { href: '/attendance', label: 'Attendance', icon: 'clock' },
  { href: '/leave', label: 'Leave', icon: 'leave' },
  { href: '/activity', label: 'Activity', icon: 'activity' },
  { href: '/profile', label: 'Profile', icon: 'profile' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
];
