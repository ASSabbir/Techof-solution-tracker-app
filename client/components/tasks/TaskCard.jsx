'use client';
import { useRef } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { burst } from '@/lib/motion';
import { fmtDateTime, fmtDeadline, fmtTime, fmtMinutes, timeAgo } from '@/lib/format';
import { TONE, STATUS_META } from '@/lib/constants';
import { useAction } from '@/hooks/queries';
import { useUI } from '@/components/contexts';
import { Avatar } from '@/components/ui/primitives';
import Icon from '@/components/ui/Icon';
import Countdown, { useTaskTiming } from './Countdown';
import ExtensionInfo from './ExtensionInfo';
import { PriorityBadge, StatusBadge, ResultBadge } from './badges';

export default function TaskCard({ task, showAssignee = false }) {
  const ui = useUI();
  const ref = useRef(null);
  const { now, state, open } = useTaskTiming(task);
  const complete = useAction(() => api(`/tasks/${task._id}/complete`, { method: 'POST' }), { success: 'Task completed — nice work!' });
  const decide = useAction(({ id, action }) => api(`/extensions/${id}/${action}`, { method: 'PATCH', body: {} }), {
    success: (_d, v) => (v.action === 'approve' ? 'Extension approved' : 'Extension rejected'),
  });

  const overdue = state === 'overdue';
  const completed = task.status === 'COMPLETED';
  const tone = completed ? 'success' : overdue ? 'danger' : task.status === 'EXTENDED' ? 'accent' : task.status === 'EXTENSION_REQUESTED' ? 'warning' : task.status === 'CANCELLED' ? 'muted' : 'info';
  const t = TONE[tone];

  async function onComplete() {
    const ok = await ui.confirm({
      title: 'Are you sure you completed this task?',
      message: `“${task.title}” will be marked complete. The timestamp is recorded by the server and can’t be changed.`,
      confirmText: 'Confirm Completion',
    });
    if (!ok) return;
    try {
      await complete.mutateAsync();
      burst(ref.current);
    } catch {}
  }

  const pending = task.pendingExtension;

  return (
    <article ref={ref} data-anim className={clsx('card group relative flex flex-col overflow-hidden p-5 transition duration-300 hover:-translate-y-0.5 hover:shadow-glow', completed && 'border-success/30', overdue && !completed && 'border-danger/35')}>
      <span className={clsx('absolute inset-y-0 left-0 w-1', t.solid)} />
      <div className="flex flex-wrap items-center gap-2">
        <PriorityBadge priority={task.priority} />
        <StatusBadge status={overdue && task.status !== 'EXTENSION_REQUESTED' ? 'OVERDUE' : task.status} />
        {completed && <ResultBadge result={task.completionResult} />}
        {showAssignee && (
          <span className="ml-auto flex items-center gap-2 text-xs font-semibold text-muted">
            <Avatar user={task.assignedTo} size="xs" />{task.assignedTo?.name}
          </span>
        )}
      </div>

      <Link href={`/tasks/${task._id}`} className="mt-3.5 flex items-start gap-2 text-lg font-extrabold leading-snug tracking-tight hover:text-accent">
        {completed && <Icon name="ok" className="mt-1 h-5 w-5 shrink-0 text-success" />}
        {overdue && !completed && task.status === 'OVERDUE' && <Icon name="no" className="mt-1 h-5 w-5 shrink-0 text-danger" />}
        <span className={clsx(task.status === 'CANCELLED' && 'line-through opacity-60')}>{task.title}</span>
      </Link>

      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
        <span>Assigned by <span className="font-semibold text-ink">{task.createdBy?.name}</span></span>
        <span aria-hidden>·</span>
        <span>{timeAgo(task.createdAt, now)}</span>
      </p>

      {open && <Countdown task={task} className="mt-5" />}

      {completed && (
        <div className="mt-5 rounded-xl border border-success/25 bg-success/10 p-3.5">
          <p className="text-sm font-bold text-success">Completed at {fmtTime(task.completedAt)}</p>
          <p className="mt-0.5 text-xs text-muted">Deadline was {fmtDateTime(task.originalDeadline)}{task.extensionCount > 0 && ` (+${fmtMinutes(task.totalExtensionMinutes)} extension)`} · {task.score} pts</p>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-xs">
        <span className="text-muted">{open ? <>Deadline: <span className="font-semibold text-ink">{fmtDeadline(task.currentDeadline, now)}</span></> : task.status === 'CANCELLED' ? 'Cancelled' : ''}</span>
        {task.extensionCount > 0 && <span className="font-semibold text-accent">Extra time used: {fmtMinutes(task.totalExtensionMinutes)}</span>}
      </div>

      <ExtensionInfo task={task} compact />

      <div className="mt-5 flex flex-wrap items-center gap-2.5 pt-1">
        <Link href={`/tasks/${task._id}`} className="btn-soft btn-sm">View</Link>
        {task.permissions?.canComplete && (
          <button onClick={onComplete} disabled={complete.isPending} className="btn-success btn-sm">
            <Icon name="check" className="h-3.5 w-3.5" />{complete.isPending ? 'Completing…' : 'Complete'}
          </button>
        )}
        {task.permissions?.canRequestExtension && (
          <button onClick={() => ui.openExtension(task)} className={clsx('btn-sm', overdue ? 'btn-primary' : 'btn-ghost')}>
            <Icon name="timer" className="h-3.5 w-3.5" />Request Extension
          </button>
        )}
        {task.permissions?.canDecideExtension && pending && (
          <>
            <button onClick={() => decide.mutate({ id: pending._id, action: 'reject' })} disabled={decide.isPending} className="btn-danger btn-sm">Reject</button>
            <button onClick={() => decide.mutate({ id: pending._id, action: 'approve' })} disabled={decide.isPending} className="btn-success btn-sm">Approve</button>
          </>
        )}
      </div>
    </article>
  );
}
