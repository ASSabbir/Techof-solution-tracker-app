// Per-person shift logic. A shift may cross midnight (e.g. 17:00 -> 01:00); it always belongs to the date it STARTS on.
const T = require('./time');

const userShift = (user, settings) => ({
  start: (user && user.shiftStart) || settings.workdayStart,
  end: (user && user.shiftEnd) || settings.workdayEnd,
});

const isOvernight = (s) => T.hhmmToMinutes(s.end) <= T.hhmmToMinutes(s.start);

function windowFor(dateKey, shift, tz) {
  const startUtc = T.zonedToUtc(dateKey, shift.start, tz);
  const endKey = isOvernight(shift) ? T.addDaysKey(dateKey, 1) : dateKey;
  const endUtc = T.zonedToUtc(endKey, shift.end, tz);
  return { date: dateKey, startUtc, endUtc };
}

// Shift days around "now": yesterday, today, tomorrow.
function windows(now, shift, tz) {
  const todayK = T.dateKey(now, tz);
  return [-1, 0, 1].map((n) => windowFor(T.addDaysKey(todayK, n), shift, tz));
}

// The shift whose clock-in window (start - early ... end) contains now, or null.
function currentWindow(now, shift, settings) {
  const early = (settings.clockInEarlyMinutes ?? 60) * 60_000;
  const t = now.getTime();
  const [yest, today, tomorrow] = windows(now, shift, settings.timezone);
  for (const w of [today, yest, tomorrow]) {
    if (t >= w.startUtc.getTime() - early && t <= w.endUtc.getTime()) return w;
  }
  return null;
}

function lastEndedWindow(now, shift, settings) {
  const ended = windows(now, shift, settings.timezone).filter((w) => w.endUtc.getTime() <= now.getTime());
  ended.sort((a, b) => b.endUtc - a.endUtc);
  return ended[0] || null;
}

// The shift that is running now, or the next one to start.
function upcomingWindow(now, shift, settings) {
  const open = windows(now, shift, settings.timezone).filter((w) => w.endUtc.getTime() > now.getTime());
  open.sort((a, b) => a.startUtc - b.startUtc);
  return open[0] || null;
}

// Which attendance date a moment belongs to: each date owns the 24 hours that END when its shift ends.
// So evening work the day before a 1 AM shift counts toward that shift's date. Returns that date's window.
function dayFor(at, shift, tz) {
  const t = at.getTime();
  const todayK = T.dateKey(at, tz);
  for (const n of [-1, 0, 1, 2]) {
    const w = windowFor(T.addDaysKey(todayK, n), shift, tz);
    const end = w.endUtc.getTime();
    if (t > end - 24 * 3600_000 && t <= end) return w;
  }
  return windowFor(todayK, shift, tz);
}

function hhmm12(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function fmtInstant(date, tz) {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).format(date);
}

module.exports = { userShift, isOvernight, windowFor, windows, currentWindow, lastEndedWindow, upcomingWindow, dayFor, hhmm12, fmtInstant };