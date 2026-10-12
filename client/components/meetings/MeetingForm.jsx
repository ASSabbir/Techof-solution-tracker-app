'use client';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { MEETING_MODES } from '@/lib/constants';
import { toLocalInput } from '@/lib/format';
import { useAction, useUsers } from '@/hooks/queries';
import { useAuth } from '@/components/contexts';
import { Avatar, Field, Spinner } from '@/components/ui/primitives';
import Icon from '@/components/ui/Icon';

const DURATIONS = [15, 30, 45, 60, 90, 120, 180];
const durLabel = (m) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60} hour${m === 60 ? '' : 's'}`);

const schema = z.object({
  title: z.string().trim().min(3, 'What is the meeting about?').max(140),
  projectName: z.string().trim().min(1, 'Add the project name.').max(100),
  companyName: z.string().trim().min(1, 'Add the company name.').max(100),
  personName: z.string().trim().min(1, 'Who are we meeting?').max(100),
  responsible: z.string().min(1, 'Choose who is responsible.'),
  startsAt: z.string().min(1, 'Pick a date and time.'),
  durationMinutes: z.number().int().min(5).max(720),
  mode: z.enum(['ONLINE', 'IN_PERSON', 'PHONE']),
  location: z.string().trim().max(300),
  agenda: z.string().trim().max(2000),
});

export default function MeetingForm({ meeting, onDone, onCancel }) {
  const { user } = useAuth();
  const { data: users = [] } = useUsers();
  const editing = !!meeting;

  const save = useAction(
    (body) => (editing ? api(`/meetings/${meeting._id}`, { method: 'PATCH', body }) : api('/meetings', { method: 'POST', body })),
    { success: editing ? 'Meeting updated.' : 'Meeting announced. Your team has been notified.' }
  );

  const { register, handleSubmit, watch, setValue, setError, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: editing
      ? {
          title: meeting.title, projectName: meeting.projectName, companyName: meeting.companyName, personName: meeting.personName,
          responsible: meeting.responsible?._id || '', startsAt: toLocalInput(new Date(meeting.startsAt)), durationMinutes: meeting.durationMinutes,
          mode: meeting.mode, location: meeting.location || '', agenda: meeting.agenda || '',
        }
      : {
          title: '', projectName: '', companyName: '', personName: '', responsible: user?._id || '',
          startsAt: toLocalInput(new Date(Date.now() + 24 * 3600_000)), durationMinutes: 60, mode: 'ONLINE', location: '', agenda: '',
        },
  });
  useEffect(() => { register('responsible'); register('mode'); }, [register]);
  const v = watch();
  const mode = MEETING_MODES.find((m) => m.value === v.mode) || MEETING_MODES[0];

  async function onSubmit(values) {
    if (!editing && new Date(values.startsAt).getTime() < Date.now() - 60_000) {
      setError('startsAt', { message: 'Pick a time in the future.' });
      return;
    }
    try {
      await save.mutateAsync({ ...values, startsAt: new Date(values.startsAt).toISOString() });
      onDone?.();
    } catch {}
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <Field label="What is the meeting about?" error={errors.title?.message}>
        <input className="input" autoFocus placeholder="Requirement discussion, demo, kickoff…" {...register('title')} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Project name" error={errors.projectName?.message}><input className="input" placeholder="Website redesign" {...register('projectName')} /></Field>
        <Field label="Company name" error={errors.companyName?.message}><input className="input" placeholder="Acme Ltd." {...register('companyName')} /></Field>
      </div>

      <Field label="Person we are meeting" error={errors.personName?.message} hint="The client or contact on the other side.">
        <input className="input" placeholder="Mr. Rahman" {...register('personName')} />
      </Field>

      <div>
        <p className="label">Responsible person</p>
        <div className="grid gap-2.5 sm:grid-cols-3">
          {users.map((u) => {
            const on = v.responsible === u._id;
            return (
              <button key={u._id} type="button" onClick={() => setValue('responsible', u._id, { shouldValidate: true })}
                className={clsx('flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition', on ? 'border-accent bg-accent/10' : 'border-line bg-surface-2 hover:border-accent/40')}>
                <Avatar user={u} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-bold">{u.name}{u._id === user?._id && <span className="font-medium text-muted"> (you)</span>}</span>
                {on && <Icon name="check" className="h-4 w-4 text-accent" />}
              </button>
            );
          })}
        </div>
        {errors.responsible && <p className="field-error">{errors.responsible.message}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date & time" error={errors.startsAt?.message}><input type="datetime-local" className="input" {...register('startsAt')} /></Field>
        <Field label="Duration" error={errors.durationMinutes?.message}>
          <select className="input" {...register('durationMinutes', { valueAsNumber: true })}>
            {[...new Set([...DURATIONS, v.durationMinutes].filter(Boolean))].sort((a, b) => a - b).map((m) => <option key={m} value={m}>{durLabel(m)}</option>)}
          </select>
        </Field>
      </div>

      <div>
        <p className="label">How</p>
        <div className="grid grid-cols-3 gap-2.5">
          {MEETING_MODES.map((m) => (
            <button key={m.value} type="button" onClick={() => setValue('mode', m.value)}
              className={clsx('flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition', v.mode === m.value ? 'border-accent bg-accent/10' : 'border-line bg-surface-2 text-muted hover:border-accent/40')}>
              <Icon name={m.icon} className="h-4 w-4" />{m.label}
            </button>
          ))}
        </div>
        <input className="input mt-3" placeholder={mode.placeholder} {...register('location')} />
      </div>

      <Field label="Agenda (optional)" hint="What should everyone prepare or know?" error={errors.agenda?.message}>
        <textarea className="input min-h-[96px] resize-y" placeholder="Points to discuss, documents to bring…" {...register('agenda')} />
      </Field>

      {editing && <p className="rounded-xl bg-warning/10 px-3.5 py-2.5 text-xs font-semibold text-warning">If you change the date or time, everyone is asked to confirm again.</p>}

      <div className="flex justify-end gap-3 border-t border-line pt-5">
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" disabled={save.isPending}>
          {save.isPending ? <><Spinner />Saving…</> : editing ? <><Icon name="save" />Save changes</> : <><Icon name="meetingAdd" />Announce meeting</>}
        </button>
      </div>
    </form>
  );
}