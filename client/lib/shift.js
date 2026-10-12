// "17:00" -> "5:00 PM"
export function hhmm12(hhmm) {
  if (!hhmm) return '—';
  const [h, m] = String(hhmm).split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export const shiftRange = (start, end) => `${hhmm12(start)} – ${hhmm12(end)}`;
export const isOvernight = (start, end) => !!start && !!end && start >= end;