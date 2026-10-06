'use client';
import { useState } from 'react';
import { useEnter } from '@/hooks/useEnter';
import { useTasks } from '@/hooks/queries';
import { useUI } from '@/components/contexts';
import { EmptyState, ErrorState, PageHeader, Skeleton, Tabs } from '@/components/ui/primitives';
import Icon from '@/components/ui/Icon';
import TaskCard from './TaskCard';
import TeamTable from './TeamTable';
import TaskFilters, { EMPTY_FILTERS, toParams } from './TaskFilters';
import Pagination from './Pagination';

const TABS = [['all', 'All'], ['active', 'Active'], ['dueSoon', 'Due Soon'], ['completed', 'Completed'], ['overdue', 'Overdue'], ['extended', 'Extended']];

export default function TaskBrowser({ mine }) {
  const ui = useUI();
  const [tab, setTab] = useState('all');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const params = { ...toParams(filters), tab: mine ? tab : undefined, page, limit: mine ? 12 : 20 };
  const { data, isLoading, isError, refetch, isFetching } = useTasks({ mine, params });
  const ref = useEnter(!!data);

  return (
    <div ref={ref}>
      <PageHeader
        eyebrow={mine ? 'Your workload' : 'Full transparency'}
        title={mine ? 'My Tasks' : 'Team Tasks'}
        subtitle={mine ? 'Everything assigned to you, with live countdowns.' : 'Every task across the team, who has it, and where it stands.'}
        actions={<button className="btn-primary" onClick={() => ui.openAddTask()}><Icon name="plus" />Add Task</button>}
      />
      {mine && (
        <div className="mb-4" data-anim>
          <Tabs value={tab} onChange={(v) => { setTab(v); setPage(1); }} tabs={TABS.map(([value, label]) => ({ value, label, count: data?.counts?.[value] }))} />
        </div>
      )}
      <div className="mb-6"><TaskFilters value={filters} onChange={(f) => { setFilters(f); setPage(1); }} showUser={!mine} /></div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-72" />)}</div>
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : data.items.length === 0 ? (
        <div className="card"><EmptyState icon="check" title={mine && tab === 'all' && !filters.search ? 'No Active Tasks' : 'Nothing matches'} text={mine && tab === 'all' && !filters.search ? 'You’re all caught up.' : 'Try a different tab or clear the filters.'} action={<button className="btn-primary" onClick={() => ui.openAddTask()}>Create New Task</button>} /></div>
      ) : (
        <div className="space-y-6">
          {mine ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.items.map((t) => <TaskCard key={t._id} task={t} />)}</div>
          ) : (
            <>
              <TeamTable items={data.items} />
              <div className="grid gap-4 md:hidden">{data.items.map((t) => <TaskCard key={t._id} task={t} showAssignee />)}</div>
            </>
          )}
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
