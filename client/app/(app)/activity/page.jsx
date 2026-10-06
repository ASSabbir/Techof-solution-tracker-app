'use client';
import { useState } from 'react';
import { useEnter } from '@/hooks/useEnter';
import { useActivity, useUsers } from '@/hooks/queries';
import ActivityList from '@/components/ActivityList';
import Pagination from '@/components/tasks/Pagination';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/primitives';

export default function ActivityPage() {
  const { data: users = [] } = useUsers();
  const [userId, setUserId] = useState('');
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useActivity({ userId, entityType, page, limit: 30 });
  const ref = useEnter(!!data);
  return (
    <div ref={ref}>
      <PageHeader eyebrow="Audit trail" title="Activity" subtitle="An append-only record of everything that happened. Entries can’t be edited or removed." />
      <div className="mb-5 flex flex-wrap gap-3" data-anim>
        <select className="input !w-auto" value={userId} onChange={(e) => { setUserId(e.target.value); setPage(1); }}><option value="">Everyone</option>{users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}</select>
        <select className="input !w-auto" value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }}><option value="">All activity</option><option value="Task">Tasks</option><option value="Attendance">Attendance</option><option value="Leave">Leave</option><option value="Settings">Settings</option></select>
      </div>
      {isError ? <ErrorState onRetry={refetch} /> : isLoading ? <Skeleton className="h-96" /> : (
        <div className="card card-pad" data-anim>
          {data.items.length ? <ActivityList items={data.items} /> : <EmptyState icon="activity" title="No activity yet" />}
          <div className="mt-4"><Pagination page={data.page} pages={data.pages} onChange={setPage} /></div>
        </div>
      )}
    </div>
  );
}
