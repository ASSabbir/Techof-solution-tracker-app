'use client';
import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { useServerNow } from '@/lib/clock';
import { OPEN_STATUSES } from '@/lib/constants';
import { fmtClock, fmtOverdue } from '@/lib/format';
import { gsap, motionOK } from '@/lib/motion';
import { ProgressBar } from '@/components/ui/primitives';

// Timing is always derived from the server-synced clock, never the raw browser clock.
export function useTaskTiming(task) {
  const now = useServerNow();
  const open = OPEN_STATUSES.includes(task.status);
  const deadline = new Date(task.currentDeadline).getTime();
  const start = new Date(task.startedAt).getTime();
  const diff = deadline - now;
  let state = 'ok';
  if (!open) state = 'closed';
  else if (diff <= 0) state = 'overdue';
  else if (diff <= 10 * 60_000) state = 'critical';
  else if (diff <= 60 * 60_000) state = 'soon';
  const total = deadline - start;
  const progress = total > 0 ? Math.min(100, Math.max(0, ((now - start) / total) * 100)) : 100;
  return { now, diff, state, progress, open };
}

const STATE_STYLE = {
  ok: { text: 'text-ink', bar: 'accent', label: 'Time remaining' },
  soon: { text: 'text-warning', bar: 'warning', label: 'Time remaining' },
  critical: { text: 'text-danger', bar: 'danger', label: 'Almost out of time' },
  overdue: { text: 'text-danger', bar: 'danger', label: 'Overdue by' },
};

export default function Countdown({ task, size = 'md', showBar = true, className }) {
  const { diff, state, progress, open } = useTaskTiming(task);
  const ref = useRef(null);
  const prev = useRef(state);

  // Only animate when the state changes (ok -> soon -> critical -> overdue), never every second.
  useEffect(() => {
    if (prev.current !== state && ref.current && motionOK()) {
      gsap.fromTo(ref.current, { scale: 1.07 }, { scale: 1, duration: 0.7, ease: 'elastic.out(1, 0.45)' });
    }
    prev.current = state;
  }, [state]);

  if (!open) return null;
  const s = STATE_STYLE[state];
  const overdue = state === 'overdue';
  const digits = overdue ? fmtClock(-diff) : fmtClock(diff);

  return (
    <div className={className}>
      <div ref={ref} className="flex items-end justify-between gap-3 origin-left">
        <div>
          <p className={clsx('digit font-bold leading-none tracking-tight', s.text, size === 'lg' ? 'text-5xl sm:text-6xl' : size === 'sm' ? 'text-xl' : 'text-3xl', state === 'critical' && 'animate-pulse')}>
            {overdue ? '−' : ''}{digits}
          </p>
          <p className="eyebrow mt-2">{overdue ? `Overdue by ${fmtOverdue(-diff)}` : s.label}</p>
        </div>
      </div>
      {showBar && <ProgressBar value={overdue ? 100 : progress} tone={s.bar} className="mt-3" />}
    </div>
  );
}
