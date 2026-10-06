// Timezone-aware date helpers. All "calendar day" logic uses the configured app timezone.
const pad = (n) => String(n).padStart(2, '0');
const cache = new Map();

function formatter(tz) {
  if (!cache.has(tz)) {
    cache.set(
      tz,
      new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
    );
  }
  return cache.get(tz);
}

function partsOf(date, tz) {
  const out = {};
  for (const p of formatter(tz).formatToParts(date)) if (p.type !== 'literal') out[p.type] = Number(p.value);
  if (out.hour === 24) out.hour = 0;
  return out;
}

const dateKey = (date, tz) => {
  const p = partsOf(date, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
};
const minutesOfDay = (date, tz) => {
  const p = partsOf(date, tz);
  return p.hour * 60 + p.minute;
};
function tzOffsetMs(date, tz) {
  const p = partsOf(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}
// "2026-10-06" + "18:00" in tz -> UTC Date
function zonedToUtc(key, hhmm, tz) {
  const [y, m, d] = key.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let t = guess - tzOffsetMs(new Date(guess), tz);
  t = guess - tzOffsetMs(new Date(t), tz);
  return new Date(t);
}
const weekdayOf = (key) => new Date(`${key}T00:00:00Z`).getUTCDay(); // 0 = Sunday
function addDaysKey(key, n) {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const hhmmToMinutes = (s) => {
  const [h, m] = String(s).split(':').map(Number);
  return h * 60 + (m || 0);
};
function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  const start = `${y}-${pad(m)}-01`;
  const end = addDaysKey(`${m === 12 ? y + 1 : y}-${pad(m === 12 ? 1 : m + 1)}-01`, -1);
  return { start, end };
}
function listDays(start, end) {
  const out = [];
  for (let k = start; k <= end; k = addDaysKey(k, 1)) out.push(k);
  return out;
}
const isWorkingDay = (key, settings) => settings.workingDays.includes(weekdayOf(key));
function fmtDuration(mins) {
  mins = Math.max(0, Math.round(mins));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

module.exports = {
  dateKey, minutesOfDay, zonedToUtc, weekdayOf, addDaysKey, hhmmToMinutes,
  monthRange, listDays, isWorkingDay, fmtDuration,
};
