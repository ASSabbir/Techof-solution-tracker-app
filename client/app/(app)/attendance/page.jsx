'use client';
import { useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { ATTENDANCE_META, TONE } from '@/lib/constants';
import { fmtTime, fmtWorked, minutesToClock, shiftMonth } from '@/lib/format';
import { useEnter } from '@/hooks/useEnter';
import { useAttendanceHistory, useAttendanceTeam, useUsers } from '@/hooks/queries';
import { useAuth, useUI } from '@/components/contexts';
import { Avatar, Badge, ErrorState, PageHeader, Skeleton, Stat } from '@/components/ui/primitives';
import Icon from '@/components/ui/Icon';
import ClockWidget from '@/components/attendance/ClockWidget';
import Calendar, { DayDetail } from '@/components/attendance/Calendar';

function TeamToday() {
  const { data } = useAttendanceTeam();
  if (!data) return <Skeleton className="h-48" />;
  return (
    <div className="card overflow-hidden" data-anim>
      <div className="flex items-center justify-between px-5 pt-5"><p className="eyebrow">Team attendance · today</p><Link href={`/attendance/${data.date}`} className="text-xs font-bold text-accent hover:underline">Details</Link></div>
      <table className="mt-3 w-full text-left text-sm">
        <thead><tr className="border-b border-line"><th className="eyebrow px-5 py-2.5">Member</th><th className="eyebrow px-2 py-2.5">Entry</th><th className="eyebrow px-2 py-2.5">Exit</th><th className="eyebrow px-5 py-2.5 text-right">Status</th></tr></thead>
        <tbody>
          {data.rows.map((r) => {
            const st = r.record?.status;
            const meta = st ? ATTENDANCE_META[st] : null;
            return (
              <tr key={r.user._id} className="border-b border-line/60 last:border-0">
                <td className="px-5 py-3"><span className="flex items-center gap-2.5 font-bold"><Avatar user={r.user} size="xs" />{r.user.name}</span></td>
                <td className="digit px-2 py-3">{fmtTime(r.record?.entryTime)}</td>
                <td className="digit px-2 py-3">{fmtTime(r.record?.exitTime)}</td>
                <td className="px-5 py-3 text-right">{meta ? <Badge tone={meta.tone}>{meta.label}</Badge> : <span className="text-xs text-muted">{data.isWorkingDay ? 'Not clocked in' : 'Day off'}</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function AttendancePage() {
  const { user } = useAuth();
  const ui = useUI();
  const { data: users = [] } = useUsers();
  const [month, setMonth] = useState(null);
  const [who, setWho] = useState(user._id);
  const [selected, setSelected] = useState(null);
  const { data, isLoading, isError, refetch } = useAttendanceHistory(month || undefined, who);
  const ref = useEnter(!!data);
  const cur = month || data?.month;
  const st = data?.stats;
  const sel = data?.days.find((d) => d.date === (selected || data.days.find((x) => x.isToday)?.date));

  return (
    <div ref={ref}>
      <PageHeader eyebrow="Daily presence" title="Attendance" subtitle="Server-recorded clock in and out. Missed working days are marked absent automatically after the workday ends."
        actions={<><Link href="/attendance/history" className="btn-soft"><Icon name="history" />History</Link><button className="btn-primary" onClick={() => ui.openLeave()}><Icon name="leave" />Apply Leave</button></>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6"><ClockWidget /><TeamToday /></div>
        <div className="space-y-6 lg:col-span-2">
          <div className="no-scrollbar flex gap-2 overflow-x-auto" data-anim>
            {users.map((u) => (
              <button key={u._id} onClick={() => { setWho(u._id); setSelected(null); }} className={clsx('flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition', who === u._id ? 'border-accent bg-accent/10' : 'border-line bg-surface text-muted hover:text-ink')}><Avatar user={u} size="xs" />{u._id === user._id ? 'Me' : u.name}</button>
            ))}
          </div>
          {isError ? <ErrorState onRetry={refetch} /> : isLoading ? <Skeleton className="h-[28rem]" /> : (
            <>
              <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
                <div className="card card-pad" data-anim>
                  <Calendar month={data.month} days={data.days} selected={sel?.date} onSelect={setSelected}
                    onPrev={() => { setMonth(shiftMonth(cur, -1)); setSelected(null); }} onNext={() => { setMonth(shiftMonth(cur, 1)); setSelected(null); }} />
                </div>
                <div className="card card-pad" data-anim><p className="eyebrow mb-3">Day detail</p><DayDetail day={sel} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4" data-anim>
                <Stat label="Present" value={st.present} tone="success" icon="ok" />
                <Stat label="Late" value={st.late} tone="warning" icon="clock" />
                <Stat label="Leave" value={st.leave} tone="info" icon="leave" />
                <Stat label="Absent" value={st.absent} tone="danger" icon="no" />
              </div>
              <div className="card card-pad grid grid-cols-3 gap-4" data-anim>
                <div><p className="eyebrow">Attendance rate</p><p className="digit mt-1.5 text-2xl font-extrabold">{st.attendanceRate == null ? '—' : `${st.attendanceRate}%`}</p></div>
                <div><p className="eyebrow">Avg entry</p><p className="digit mt-1.5 text-2xl font-extrabold">{minutesToClock(st.avgEntryMinutes)}</p></div>
                <div><p className="eyebrow">Avg working</p><p className="digit mt-1.5 text-2xl font-extrabold">{st.avgWorkingMinutes ? fmtWorked(st.avgWorkingMinutes) : '—'}</p></div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
