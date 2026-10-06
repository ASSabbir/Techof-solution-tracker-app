'use client';
import Link from 'next/link';
import clsx from 'clsx';
import { fmtClock, fmtDateTime, fmtOverdue, fmtMinutes } from '@/lib/format';
import { Avatar } from '@/components/ui/primitives';
import { useTaskTiming } from './Countdown';
import { PriorityBadge, ResultBadge, StatusBadge } from './badges';

function Timing({ task }) {
  const { diff, state, open } = useTaskTiming(task);
  if (!open) return task.status === 'COMPLETED' ? <ResultBadge result={task.completionResult} /> : <span className="text-muted">—</span>;
  if (state === 'overdue') return <span className="digit font-bold text-danger">+{fmtOverdue(-diff)} over</span>;
  return <span className={clsx('digit font-bold', state === 'critical' ? 'text-danger' : state === 'soon' ? 'text-warning' : '')}>{fmtClock(diff)}</span>;
}

export default function TeamTable({ items }) {
  return (
    <div className="card hidden overflow-hidden md:block" data-anim>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line bg-surface-2/60">
            {['Task', 'Assigned to', 'Assigned by', 'Priority', 'Status', 'Time', 'Deadline'].map((h) => <th key={h} className="eyebrow px-4 py-3.5">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t._id} className="border-b border-line/60 transition last:border-0 hover:bg-surface-2/50">
              <td className="max-w-[18rem] px-4 py-3.5">
                <Link href={`/tasks/${t._id}`} className="block truncate font-bold hover:text-accent">{t.title}</Link>
                {t.extensionCount > 0 && <span className="text-[11px] font-semibold text-accent">+{fmtMinutes(t.totalExtensionMinutes)} extra time</span>}
              </td>
              <td className="px-4 py-3.5"><span className="flex items-center gap-2 font-semibold"><Avatar user={t.assignedTo} size="xs" />{t.assignedTo?.name}</span></td>
              <td className="px-4 py-3.5 text-muted">{t.createdBy?.name}</td>
              <td className="px-4 py-3.5"><PriorityBadge priority={t.priority} /></td>
              <td className="px-4 py-3.5"><StatusBadge status={t.status} /></td>
              <td className="px-4 py-3.5"><Timing task={t} /></td>
              <td className="digit whitespace-nowrap px-4 py-3.5 text-xs text-muted">{fmtDateTime(t.currentDeadline)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
