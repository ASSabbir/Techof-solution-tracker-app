'use client';
import { useState } from 'react';
import clsx from 'clsx';
import { fmtMinutes } from '@/lib/format';
import { useEnter } from '@/hooks/useEnter';
import { useLeaderboard } from '@/hooks/queries';
import { Avatar, CountUp, ErrorState, PageHeader, ProgressBar, Segmented, Skeleton } from '@/components/ui/primitives';
import Icon from '@/components/ui/Icon';
import Link from 'next/link';

const RANK = ['text-warning', 'text-muted', 'text-orange-400'];

function Metric({ label, value, tone }) {
  return <div><p className="eyebrow !text-[10px]">{label}</p><p className={clsx('digit mt-1 text-xl font-extrabold', tone)}>{value}</p></div>;
}

export default function LeaderboardPage() {
  const [period, setPeriod] = useState('all');
  const { data, isLoading, isError, refetch, isFetching } = useLeaderboard(period);
  const ref = useEnter(!!data);

  return (
    <div ref={ref}>
      <PageHeader eyebrow="Motivation, not competition" title="Leaderboard" subtitle="Ranked by points — quality and timeliness beat task count. Extensions and late work are scored lower."
        actions={<Segmented value={period} onChange={setPeriod} options={[{ value: 'all', label: 'All time' }, { value: 'month', label: '30 days' }, { value: 'week', label: '7 days' }]} />} />

      {isLoading ? (
        <div className="space-y-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-44" />)}</div>
      ) : isError ? <ErrorState onRetry={refetch} /> : (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-2">
            {data.entries.map((e) => {
              const s = e.stats;
              return (
                <div key={e.user._id} data-anim className={clsx('card card-pad', e.rank === 1 && 'border-warning/40 shadow-glow')}>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className={clsx('grid h-12 w-12 place-items-center rounded-2xl bg-surface-2 text-xl font-black', RANK[e.rank - 1])}>{e.rank === 1 ? <Icon name="crown" className="h-6 w-6" /> : e.rank}</div>
                    <Link href={`/profile/${e.user._id}`} className="flex min-w-0 items-center gap-3 hover:opacity-90"><Avatar user={e.user} size="lg" /><div className="min-w-0"><p className="truncate text-xl font-extrabold">{e.user.name}</p><p className="text-xs font-semibold text-muted">{s.completed} completed · {s.openTasks} open</p></div></Link>
                    <div className="ml-auto text-right"><p className="text-3xl font-extrabold"><CountUp value={s.score} decimals={1} /></p><p className="eyebrow">points</p></div>
                  </div>
                  <ProgressBar className="mt-5 !h-2" value={e.scoreShare} animate tone={e.rank === 1 ? 'warning' : 'accent'} />
                  <div className="mt-6 grid grid-cols-3 gap-x-4 gap-y-5 sm:grid-cols-6">
                    <Metric label="Completed" value={s.completed} />
                    <Metric label="On time" value={s.onTime} tone="text-success" />
                    <Metric label="Extended" value={s.extendedTasks} tone="text-accent" />
                    <Metric label="Overdue" value={s.overdue} tone={s.overdue ? 'text-danger' : ''} />
                    <Metric label="Extra time" value={fmtMinutes(s.extraMinutes)} />
                    <Metric label="Completion" value={s.completionRate == null ? '—' : `${s.completionRate}%`} />
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {e.achievements.map((a) => (
                      <span key={a.key} title={a.description} className={clsx('badge normal-case tracking-normal', a.earned ? 'bg-warning/12 text-warning' : 'bg-surface-2 text-muted/70')}>
                        <Icon name={{ 'on-time-master': 'award', 'fast-finisher': 'zap', consistency: 'flame', reliable: 'target', 'deadline-survivor': 'shield' }[a.key]} className="h-3 w-3" />{a.title}{!a.earned && <span className="opacity-70"> {a.progress}/{a.target}</span>}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-6">
            <div className="card card-pad" data-anim>
              <p className="eyebrow mb-4">Team performance</p>
              <dl className="space-y-3 text-sm">
                {[['Tasks completed', data.team.completed], ['On-time tasks', data.team.onTime], ['Extended tasks', data.team.extendedTasks], ['Overdue tasks', data.team.overdue]].map(([k, v]) => <div key={k} className="flex justify-between"><dt className="text-muted">{k}</dt><dd className="digit font-extrabold">{v}</dd></div>)}
                <div className="flex justify-between border-t border-line pt-3"><dt className="text-muted">On-time rate</dt><dd className="digit text-lg font-extrabold">{data.team.onTimeRate == null ? '—' : `${data.team.onTimeRate}%`}</dd></div>
              </dl>
            </div>
            <div className="card card-pad" data-anim>
              <p className="eyebrow mb-4">How scoring works</p>
              <ul className="space-y-2 text-sm">
                {Object.entries(data.scoring.points).map(([k, v]) => <li key={k} className="flex justify-between"><span className="text-muted">{k[0] + k.slice(1).toLowerCase()} task</span><span className="digit font-bold">{v} pt</span></li>)}
              </ul>
              <div className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
                <p className="flex justify-between"><span className="text-muted">Before deadline</span><span className="digit font-bold text-success">×{data.scoring.multipliers.ON_TIME}</span></p>
                <p className="flex justify-between"><span className="text-muted">After approved extension</span><span className="digit font-bold text-accent">×{data.scoring.multipliers.WITHIN_EXTENSION}</span></p>
                <p className="flex justify-between"><span className="text-muted">Completed late</span><span className="digit font-bold text-danger">×{data.scoring.multipliers.LATE}</span></p>
                <p className="flex justify-between"><span className="text-muted">Fast-finisher bonus</span><span className="digit font-bold">+{Math.round(data.scoring.earlyBonus * 100)}%</span></p>
                <p className="flex justify-between"><span className="text-muted">Cancelled</span><span className="digit font-bold">0</span></p>
              </div>
              <p className="mt-4 text-xs text-muted">Ten tiny tasks never outrank one major project. Scoring is configurable in Settings.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
