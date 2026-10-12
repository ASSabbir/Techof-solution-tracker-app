'use client';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { shiftRange, isOvernight } from '@/lib/shift';
import { useEnter } from '@/hooks/useEnter';
import { useAction, useSettings, useUsers } from '@/hooks/queries';
import { useAuth } from '@/components/contexts';
import { playChime, setSoundEnabled, setSoundVolume, soundEnabled, soundVolume } from '@/lib/sound';
import { useThemePref } from '@/components/providers';
import { Avatar, ErrorState, Field, PageHeader, Segmented, Skeleton, Spinner } from '@/components/ui/primitives';
import Icon from '@/components/ui/Icon';

const DAYS = [['Sat', 6], ['Sun', 0], ['Mon', 1], ['Tue', 2], ['Wed', 3], ['Thu', 4], ['Fri', 5]];

function Toggle({ checked, onChange, label, hint }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 rounded-xl border border-line bg-surface-2/60 px-4 py-3 text-left transition hover:border-accent/40">
      <span><span className="block text-sm font-bold">{label}</span>{hint && <span className="text-xs text-muted">{hint}</span>}</span>
      <span className={clsx('relative h-6 w-11 shrink-0 rounded-full transition', checked ? 'bg-accent' : 'bg-line')}><span className={clsx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} /></span>
    </button>
  );
}

const Num = ({ label, value, onChange, step = 1, hint }) => (
  <Field label={label} hint={hint}><input type="number" step={step} className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} /></Field>
);


/* Notification sound: a short chime whenever a new notification arrives. Stored on this device. */
function SoundCard() {
  const [on, setOn] = useState(true);
  const [vol, setVol] = useState(0.7);
  useEffect(() => { setOn(soundEnabled()); setVol(soundVolume()); }, []);
  const toggle = (v) => { setOn(v); setSoundEnabled(v); if (v) playChime('default', { force: true }); };
  return (
    <div className="card card-pad space-y-5" data-anim>
      <p className="eyebrow">Notification sound</p>
      <Toggle checked={on} onChange={toggle} label="Play sounds" hint="New notifications, clock in/out, creating and completing tasks. Notification sounds also play when this tab is in the background. Your browser needs one click on the page first." />
      <div className={clsx('space-y-4 transition', !on && 'pointer-events-none opacity-50')}>
        <Field label={`Volume · ${Math.round(vol * 100)}%`}>
          <input type="range" min="0.1" max="1" step="0.05" value={vol} className="w-full accent-[rgb(var(--accent))]" onChange={(e) => { const v = Number(e.target.value); setVol(v); setSoundVolume(v); }} onPointerUp={() => playChime('default', { force: true })} />
        </Field>
        <div className="flex flex-wrap gap-2.5">
          <button type="button" className="btn-soft btn-sm" onClick={() => playChime('default', { force: true })}><Icon name="volume" className="h-3.5 w-3.5" />Task &amp; general</button>
          <button type="button" className="btn-soft btn-sm" onClick={() => playChime('meeting', { force: true })}><Icon name="meeting" className="h-3.5 w-3.5" />Meetings</button>
          <button type="button" className="btn-soft btn-sm" onClick={() => playChime('alert', { force: true })}><Icon name="warning" className="h-3.5 w-3.5" />Deadlines</button>
          <button type="button" className="btn-soft btn-sm" onClick={() => playChime('clockin', { force: true })}><Icon name="login" className="h-3.5 w-3.5" />Clock in</button>
          <button type="button" className="btn-soft btn-sm" onClick={() => playChime('clockout', { force: true })}><Icon name="logout" className="h-3.5 w-3.5" />Clock out</button>
          <button type="button" className="btn-soft btn-sm" onClick={() => playChime('create', { force: true })}><Icon name="plus" className="h-3.5 w-3.5" />New task</button>
          <button type="button" className="btn-soft btn-sm" onClick={() => playChime('complete', { force: true })}><Icon name="check" className="h-3.5 w-3.5" />Task done</button>
        </div>
      </div>
    </div>
  );
}

/* Each person sets their own shift. Clock-in/out, lateness and absence all follow it. */
function MyShift({ settings }) {
  const { user, setUser } = useAuth();
  const { data: users = [] } = useUsers();
  const defStart = settings.workdayStart;
  const defEnd = settings.workdayEnd;
  const [start, setStart] = useState(user.shiftStart || defStart);
  const [end, setEnd] = useState(user.shiftEnd || defEnd);

  useEffect(() => { setStart(user.shiftStart || defStart); setEnd(user.shiftEnd || defEnd); }, [user.shiftStart, user.shiftEnd, defStart, defEnd]);

  const save = useAction((body) => api('/users/me', { method: 'PATCH', body }), { success: 'Your shift was updated.', onSuccess: (d) => setUser(d.user) });
  const same = start === end;
  const unchanged = start === (user.shiftStart || defStart) && end === (user.shiftEnd || defEnd);
  const custom = !!(user.shiftStart || user.shiftEnd);

  return (
    <div className="card card-pad space-y-5" data-anim>
      <div>
        <p className="eyebrow">My shift</p>
        <p className="mt-1.5 text-sm text-muted">Set the hours <span className="font-semibold text-ink">you</span> work. Clock-in opens shortly before it starts, lateness is counted from it, and you’re marked absent only after it ends. A shift can end after midnight.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Shift starts"><input type="time" className="input" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="Shift ends" error={same ? 'Start and end can’t be the same time.' : undefined}><input type="time" className="input" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
      </div>
      {!same && <p className="rounded-xl bg-accent/8 px-3.5 py-2.5 text-sm"><span className="text-muted">Your shift: </span><span className="digit font-bold">{shiftRange(start, end)}</span>{isOvernight(start, end) && <span className="text-muted"> · ends the next day</span>}</p>}
      <div className="flex flex-wrap gap-3">
        <button className="btn-primary" disabled={save.isPending || same || unchanged} onClick={() => save.mutate({ shiftStart: start, shiftEnd: end })}>{save.isPending ? <><Spinner />Saving…</> : <><Icon name="save" />Save my shift</>}</button>
        {custom && <button className="btn-ghost" disabled={save.isPending} onClick={() => save.mutate({ shiftStart: '', shiftEnd: '' })}>Use team default ({shiftRange(defStart, defEnd)})</button>}
      </div>

      <div className="border-t border-line pt-4">
        <p className="eyebrow mb-3">Team shifts</p>
        <ul className="space-y-2.5">
          {users.map((u) => (
            <li key={u._id} className="flex items-center gap-3 text-sm">
              <Avatar user={u} size="xs" /><span className="flex-1 font-semibold">{u.name}</span>
              <span className="digit text-muted">{shiftRange(u.shiftStart || defStart, u.shiftEnd || defEnd)}{!(u.shiftStart || u.shiftEnd) && ' (default)'}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const theme = useThemePref();
  const { data, isLoading, isError, refetch } = useSettings();
  const [s, setS] = useState(null);
  const save = useAction((body) => api('/settings', { method: 'PATCH', body }), { success: 'Team settings saved.' });
  const ref = useEnter(!!s);
  useEffect(() => { if (data) setS(JSON.parse(JSON.stringify(data))); }, [data]);

  if (isError) return <ErrorState onRetry={refetch} />;
  if (isLoading || !s) return <div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-96" /></div>;

  const set = (k) => (v) => setS((x) => ({ ...x, [k]: v }));
  const nested = (group, k) => (v) => setS((x) => ({ ...x, scoring: { ...x.scoring, [group]: { ...x.scoring[group], [k]: v } } }));
  const toggleDay = (d) => set('workingDays')(s.workingDays.includes(d) ? s.workingDays.filter((x) => x !== d) : [...s.workingDays, d]);

  function submit() {
    save.mutate({
      workdayStart: s.workdayStart, workdayEnd: s.workdayEnd, workingDays: s.workingDays,
      lateGraceMinutes: Number(s.lateGraceMinutes), clockInEarlyMinutes: Number(s.clockInEarlyMinutes),
      requireExtensionApproval: s.requireExtensionApproval, maxExtensionsPerTask: Number(s.maxExtensionsPerTask),
      maxExtensionMinutes: Number(s.maxExtensionMinutes), dueSoonMinutes: Number(s.dueSoonMinutes),
      scoring: { points: s.scoring.points, multipliers: s.scoring.multipliers, earlyBonus: Number(s.scoring.earlyBonus) },
    });
  }

  return (
    <div ref={ref} className="mx-auto max-w-4xl space-y-6">
      <PageHeader eyebrow="Preferences" title="Settings" subtitle="Personal options live on this device. Team settings apply to everyone and are logged in Activity." />

      <div className="card card-pad space-y-5" data-anim>
        <p className="eyebrow">Appearance</p>
        <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm font-bold">Theme</span>
          <Segmented value={theme.pref} onChange={theme.setTheme} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'System' }]} /></div>
        <Toggle checked={theme.reduce} onChange={theme.setReduceMotion} label="Reduce motion" hint="Turns off animations on this device." />
      </div>

      <SoundCard />

      <MyShift settings={s} />

      <div className="card card-pad space-y-6" data-anim>
        <p className="eyebrow">Tasks &amp; extensions</p>
        <Toggle checked={s.requireExtensionApproval} onChange={set('requireExtensionApproval')} label="Require approval for extensions" hint="When off, extension requests are approved automatically (still fully recorded)." />
        <div className="grid gap-4 sm:grid-cols-3">
          <Num label="Max extensions per task" value={s.maxExtensionsPerTask} onChange={set('maxExtensionsPerTask')} />
          <Num label="Max minutes per extension" value={s.maxExtensionMinutes} onChange={set('maxExtensionMinutes')} step={5} />
          <Num label="“Due soon” window (min)" value={s.dueSoonMinutes} onChange={set('dueSoonMinutes')} step={5} />
        </div>
      </div>

      <div className="card card-pad space-y-5" data-anim>
        <p className="eyebrow">Attendance · team defaults · timezone {s.timezone}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Default shift starts" hint="Used by anyone who hasn’t set their own shift."><input type="time" className="input" value={s.workdayStart} onChange={(e) => set('workdayStart')(e.target.value)} /></Field>
          <Field label="Default shift ends"><input type="time" className="input" value={s.workdayEnd} onChange={(e) => set('workdayEnd')(e.target.value)} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Num label="Late after (minutes)" value={s.lateGraceMinutes} onChange={set('lateGraceMinutes')} hint="Clock-ins later than shift start + this count as Late." />
          <Num label="Clock-in opens (minutes before shift)" value={s.clockInEarlyMinutes} onChange={set('clockInEarlyMinutes')} hint="Nobody can clock in earlier than this." />
        </div>
        <div><p className="label">Working days</p><div className="flex flex-wrap gap-2">{DAYS.map(([n, d]) => <button key={d} type="button" onClick={() => toggleDay(d)} className={clsx('rounded-lg border px-3.5 py-2 text-sm font-bold transition', s.workingDays.includes(d) ? 'border-accent bg-accent/10' : 'border-line bg-surface-2 text-muted')}>{n}</button>)}</div></div>
      </div>

      <div className="card card-pad space-y-5" data-anim>
        <p className="eyebrow">Leaderboard scoring</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => <Num key={p} label={`${p[0]}${p.slice(1).toLowerCase()} points`} value={s.scoring.points[p]} onChange={nested('points', p)} step={0.5} />)}</div>
        <div className="grid gap-4 sm:grid-cols-4">
          <Num label="On time ×" value={s.scoring.multipliers.ON_TIME} onChange={nested('multipliers', 'ON_TIME')} step={0.05} />
          <Num label="After extension ×" value={s.scoring.multipliers.WITHIN_EXTENSION} onChange={nested('multipliers', 'WITHIN_EXTENSION')} step={0.05} />
          <Num label="Late ×" value={s.scoring.multipliers.LATE} onChange={nested('multipliers', 'LATE')} step={0.05} />
          <Num label="Early bonus" value={s.scoring.earlyBonus} onChange={(v) => setS((x) => ({ ...x, scoring: { ...x.scoring, earlyBonus: v } }))} step={0.05} hint="0.2 = +20%" />
        </div>
        <p className="text-xs text-muted">Changes apply to tasks completed from now on — scores already awarded are never rewritten.</p>
      </div>

      <div className="rounded-2xl border border-line bg-surface-2/50 px-5 py-4 text-sm text-muted" data-anim>
        <span className="font-bold text-ink">Automatic cleanup:</span> activity history is deleted after 7 days, finished or cancelled tasks after 30 days, and notifications after 14 days. Open tasks and attendance records are kept.
      </div>

      <div className="flex justify-end" data-anim><button className="btn-primary" onClick={submit} disabled={save.isPending}>{save.isPending ? <><Spinner />Saving…</> : <><Icon name="save" />Save team settings</>}</button></div>
    </div>
  );
}