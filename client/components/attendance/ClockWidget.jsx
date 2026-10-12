'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useServerNow } from '@/lib/clock';
import { fmtDeadline, fmtTime, fmtWorked } from '@/lib/format';
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

  const clockIn = useAction((override) => api('/attendance/clock-in', { method: 'POST', body: { override } }), { success: 'Clocked in. Have a productive shift!', silentError: true, sound: 'clockin' });
  const clockOut = useAction((text) => api('/attendance/clock-out', { method: 'POST', body: { summary: text } }), {
    success: 'Clocked out. Nice work today!',
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
  const working = data?.state === 'WORKING';
  const done = data?.state === 'COMPLETED';
  const onLeave = data?.state === 'LEAVE';
  const minutes = working ? Math.max(0, Math.floor((now - new Date(rec.entryTime).getTime()) / 60000)) : rec?.workingMinutes || 0;
  const busy = clockIn.isPending || clockOut.isPending;
  const canIn = !!shift?.canClockIn;

  return (
    <div className="card card-pad relative overflow-hidden" data-anim>
      <div className="flex items-center justify-between">
        <p className="eyebrow">Attendance</p>
        {working && <Badge tone="success" dot>Working</Badge>}
        {done && <Badge tone="info" dot>Completed</Badge>}
        {onLeave && <Badge tone="info" dot>On leave</Badge>}
        {data?.state === 'ABSENT' && <Badge tone="danger" dot>Absent</Badge>}
        {data?.state === 'NOT_STARTED' && <Badge tone="muted" dot>Not started</Badge>}
      </div>

      {shift && (
        <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-muted">
          <Icon name="clock" className="h-3.5 w-3.5" />
          Your shift: <span className="digit text-ink">{shiftRange(shift.start, shift.end)}</span>{shift.overnight && <span>(ends next day)</span>}
        </p>
      )}

      <div className={compact ? 'mt-4 grid grid-cols-3 gap-3' : 'mt-5 grid grid-cols-3 gap-4'}>
        <div><p className="text-xs text-muted">Entry</p><p className="digit mt-1 text-lg font-extrabold">{fmtTime(rec?.entryTime)}</p></div>
        <div><p className="text-xs text-muted">{done ? 'Exit' : 'Status'}</p><p className="mt-1 text-lg font-extrabold">{done ? <span className="digit">{fmtTime(rec?.exitTime)}</span> : rec?.status ? ATTENDANCE_META[rec.status]?.label : '—'}</p></div>
        <div><p className="text-xs text-muted">Duration</p><p className="digit mt-1 text-lg font-extrabold">{rec?.entryTime ? fmtWorked(minutes) : '—'}</p></div>
      </div>

      <div className="mt-5">
        {!rec?.entryTime && !done && (
          <>
            <button onClick={doClockIn} disabled={busy || !canIn} className="btn-primary w-full">{busy ? <Spinner /> : <Icon name="login" />}{clockIn.isPending ? 'Clocking in…' : 'Clock In'}</button>
            {!canIn && shift?.opensAt && <p className="mt-2.5 text-center text-xs font-semibold text-muted">Clock-in opens {fmtDeadline(shift.opensAt, now).replace(/^Today, /, 'at ')}</p>}
          </>
        )}
        {working && (
          <button onClick={() => setOutOpen(true)} disabled={busy} className="btn-soft w-full hover:!border-danger/50 hover:!bg-danger/10"><Icon name="logout" />Clock Out</button>
        )}
        {done && <p className="rounded-xl bg-success/10 px-4 py-2.5 text-center text-sm font-semibold text-success">You’re done — {fmtWorked(rec.workingMinutes)} logged{rec.autoClosed ? ' (closed automatically at shift end)' : ''}.</p>}
      </div>

      <Modal open={outOpen} onClose={() => !clockOut.isPending && setOutOpen(false)} title="Clock out" subtitle="Add a short note about what you worked on. It shows in your attendance details." size="md"
        footer={(
          <>
            <button className="btn-ghost" onClick={() => setOutOpen(false)} disabled={clockOut.isPending}>Cancel</button>
            <button className="btn-primary" onClick={() => clockOut.mutate(summary.trim())} disabled={clockOut.isPending}>{clockOut.isPending ? <><Spinner />Clocking out…</> : <><Icon name="logout" />Clock Out</>}</button>
          </>
        )}>
        <Field label="What did you do today? (optional)" hint={`${summary.length}/500`}>
          <textarea className="input min-h-[110px] resize-y" maxLength={500} autoFocus value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Finished the homepage animations, fixed the login bug…" />
        </Field>
      </Modal>
    </div>
  );
}