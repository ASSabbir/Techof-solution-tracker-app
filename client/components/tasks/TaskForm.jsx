'use client';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { useServerNow } from '@/lib/clock';
import { PRIORITY_META } from '@/lib/constants';
import { fmtDateTime, toLocalInput } from '@/lib/format';
import { useAction, useUsers } from '@/hooks/queries';
import { useAuth } from '@/components/contexts';
import { Avatar, Field, Segmented, Spinner } from '@/components/ui/primitives';
import Icon from '@/components/ui/Icon';

const schema = z
  .object({
    title: z.string().trim().min(2, 'Give the task a title.').max(140, 'Keep the title under 140 characters.'),
    description: z.string().max(2000).optional(),
    assignedTo: z.string().min(1, 'Choose who this is for.'),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
    deadlineType: z.enum(['hours', 'days', 'custom']),
    hours: z.union([z.number(), z.nan()]).optional(),
    days: z.union([z.number(), z.nan()]).optional(),
    customAt: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.deadlineType === 'hours' && !(v.hours > 0)) ctx.addIssue({ code: 'custom', path: ['hours'], message: 'Enter how many hours.' });
    if (v.deadlineType === 'days' && !(v.days > 0)) ctx.addIssue({ code: 'custom', path: ['days'], message: 'Enter how many days.' });
    if (v.deadlineType === 'custom') {
      if (!v.customAt) ctx.addIssue({ code: 'custom', path: ['customAt'], message: 'Pick a date and time.' });
      else if (new Date(v.customAt).getTime() < Date.now() + 60_000) ctx.addIssue({ code: 'custom', path: ['customAt'], message: 'Choose a time at least a minute from now.' });
    }
  });

const HOUR_CHIPS = [1, 2, 4, 8, 12, 24];
const DAY_CHIPS = [1, 2, 3, 5, 7, 14];

export default function TaskForm({ defaults, onDone, onCancel }) {
  const { user } = useAuth();
  const { data: users = [] } = useUsers();
  const now = useServerNow();
  const create = useAction((body) => api('/tasks', { method: 'POST', body }).then((d) => d.task), { success: 'Task created — the countdown has started.' });

  const { register, handleSubmit, watch, setValue, setError, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: defaults?.title || '', description: '', assignedTo: defaults?.assignedTo || user?._id || '', priority: 'MEDIUM',
      deadlineType: 'hours', hours: 2, days: 1, customAt: toLocalInput(new Date(Date.now() + 24 * 3600_000)),
    },
  });
  const v = watch();
  useEffect(() => { register('assignedTo'); register('priority'); register('deadlineType'); }, [register]);

  let preview = null;
  if (v.deadlineType === 'hours' && v.hours > 0) preview = now + v.hours * 3600_000;
  else if (v.deadlineType === 'days' && v.days > 0) preview = now + v.days * 86_400_000;
  else if (v.deadlineType === 'custom' && v.customAt) preview = new Date(v.customAt).getTime();

  async function submit(values) {
    const deadline =
      values.deadlineType === 'hours' ? { type: 'hours', value: values.hours }
        : values.deadlineType === 'days' ? { type: 'days', value: values.days }
          : { type: 'custom', at: new Date(values.customAt).toISOString() };
    try {
      const task = await create.mutateAsync({ title: values.title, description: values.description || '', assignedTo: values.assignedTo, priority: values.priority, deadline });
      onDone?.(task);
    } catch (err) {
      if (err.fields?.title) setError('title', { message: err.fields.title });
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-6" noValidate>
      <Field label="Task title" error={errors.title?.message}>
        <input className="input" placeholder="Complete Sattar & Co. Homepage" autoFocus {...register('title')} />
      </Field>

      <Field label="Description (optional)" error={errors.description?.message}>
        <textarea className="input min-h-[88px] resize-y" placeholder="Finish responsive version and animation implementation." {...register('description')} />
      </Field>

      <Field label="Assign to" error={errors.assignedTo?.message}>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {users.map((u) => (
            <button key={u._id} type="button" onClick={() => setValue('assignedTo', u._id, { shouldValidate: true })}
              className={clsx('flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition', v.assignedTo === u._id ? 'border-accent bg-accent/10 shadow-glow' : 'border-line bg-surface-2 hover:border-accent/40')}>
              <Avatar user={u} size="sm" />
              <span className="min-w-0"><span className="block truncate text-sm font-bold">{u.name}</span>{u._id === user?._id && <span className="text-[11px] text-muted">You</span>}</span>
              {v.assignedTo === u._id && <Icon name="check" className="ml-auto h-4 w-4 text-accent" />}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Priority">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {Object.entries(PRIORITY_META).map(([key, m]) => (
            <button key={key} type="button" onClick={() => setValue('priority', key)}
              className={clsx('rounded-xl border px-3 py-2.5 text-sm font-bold transition', v.priority === key ? 'border-accent bg-accent/10' : 'border-line bg-surface-2 text-muted hover:text-ink')}>
              {m.label}<span className="ml-1.5 text-[10px] font-semibold text-muted">{m.points}pt</span>
            </button>
          ))}
        </div>
      </Field>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="label !mb-0">Deadline</span>
          <Segmented size="sm" value={v.deadlineType} onChange={(x) => setValue('deadlineType', x, { shouldValidate: true })}
            options={[{ value: 'hours', label: 'Hours' }, { value: 'days', label: 'Days' }, { value: 'custom', label: 'Custom' }]} />
        </div>

        {v.deadlineType === 'hours' && (
          <Field error={errors.hours?.message}>
            <div className="flex flex-wrap items-center gap-2">
              {HOUR_CHIPS.map((h) => (
                <button type="button" key={h} onClick={() => setValue('hours', h, { shouldValidate: true })} className={clsx('rounded-lg border px-3 py-1.5 text-sm font-bold transition', v.hours === h ? 'border-accent bg-accent/10' : 'border-line bg-surface-2 text-muted hover:text-ink')}>{h}h</button>
              ))}
              <input type="number" min="0.25" step="0.25" className="input !w-28" {...register('hours', { valueAsNumber: true })} />
              <span className="text-sm text-muted">hours</span>
            </div>
          </Field>
        )}
        {v.deadlineType === 'days' && (
          <Field error={errors.days?.message}>
            <div className="flex flex-wrap items-center gap-2">
              {DAY_CHIPS.map((d) => (
                <button type="button" key={d} onClick={() => setValue('days', d, { shouldValidate: true })} className={clsx('rounded-lg border px-3 py-1.5 text-sm font-bold transition', v.days === d ? 'border-accent bg-accent/10' : 'border-line bg-surface-2 text-muted hover:text-ink')}>{d}d</button>
              ))}
              <input type="number" min="0.5" step="0.5" className="input !w-28" {...register('days', { valueAsNumber: true })} />
              <span className="text-sm text-muted">days</span>
            </div>
          </Field>
        )}
        {v.deadlineType === 'custom' && (
          <Field error={errors.customAt?.message}>
            <input type="datetime-local" className="input sm:max-w-xs" {...register('customAt')} />
          </Field>
        )}
        {preview && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-accent/8 px-3.5 py-2.5 text-sm">
            <Icon name="timer" className="h-4 w-4 text-accent" />
            <span className="text-muted">Due</span> <span className="font-bold">{fmtDateTime(preview)}</span>
            <span className="ml-auto hidden text-xs text-muted sm:inline">Fixed once created — extensions need approval</span>
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-line pt-5">
        {onCancel && <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>}
        <button type="submit" className="btn-primary min-w-36" disabled={create.isPending}>
          {create.isPending ? <><Spinner />Creating task…</> : <><Icon name="plus" />Create task</>}
        </button>
      </div>
    </form>
  );
}
