'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { PRIORITY_META } from '@/lib/constants';
import { fmtDateShort } from '@/lib/format';
import { useServerNow } from '@/lib/clock';
import { useEnter } from '@/hooks/useEnter';
import { useAction, useProject, useTasks } from '@/hooks/queries';
import { useUI } from '@/components/contexts';
import { Avatar, Badge, EmptyState, ErrorState, Skeleton, Tabs } from '@/components/ui/primitives';
import Modal from '@/components/ui/Modal';
import Icon from '@/components/ui/Icon';
import TaskCard from '@/components/tasks/TaskCard';
import ProjectForm from '@/components/projects/ProjectForm';
import { ProgressLine, ProjectStatus, dueInfo } from '@/components/projects/parts';

const dateOf = (key) => fmtDateShort(`${key}T00:00:00`);

function Tile({ label, value, tone }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2/60 px-4 py-3">
      <p className="eyebrow">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold ${tone || ''}`}>{value}</p>
    </div>
  );
}

function ProjectTasks({ id }) {
  const [tab, setTab] = useState('open');
  const params = { projectId: id, limit: 50, ...(tab === 'open' ? { completion: 'OPEN' } : tab === 'done' ? { tab: 'completed' } : {}) };
  const { data, isLoading, isError, refetch } = useTasks({ mine: false, params });
  return (
    <div>
      <div className="mb-4"><Tabs value={tab} onChange={setTab} tabs={[{ value: 'open', label: 'Open' }, { value: 'done', label: 'Completed' }, { value: 'all', label: 'All' }]} /></div>
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
      ) : isError ? <ErrorState onRetry={refetch} /> : data.items.length === 0 ? (
        <div className="card"><EmptyState icon="check" title={tab === 'open' ? 'No open tasks' : 'Nothing here'} text={tab === 'open' ? 'Add a task to this project to get started.' : 'Finished tasks are kept for 30 days, then removed. The project’s completed count stays.'} /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">{data.items.map((t) => <TaskCard key={t._id} task={t} showAssignee />)}</div>
      )}
    </div>
  );
}

function Body({ p }) {
  const ui = useUI();
  const router = useRouter();
  const now = useServerNow();
  const ref = useEnter(true);
  const [editing, setEditing] = useState(false);
  const setStatus = useAction((status) => api(`/projects/${p._id}`, { method: 'PATCH', body: { status } }), { success: 'Project status updated.' });
  const due = dueInfo(p, now);
  const closed = ['COMPLETED', 'ARCHIVED'].includes(p.status);

  return (
    <div ref={ref} className="space-y-6">
      <button onClick={() => router.push('/projects')} data-anim className="btn-ghost -ml-3"><Icon name="back" />All projects</button>

      <div data-anim className="card card-pad relative overflow-hidden">
        <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: p.color }} />
        <div className="flex flex-wrap items-center gap-2">
          <ProjectStatus status={p.status} />
          <Badge tone={PRIORITY_META[p.priority]?.tone}>{PRIORITY_META[p.priority]?.label} priority</Badge>
          {due && <Badge tone={due.tone} icon="timer">{due.label}</Badge>}
        </div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-4xl">{p.name}</h1>
        {p.clientName && <p className="mt-1.5 flex items-center gap-2 text-muted"><Icon name="company" className="h-4 w-4" />{p.clientName}</p>}
        {p.description && <p className="mt-3 max-w-3xl whitespace-pre-wrap text-muted">{p.description}</p>}
        {p.tags?.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{p.tags.map((t) => <span key={t} className="flex items-center gap-1 rounded-md bg-surface-2 px-2.5 py-1 text-xs font-semibold text-muted"><Icon name="tag" className="h-3 w-3" />{t}</span>)}</div>}

        <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
          <span className="flex items-center gap-2"><Avatar user={p.lead} size="sm" /><span><span className="block text-xs text-muted">Project lead</span><span className="font-bold">{p.lead?.name}</span></span></span>
          <span><span className="block text-xs text-muted">Started</span><span className="font-bold">{p.startDate ? dateOf(p.startDate) : '—'}</span></span>
          <span><span className="block text-xs text-muted">Due</span><span className="font-bold">{p.dueDate ? dateOf(p.dueDate) : '—'}</span></span>
          <span><span className="block text-xs text-muted">Added by</span><span className="font-bold">{p.createdBy?.name}</span></span>
          {p.link && <a href={p.link} target="_blank" rel="noopener noreferrer" className="btn-soft btn-sm"><Icon name="external" className="h-3.5 w-3.5" />Open link</a>}
        </div>

        <ProgressLine project={p} className="mt-6 max-w-xl" />

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Open tasks" value={p.stats.open} />
          <Tile label="Completed" value={p.stats.completed} tone="text-success" />
          <Tile label="Overdue" value={p.stats.overdue} tone={p.stats.overdue ? 'text-danger' : ''} />
          <Tile label="Next deadline" value={p.stats.nextDeadline ? fmtDateShort(p.stats.nextDeadline) : '—'} />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {!closed && <button className="btn-primary" onClick={() => ui.openAddTask({ projectId: p._id })}><Icon name="plus" />Add task</button>}
          {p.canManage && (
            <>
              <button className="btn-soft" onClick={() => setEditing(true)}><Icon name="edit" />Edit project</button>
              {p.status === 'COMPLETED' || p.status === 'ARCHIVED'
                ? <button className="btn-ghost" disabled={setStatus.isPending} onClick={() => setStatus.mutate('ACTIVE')}>Reopen</button>
                : (
                  <>
                    <button className="btn-ghost" disabled={setStatus.isPending} onClick={() => setStatus.mutate(p.status === 'ON_HOLD' ? 'ACTIVE' : 'ON_HOLD')}>{p.status === 'ON_HOLD' ? 'Resume' : 'Put on hold'}</button>
                    <button className="btn-success" disabled={setStatus.isPending} onClick={() => setStatus.mutate('COMPLETED')}><Icon name="check" />Mark completed</button>
                  </>
                )}
              {p.status !== 'ARCHIVED' && <button className="btn-ghost" disabled={setStatus.isPending} onClick={() => setStatus.mutate('ARCHIVED')}>Archive</button>}
            </>
          )}
        </div>
      </div>

      {p.workload?.length > 0 && (
        <div data-anim className="card card-pad">
          <p className="eyebrow mb-4">Who’s working on it</p>
          <ul className="grid gap-3 sm:grid-cols-3">
            {p.workload.map((w) => (
              <li key={w.user._id} className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/60 px-3.5 py-3">
                <Avatar user={w.user} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-bold">{w.user.name}</span>
                <span className="text-xs font-bold text-muted">{w.open} open</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div data-anim>
        <p className="eyebrow mb-3">Tasks</p>
        <ProjectTasks id={p._id} />
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit project" size="lg">
        {editing && <ProjectForm key={p._id} project={p} onDone={() => setEditing(false)} onCancel={() => setEditing(false)} />}
      </Modal>
    </div>
  );
}

export default function ProjectDetailPage() {
  const { id } = useParams();
  const { data, isLoading, isError, error, refetch } = useProject(id);
  if (isLoading) return <div className="space-y-4"><Skeleton className="h-80" /><Skeleton className="h-64" /></div>;
  if (isError || !data) return <ErrorState message={error?.status === 404 ? 'That project could not be found.' : undefined} onRetry={refetch} />;
  return <Body p={data} />;
}