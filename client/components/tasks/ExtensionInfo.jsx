'use client';
import { fmtMinutes, fmtTime, fmtDateTime } from '@/lib/format';
import Icon from '@/components/ui/Icon';

// Transparent extension record: the original deadline never disappears.
export default function ExtensionInfo({ task, compact = false }) {
  const approved = (task.extensions || []).filter((e) => e.status === 'APPROVED');
  const pending = task.pendingExtension;
  if (!approved.length && !pending) return null;
  const last = approved[approved.length - 1];

  return (
    <div className="mt-4 space-y-3">
      {approved.length > 0 && (
        <div className="rounded-xl border border-accent/25 bg-accent/8 p-3.5">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><p className="eyebrow">Original</p><p className="digit mt-1 text-sm font-bold line-through decoration-muted/60">{fmtTime(task.originalDeadline)}</p></div>
            <div><p className="eyebrow">Extension</p><p className="digit mt-1 text-sm font-bold text-accent">+{fmtMinutes(task.totalExtensionMinutes)}</p></div>
            <div><p className="eyebrow">New deadline</p><p className="digit mt-1 text-sm font-bold">{fmtTime(task.currentDeadline)}</p></div>
          </div>
          {!compact && last && (
            <p className="mt-3 border-t border-accent/15 pt-3 text-xs text-muted">
              <span className="font-semibold text-ink">Reason:</span> {last.reason}
              {last.approvedBy?.name && <> · Approved by <span className="font-semibold text-ink">{last.approvedBy.name}</span></>}
            </p>
          )}
          {approved.length > 1 && <p className="mt-2 text-center text-[11px] font-semibold text-muted">{approved.length} extensions · total extra {fmtMinutes(task.totalExtensionMinutes)}</p>}
        </div>
      )}
      {pending && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-3.5 text-sm">
          <Icon name="hourglass" className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div className="min-w-0">
            <p className="font-bold text-warning">Extension requested · +{fmtMinutes(pending.requestedMinutes)}</p>
            <p className="mt-0.5 text-xs text-muted">“{pending.reason}” — waiting for {task.createdBy?.name && String(task.createdBy._id) !== String(pending.requestedBy?._id) ? task.createdBy.name : 'a teammate'} · {fmtDateTime(pending.requestedAt)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
