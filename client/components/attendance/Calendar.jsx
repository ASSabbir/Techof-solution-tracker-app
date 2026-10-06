'use client';
import clsx from 'clsx';
import { ATTENDANCE_META, TONE } from '@/lib/constants';
import { keyToDate } from '@/lib/format';
import Icon from '@/components/ui/Icon';
import { monthLabel } from '@/lib/format';

const WEEK = ['SAT', 'SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI'];
// JS weekday (0=Sun) -> column in a Saturday-first grid
const col = (wd) => (wd + 1) % 7;

export default function Calendar({ month, days = [], selected, onSelect, onPrev, onNext }) {
  const lead = days.length ? col(days[0].weekday) : 0;
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-extrabold tracking-tight">{monthLabel(month)}</h3>
        <div className="flex gap-1.5">
          <button className="btn-soft !p-2" onClick={onPrev} aria-label="Previous month"><Icon name="left" /></button>
          <button className="btn-soft !p-2" onClick={onNext} aria-label="Next month"><Icon name="right" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5 text-center sm:gap-2">
        {WEEK.map((d) => <div key={d} className="eyebrow pb-1 !text-[10px]">{d}</div>)}
        {Array.from({ length: lead }).map((_, i) => <div key={`l${i}`} />)}
        {days.map((d) => {
          const st = d.record?.status;
          const meta = st ? ATTENDANCE_META[st] : null;
          const t = meta ? TONE[meta.tone] : null;
          const day = Number(d.date.slice(8));
          return (
            <button key={d.date} onClick={() => onSelect(d.date)} title={meta?.label}
              className={clsx('relative aspect-square rounded-xl border text-sm font-bold transition duration-200 hover:-translate-y-0.5',
                selected === d.date ? 'border-accent shadow-glow' : 'border-line/70',
                t ? `${t.bg} ${t.text}` : d.isWorkingDay ? 'bg-surface-2/60 text-ink' : 'bg-transparent text-muted/50',
                d.isToday && 'ring-2 ring-accent/50 ring-offset-2 ring-offset-surface')}>
              {day}
              {meta && <span className={clsx('absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full', t.solid)} />}
            </button>
          );
        })}
      </div>
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
        {Object.entries(ATTENDANCE_META).filter(([k]) => k !== 'HALF_DAY').map(([k, m]) => (
          <span key={k} className="flex items-center gap-2 text-xs font-semibold text-muted"><span className={clsx('h-2.5 w-2.5 rounded-full', TONE[m.tone].solid)} />{m.label}</span>
        ))}
      </div>
    </div>
  );
}

export function DayDetail({ day }) {
  if (!day) return <p className="text-sm text-muted">Select a date to see the details.</p>;
  const r = day.record;
  const meta = r ? ATTENDANCE_META[r.status] : null;
  const fmt = (d) => (d ? new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—');
  const worked = r?.workingMinutes ? `${String(Math.floor(r.workingMinutes / 60)).padStart(2, '0')}h ${String(r.workingMinutes % 60).padStart(2, '0')}m` : '—';
  return (
    <div>
      <p className="text-lg font-extrabold">{keyToDate(day.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      {!r ? (
        <p className="mt-3 text-sm text-muted">{day.isFuture ? 'This day hasn’t happened yet.' : day.isWorkingDay ? 'No attendance recorded.' : 'Day off.'}</p>
      ) : (
        <dl className="mt-4 divide-y divide-line/70 text-sm">
          {[['Entry', fmt(r.entryTime)], ['Exit', fmt(r.exitTime)], ['Working', worked]].map(([k, v]) => (
            <div key={k} className="flex justify-between py-2.5"><dt className="text-muted">{k}</dt><dd className="digit font-bold">{v}</dd></div>
          ))}
          <div className="flex justify-between py-2.5"><dt className="text-muted">Status</dt><dd className={clsx('font-bold', TONE[meta.tone].text)}>{meta.label}</dd></div>
          {r.note && <div className="flex justify-between gap-4 py-2.5"><dt className="text-muted">Reason</dt><dd className="text-right font-semibold">{r.note}</dd></div>}
          {r.overrideLeave && <div className="py-2.5 text-xs font-semibold text-warning">Clocked in over approved leave</div>}
        </dl>
      )}
    </div>
  );
}
