'use client';
import { useLayoutEffect, useRef } from 'react';
import clsx from 'clsx';
import { TONE } from '@/lib/constants';
import { initials } from '@/lib/format';
import { gsap, motionOK } from '@/lib/motion';
import { useUsers } from '@/hooks/queries';
import Icon from './Icon';

/* ---------- Badge ---------- */
export function Badge({ tone = 'muted', children, className, dot, icon }) {
  const t = TONE[tone] || TONE.muted;
  return (
    <span className={clsx('badge', t.bg, t.text, className)}>
      {dot && <span className={clsx('h-1.5 w-1.5 rounded-full', t.solid)} />}
      {icon && <Icon name={icon} className="h-3 w-3" />}
      {children}
    </span>
  );
}

/* ---------- Avatar ---------- */
const GRADIENTS = [
  'from-indigo-500 to-cyan-400', 'from-fuchsia-500 to-orange-400', 'from-emerald-500 to-sky-400',
  'from-rose-500 to-amber-400', 'from-violet-500 to-pink-400', 'from-teal-500 to-lime-400',
];
const hash = (s = '') => [...s].reduce((a, c) => a + c.charCodeAt(0), 0);
const SIZE = { xs: 'h-6 w-6 text-[10px]', sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg', xl: 'h-24 w-24 text-3xl' };

export function Avatar({ user, size = 'md', className, ring }) {
  const { data: users } = useUsers();
  const id = user?._id;
  const full = users?.find((u) => u._id === id);
  const src = user?.avatar || full?.avatar;
  const name = user?.name || full?.name || '';
  return (
    <span className={clsx('relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-white', SIZE[size], ring && 'ring-2 ring-accent/50 ring-offset-2 ring-offset-surface', !src && `bg-gradient-to-br ${GRADIENTS[hash(name) % GRADIENTS.length]}`, className)} title={name}>
      {src ? <img src={src} alt={name} className="h-full w-full object-cover" /> : initials(name)}
    </span>
  );
}

/* ---------- Progress ---------- */
export function ProgressBar({ value = 0, tone = 'accent', className, animate = false }) {
  const ref = useRef(null);
  const pct = Math.max(0, Math.min(100, value));
  useLayoutEffect(() => {
    if (!animate || !ref.current || !motionOK()) return undefined;
    const tween = gsap.fromTo(ref.current, { width: '0%' }, { width: `${pct}%`, duration: 0.9, ease: 'power3.out' });
    return () => tween.kill();
  }, [pct, animate]);
  const t = TONE[tone] || TONE.accent;
  return (
    <div className={clsx('h-1.5 w-full overflow-hidden rounded-full bg-surface-2', className)}>
      <div ref={ref} className={clsx('h-full rounded-full transition-[width] duration-700 ease-out', t.solid)} style={animate ? undefined : { width: `${pct}%` }} />
    </div>
  );
}

/* ---------- Skeleton / empty / spinner ---------- */
export const Skeleton = ({ className }) => <div className={clsx('skeleton', className)} />;

export function Spinner({ className = 'h-4 w-4' }) {
  return (
    <svg className={clsx('animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyState({ icon = 'inbox', title, text, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-accent/10 text-accent">
        <Icon name={icon} className="h-6 w-6" />
      </div>
      <p className="text-base font-extrabold">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message = 'Something went wrong. Please try again.', onRetry }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-danger/10 text-danger"><Icon name="warning" className="h-6 w-6" /></div>
      <p className="font-bold">{message}</p>
      {onRetry && <button className="btn-soft btn-sm" onClick={onRetry}><Icon name="refresh" className="h-3.5 w-3.5" />Try again</button>}
    </div>
  );
}

/* ---------- Tabs (pill) ---------- */
export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={clsx('no-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1', className)}>
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button key={t.value} onClick={() => onChange(t.value)} className={clsx('relative flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors', active ? 'bg-accent/12 text-ink' : 'text-muted hover:text-ink')}>
            {t.label}
            {t.count !== undefined && (
              <span className={clsx('rounded-full px-1.5 py-0.5 text-[10px] font-bold', active ? 'bg-accent text-white dark:text-slate-950' : 'bg-surface-2 text-muted')}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Segmented control ---------- */
export function Segmented({ options, value, onChange, className, size = 'md' }) {
  return (
    <div className={clsx('inline-flex rounded-xl border border-line bg-surface-2 p-1', className)}>
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} className={clsx('rounded-lg font-semibold transition', size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm', value === o.value ? 'bg-surface text-ink shadow-soft' : 'text-muted hover:text-ink')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Count-up number ---------- */
export function CountUp({ value = 0, decimals = 0, suffix = '', duration = 1, className }) {
  const ref = useRef(null);
  const prev = useRef(0);
  const fmt = (v) => `${Number(v).toFixed(decimals)}${suffix}`;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (!motionOK()) { el.textContent = fmt(value); return undefined; }
    const o = { v: prev.current };
    const tween = gsap.to(o, { v: value, duration, ease: 'power2.out', onUpdate: () => { el.textContent = fmt(o.v); }, onComplete: () => { prev.current = value; } });
    return () => tween.kill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <span ref={ref} className={clsx('digit', className)}>{fmt(value)}</span>;
}

/* ---------- Page header ---------- */
export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div data-anim className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

/* ---------- Form field wrapper ---------- */
export function Field({ label, error, hint, children, className }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

export function Stat({ label, value, tone = 'accent', icon, sub, decimals = 0, suffix = '' }) {
  const t = TONE[tone] || TONE.accent;
  return (
    <div className="card card-pad relative overflow-hidden" data-anim>
      <div className="flex items-start justify-between">
        <div>
          <p className="eyebrow">{label}</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight">
            {typeof value === 'number' ? <CountUp value={value} decimals={decimals} suffix={suffix} /> : value}
          </p>
          {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
        </div>
        {icon && <div className={clsx('grid h-10 w-10 place-items-center rounded-xl', t.bg, t.text)}><Icon name={icon} className="h-5 w-5" /></div>}
      </div>
    </div>
  );
}
