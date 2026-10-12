'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { MEETING_MODES } from '@/lib/constants';
import { fmtMinutes } from '@/lib/format';
import { useServerNow } from '@/lib/clock';
import { useEnter } from '@/hooks/useEnter';
import { useAction, useMeetings } from '@/hooks/queries';
import { useAuth } from '@/components/contexts';
import { Avatar, EmptyState, ErrorState, PageHeader, Skeleton, Stat, Tabs } from '@/components/ui/primitives';
import Modal from '@/components/ui/Modal';
import Icon from '@/components/ui/Icon';
import MeetingForm from '@/components/meetings/MeetingForm';
import MeetingDetail from '@/components/meetings/MeetingDetail';
import { DateTile, PeopleStack, PhaseBadge, RsvpButtons, phaseOf, timeRange, until } from '@/components/meetings/parts';

function MeetingCard({ m, now, onOpen }) {
  const phase = phaseOf(m, now);
  const active = phase === 'upcoming' || phase === 'live';
  const mode = MEETING_MODES.find((x) => x.value === m.mode) || MEETING_MODES[0];
  const rsvp = useAction(({ response }) => api(`/meetings/${m._id}/rsvp`, { method: 'POST', body: { response } }), {
    success: (_d, v) => ({ GOING: 'You’re marked as going.', MAYBE: 'Marked as maybe.', NOT_GOING: 'Marked as can’t go.' }[v.response]),
  });
  return (
    <article data-anim className="card card-pad transition hover:border-accent/40">
      <div className="flex gap-4">
        <DateTile date={m.startsAt} muted={!active} />
        <button type="button" onClick={() => onOpen(m._id)} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`text-base font-extrabold tracking-tight ${phase === 'cancelled' ? 'text-muted line-through' : ''}`}>{m.title}</h3>
            <PhaseBadge m={m} now={now} />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span className="flex items-center gap-1.5"><Icon name="project" className="h-3.5 w-3.5" />{m.projectName}</span>
            <span className="flex items-center gap-1.5"><Icon name="company" className="h-3.5 w-3.5" />{m.companyName}</span>
            <span className="flex items-center gap-1.5"><Icon name="profile" className="h-3.5 w-3.5" />{m.personName}</span>
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold">
            <span className="flex items-center gap-1.5"><Icon name="clock" className="h-3.5 w-3.5 text-muted" />{timeRange(m)} · {fmtMinutes(m.durationMinutes)}</span>
            <span className="flex items-center gap-1.5 text-muted"><Icon name={mode.icon} className="h-3.5 w-3.5" />{mode.label}</span>
          </p>
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line/70 pt-4">
        <div className="flex items-center gap-3">
          <PeopleStack people={m.people} />
          <div className="text-xs">
            <p className="font-bold">{m.counts.going} going{m.counts.maybe ? ` · ${m.counts.maybe} maybe` : ''}{m.counts.notGoing ? ` · ${m.counts.notGoing} no` : ''}</p>
            <p className="flex items-center gap-1.5 text-muted"><Avatar user={m.responsible} size="xs" />{m.responsible?.name} is responsible</p>
          </div>
        </div>
        {active ? <RsvpButtons size="sm" value={m.myResponse} busy={rsvp.isPending} onPick={(response) => rsvp.mutate({ response })} /> : <button className="btn-ghost btn-sm" onClick={() => onOpen(m._id)}>View details</button>}
      </div>
    </article>
  );
}

function MeetingsInner() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const now = useServerNow();
  const { data, isLoading, isError, refetch } = useMeetings();
  const [tab, setTab] = useState('upcoming');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState(null);
  const [form, setForm] = useState({ open: false, meeting: null });
  const ref = useEnter(!!data, { selector: '[data-anim]' });

  // Deep link from a notification: /meetings?open=<id>
  const wanted = params.get('open');
  useEffect(() => { if (wanted) setOpenId(wanted); }, [wanted]);
  const closeDetail = () => { setOpenId(null); if (wanted) router.replace('/meetings'); };

  const groups = useMemo(() => {
    const all = data || [];
    const g = { upcoming: [], past: [], cancelled: [] };
    for (const m of all) {
      const p = phaseOf(m, now);
      if (p === 'cancelled') g.cancelled.push(m);
      else if (p === 'done') g.past.push(m);
      else g.upcoming.push(m);
    }
    g.past.reverse();
    g.cancelled.reverse();
    return g;
  }, [data, now]);

  if (isError) return <ErrorState onRetry={refetch} />;

  const needReply = groups.upcoming.filter((m) => m.myResponse === 'PENDING').length;
  const mineLead = groups.upcoming.filter((m) => String(m.responsible?._id) === String(user._id)).length;
  const next = groups.upcoming[0];
  const term = q.trim().toLowerCase();
  const shown = groups[tab].filter((m) => !term || [m.title, m.projectName, m.companyName, m.personName, m.responsible?.name].some((s) => (s || '').toLowerCase().includes(term)));
  const opened = openId ? (data || []).find((m) => m._id === openId) : null;

  return (
    <div ref={ref}>
      <PageHeader
        eyebrow="Client meetings"
        title="Meetings"
        subtitle="Announce a meeting, name who is responsible, and everyone is notified. Tell the team if you’re going."
        actions={<button className="btn-primary" onClick={() => setForm({ open: true, meeting: null })}><Icon name="meetingAdd" />Announce meeting</button>}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Upcoming" value={groups.upcoming.length} icon="meeting" tone="accent" />
        <Stat label="Next meeting" value={next ? (phaseOf(next, now) === 'live' ? 'Live now' : until(new Date(next.startsAt).getTime() - now)) : '—'} icon="timer" tone="info" sub={next ? `${next.companyName} · ${next.projectName}` : 'Nothing scheduled'} />
        <Stat label="Needs your reply" value={needReply} icon="maybe" tone={needReply ? 'warning' : 'muted'} />
        <Stat label="You’re responsible for" value={mineLead} icon="crown" tone="success" />
      </div>

      <div data-anim className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onChange={setTab} tabs={[
          { value: 'upcoming', label: 'Upcoming', count: groups.upcoming.length },
          { value: 'past', label: 'Past', count: groups.past.length },
          { value: 'cancelled', label: 'Cancelled', count: groups.cancelled.length },
        ]} />
        <div className="relative sm:w-72">
          <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input !pl-10" placeholder="Search project, company, person…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4"><Skeleton className="h-44" /><Skeleton className="h-44" /></div>
      ) : shown.length === 0 ? (
        <div className="card" data-anim>
          <EmptyState icon="meeting" title={term ? 'No meetings match your search' : tab === 'upcoming' ? 'No upcoming meetings' : tab === 'past' ? 'No past meetings yet' : 'Nothing was cancelled'}
            text={tab === 'upcoming' && !term ? 'Announce one and the whole team is notified instantly.' : undefined}
            action={tab === 'upcoming' && !term ? <button className="btn-primary" onClick={() => setForm({ open: true, meeting: null })}>Announce a meeting</button> : undefined} />
        </div>
      ) : (
        <div className="space-y-4">{shown.map((m) => <MeetingCard key={m._id} m={m} now={now} onOpen={setOpenId} />)}</div>
      )}
      <p className="mt-6 text-center text-xs text-muted">Meetings are removed automatically 30 days after they end.</p>

      <Modal open={!!opened} onClose={closeDetail} title={opened?.title} subtitle={opened ? `${opened.projectName} · ${opened.companyName}` : undefined} size="lg">
        {opened && <MeetingDetail meeting={opened} onClose={closeDetail} onEdit={(m) => { setOpenId(null); setForm({ open: true, meeting: m }); }} />}
      </Modal>

      <Modal open={form.open} onClose={() => setForm({ open: false, meeting: null })} title={form.meeting ? 'Edit meeting' : 'Announce a meeting'} subtitle={form.meeting ? undefined : 'Everyone on the team gets a notification right away.'} size="lg">
        {form.open && <MeetingForm key={form.meeting?._id || 'new'} meeting={form.meeting} onDone={() => setForm({ open: false, meeting: null })} onCancel={() => setForm({ open: false, meeting: null })} />}
      </Modal>
    </div>
  );
}

export default function MeetingsPage() {
  return <Suspense fallback={<div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-44" /></div>}><MeetingsInner /></Suspense>;
}