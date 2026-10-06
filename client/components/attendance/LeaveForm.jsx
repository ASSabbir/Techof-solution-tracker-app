'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { LEAVE_TYPES } from '@/lib/constants';
import { useAction } from '@/hooks/queries';
import { Field, Spinner } from '@/components/ui/primitives';

const schema = z.object({
  date: z.string().min(1, 'Choose a date.'),
  type: z.string(),
  reason: z.string().trim().min(3, 'Please add a short reason.').max(500),
});

function localToday() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export default function LeaveForm({ onDone, onCancel }) {
  const submit = useAction((body) => api('/leave', { method: 'POST', body }), { success: 'Leave request submitted.' });
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema), defaultValues: { date: localToday(), type: 'PERSONAL', reason: '' } });
  return (
    <form onSubmit={handleSubmit(async (v) => { try { await submit.mutateAsync(v); onDone?.(); } catch {} })} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Leave date" error={errors.date?.message}><input type="date" min={localToday()} className="input" {...register('date')} /></Field>
        <Field label="Leave type"><select className="input" {...register('type')}>{LEAVE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></Field>
      </div>
      <Field label="Reason" error={errors.reason?.message}><textarea className="input min-h-[96px]" placeholder="Personal work" {...register('reason')} /></Field>
      <div className="flex justify-end gap-3 border-t border-line pt-5">
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" disabled={submit.isPending}>{submit.isPending ? <><Spinner />Submitting…</> : 'Submit Leave Request'}</button>
      </div>
    </form>
  );
}
