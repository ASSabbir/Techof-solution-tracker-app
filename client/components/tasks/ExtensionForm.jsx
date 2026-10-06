'use client';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { useServerNow } from '@/lib/clock';
import { fmtDateTime, fmtMinutes } from '@/lib/format';
import { useAction } from '@/hooks/queries';
import { Field, Spinner } from '@/components/ui/primitives';
import Icon from '@/components/ui/Icon';

const CHIPS = [30, 60, 120, 240];

export default function ExtensionForm({ task, onDone, onCancel }) {
  const now = useServerNow();
  const max = task.limits?.maxExtensionMinutes || 480;
  const schema = z.object({
    minutes: z.number({ invalid_type_error: 'Enter the extra time in minutes.' }).int('Use whole minutes.').min(5, 'Request at least 5 minutes.').max(max, `You can request at most ${fmtMinutes(max)} at a time.`),
    reason: z.string().trim().min(5, 'Please explain why you need more time.').max(500),
  });
  const request = useAction((body) => api(`/tasks/${task._id}/extensions`, { method: 'POST', body }), { success: 'Extension requested — waiting for approval.' });
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({ resolver: zodResolver(schema), defaultValues: { minutes: 120, reason: '' } });
  useEffect(() => { register('minutes', { valueAsNumber: true }); }, [register]);
  const minutes = watch('minutes');

  const base = Math.max(new Date(task.currentDeadline).getTime(), now);
  const next = Number.isFinite(minutes) && minutes > 0 ? base + minutes * 60_000 : null;

  async function submit(v) {
    try { await request.mutateAsync(v); onDone?.(); } catch {}
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-5" noValidate>
      <div className="rounded-xl border border-line bg-surface-2 p-4">
        <p className="text-sm font-bold">{task.title}</p>
        <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
          <div><p className="eyebrow">Current deadline</p><p className="digit mt-1 font-bold">{fmtDateTime(task.currentDeadline)}</p></div>
          <div><p className="eyebrow">Extensions used</p><p className="mt-1 font-bold">{task.extensionCount} / {task.limits?.maxExtensions}</p></div>
        </div>
      </div>

      <Field label="Additional time" error={errors.minutes?.message}>
        <div className="flex flex-wrap items-center gap-2">
          {CHIPS.map((m) => (
            <button key={m} type="button" onClick={() => setValue('minutes', m, { shouldValidate: true })} className={clsx('rounded-lg border px-3 py-1.5 text-sm font-bold transition', minutes === m ? 'border-accent bg-accent/10' : 'border-line bg-surface-2 text-muted hover:text-ink')}>{fmtMinutes(m)}</button>
          ))}
          <input type="number" min="5" step="5" className="input !w-28" value={Number.isFinite(minutes) ? minutes : ''} onChange={(e) => setValue('minutes', e.target.value === '' ? NaN : Number(e.target.value), { shouldValidate: true })} />
          <span className="text-sm text-muted">minutes</span>
        </div>
      </Field>

      <Field label="Reason" error={errors.reason?.message}>
        <textarea className="input min-h-[96px]" placeholder="Client provided additional design changes." {...register('reason')} />
      </Field>

      {next && (
        <p className="flex items-center gap-2 rounded-xl bg-accent/8 px-3.5 py-2.5 text-sm">
          <Icon name="timer" className="h-4 w-4 text-accent" />
          <span className="text-muted">If approved, new deadline</span> <span className="font-bold">{fmtDateTime(next)}</span>
        </p>
      )}

      <div className="flex justify-end gap-3 border-t border-line pt-5">
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" disabled={request.isPending}>{request.isPending ? <><Spinner />Requesting extension…</> : 'Send request'}</button>
      </div>
    </form>
  );
}
