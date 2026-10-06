'use client';
import Link from 'next/link';
import { api } from '@/lib/api';
import { fmtMinutes, keyToDate } from '@/lib/format';
import { useAction } from '@/hooks/queries';
import { Avatar } from '@/components/ui/primitives';
import Icon from '@/components/ui/Icon';

// Things waiting for the current user's decision (extension requests + leave requests).
export default function Approvals({ extensions = [], leaves = [] }) {
  const extDecide = useAction(({ id, action }) => api(`/extensions/${id}/${action}`, { method: 'PATCH', body: {} }), { success: (_d, v) => (v.action === 'approve' ? 'Extension approved' : 'Extension rejected') });
  const leaveDecide = useAction(({ id, action }) => api(`/leave/${id}/${action}`, { method: 'PATCH', body: {} }), { success: (_d, v) => (v.action === 'approve' ? 'Leave approved' : 'Leave rejected') });
  if (!extensions.length && !leaves.length) return null;
  return (
    <div className="card card-pad border-warning/30" data-anim>
      <div className="mb-4 flex items-center gap-2.5"><Icon name="hourglass" className="h-5 w-5 text-warning" /><h2 className="text-lg font-extrabold">Needs your decision</h2></div>
      <ul className="space-y-3">
        {extensions.map((e) => (
          <li key={e._id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-2/60 p-3.5">
            <Avatar user={e.requestedBy} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{e.requestedBy?.name} requested +{fmtMinutes(e.requestedMinutes)}</p>
              <p className="truncate text-xs text-muted"><Link href={`/tasks/${e.taskId?._id}`} className="font-semibold text-ink hover:text-accent">{e.taskId?.title}</Link> — “{e.reason}”</p>
            </div>
            <div className="flex gap-2">
              <button className="btn-danger btn-sm" disabled={extDecide.isPending} onClick={() => extDecide.mutate({ id: e._id, action: 'reject' })}>Reject</button>
              <button className="btn-success btn-sm" disabled={extDecide.isPending} onClick={() => extDecide.mutate({ id: e._id, action: 'approve' })}>Approve</button>
            </div>
          </li>
        ))}
        {leaves.map((l) => (
          <li key={l._id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-2/60 p-3.5">
            <Avatar user={l.userId} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{l.userId?.name} applied for leave</p>
              <p className="truncate text-xs text-muted">{keyToDate(l.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} — “{l.reason}”</p>
            </div>
            <div className="flex gap-2">
              <button className="btn-danger btn-sm" disabled={leaveDecide.isPending} onClick={() => leaveDecide.mutate({ id: l._id, action: 'reject' })}>Reject</button>
              <button className="btn-success btn-sm" disabled={leaveDecide.isPending} onClick={() => leaveDecide.mutate({ id: l._id, action: 'approve' })}>Approve</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
