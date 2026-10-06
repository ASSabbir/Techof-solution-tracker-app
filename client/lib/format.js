const pad = (n) => String(Math.floor(Math.abs(n))).padStart(2, '0');

export function splitMs(ms) {
  const total = Math.floor(Math.abs(ms) / 1000);
  return { days: Math.floor(total / 86400), hours: Math.floor((total % 86400) / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60 };
}

// 01:42:36  (or "2d 04:12:00" beyond 48h)
export function fmtClock(ms) {
  const { days, hours, minutes, seconds } = splitMs(ms);
  if (days >= 2) return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(days * 24 + hours)}:${pad(minutes)}:${pad(seconds)}`;
}

// "01h 24m"
export function fmtOverdue(ms) {
  const { days, hours, minutes } = splitMs(ms);
  const h = days * 24 + hours;
  return h ? `${pad(h)}h ${pad(minutes)}m` : `${pad(minutes)}m`;
}

// minutes -> "2h 30m"
export function fmtMinutes(mins) {
  mins = Math.max(0, Math.round(mins || 0));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}
// minutes -> "09h 08m"
export const fmtWorked = (mins) => `${pad(Math.floor((mins || 0) / 60))}h ${pad((mins || 0) % 60)}m`;

const timeFmt = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
const dateShort = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const dateLong = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const dateFull = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export const fmtTime = (d) => (d ? timeFmt.format(new Date(d)) : '—');
export const fmtDateShort = (d) => dateShort.format(new Date(d));
export const fmtDateFull = (d) => dateFull.format(new Date(d));
export const fmtDateTime = (d) => (d ? `${dateShort.format(new Date(d))}, ${timeFmt.format(new Date(d))}` : '—');
export const fmtLongDate = (d) => dateLong.format(new Date(d));

const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// "Today, 7:00 PM" / "Tomorrow, 9:00 AM" / "Oct 9, 5:00 PM"
export function fmtDeadline(deadline, nowMs) {
  const d = new Date(deadline);
  const now = new Date(nowMs);
  const tomorrow = new Date(now.getTime() + 86400000);
  const yesterday = new Date(now.getTime() - 86400000);
  const t = timeFmt.format(d);
  if (sameDay(d, now)) return `Today, ${t}`;
  if (sameDay(d, tomorrow)) return `Tomorrow, ${t}`;
  if (sameDay(d, yesterday)) return `Yesterday, ${t}`;
  return `${dateShort.format(d)}, ${t}`;
}

export function timeAgo(date, nowMs) {
  const diff = Math.max(0, nowMs - new Date(date).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 45) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m || 1} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} day${d === 1 ? '' : 's'} ago`;
  return fmtDateShort(date);
}

export function greeting(nowMs) {
  const h = new Date(nowMs).getHours();
  if (h < 5) return 'Working late';
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  if (h < 21) return 'Good Evening';
  return 'Good Night';
}

export const pad2 = pad;
export const initials = (name = '') => name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '?';

// Convert a Date to the value a <input type="datetime-local"> expects (local time).
export function toLocalInput(date) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export const monthLabel = (m) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};
export const shiftMonth = (m, delta) => {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
export const keyToDate = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const minutesToClock = (mins) => {
  if (mins == null) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${pad(h % 12 || 12)}:${pad(m)} ${ap}`;
};
