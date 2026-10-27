'use client';
import Link from 'next/link';
import clsx from 'clsx';
import { PROJECT_STATUS } from '@/lib/constants';
import { fmtDateShort } from '@/lib/format';
import { Badge } from '@/components/ui/primitives';

export const ProjectStatus = ({ status }) => {
  const m = PROJECT_STATUS[status] || PROJECT_STATUS.ACTIVE;
  return <Badge tone={m.tone} dot>{m.label}</Badge>;
};

/* Small coloured pill with the project name. `link` makes it open the project. */
export function ProjectChip({ project, link = false, className }) {
  if (!project) return null;
  const inner = (
    <>
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: project.color || '#6366f1' }} />
      <span className="truncate">{project.name}</span>
    </>
  );
  const cls = clsx('inline-flex max-w-[14rem] items-center gap-1.5 rounded-full border border-line bg-surface-2/70 px-2.5 py-1 text-xs font-bold', link && 'transition hover:border-accent/50 hover:text-accent', className);
  return link ? <Link href={`/projects/${project._id}`} className={cls}>{inner}</Link> : <span className={cls}>{inner}</span>;
}

const dayNumber = (key) => Math.round(new Date(`${key}T00:00:00`).getTime() / 86400000);
const todayKey = (now) => new Date(now).toLocaleDateString('en-CA'); // YYYY-MM-DD in the viewer's timezone

/* How close the due date is. Returns null when there is no date or the project is finished. */
export function dueInfo(project, now) {
  if (!project.dueDate || ['COMPLETED', 'ARCHIVED'].includes(project.status)) return null;
  const d = dayNumber(project.dueDate) - dayNumber(todayKey(now));
  if (d < 0) return { label: `${-d}d overdue`, tone: 'danger' };
  if (d === 0) return { label: 'Due today', tone: 'warning' };
  if (d <= 7) return { label: `Due in ${d}d`, tone: 'warning' };
  return { label: `Due ${fmtDateShort(`${project.dueDate}T00:00:00`)}`, tone: 'muted' };
}

export function ProgressLine({ project, className }) {
  const { progress, completed, total } = project.stats;
  const pct = progress ?? 0;
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-bold">{progress === null ? 'No tasks yet' : `${pct}% done`}</span>
        <span className="font-semibold text-muted">{completed}/{total} tasks</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${pct}%`, backgroundColor: project.color || '#6366f1' }} />
      </div>
    </div>
  );
}