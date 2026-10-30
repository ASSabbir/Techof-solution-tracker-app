'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useServerNow } from '@/lib/clock';
import { fmtTime, fmtWorked } from '@/lib/format';
import { shiftRange } from '@/lib/shift';
import { useAction, useAttendanceToday } from '@/hooks/queries';
import { useToast, useUI } from '@/components/contexts';
import { Badge, Field, Skeleton, Spinner } from '@/components/ui/primitives';
import Modal from '@/components/ui/Modal';
import { ATTENDANCE_META } from '@/lib/constants';
import Icon from '@/components/ui/Icon';

export default function ClockWidget({ compact = false }) {
  const { data, isLoading } = useAttendanceToday();
  const ui = useUI();
  const toast = useToast();
  const now = useServerNow();
  const [outOpen, setOutOpen] = useState(false);
  const [summary, setSummary] = useState('');

  const clockIn = useAction((override) => api('/attendance/clock-in', { method: 'POST', body: { override } }), { success: 'Clocked in. Have a productive session!', silentError: true, sound: 'clockin' });
  const clockOut = useAction((text) => api('/attendance/clock-out', { method: 'POST', body: { summary: text } }), {
    success: 'Clocked out. Nice work!',
    sound: 'clockout',
    onSuccess: () => { setOutOpen(false); setSummary(''); },
  });

  async function doClockIn() {
    try {
      await clockIn.mutateAsync(false);
    } catch (err) {
      if (err.code === 'LEAVE_CONFLICT') {
        const ok = await ui.confirm({ title: 'You have approved leave today', message: 'Clocking in will record you as present and mark this as a leave override. Continue?', confirmText: 'Clock in anyway' });
        if (ok) { try { await clockIn.mutateAsync(true); } catch {} }
      } else {
        toast.error(err.message);
      }
    }
  }

  if (isLoading) return <div className="card card-pad"><Skeleton className="h-6 w-40" /><Skeleton className="mt-4 h-20 w-full" /></div>;

  const rec = data?.record;
  const shift = data?.shift;
  const session = data?.openSession;
  const working = data?.state === 'WORKING';
  const overtimeRunning = working && session?.kind === 'OVERTIME';
  const done = data?.state === 'COMPLETED';
  const onLeave = data?.state === 'LEAVE';
  const startMs = session ? new Date(session.entryTime).getTime() : null;
  const minutes = working ? Math.max(0, Math.floor((now - startMs) / 60000)) : rec?.workingMinutes || 0;
  const busy = clockIn.isPending || clockOut.isPending;
  const canIn = !!shift?.canClockIn;
  const overtimeMode = shift?.mode === 'OVERTIME';
  const otTotal = (data?.overtime?.minutes || 0) + (overtimeRunning ? minutes : 0);
  const entryShown = working ? session.entryTime : rec?.entryTime;

  return (
    <div className="card card-pad relative overflow-hidden" data-anim>
      <div className="flex items-center justify-between">
        <p className="eyebrow">Attendance</p>
        {working && (overtimeRunning ? <Badge tone="overtime" dot>Overtime</Badge> : <Badge tone="success" dot>Working</Badge>)}
        {!working && done && <Badge tone="info" dot>Completed</Badge>}
        {!working && onLeave && <Badge tone="accent" dot>On leave</Badge>}
        {!working && data?.state === 'OVERTIME' && <Badge tone="overtime" dot>Overtime present</Badge>}
        {!working && data?.state === 'ABSENT' && <Badge tone="danger" dot>Absent</Badge>}
        {!working && data?.state === 'NOT_STARTED' && <Badge tone="muted" dot>Not started</Badge>}
      </div>

      {shift && (
        <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-muted">
          <Icon name="clock" className="h-3.5 w-3.5" />
          Your shift: <span className="digit text-ink">{shiftRange(shift.start, shift.end)}</span>{shift.overnight && <span>(ends next day)</span>}
        </p>
      )}

      <div className={compact ? 'mt-4 grid grid-cols-3 gap-3' : 'mt-5 grid grid-cols-3 gap-4'}>
        <div><p className="text-xs text-muted">{overtimeRunning ? 'Overtime in' : 'Entry'}</p><p className="digit mt-1 text-lg font-extrabold">{fmtTime(entryShown)}</p></div>
        <div><p className="text-xs text-muted">{done && !working ? 'Exit' : 'Status'}</p><p className="mt-1 text-lg font-extrabold">{done && !working ? <span className="digit">{fmtTime(rec?.exitTime)}</span> : working ? (overtimeRunning ? 'Overtime' : ATTENDANCE_META[rec?.status]?.label || '—') : rec?.status ? ATTENDANCE_META[rec.status]?.label : '—'}</p></div>
        <div><p className="text-xs text-muted">{overtimeRunning ? 'This session' : 'Duration'}</p><p className="digit mt-1 text-lg font-extrabold">{working || rec?.entryTime ? fmtWorked(minutes) : '—'}</p></div>
      </div>

      {otTotal > 0 && (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-success/[0.08] px-3.5 py-2 text-xs font-bold text-success/80">
          <Icon name="zap" className="h-3.5 w-3.5" />Overtime for this day: {fmtWorked(otTotal)}
        </p>
      )}

      <div className="mt-5 space-y-2.5">
        {working && (
          <button onClick={() => setOutOpen(true)} disabled={busy} className="btn-soft w-full hover:!border-danger/50 hover:!bg-danger/10"><Icon name="logout" />{overtimeRunning ? 'End Overtime' : 'Clock Out'}</button>
        )}
        {!working && done && <p className="rounded-xl bg-success/10 px-4 py-2.5 text-center text-sm font-semibold text-success">Shift done — {fmtWorked(rec.workingMinutes)} logged{rec.autoClosed ? ' (closed automatically at shift end)' : ''}.</p>}
        {!working && canIn && (
          <>
            <button onClick={doClockIn} disabled={busy} className={overtimeMode ? 'btn-soft w-full' : 'btn-primary w-full'}>{busy ? <Spinner /> : <Icon name={overtimeMode ? 'zap' : 'login'} />}{clockIn.isPending ? 'Clocking in…' : overtimeMode ? 'Clock In · Overtime' : 'Clock In'}</button>
            {overtimeMode && <p className="text-center text-xs font-semibold text-muted">Outside your shift — this counts as overtime. You can clock in any time of day.</p>}
          </>
        )}
        {working && <p className="text-center text-[11px] font-semibold text-muted">Forgot to clock out? It closes by itself after 5 hours.</p>}
      </div>

      <Modal open={outOpen} onClose={() => !clockOut.isPending && setOutOpen(false)} title={overtimeRunning ? 'End overtime' : 'Clock out'} subtitle="Add a short note about what you worked on. It shows in your attendance details." size="md"
        footer={(
          <>
            <button className="btn-ghost" onClick={() => setOutOpen(false)} disabled={clockOut.isPending}>Cancel</button>
            <button className="btn-primary" onClick={() => clockOut.mutate(summary.trim())} disabled={clockOut.isPending}>{clockOut.isPending ? <><Spinner />Clocking out…</> : <><Icon name="logout" />{overtimeRunning ? 'End Overtime' : 'Clock Out'}</>}</button>
          </>
        )}>
        <Field label="What did you do? (optional)" hint={`${summary.length}/500`}>
          <textarea className="input min-h-[110px] resize-y" maxLength={500} autoFocus value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Finished the homepage animations, fixed the login bug…" />
        </Field>
      </Modal>
    </div>
  );
}