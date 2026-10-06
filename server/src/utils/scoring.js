// Completion result + score. Kept pure so it can be unit-tested and tuned via settings.
function completionResult({ now, originalDeadline, currentDeadline }) {
  const t = now.getTime();
  if (t <= new Date(originalDeadline).getTime()) return 'ON_TIME';
  if (t <= new Date(currentDeadline).getTime()) return 'WITHIN_EXTENSION';
  return 'LATE';
}

function isEarlyFinish({ now, startedAt, originalDeadline, result }) {
  if (result !== 'ON_TIME') return false;
  const total = new Date(originalDeadline).getTime() - new Date(startedAt).getTime();
  const left = new Date(originalDeadline).getTime() - now.getTime();
  return total > 0 && left / total >= 0.5;
}

function computeScore({ priority, result, early }, settings) {
  const s = settings.scoring;
  const points = s.points[priority] ?? 0;
  let mult = s.multipliers[result] ?? 0;
  if (early) mult *= 1 + (s.earlyBonus || 0);
  return Math.round(points * mult * 100) / 100;
}

module.exports = { completionResult, isEarlyFinish, computeScore };
