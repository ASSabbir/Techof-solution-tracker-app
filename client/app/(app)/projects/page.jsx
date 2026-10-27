'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PRIORITY_META } from '@/lib/constants';
import { useServerNow } from '@/lib/clock';
import { useEnter } from '@/hooks/useEnter';
import { useProjects } from '@/hooks/queries';
import { Avatar, Badge, EmptyState, ErrorState, PageHeader, Skeleton, Stat, Tabs } from '@/components/ui/primitives';
import Modal from '@/components/ui/Modal';
import Icon from '@/components/ui/Icon';
import ProjectForm from '@/components/projects/ProjectForm';
import { ProgressLine, ProjectStatus, dueInfo } from '@/components/projects/parts';

const LIVE = ['PLANNING', 'ACTIVE', 'ON_HOLD'];

function ProjectCard({ p, now }) {
  const due = dueInfo(p, now);
  return (
    <Link href={`/projects/${p._id}`} data-anim className="card group relative flex flex-col overflow-hidden p-5 transition duration-300 hover:-translate-y-0.5 hover:shadow-glow">
      <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: p.color }} />
      <div className="flex flex-wrap items-center gap-2">
        <ProjectStatus status={p.status} />
        <Badge tone={PRIORITY_META[p.priority]?.tone}>{PRIORITY_META[p.priority]?.label}</Badge>
        {due && <Badge tone={due.tone} icon="timer" className="ml-auto">{due.label}</Badge>}
      </div>
      <h3 className="mt-3.5 text-lg font-extrabold leading-snug tracking-tight group-hover:text-accent">{p.name}</h3>
      {p.clientName && <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted"><Icon name="company" className="h-3.5 w-3.5" />{p.clientName}</p>}
      {p.description && <p className="mt-2.5 line-clamp-2 text-sm text-muted">{p.description}</p>}
      {p.tags?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">{p.tags.slice(0, 4).map((t) => <span key={t} className="rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted">{t}</span>)}{p.tags.length > 4 && <span className="text-[11px] font-semibold text-muted">+{p.tags.length - 4}</span>}</div>
      )}
      <ProgressLine project={p} className="mt-5" />
      <div className="mt-4 flex items-center justify-between border-t border-line/70 pt-4 text-xs">
        <span className="flex items-center gap-2 font-semibold text-muted"><Avatar user={p.lead} size="xs" />{p.lead?.name} · lead</span>
        <span className="flex items-center gap-3 font-bold">
          <span title="Open tasks">{p.stats.open} open</span>
          {p.stats.overdue > 0 && <span className="text-danger" title="Overdue tasks">{p.stats.overdue} overdue</span>}
        </span>
      </div>
    </Link>
  );
}

export default function ProjectsPage() {
  const router = useRouter();
  const now = useServerNow();
  const { data, isLoading, isError, refetch } = useProjects();
  const [tab, setTab] = useState('live');
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const ref = useEnter(!!data, { selector: '[data-anim]' });

  const groups = useMemo(() => {
    const all = data || [];
    return {
      live: all.filter((p) => LIVE.includes(p.status)),
      completed: all.filter((p) => p.status === 'COMPLETED'),
      archived: all.filter((p) => p.status === 'ARCHIVED'),
    };
  }, [data]);

  if (isError) return <ErrorState onRetry={refetch} />;

  const term = q.trim().toLowerCase();
  const shown = groups[tab].filter((p) => !term || [p.name, p.clientName, p.description, p.lead?.name, ...(p.tags || [])].some((s) => (s || '').toLowerCase().includes(term)));
  const openTasks = groups.live.reduce((n, p) => n + p.stats.open, 0);
  const overdue = groups.live.reduce((n, p) => n + p.stats.overdue, 0);

  return (
    <div ref={ref}>
      <PageHeader
        eyebrow="Everything we’re building"
        title="Projects"
        subtitle="Track every project in one place — who leads it, when it’s due and how far along it is. Link tasks to a project when you create them."
        actions={<button className="btn-primary" onClick={() => setAdding(true)}><Icon name="plus" />Add project</button>}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Live projects" value={groups.live.length} icon="folder" tone="accent" />
        <Stat label="Open tasks" value={openTasks} icon="mine" tone="info" sub="Across live projects" />
        <Stat label="Overdue tasks" value={overdue} icon="warning" tone={overdue ? 'danger' : 'muted'} />
        <Stat label="Completed" value={groups.completed.length} icon="ok" tone="success" sub="Projects delivered" />
      </div>

      <div data-anim className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onChange={setTab} tabs={[
          { value: 'live', label: 'Live', count: groups.live.length },
          { value: 'completed', label: 'Completed', count: groups.completed.length },
          { value: 'archived', label: 'Archived', count: groups.archived.length },
        ]} />
        <div className="relative sm:w-72">
          <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input !pl-10" placeholder="Search name, client, tag…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-72" />)}</div>
      ) : shown.length === 0 ? (
        <div className="card" data-anim>
          <EmptyState icon="folder" title={term ? 'No projects match your search' : tab === 'live' ? 'No live projects yet' : tab === 'completed' ? 'No completed projects yet' : 'Nothing archived'}
            text={tab === 'live' && !term ? 'Add your first project, then pick it when you create tasks.' : undefined}
            action={tab === 'live' && !term ? <button className="btn-primary" onClick={() => setAdding(true)}>Add a project</button> : undefined} />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{shown.map((p) => <ProjectCard key={p._id} p={p} now={now} />)}</div>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a project" subtitle="Everyone on the team is notified." size="lg">
        {adding && <ProjectForm onDone={(p) => { setAdding(false); if (p?._id) router.push(`/projects/${p._id}`); }} onCancel={() => setAdding(false)} />}
      </Modal>
    </div>
  );
}