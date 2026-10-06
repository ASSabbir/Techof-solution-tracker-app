'use client';
import { useParams, useRouter } from 'next/navigation';
import { ATTENDANCE_META } from '@/lib/constants';
import { fmtTime, fmtWorked, keyToDate } from '@/lib/format';
import { useEnter } from '@/hooks/useEnter';
import { useAttendanceDay } from '@/hooks/queries';
import { Avatar, Badge, ErrorState, PageHeader, Skeleton } from '@/components/ui/primitives';
import Icon from '@/components/ui/Icon';

export default function AttendanceDayPage() {
  const { date } = useParams();
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useAttendanceDay(date);
  const ref = useEnter(!!data);
  if (isError) return <ErrorState onRetry={refetch} />;
  return (
    <div ref={ref}>
      <button onClick={() => router.back()} className="btn-ghost -ml-3 mb-2" data-anim><Icon name="back" />Back</button>
      <PageHeader eyebrow="Team attendance" title={keyToDate(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} subtitle={data && !data.isWorkingDay ? 'This is a day off.' : undefined} />
      {isLoading ? <Skeleton className="h-56" /> : (
        <div className="grid gap-4 md:grid-cols-3">
          {data.rows.map((r) => {
            const meta = r.record ? ATTENDANCE_META[r.record.status] : null;
            return (
              <div key={r.user._id} className="card card-pad" data-anim>
                <div className="flex items-center gap-3"><Avatar user={r.user} size="md" /><p className="flex-1 font-extrabold">{r.user.name}</p>{meta ? <Badge tone={meta.tone}>{meta.label}</Badge> : <Badge tone="muted">No record</Badge>}</div>
                <dl className="mt-5 divide-y divide-line/70 text-sm">
                  {[['Entry', fmtTime(r.record?.entryTime)], ['Exit', fmtTime(r.record?.exitTime)], ['Working', r.record?.workingMinutes ? fmtWorked(r.record.workingMinutes) : '—']].map(([k, v]) => <div key={k} className="flex justify-between py-2.5"><dt className="text-muted">{k}</dt><dd className="digit font-bold">{v}</dd></div>)}
                  {r.record?.note && <div className="flex justify-between gap-3 py-2.5"><dt className="text-muted">Reason</dt><dd className="text-right font-semibold">{r.record.note}</dd></div>}
                </dl>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
