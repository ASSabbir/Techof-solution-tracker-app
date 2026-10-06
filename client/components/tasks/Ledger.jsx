'use client';
import clsx from 'clsx';
import { fmtDateTime, fmtMinutes } from '@/lib/format';
import { RESULT_META, TONE } from '@/lib/constants';
import Icon from '@/components/ui/Icon';

const ACTION_ICON = {
  TASK_CREATED: ['plus', 'accent'], TASK_ASSIGNED: ['userCheck', 'info'], DEADLINE_SET: ['timer', 'muted'],
  TASK_UPDATED: ['edit', 'muted'], TASK_OVERDUE: ['no', 'danger'], EXTENSION_REQUESTED: ['hourglass', 'warning'],
  EXTENSION_APPROVED: ['ok', 'success'], EXTENSION_REJECTED: ['no', 'danger'], TASK_COMPLETED: ['check', 'success'], TASK_CANCELLED: ['ban', 'muted'],
};

// Everything that actually happened, in order. History is append-only on the server.
export function Timeline({ events = [] }) {
  if (!events.length) return <p className="text-sm text-muted">No events yet.</p>;
  return (
    <ol className="relative space-y-5 border-l border-line pl-6">
      {events.map((e) => {
        const [icon, tone] = ACTION_ICON[e.action] || ['activity', 'muted'];
        const t = TONE[tone];
        return (
          <li key={e._id} className="relative">
            <span className={clsx('absolute -left-[37px] grid h-7 w-7 place-items-center rounded-full ring-4 ring-surface', t.bg, t.text)}><Icon name={icon} className="h-3.5 w-3.5" /></span>
            <p className="text-sm font-semibold">{e.message}</p>
            <p className="mt-0.5 text-xs text-muted">{fmtDateTime(e.createdAt)}{e.metadata?.reason && <> · “{e.metadata.reason}”</>}</p>
          </li>
        );
      })}
    </ol>
  );
}

const Row = ({ label, value, tone }) => (
  <div className="flex items-baseline justify-between gap-4 border-b border-line/70 py-2.5 last:border-0">
    <span className="text-sm text-muted">{label}</span>
    <span className={clsx('digit text-right text-sm font-bold', tone && TONE[tone]?.text)}>{value}</span>
  </div>
);

// The "record what actually happened" summary from the SRS (sections 20, 23, 100).
export function Ledger({ task }) {
  const exts = task.extensions || [];
  const done = task.status === 'COMPLETED';
  const result = RESULT_META[task.completionResult];
  const allowed = task.originalDuration + (task.totalExtensionMinutes || 0);
  return (
    <div>
      <Row label="Created" value={fmtDateTime(task.createdAt)} />
      <Row label="Original deadline" value={fmtDateTime(task.originalDeadline)} />
      {exts.map((e) => (
        <div key={e._id} className="my-1 rounded-xl bg-surface-2/70 px-3.5 py-1">
          <Row label={`Extension #${e.sequence} requested`} value={fmtDateTime(e.requestedAt)} />
          <Row label="Extra time" value={`+${fmtMinutes(e.requestedMinutes)}`} tone="accent" />
          <Row label="Reason" value={e.reason} />
          <Row label="Decision" value={e.status === 'APPROVED' ? `Approved by ${e.approvedBy?.name || 'system'}` : e.status === 'REJECTED' ? `Rejected by ${e.decidedBy?.name}` : e.status === 'CANCELLED' ? 'Cancelled' : 'Pending'} tone={e.status === 'APPROVED' ? 'success' : e.status === 'REJECTED' ? 'danger' : 'warning'} />
          {e.status === 'APPROVED' && <Row label="New deadline" value={fmtDateTime(e.newDeadline)} />}
        </div>
      ))}
      {task.extensionCount > 0 && <Row label="Total extra time" value={`+${fmtMinutes(task.totalExtensionMinutes)} (${task.extensionCount})`} tone="accent" />}
      <Row label="Current deadline" value={fmtDateTime(task.currentDeadline)} />
      {done && (
        <>
          <Row label="Completed" value={fmtDateTime(task.completedAt)} tone="success" />
          <Row label="Original duration" value={fmtMinutes(task.originalDuration)} />
          <Row label="Actual completion duration" value={fmtMinutes(task.completionMinutes)} />
          <Row label="Total allowed duration" value={fmtMinutes(allowed)} />
          <Row label="Result" value={result?.label || '—'} tone={result?.tone} />
          <Row label="Score awarded" value={`${task.score} pts`} />
        </>
      )}
    </div>
  );
}
