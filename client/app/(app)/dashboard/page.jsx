'use client';
import Link from 'next/link';
import clsx from 'clsx';
import { useServerNow } from '@/lib/clock';
import { fmtLongDate, greeting } from '@/lib/format';
import { PRESENCE_META, TONE } from '@/lib/constants';
import { useEnter } from '@/hooks/useEnter';
import { useDashboard, useMeetings } from '@/hooks/queries';
import { useAuth, useUI } from '@/components/contexts';
import { Avatar, Badge, EmptyState, ErrorState, Skeleton, Stat } from '@/components/ui/primitives';
import Icon from '@/components/ui/Icon';
import TaskCard from '@/components/tasks/TaskCard';
import ClockWidget from '@/components/attendance/ClockWidget';
import ActivityList from '@/components/ActivityList';
import Approvals from '@/components/Approvals';
import { DateTile, PhaseBadge, phaseOf, timeRange } from '@/components/meetings/parts';

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-16 w-80" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      <div className="grid gap-6 lg:grid-cols-3"><Skeleton className="h-64 lg:col-span-2" /><Skeleton className="h-64" /></div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const ui = useUI();
  const now = useServerNow();
  const { data, isLoading, isError, refetch } = useDashboard();
  const meetings = useMeetings();
  const ref = useEnter(!!data);

  if (isLoading) return <DashboardSkeleton />;
  if (isError || !data) return <ErrorState onRetry={refetch} />;

  const s = data.summary;
  const quick = [
    { label: 'Add Task', icon: 'plus', onClick: () => ui.openAddTask() },
    { label: 'My Tasks', icon: 'mine', href: '/tasks/my' },
    { label: 'Request Extension', icon: 'timer', onClick: () => ui.openExtension() },
    { label: 'Apply Leave', icon: 'leave', onClick: () => ui.openLeave() },
    { label: 'Meetings', icon: 'meeting', href: '/meetings' },
    { label: 'Attendance', icon: 'clock', href: '/attendance' },
  ];
  const perf = data.performance;
  const nextMeetings = (meetings.data || []).filter((m) => ['upcoming', 'live'].includes(phaseOf(m, now))).slice(0, 3);

  return (
    <div ref={ref} className="space-y-6">
      <div data-anim className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{greeting(now)}, <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, rgb(var(--accent)), rgb(var(--accent-2)))' }}>{user.name}</span></h1>
        <p className="text-sm font-semibold text-muted">{fmtLongDate(now)}</p>
      </div>

      <div data-anim className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {quick.map((q) => q.href ? (
          <Link key={q.label} href={q.href} className="btn-soft shrink-0"><Icon name={q.icon} />{q.label}</Link>
        ) : (
          <button key={q.label} onClick={q.onClick} className="btn-soft shrink-0"><Icon name={q.icon} />{q.label}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total tasks" value={s.total} icon="layers" tone="accent" />
        <Stat label="Active" value={s.active} icon="zap" tone="info" />
        <Stat label="Completed" value={s.completed} icon="ok" tone="success" />
        <Stat label="Overdue" value={s.overdue} icon="warning" tone={s.overdue ? 'danger' : 'muted'} />
      </div>

      <Approvals extensions={data.approvals.extensions} leaves={data.approvals.leaves} />

      {nextMeetings.length > 0 && (
        <div className="card card-pad" data-anim>
          <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-extrabold">Upcoming meetings</h2><Link href="/meetings" className="text-sm font-bold text-accent hover:underline">View all</Link></div>
          <ul className="grid gap-3 md:grid-cols-3">
            {nextMeetings.map((m) => (
              <li key={m._id}>
                <Link href={`/meetings?open=${m._id}`} className="flex items-start gap-3 rounded-xl border border-line bg-surface-2/50 p-3 transition hover:border-accent/40">
                  <DateTile date={m.startsAt} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold">{m.title}</p>
                    <p className="truncate text-xs text-muted">{m.projectName} · {m.companyName}</p>
                    <p className="mt-0.5 text-xs font-semibold">{timeRange(m)}</p>
                    <div className="mt-1.5 flex items-center gap-2"><PhaseBadge m={m} now={now} />{m.myResponse === 'PENDING' && <span className="text-[11px] font-bold text-warning">Reply needed</span>}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div data-anim className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold">My upcoming tasks</h2>
            <Link href="/tasks/my" className="text-sm font-bold text-accent hover:underline">View all</Link>
          </div>
          {data.upcoming.length === 0 ? (
            <div className="card" data-anim><EmptyState icon="check" title="No active tasks" text="You’re all caught up." action={<button className="btn-primary" onClick={() => ui.openAddTask()}>Create New Task</button>} /></div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">{data.upcoming.map((t) => <TaskCard key={t._id} task={t} />)}</div>
          )}
        </div>

        <div className="space-y-6">
          <ClockWidget />

          <div className="card card-pad" data-anim>
            <p className="eyebrow mb-4">Team status</p>
            <ul className="space-y-3.5">
              {data.team.map((m) => {
                const meta = PRESENCE_META[m.status] || PRESENCE_META.NOT_ACTIVE;
                return (
                  <li key={m._id}>
                    <Link href={`/profile/${m._id}`} className="flex items-center gap-3 rounded-xl transition hover:bg-surface-2/60">
                      <div className="relative"><Avatar user={m} size="md" /><span className={clsx('absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-surface', TONE[meta.tone].solid)} /></div>
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{m.name}</p><p className="text-xs text-muted">{String(m.activeTasks).padStart(2, '0')} active task{m.activeTasks === 1 ? '' : 's'}</p></div>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card card-pad lg:col-span-2" data-anim>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-extrabold">Recent activity</h2><Link href="/activity" className="text-sm font-bold text-accent hover:underline">Full history</Link></div>
          {data.recentActivity.length ? <ActivityList items={data.recentActivity} /> : <EmptyState icon="activity" title="Nothing yet" text="Actions will show up here as they happen." />}
        </div>
        <div className="card card-pad" data-anim>
          <p className="eyebrow mb-4">Team performance</p>
          <dl className="space-y-3.5 text-sm">
            {[['Tasks completed', perf.completed, ''], ['On-time tasks', perf.onTime, 'text-success'], ['Extended tasks', perf.extendedTasks, 'text-accent'], ['Overdue tasks', perf.overdue, 'text-danger']].map(([k, v, c]) => (
              <div key={k} className="flex items-center justify-between"><dt className="text-muted">{k}</dt><dd className={clsx('digit text-lg font-extrabold', c)}>{v}</dd></div>
            ))}
            <div className="flex items-center justify-between border-t border-line pt-3.5"><dt className="text-muted">On-time rate</dt><dd className="digit text-lg font-extrabold">{perf.onTimeRate == null ? '—' : `${perf.onTimeRate}%`}</dd></div>
          </dl>
          <Link href="/leaderboard" className="btn-soft mt-5 w-full"><Icon name="trophy" />Open leaderboard</Link>
        </div>
      </div>
    </div>
  );
}