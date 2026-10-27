'use client';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { PRIORITY_META, PROJECT_COLORS, PROJECT_STATUS } from '@/lib/constants';
import { useAction, useUsers } from '@/hooks/queries';
import { useAuth } from '@/components/contexts';
import { Avatar, Field, Spinner } from '@/components/ui/primitives';
import Icon from '@/components/ui/Icon';

const schema = z.object({
  name: z.string().trim().min(2, 'Give the project a name.').max(100),
  clientName: z.string().trim().max(100),
  description: z.string().trim().max(2000),
  status: z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  lead: z.string().min(1, 'Choose who leads this project.'),
  startDate: z.string(),
  dueDate: z.string(),
  link: z.string().trim().max(300).refine((s) => s === '' || /^https?:\/\//i.test(s), 'Start the link with http:// or https://'),
  tagsText: z.string().max(300),
}).superRefine((v, ctx) => {
  if (v.startDate && v.dueDate && v.dueDate < v.startDate) ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'Due date can’t be before the start date.' });
});

const parseTags = (text) => [...new Set(text.split(',').map((t) => t.trim()).filter(Boolean))].slice(0, 8).map((t) => t.slice(0, 24));

export default function ProjectForm({ project, onDone, onCancel }) {
  const { user } = useAuth();
  const { data: users = [] } = useUsers();
  const editing = !!project;

  const save = useAction(
    (body) => (editing ? api(`/projects/${project._id}`, { method: 'PATCH', body }) : api('/projects', { method: 'POST', body })).then((d) => d.project),
    { success: editing ? 'Project updated.' : 'Project added. Your team has been notified.', sound: editing ? undefined : 'create' }
  );

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: editing
      ? {
          name: project.name, clientName: project.clientName || '', description: project.description || '', status: project.status, priority: project.priority,
          color: project.color || PROJECT_COLORS[0], lead: project.lead?._id || '', startDate: project.startDate || '', dueDate: project.dueDate || '',
          link: project.link || '', tagsText: (project.tags || []).join(', '),
        }
      : { name: '', clientName: '', description: '', status: 'ACTIVE', priority: 'MEDIUM', color: PROJECT_COLORS[0], lead: user?._id || '', startDate: '', dueDate: '', link: '', tagsText: '' },
  });
  useEffect(() => { ['lead', 'status', 'priority', 'color'].forEach((k) => register(k)); }, [register]);
  const v = watch();

  async function onSubmit(values) {
    const { tagsText, ...rest } = values;
    try {
      const saved = await save.mutateAsync({ ...rest, tags: parseTags(tagsText) });
      onDone?.(saved);
    } catch {}
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Project name" error={errors.name?.message}><input className="input" autoFocus placeholder="Sattar & Co. Website" {...register('name')} /></Field>
        <Field label="Client / company (optional)" error={errors.clientName?.message}><input className="input" placeholder="Sattar & Co." {...register('clientName')} /></Field>
      </div>

      <Field label="Description (optional)" hint="What is being built, and anything the team should know." error={errors.description?.message}>
        <textarea className="input min-h-[96px] resize-y" placeholder="Corporate website with blog, contact form and CMS." {...register('description')} />
      </Field>

      <div>
        <p className="label">Project lead</p>
        <div className="grid gap-2.5 sm:grid-cols-3">
          {users.map((u) => {
            const on = v.lead === u._id;
            return (
              <button key={u._id} type="button" onClick={() => setValue('lead', u._id, { shouldValidate: true })}
                className={clsx('flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition', on ? 'border-accent bg-accent/10' : 'border-line bg-surface-2 hover:border-accent/40')}>
                <Avatar user={u} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-bold">{u.name}{u._id === user?._id && <span className="font-medium text-muted"> (you)</span>}</span>
                {on && <Icon name="check" className="h-4 w-4 text-accent" />}
              </button>
            );
          })}
        </div>
        {errors.lead && <p className="field-error">{errors.lead.message}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="label">Status</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(PROJECT_STATUS).map(([key, m]) => (
              <button key={key} type="button" onClick={() => setValue('status', key)}
                className={clsx('rounded-lg border px-3 py-1.5 text-xs font-bold transition', v.status === key ? 'border-accent bg-accent/10' : 'border-line bg-surface-2 text-muted hover:text-ink')}>{m.label}</button>
            ))}
          </div>
        </div>
        <div>
          <p className="label">Priority</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(PRIORITY_META).map(([key, m]) => (
              <button key={key} type="button" onClick={() => setValue('priority', key)}
                className={clsx('rounded-lg border px-3 py-1.5 text-xs font-bold transition', v.priority === key ? 'border-accent bg-accent/10' : 'border-line bg-surface-2 text-muted hover:text-ink')}>{m.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Start date (optional)" error={errors.startDate?.message}><input type="date" className="input" {...register('startDate')} /></Field>
        <Field label="Due date (optional)" error={errors.dueDate?.message}><input type="date" className="input" {...register('dueDate')} /></Field>
      </div>

      <div>
        <p className="label">Colour</p>
        <div className="flex flex-wrap gap-2.5">
          {PROJECT_COLORS.map((c) => (
            <button key={c} type="button" aria-label={`Colour ${c}`} onClick={() => setValue('color', c)}
              className={clsx('grid h-8 w-8 place-items-center rounded-full ring-offset-2 ring-offset-surface transition', v.color === c ? 'ring-2 ring-ink/60' : 'hover:scale-110')} style={{ backgroundColor: c }}>
              {v.color === c && <Icon name="check" className="h-4 w-4 text-white" />}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Link (optional)" hint="Live site, repo or shared folder." error={errors.link?.message}><input className="input" placeholder="https://" {...register('link')} /></Field>
        <Field label="Tags (optional)" hint="Separate with commas, up to 8." error={errors.tagsText?.message}><input className="input" placeholder="Next.js, SEO, Logo" {...register('tagsText')} /></Field>
      </div>

      <div className="flex justify-end gap-3 border-t border-line pt-5">
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" disabled={save.isPending}>
          {save.isPending ? <><Spinner />Saving…</> : editing ? <><Icon name="save" />Save changes</> : <><Icon name="plus" />Add project</>}
        </button>
      </div>
    </form>
  );
}