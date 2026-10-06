'use client';
import { useRef, useState } from 'react';
import clsx from 'clsx';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, tokenStore } from '@/lib/api';
import { fmtDateFull, fmtMinutes } from '@/lib/format';
import { useEnter } from '@/hooks/useEnter';
import { useAction, useProfile } from '@/hooks/queries';
import { useAuth } from '@/components/contexts';
import { Avatar, CountUp, ErrorState, Field, PageHeader, ProgressBar, Skeleton, Spinner, Stat } from '@/components/ui/primitives';
import Icon from '@/components/ui/Icon';

const pwSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  newPassword: z.string().min(8, 'Use at least 8 characters.'),
  confirm: z.string(),
}).refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords don’t match.' });

function resizeImage(file, size = 192) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const s = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => reject(new Error('That image could not be read.'));
    img.src = url;
  });
}

function PasswordForm() {
  const change = useAction((body) => api('/auth/change-password', { method: 'POST', body }), { success: 'Password updated.' });
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(pwSchema) });
  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit(async (v) => {
      try {
        const d = await change.mutateAsync({ currentPassword: v.currentPassword, newPassword: v.newPassword });
        tokenStore.set(d.token, !!localStorage.getItem('techof_token'));
        reset();
      } catch {}
    })}>
      <Field label="Current password" error={errors.currentPassword?.message}><input type="password" autoComplete="current-password" className="input" {...register('currentPassword')} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New password" error={errors.newPassword?.message}><input type="password" autoComplete="new-password" className="input" {...register('newPassword')} /></Field>
        <Field label="Confirm" error={errors.confirm?.message}><input type="password" autoComplete="new-password" className="input" {...register('confirm')} /></Field>
      </div>
      <button className="btn-primary" disabled={change.isPending}>{change.isPending ? <><Spinner />Updating…</> : <><Icon name="lock" />Change password</>}</button>
    </form>
  );
}

export default function ProfileView({ id }) {
  const { user: me, setUser } = useAuth();
  const isMe = id === me._id;
  const { data, isLoading, isError, refetch } = useProfile(id);
  const ref = useEnter(!!data);
  const fileRef = useRef(null);
  const [name, setName] = useState(null);
  const update = useAction((body) => api('/users/me', { method: 'PATCH', body }), { success: 'Profile updated.', onSuccess: (d) => setUser(d.user) });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-48" /><Skeleton className="h-64" /></div>;
  if (isError || !data) return <ErrorState onRetry={refetch} />;
  const { user, stats, attendance: att, achievements, activity: act, summary } = data;

  async function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    try { update.mutate({ avatar: await resizeImage(f) }); } catch {}
    e.target.value = '';
  }

  return (
    <div ref={ref} className="space-y-6">
      <PageHeader eyebrow={isMe ? 'Your account' : 'Team member'} title={isMe ? 'My Profile' : user.name} />

      <div className="card card-pad flex flex-col items-center gap-6 sm:flex-row" data-anim>
        <div className="relative">
          <Avatar user={{ ...user, avatar: isMe ? me.avatar || user.avatar : user.avatar }} size="xl" ring />
          {isMe && <><button onClick={() => fileRef.current?.click()} className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full border border-line bg-surface text-accent shadow-soft transition hover:scale-110" aria-label="Change photo"><Icon name="camera" /></button><input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} /></>}
        </div>
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <h2 className="text-2xl font-extrabold">{user.name}</h2>
          <p className="mt-1 flex items-center justify-center gap-2 text-sm text-muted sm:justify-start"><Icon name="mail" className="h-4 w-4" />{user.email}</p>
          <p className="mt-1 text-sm text-muted">Joined {fmtDateFull(user.joinedAt || user.createdAt)}</p>
        </div>
        <div className="grid w-full grid-cols-3 gap-4 text-center sm:w-auto">
          <div><p className="digit text-2xl font-extrabold">{summary.activeTasks}</p><p className="eyebrow">Active</p></div>
          <div><p className="digit text-2xl font-extrabold">{summary.completedTasks}</p><p className="eyebrow">Completed</p></div>
          <div><p className="digit text-2xl font-extrabold">{summary.attendanceRate == null ? '—' : `${summary.attendanceRate}%`}</p><p className="eyebrow">Attendance</p></div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Points" value={stats.score} decimals={1} icon="trophy" tone="warning" />
        <Stat label="On-time rate" value={stats.onTimeRate ?? 0} suffix="%" icon="target" tone="success" />
        <Stat label="Extended tasks" value={stats.extendedTasks} icon="timer" tone="accent" sub={`${fmtMinutes(stats.extraMinutes)} extra time`} />
        <Stat label="Overdue" value={stats.overdue} icon="warning" tone={stats.overdue ? 'danger' : 'muted'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card card-pad" data-anim>
          <p className="eyebrow mb-4">Activity</p>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            {[['Tasks created', act.tasksCreated], ['Tasks assigned', act.tasksAssigned], ['Tasks completed', act.tasksCompleted], ['Extensions requested', act.extensionsRequested], ['Extensions approved', act.extensionsApproved], ['Days attended', act.attendanceDays], ['Leave days', act.leaveDays]].map(([k, v]) => (
              <div key={k}><dt className="text-muted">{k}</dt><dd className="digit text-xl font-extrabold"><CountUp value={v} /></dd></div>
            ))}
          </dl>
        </div>
        <div className="card card-pad" data-anim>
          <p className="eyebrow mb-4">Achievements</p>
          <ul className="space-y-4">
            {achievements.map((a) => (
              <li key={a.key}>
                <div className="flex items-center justify-between text-sm"><span className={clsx('font-bold', !a.earned && 'text-muted')}>{a.title}</span><span className="text-xs font-semibold text-muted">{a.earned ? 'Earned' : `${a.progress}/${a.target}`}</span></div>
                <ProgressBar className="mt-1.5" value={(a.progress / a.target) * 100} tone={a.earned ? 'warning' : 'accent'} animate />
                <p className="mt-1 text-xs text-muted">{a.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {isMe && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card card-pad" data-anim>
            <p className="eyebrow mb-4">Display name</p>
            <div className="flex gap-3"><input className="input" value={name ?? user.name} onChange={(e) => setName(e.target.value)} /><button className="btn-soft" disabled={update.isPending || !name || name === user.name} onClick={() => update.mutate({ name })}><Icon name="save" />Save</button></div>
            {me.avatar && <button className="btn-ghost btn-sm mt-4" onClick={() => update.mutate({ avatar: '' })}>Remove photo</button>}
          </div>
          <div className="card card-pad" data-anim><p className="eyebrow mb-4">Security</p><PasswordForm /></div>
        </div>
      )}
    </div>
  );
}
