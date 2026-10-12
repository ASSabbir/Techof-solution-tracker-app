'use client';
import clsx from 'clsx';
import { RSVP_META, TONE } from '@/lib/constants';
import { fmtMinutes } from '@/lib/format';
import { Avatar, Badge } from '@/components/ui/primitives';
import Icon from '@/components/ui/Icon';

const MIN = 60_000;

/* live / upcoming / done / cancelled, from the server clock */
export function phaseOf(m, now) {
  if (m.status === 'CANCELLED') return 'cancelled';
  const s = new Date(m.startsAt).getTime();
  const e = new Date(m.endsAt).getTime();
  if (now >= e) return 'done';
  if (now >= s) return 'live';
  return 'upcoming';
}

export function until(ms) {
  const mins = Math.max(0, Math.round(ms / MIN));
  if (mins < 1) return 'in a moment';
  if (mins < 60) return `in ${mins}m`;
  if (mins < 24 * 60) return `in ${fmtMinutes(mins)}`;
  const d = Math.floor(mins / 1440);
  return `in ${d} day${d === 1 ? '' : 's'}`;
}

export function PhaseBadge({ m, now }) {
  const p = phaseOf(m, now);
  if (p === 'cancelled') return <Badge tone="danger" dot>Cancelled</Badge>;
  if (p === 'done') return <Badge tone="muted">Completed</Badge>;
  if (p === 'live') return <Badge tone="success" dot>Live now</Badge>;
  const diff = new Date(m.startsAt).getTime() - now;
  return <Badge tone={diff < 3600_000 ? 'warning' : 'info'} dot>{until(diff)}</Badge>;
}

export function DateTile({ date, muted }) {
  const d = new Date(date);
  return (
    <div className={clsx('flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-2xl border', muted ? 'border-line bg-surface-2 text-muted' : 'border-accent/30 bg-accent/10')}>
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">{d.toLocaleDateString('en-US', { month: 'short' })}</span>
      <span className="digit text-xl font-extrabold leading-none">{d.getDate()}</span>
      <span className="text-[10px] font-semibold text-muted">{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
    </div>
  );
}

export const timeRange = (m) => {
  const f = (d) => new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${f(m.startsAt)} – ${f(m.endsAt)}`;
};

/* Going / Maybe / Can't go */
export function RsvpButtons({ value, onPick, busy, size = 'md' }) {
  return (
    <div className="flex flex-wrap gap-2">
      {['GOING', 'MAYBE', 'NOT_GOING'].map((k) => {
        const meta = RSVP_META[k];
        const on = value === k;
        const t = TONE[meta.tone];
        return (
          <button key={k} type="button" disabled={busy} onClick={() => onPick(k)}
            className={clsx('flex items-center gap-1.5 rounded-xl border font-bold transition disabled:opacity-60', size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm', on ? `${t.border} ${t.bg} ${t.text}` : 'border-line bg-surface-2 text-muted hover:border-accent/40 hover:text-ink')}>
            <Icon name={meta.icon} className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />{meta.label}
          </button>
        );
      })}
    </div>
  );
}

/* Small stack of avatars ringed by their answer */
export function PeopleStack({ people }) {
  return (
    <div className="flex -space-x-2">
      {people.map((p) => (
        <span key={p.user._id} title={`${p.user.name}: ${RSVP_META[p.response].label}`} className={clsx('rounded-full ring-2', TONE[RSVP_META[p.response].tone].ring, 'bg-surface')}>
          <Avatar user={p.user} size="sm" />
        </span>
      ))}
    </div>
  );
}

export const isUrl = (s) => /^https?:\/\//i.test(s || '');

export function calendarLink(m) {
  const z = (d) => new Date(d).toISOString().replace(/[-:]|\.\d{3}/g, '');
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${m.title} — ${m.projectName} (${m.companyName})`,
    dates: `${z(m.startsAt)}/${z(m.endsAt)}`,
    details: `Meeting with ${m.personName} (${m.companyName}). Responsible: ${m.responsible?.name}.${m.agenda ? `\n\n${m.agenda}` : ''}`,
    location: m.location || '',
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}