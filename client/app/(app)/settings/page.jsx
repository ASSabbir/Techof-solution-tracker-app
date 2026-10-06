'use client';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { useEnter } from '@/hooks/useEnter';
import { useAction, useSettings } from '@/hooks/queries';
import { useThemePref } from '@/components/providers';
import { ErrorState, Field, PageHeader, Segmented, Skeleton, Spinner } from '@/components/ui/primitives';
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
      workdayStart: s.workdayStart, lateAfter: s.lateAfter, workdayEnd: s.workdayEnd, workingDays: s.workingDays,
      requireExtensionApproval: s.requireExtensionApproval, maxExtensionsPerTask: Number(s.maxExtensionsPerTask),
      maxExtensionMinutes: Number(s.maxExtensionMinutes), dueSoonMinutes: Number(s.dueSoonMinutes),
      scoring: { points: s.scoring.points, multipliers: s.scoring.multipliers, earlyBonus: Number(s.scoring.earlyBonus) },
    });
  }

  return (
    <div ref={ref} className="mx-auto max-w-4xl space-y-6">
      <PageHeader eyebrow="Preferences" title="Settings" subtitle="Personal display options live on this device. Team settings apply to everyone and are logged in Activity." />

      <div className="card card-pad space-y-5" data-anim>
        <p className="eyebrow">Appearance</p>
        <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm font-bold">Theme</span>
          <Segmented value={theme.pref} onChange={theme.setTheme} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'System' }]} /></div>
        <Toggle checked={theme.reduce} onChange={theme.setReduceMotion} label="Reduce motion" hint="Turns off animations on this device." />
      </div>

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
        <p className="eyebrow">Attendance · timezone {s.timezone}</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Workday starts"><input type="time" className="input" value={s.workdayStart} onChange={(e) => set('workdayStart')(e.target.value)} /></Field>
          <Field label="Late after" hint="Clock-ins after this are “Late”."><input type="time" className="input" value={s.lateAfter} onChange={(e) => set('lateAfter')(e.target.value)} /></Field>
          <Field label="Workday ends" hint="Missing days are marked absent after this."><input type="time" className="input" value={s.workdayEnd} onChange={(e) => set('workdayEnd')(e.target.value)} /></Field>
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

      <div className="flex justify-end" data-anim><button className="btn-primary" onClick={submit} disabled={save.isPending}>{save.isPending ? <><Spinner />Saving…</> : <><Icon name="save" />Save team settings</>}</button></div>
    </div>
  );
}
