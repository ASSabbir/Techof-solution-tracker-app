'use client';
import { api } from '@/lib/api';
import { LEAVE_META, LEAVE_TYPES } from '@/lib/constants';
import { keyToDate } from '@/lib/format';
import { useEnter } from '@/hooks/useEnter';
import { useAction, useLeaves } from '@/hooks/queries';
import { useUI } from '@/components/contexts';
import { Avatar, Badge, EmptyState, PageHeader, Skeleton } from '@/components/ui/primitives';
import Icon from '@/components/ui/Icon';

const label = (v) => LEAVE_TYPES.find((t) => t.value === v)?.label || v;
const day = (d) => keyToDate(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

function LeaveRow({ l, mine }) {
  const decide = useAction(({ action }) => api(`/leave/${l._id}/${action}`, { method: 'PATCH', body: {} }), { success: (_d, v) => (v.action === 'approve' ? 'Leave approved' : 'Leave rejected') });
  const cancel = useAction(() => api(`/leave/${l._id}/cancel`, { method: 'PATCH' }), { success: 'Leave request cancelled.' });
  const m = LEAVE_META[l.status];
  return (
    <li className="flex flex-wrap items-center gap-3 border-b border-line/70 py-4 last:border-0">
      {!mine && <Avatar user={l.userId} size="sm" />}
      <div className="min-w-0 flex-1">
        <p className="font-bold">{!mine && <>{l.userId?.name} · </>}{day(l.date)}</p>
        <p className="text-sm text-muted">{label(l.type)} — “{l.reason}”</p>
        {l.approvedBy && l.status !== 'PENDING' && <p className="mt-0.5 text-xs text-muted">{l.status === 'APPROVED' ? 'Approved' : 'Rejected'} by {l.approvedBy.name}</p>}
      </div>
      <Badge tone={m.tone} dot>{m.label}</Badge>
      {mine && l.status === 'PENDING' && <button className="btn-ghost btn-sm" disabled={cancel.isPending} onClick={() => cancel.mutate()}>Cancel</button>}
      {!mine && l.status === 'PENDING' && (<><button className="btn-danger btn-sm" disabled={decide.isPending} onClick={() => decide.mutate({ action: 'reject' })}>Reject</button><button className="btn-success btn-sm" disabled={decide.isPending} onClick={() => decide.mutate({ action: 'approve' })}>Approve</button></>)}
    </li>
  );
}

export default function LeavePage() {
  const ui = useUI();
  const mine = useLeaves('mine');
  const team = useLeaves('team');
  const ref = useEnter(!!mine.data && !!team.data);
  return (
    <div ref={ref}>
      <PageHeader eyebrow="Time off" title="Leave" subtitle="Apply for leave and approve your teammates’. The reason stays visible in attendance history." actions={<button className="btn-primary" onClick={() => ui.openLeave()}><Icon name="plus" />Apply for leave</button>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card card-pad" data-anim><p className="eyebrow mb-2">My requests</p>
          {mine.isLoading ? <Skeleton className="h-32" /> : mine.data?.length ? <ul>{mine.data.map((l) => <LeaveRow key={l._id} l={l} mine />)}</ul> : <EmptyState icon="leave" title="No leave requests" text="When you apply for leave it shows up here." />}
        </div>
        <div className="card card-pad" data-anim><p className="eyebrow mb-2">Team requests</p>
          {team.isLoading ? <Skeleton className="h-32" /> : team.data?.length ? <ul>{team.data.map((l) => <LeaveRow key={l._id} l={l} />)}</ul> : <EmptyState icon="inbox" title="Nothing to review" text="You’re all caught up." />}
        </div>
      </div>
    </div>
  );
}
