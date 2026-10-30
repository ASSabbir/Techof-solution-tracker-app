'use client';
import { useState } from 'react';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { useServerNow } from '@/lib/clock';
import { fmtDateTime, toLocalInput } from '@/lib/format';
import { useAction } from '@/hooks/queries';
import { Field, Segmented, Spinner } from '@/components/ui/primitives';
import Modal from '@/components/ui/Modal';
import Icon from '@/components/ui/Icon';

const HOUR_CHIPS = [1, 2, 4, 8, 12, 24];
const DAY_CHIPS = [1, 2, 3, 5, 7, 14];
const chip = (on) => clsx('rounded-lg border px-3 py-1.5 text-sm font-bold transition', on ? 'border-accent bg-accent/10' : 'border-line bg-surface-2 text-muted hover:text-ink');

// Reopening a cancelled task starts it over, so the person picks a fresh deadline.
export default function ReopenModal({ task, open, onClose }) {
  const now = useServerNow();
  const [type, setType] = useState('days');
  const [hours, setHours] = useState(4);
  const [days, setDays] = useState(1);
  const [customAt, setCustomAt] = useState(() => toLocalInput(new Date(Date.now() + 24 * 3600_000)));
  const [error, setError] = useState('');

  const reopen = useAction((deadline) => api(`/tasks/${task._id}/reopen`, { method: 'POST', body: { deadline } }), {
    success: 'Task reopened with a new deadline.',
    onSuccess: () => onClose(),
  });

  let at = null;
  if (type === 'hours' && hours > 0) at = now + hours * 3600_000;
  else if (type === 'days' && days > 0) at = now + days * 86_400_000;
  else if (type === 'custom' && customAt) at = new Date(customAt).getTime();

  function submit() {
    if (!at || Number.isNaN(at)) return setError('Choose a deadline.');
    if (at < Date.now() + 60_000) return setError('Choose a time at least a minute from now.');
    setError('');
    reopen.mutate(type === 'hours' ? { type, value: hours } : type === 'days' ? { type, value: days } : { type, at: new Date(customAt).toISOString() });
  }

  return (
    <Modal open={open} onClose={() => !reopen.isPending && onClose()} title="Reopen task" subtitle={`“${task.title}” starts over with a new deadline. The assignee is notified.`} size="md"
      footer={(
        <>
          <button className="btn-ghost" onClick={onClose} disabled={reopen.isPending}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={reopen.isPending}>{reopen.isPending ? <><Spinner />Reopening…</> : <><Icon name="refresh" />Reopen task</>}</button>
        </>
      )}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="label !mb-0">New deadline</span>
        <Segmented size="sm" value={type} onChange={setType} options={[{ value: 'hours', label: 'Hours' }, { value: 'days', label: 'Days' }, { value: 'custom', label: 'Custom' }]} />
      </div>
      <Field error={error}>
        {type === 'hours' && (
          <div className="flex flex-wrap items-center gap-2">
            {HOUR_CHIPS.map((h) => <button type="button" key={h} onClick={() => setHours(h)} className={chip(hours === h)}>{h}h</button>)}
            <input type="number" min="0.25" step="0.25" className="input !w-28" value={hours} onChange={(e) => setHours(Number(e.target.value))} />
            <span className="text-sm text-muted">hours</span>
          </div>
        )}
        {type === 'days' && (
          <div className="flex flex-wrap items-center gap-2">
            {DAY_CHIPS.map((d) => <button type="button" key={d} onClick={() => setDays(d)} className={chip(days === d)}>{d}d</button>)}
            <input type="number" min="0.5" step="0.5" className="input !w-28" value={days} onChange={(e) => setDays(Number(e.target.value))} />
            <span className="text-sm text-muted">days</span>
          </div>
        )}
        {type === 'custom' && <input type="datetime-local" className="input sm:max-w-xs" value={customAt} onChange={(e) => setCustomAt(e.target.value)} />}
      </Field>
      {at && !Number.isNaN(at) && (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-accent/8 px-3.5 py-2.5 text-sm">
          <Icon name="timer" className="h-4 w-4 text-accent" /><span className="text-muted">Due</span> <span className="font-bold">{fmtDateTime(at)}</span>
        </p>
      )}
    </Modal>
  );
}