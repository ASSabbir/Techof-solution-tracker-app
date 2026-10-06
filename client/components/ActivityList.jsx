'use client';
import { useServerNow } from '@/lib/clock';
import { timeAgo } from '@/lib/format';
import { Avatar } from '@/components/ui/primitives';
import Link from 'next/link';

export default function ActivityList({ items = [] }) {
  const now = useServerNow();
  return (
    <ul className="divide-y divide-line/70">
      {items.map((a) => {
        const body = (
          <div className="flex items-start gap-3 py-3">
            <Avatar user={a.userId} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-snug">{a.message}</p>
              <p className="mt-0.5 text-xs text-muted">{timeAgo(a.createdAt, now)}</p>
            </div>
          </div>
        );
        return <li key={a._id}>{a.entityType === 'Task' && a.entityId ? <Link href={`/tasks/${a.entityId}`} className="block rounded-lg px-1 transition hover:bg-surface-2/60">{body}</Link> : <div className="px-1">{body}</div>}</li>;
      })}
    </ul>
  );
}
