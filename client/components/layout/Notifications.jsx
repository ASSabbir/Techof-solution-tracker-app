'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { useServerNow } from '@/lib/clock';
import { timeAgo } from '@/lib/format';
import { gsap, motionOK } from '@/lib/motion';
import { useAction, useNotifications } from '@/hooks/queries';
import { useToast } from '@/components/contexts';
import Icon from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/primitives';

const ICON = {
  TASK_ASSIGNED: 'mine', TASK_REMINDER: 'timer', TASK_OVERDUE: 'warning', EXTENSION_REQUESTED: 'hourglass',
  EXTENSION_APPROVED: 'ok', EXTENSION_REJECTED: 'no', TASK_COMPLETED: 'check', TASK_CANCELLED: 'ban',
  LEAVE_SUBMITTED: 'leave', LEAVE_APPROVED: 'ok', LEAVE_REJECTED: 'no',
};

export default function Notifications() {
  const [open, setOpen] = useState(false);
  const panel = useRef(null);
  const wrap = useRef(null);
  const router = useRouter();
  const toast = useToast();
  const now = useServerNow();
  const { data } = useNotifications();
  const seen = useRef(null);
  const markAll = useAction(() => api('/notifications/read-all', { method: 'POST' }), { silentError: true });
  const markOne = useAction((id) => api(`/notifications/${id}/read`, { method: 'PATCH' }), { silentError: true });

  // Pop a toast when a brand-new notification arrives (not for the initial load).
  useEffect(() => {
    if (!data) return;
    const ids = new Set(data.items.map((n) => n._id));
    if (seen.current) {
      data.items.filter((n) => !seen.current.has(n._id) && !n.readAt).slice(0, 2).forEach((n) => toast.info(n.message, { title: n.title }));
    }
    seen.current = ids;
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open && panel.current && motionOK()) gsap.fromTo(panel.current, { y: -8, opacity: 0, scale: 0.97 }, { y: 0, opacity: 1, scale: 1, duration: 0.25, ease: 'power3.out' });
    if (!open) return undefined;
    const onDown = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const unread = data?.unread || 0;
  return (
    <div className="relative" ref={wrap}>
      <button onClick={() => setOpen((o) => !o)} className="btn-soft relative !rounded-xl !p-2.5" aria-label="Notifications">
        <Icon name="bell" className="h-5 w-5" />
        {unread > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div ref={panel} className="card absolute right-0 top-full z-50 mt-3 w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-extrabold">Notifications {unread > 0 && <span className="ml-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">{unread}</span>}</p>
            {unread > 0 && <button onClick={() => markAll.mutate()} className="text-xs font-bold text-accent hover:underline">Mark all read</button>}
          </div>
          <div className="max-h-[26rem] overflow-y-auto">
            {!data?.items.length ? (
              <EmptyState icon="bell" title="You’re all caught up." />
            ) : data.items.map((n) => (
              <button key={n._id} onClick={() => { if (!n.readAt) markOne.mutate(n._id); setOpen(false); if (n.link) router.push(n.link); }}
                className={clsx('flex w-full items-start gap-3 border-b border-line/60 px-4 py-3 text-left transition last:border-0 hover:bg-surface-2', !n.readAt && 'bg-accent/5')}>
                <span className={clsx('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg', n.type === 'TASK_OVERDUE' || n.type === 'EXTENSION_REJECTED' ? 'bg-danger/12 text-danger' : n.type === 'TASK_REMINDER' ? 'bg-warning/12 text-warning' : 'bg-accent/12 text-accent')}><Icon name={ICON[n.type] || 'bell'} className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-bold">{!n.readAt && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}{n.title}</span>
                  <span className="block text-sm text-muted">{n.message}</span>
                  <span className="mt-0.5 block text-[11px] font-semibold text-muted/80">{timeAgo(n.createdAt, now)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
