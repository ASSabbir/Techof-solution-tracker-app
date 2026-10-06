'use client';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { burst } from '@/lib/motion';
import { useRef } from 'react';
import { fmtDateTime } from '@/lib/format';
import { useEnter } from '@/hooks/useEnter';
import { useAction, useTask } from '@/hooks/queries';
import { useUI } from '@/components/contexts';
import { Avatar, ErrorState, Skeleton } from '@/components/ui/primitives';
import Icon from '@/components/ui/Icon';
import Countdown, { useTaskTiming } from '@/components/tasks/Countdown';
import ExtensionInfo from '@/components/tasks/ExtensionInfo';
import { Ledger, Timeline } from '@/components/tasks/Ledger';
import { PriorityBadge, ResultBadge, StatusBadge } from '@/components/tasks/badges';

function Body({ task }) {
  const ui = useUI();
  const router = useRouter();
  const ref = useEnter(true);
  const heroRef = useRef(null);
  const { state } = useTaskTiming(task);
  const complete = useAction(() => api(`/tasks/${task._id}/complete`, { method: 'POST' }), { success: 'Task completed — nice work!' });
  const cancel = useAction((reason) => api(`/tasks/${task._id}/cancel`, { method: 'POST', body: { reason } }), { success: 'Task cancelled.' });
  const decide = useAction(({ id, action }) => api(`/extensions/${id}/${action}`, { method: 'PATCH', body: {} }), { success: (_d, v) => (v.action === 'approve' ? 'Extension approved' : 'Extension rejected') });
  const p = task.permissions;
  const overdue = state === 'overdue';
  const completed = task.status === 'COMPLETED';

  async function onComplete() {
    const ok = await ui.confirm({ title: 'Are you sure you completed this task?', message: 'The completion time is recorded by the server and can’t be changed.', confirmText: 'Confirm Completion' });
    if (!ok) return;
    try { await complete.mutateAsync(); burst(heroRef.current); } catch {}
  }
  async function onCancel() {
    const ok = await ui.confirm({ title: 'Cancel this task?', message: 'Cancelled tasks earn no score. This is recorded in the history.', confirmText: 'Cancel task', cancelText: 'Keep it', tone: 'danger' });
    if (ok) cancel.mutate('');
  }

  return (
    <div ref={ref} className="space-y-6">
      <button onClick={() => router.back()} data-anim className="btn-ghost -ml-3"><Icon name="back" />Back</button>

      <div ref={heroRef} data-anim className={`card card-pad ${completed ? 'border-success/30' : overdue ? 'border-danger/35' : ''}`}>
        <div className="flex flex-wrap items-center gap-2"><PriorityBadge priority={task.priority} /><StatusBadge status={task.status} />{completed && <ResultBadge result={task.completionResult} />}</div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-4xl">{completed && <Icon name="ok" className="mr-2 inline h-7 w-7 -translate-y-0.5 text-success" />}{task.title}</h1>
        {task.description && <p className="mt-3 max-w-3xl whitespace-pre-wrap text-muted">{task.description}</p>}

        <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
          <span className="flex items-center gap-2"><Avatar user={task.assignedTo} size="sm" /><span><span className="block text-xs text-muted">Assigned to</span><span className="font-bold">{task.assignedTo?.name}</span></span></span>
          <span className="flex items-center gap-2"><Avatar user={task.createdBy} size="sm" /><span><span className="block text-xs text-muted">Assigned by</span><span className="font-bold">{task.createdBy?.name}</span></span></span>
          <span><span className="block text-xs text-muted">Created</span><span className="font-bold">{fmtDateTime(task.createdAt)}</span></span>
        </div>

        {task.isPastDeadline !== undefined && !['COMPLETED', 'CANCELLED'].includes(task.status) && <Countdown task={task} size="lg" className="mt-8 max-w-xl" />}
        {completed && <div className="mt-6 rounded-xl border border-success/25 bg-success/10 p-4"><p className="font-bold text-success">Completed {fmtDateTime(task.completedAt)} by {task.completedBy?.name}</p><p className="mt-0.5 text-sm text-muted">Original deadline {fmtDateTime(task.originalDeadline)} · {task.score} points awarded</p></div>}
        {task.status === 'CANCELLED' && <p className="mt-6 rounded-xl bg-surface-2 p-4 text-sm font-semibold text-muted">This task was cancelled {fmtDateTime(task.cancelledAt)}.</p>}

        <ExtensionInfo task={task} />

        <div className="mt-6 flex flex-wrap gap-3">
          {p.canComplete && <button className="btn-success" onClick={onComplete} disabled={complete.isPending}><Icon name="check" />{complete.isPending ? 'Completing task…' : 'Mark as Complete'}</button>}
          {p.canRequestExtension && <button className={overdue ? 'btn-primary' : 'btn-soft'} onClick={() => ui.openExtension(task)}><Icon name="timer" />Request Extension</button>}
          {p.canDecideExtension && task.pendingExtension && (<>
            <button className="btn-danger" disabled={decide.isPending} onClick={() => decide.mutate({ id: task.pendingExtension._id, action: 'reject' })}>Reject</button>
            <button className="btn-success" disabled={decide.isPending} onClick={() => decide.mutate({ id: task.pendingExtension._id, action: 'approve' })}>Approve extension</button>
          </>)}
          {p.canCancel && <button className="btn-ghost" onClick={onCancel}><Icon name="ban" />Cancel task</button>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card card-pad" data-anim><p className="eyebrow mb-3">Accountability record</p><Ledger task={task} /></div>
        <div className="card card-pad" data-anim><p className="eyebrow mb-5">What happened</p><Timeline events={task.timeline} /></div>
      </div>
    </div>
  );
}

export default function TaskDetailPage() {
  const { id } = useParams();
  const { data, isLoading, isError, error, refetch } = useTask(id);
  if (isLoading) return <div className="space-y-4"><Skeleton className="h-72" /><Skeleton className="h-64" /></div>;
  if (isError || !data) return <ErrorState message={error?.status === 404 ? 'That task could not be found.' : undefined} onRetry={refetch} />;
  return <Body task={data} />;
}
