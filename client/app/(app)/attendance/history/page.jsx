'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ATTENDANCE_META } from '@/lib/constants';
import { fmtTime, fmtWorked, keyToDate, monthLabel, shiftMonth } from '@/lib/format';
import { useEnter } from '@/hooks/useEnter';
import { useAttendanceHistory, useUsers } from '@/hooks/queries';
import { useAuth } from '@/components/contexts';
import { Badge, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/primitives';
import Icon from '@/components/ui/Icon';

export default function AttendanceHistoryPage() {
  const { user } = useAuth();
  const { data: users = [] } = useUsers();
  const [month, setMonth] = useState(null);
  const [who, setWho] = useState(user._id);
  const { data, isLoading, isError, refetch } = useAttendanceHistory(month || undefined, who);
  const ref = useEnter(!!data);
  const cur = month || data?.month;
  const rows = data ? [...data.records].sort((a, b) => (a.date < b.date ? 1 : -1)) : [];

  return (
    <div ref={ref}>
      <PageHeader eyebrow="Records" title="Attendance history" actions={<Link href="/attendance" className="btn-soft"><Icon name="back" />Back to attendance</Link>} />
      <div className="mb-5 flex flex-wrap items-center gap-3" data-anim>
        <div className="flex items-center gap-1.5">
          <button className="btn-soft !p-2" onClick={() => cur && setMonth(shiftMonth(cur, -1))} aria-label="Previous month"><Icon name="left" /></button>
          <span className="min-w-40 text-center font-extrabold">{cur ? monthLabel(cur) : '…'}</span>
          <button className="btn-soft !p-2" onClick={() => cur && setMonth(shiftMonth(cur, 1))} aria-label="Next month"><Icon name="right" /></button>
        </div>
        <select className="input !w-auto" value={who} onChange={(e) => setWho(e.target.value)}>{users.map((u) => <option key={u._id} value={u._id}>{u._id === user._id ? `${u.name} (me)` : u.name}</option>)}</select>
      </div>
      {isError ? <ErrorState onRetry={refetch} /> : isLoading ? <Skeleton className="h-80" /> : rows.length === 0 ? (
        <div className="card"><EmptyState icon="clock" title="No attendance records found." text="Nothing was recorded for this month." /></div>
      ) : (
        <div className="card overflow-x-auto" data-anim>
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead><tr className="border-b border-line bg-surface-2/60">{['Date', 'Entry', 'Exit', 'Working', 'Status', 'Note'].map((h) => <th key={h} className="eyebrow px-4 py-3.5">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => { const m = ATTENDANCE_META[r.status]; return (
                <tr key={r._id} className="border-b border-line/60 last:border-0 hover:bg-surface-2/50">
                  <td className="px-4 py-3 font-bold"><Link href={`/attendance/${r.date}`} className="hover:text-accent">{keyToDate(r.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Link></td>
                  <td className="digit px-4 py-3">{fmtTime(r.entryTime)}</td><td className="digit px-4 py-3">{fmtTime(r.exitTime)}</td>
                  <td className="digit px-4 py-3">{r.workingMinutes ? fmtWorked(r.workingMinutes) : '—'}</td>
                  <td className="px-4 py-3"><Badge tone={m.tone}>{m.label}</Badge></td><td className="px-4 py-3 text-muted">{r.note || (r.overrideLeave ? 'Leave override' : '')}</td>
                </tr>); })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
