'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { api, tokenStore } from '@/lib/api';
import { gsap, motionOK } from '@/lib/motion';
import { AuthContext, ToastContext, UIContext, useToast } from './contexts';
import Icon from './ui/Icon';
import Modal from './ui/Modal';
import { Spinner } from './ui/primitives';
import TaskForm from './tasks/TaskForm';
import ExtensionForm from './tasks/ExtensionForm';
import LeaveForm from './attendance/LeaveForm';

/* ---------------------------------------------------------------- Theme */
function applyTheme(pref) {
  const dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}
export function applyMotion(reduce) {
  document.documentElement.dataset.reduceMotion = reduce ? 'true' : 'false';
}
export function useThemePref() {
  const [pref, setPref] = useState('dark');
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    setPref(localStorage.getItem('techof_theme') || 'dark');
    setReduce(localStorage.getItem('techof_reduce_motion') === 'true');
  }, []);
  const setTheme = (p) => { setPref(p); localStorage.setItem('techof_theme', p); applyTheme(p); };
  const setReduceMotion = (r) => { setReduce(r); localStorage.setItem('techof_reduce_motion', String(r)); applyMotion(r); };
  return { pref, setTheme, reduce, setReduceMotion };
}

/* ---------------------------------------------------------------- Toasts */
function ToastItem({ toast, onDone }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (motionOK()) gsap.fromTo(el, { x: 40, opacity: 0, scale: 0.96 }, { x: 0, opacity: 1, scale: 1, duration: 0.4, ease: 'power3.out' });
    const t = setTimeout(() => {
      if (!motionOK()) return onDone();
      gsap.to(el, { x: 40, opacity: 0, duration: 0.25, ease: 'power2.in', onComplete: onDone });
    }, toast.duration || 4200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const tone = { success: 'text-success', error: 'text-danger', info: 'text-info' }[toast.type];
  const icon = { success: 'ok', error: 'alert', info: 'bell' }[toast.type];
  return (
    <div ref={ref} className="glass pointer-events-auto flex w-full items-start gap-3 rounded-2xl border border-line p-3.5 shadow-soft sm:w-96">
      <Icon name={icon} className={clsx('mt-0.5 h-5 w-5 shrink-0', tone)} />
      <div className="min-w-0 flex-1">
        {toast.title && <p className="text-sm font-bold">{toast.title}</p>}
        <p className={clsx('text-sm', toast.title ? 'text-muted' : 'font-semibold')}>{toast.message}</p>
      </div>
    </div>
  );
}
function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((type, message, extra = {}) => setItems((s) => [...s.slice(-3), { id: Math.random().toString(36).slice(2), type, message, ...extra }]), []);
  const api_ = useMemo(() => ({
    success: (m, e) => push('success', m, e), error: (m, e) => push('error', m, e), info: (m, e) => push('info', m, e),
  }), [push]);
  return (
    <ToastContext.Provider value={api_}>
      {children}
      <div className="pointer-events-none fixed inset-x-3 bottom-3 z-[200] flex flex-col items-end gap-2.5 sm:inset-x-auto sm:bottom-5 sm:right-5">
        {items.map((t) => <ToastItem key={t.id} toast={t} onDone={() => setItems((s) => s.filter((x) => x.id !== t.id))} />)}
      </div>
    </ToastContext.Provider>
  );
}

/* ----------------------------------------------------------------- Auth */
function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => {
    if (!tokenStore.get()) { setReady(true); return; }
    api('/auth/me').then((d) => setUser(d.user)).catch(() => tokenStore.clear()).finally(() => setReady(true));
  }, []);

  // Any 401 from the API ends the session.
  useEffect(() => {
    const onUnauthorized = () => {
      if (!tokenStore.get()) return;
      tokenStore.clear();
      setUser(null);
      qc.clear();
      router.replace('/login?expired=1');
    };
    window.addEventListener('techof:unauthorized', onUnauthorized);
    return () => window.removeEventListener('techof:unauthorized', onUnauthorized);
  }, [qc, router]);

  // Automatic session validation: every 5 minutes and when the tab regains focus.
  useEffect(() => {
    if (!user) return undefined;
    const check = () => api('/auth/me').then((d) => setUser(d.user)).catch(() => {});
    const id = setInterval(check, 5 * 60_000);
    window.addEventListener('focus', check);
    return () => { clearInterval(id); window.removeEventListener('focus', check); };
  }, [user?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(() => ({
    user, ready, setUser,
    async login({ identifier, password, remember }) {
      const d = await api('/auth/login', { method: 'POST', body: { identifier, password, remember } });
      tokenStore.set(d.token, remember);
      setUser(d.user);
      return d.user;
    },
    async logout() {
      try { await api('/auth/logout', { method: 'POST' }); } catch {}
      tokenStore.clear();
      setUser(null);
      qc.clear();
      router.replace('/login');
    },
  }), [user, ready, qc, router]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* ------------------------------------------------------- Global UI / modals */
function UIProvider({ children }) {
  const [taskModal, setTaskModal] = useState({ open: false, defaults: null });
  const [extTask, setExtTask] = useState(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const [picker, setPicker] = useState(false);
  const router = useRouter();

  const ui = useMemo(() => ({
    openAddTask: (defaults = null) => setTaskModal({ open: true, defaults }),
    openExtension: (task) => (task ? setExtTask(task) : setPicker(true)),
    openLeave: () => setLeaveOpen(true),
    confirm: (opts) => new Promise((resolve) => setConfirmState({ ...opts, resolve })),
  }), []);

  const closeConfirm = (result) => { confirmState?.resolve(result); setConfirmState(null); };

  return (
    <UIContext.Provider value={ui}>
      {children}

      <Modal open={taskModal.open} onClose={() => setTaskModal((s) => ({ ...s, open: false }))} title="Create a task" subtitle="Assign it, set a deadline, and the countdown starts immediately." size="lg">
        <TaskForm defaults={taskModal.defaults} onDone={(task) => { setTaskModal((s) => ({ ...s, open: false })); if (task?._id) router.push(`/tasks/${task._id}`); }} onCancel={() => setTaskModal((s) => ({ ...s, open: false }))} />
      </Modal>

      <Modal open={!!extTask} onClose={() => setExtTask(null)} title="Request more time" subtitle="Deadlines can’t be reset — the person who assigned the task will approve or reject." size="md">
        {extTask && <ExtensionForm task={extTask} onDone={() => setExtTask(null)} onCancel={() => setExtTask(null)} />}
      </Modal>

      <ExtensionPicker open={picker} onClose={() => setPicker(false)} onPick={(t) => { setPicker(false); setExtTask(t); }} />

      <Modal open={leaveOpen} onClose={() => setLeaveOpen(false)} title="Apply for leave" subtitle="Your teammates will be asked to approve it." size="md">
        <LeaveForm onDone={() => setLeaveOpen(false)} onCancel={() => setLeaveOpen(false)} />
      </Modal>

      <Modal open={!!confirmState} onClose={() => closeConfirm(false)} title={confirmState?.title} size="sm"
        footer={confirmState && (
          <>
            <button className="btn-ghost" onClick={() => closeConfirm(false)}>{confirmState.cancelText || 'Cancel'}</button>
            <button className={confirmState.tone === 'danger' ? 'btn-danger' : 'btn-primary'} onClick={() => closeConfirm(true)}>{confirmState.confirmText || 'Confirm'}</button>
          </>
        )}>
        <p className="text-sm text-muted">{confirmState?.message}</p>
      </Modal>
    </UIContext.Provider>
  );
}

// "Request Extension" quick action: pick one of your own eligible tasks first.
function ExtensionPicker({ open, onClose, onPick }) {
  const [state, setState] = useState({ loading: false, items: [] });
  useEffect(() => {
    if (!open) return;
    setState({ loading: true, items: [] });
    api('/tasks/my', { params: { tab: 'active', limit: 50 } })
      .then(async (d) => {
        const od = await api('/tasks/my', { params: { tab: 'overdue', limit: 50 } });
        const all = [...d.items, ...od.items].filter((t) => t.permissions?.canRequestExtension);
        setState({ loading: false, items: all });
      })
      .catch(() => setState({ loading: false, items: [] }));
  }, [open]);
  return (
    <Modal open={open} onClose={onClose} title="Request an extension" subtitle="Choose the task you need more time for." size="md">
      {state.loading ? (
        <div className="flex justify-center py-8 text-muted"><Spinner className="h-5 w-5" /></div>
      ) : state.items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">None of your tasks can take an extension right now.</p>
      ) : (
        <ul className="space-y-2">
          {state.items.map((t) => (
            <li key={t._id}>
              <button onClick={() => onPick(t)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3 text-left transition hover:border-accent/50">
                <span className="min-w-0"><span className="block truncate text-sm font-bold">{t.title}</span><span className="text-xs text-muted">{t.extensionCount}/{t.limits.maxExtensions} extensions used</span></span>
                <Icon name="arrow" className="h-4 w-4 shrink-0 text-muted" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------ Root provider */
export default function Providers({ children }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 10_000, refetchOnWindowFocus: true, retry: (n, err) => n < 2 && (!err?.status || err.status >= 500 || err.status === 0) } },
  }));

  useEffect(() => {
    const theme = localStorage.getItem('techof_theme') || 'dark';
    applyTheme(theme);
    applyMotion(localStorage.getItem('techof_reduce_motion') === 'true');
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => { if ((localStorage.getItem('techof_theme') || 'dark') === 'system') applyTheme('system'); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <AuthProvider>
          <UIProvider>{children}</UIProvider>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
