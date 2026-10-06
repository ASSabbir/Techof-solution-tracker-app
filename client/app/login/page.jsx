'use client';
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { gsap, motionOK } from '@/lib/motion';
import { useAuth } from '@/components/contexts';
import { Field, Spinner } from '@/components/ui/primitives';
import Icon from '@/components/ui/Icon';

const schema = z.object({
  identifier: z.string().trim().min(1, 'Enter your email or username.'),
  password: z.string().min(1, 'Enter your password.'),
  remember: z.boolean(),
});

const POINTS = [
  ['timer', 'Live countdowns', 'Every task has a deadline the server enforces.'],
  ['shield', 'Immutable history', 'Deadlines can’t be reset — only extended with approval.'],
  ['trophy', 'Fair leaderboard', 'Rewards quality and timeliness, not task count.'],
];

function LoginInner() {
  const { user, ready, login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const root = useRef(null);
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema), defaultValues: { identifier: '', password: '', remember: true } });

  useEffect(() => { if (ready && user) router.replace('/dashboard'); }, [ready, user, router]);

  useLayoutEffect(() => {
    if (!root.current || !motionOK()) return undefined;
    const ctx = gsap.context(() => {
      gsap.to('.blob-a', { x: 60, y: 40, duration: 9, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      gsap.to('.blob-b', { x: -50, y: -30, duration: 11, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('.brand-mark', { scale: 0.6, opacity: 0, rotate: -12, duration: 0.7 })
        .from('.hero-line', { y: 36, opacity: 0, stagger: 0.12, duration: 0.8 }, '-=0.35')
        .from('.hero-point', { x: -24, opacity: 0, stagger: 0.1, duration: 0.6 }, '-=0.4')
        .from('.login-card', { y: 40, opacity: 0, scale: 0.97, duration: 0.8 }, 0.25)
        .from('.login-field', { y: 14, opacity: 0, stagger: 0.07, duration: 0.5 }, '-=0.5');
    }, root);
    return () => ctx.revert();
  }, []);

  async function onSubmit(v) {
    setError('');
    try {
      await login(v);
      if (motionOK()) await gsap.to('.login-card', { y: -20, opacity: 0, scale: 0.97, duration: 0.3, ease: 'power2.in' });
      router.replace('/dashboard');
    } catch (err) {
      setError(err.message);
      if (motionOK()) gsap.fromTo('.login-card', { x: -10 }, { x: 0, duration: 0.6, ease: 'elastic.out(1, 0.25)' });
    }
  }

  return (
    <div ref={root} className="relative grid min-h-screen overflow-hidden lg:grid-cols-[1.1fr_1fr]">
      <div className="blob-a pointer-events-none absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-accent/25 blur-[110px]" />
      <div className="blob-b pointer-events-none absolute -bottom-40 right-0 h-[30rem] w-[30rem] rounded-full bg-accent-2/20 blur-[120px]" />

      <section className="relative z-10 hidden flex-col justify-between p-12 lg:flex">
        <div className="flex items-center gap-3">
          <span className="brand-mark grid h-11 w-11 place-items-center rounded-2xl text-lg font-black text-white shadow-glow dark:text-slate-950" style={{ backgroundImage: 'linear-gradient(135deg, rgb(var(--accent)), rgb(var(--accent-2)))' }}>T</span>
          <span className="brand-mark text-lg font-extrabold tracking-tight">TechOf Solutions</span>
        </div>
        <div className="max-w-xl">
          <h1 className="hero-line text-5xl font-extrabold leading-[1.05] tracking-tight xl:text-6xl">Record what <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, rgb(var(--accent)), rgb(var(--accent-2)))' }}>actually happened.</span></h1>
          <p className="hero-line mt-5 text-lg text-muted">Tasks, deadlines, attendance and accountability for the team — a small internal operating system, not another to-do list.</p>
          <ul className="mt-10 space-y-5">
            {POINTS.map(([icon, title, text]) => (
              <li key={title} className="hero-point flex items-start gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/12 text-accent"><Icon name={icon} className="h-5 w-5" /></span>
                <span><span className="block font-bold">{title}</span><span className="text-sm text-muted">{text}</span></span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs font-semibold text-muted">© {new Date().getFullYear()} TechOf Solutions · Internal use only</p>
      </section>

      <section className="relative z-10 flex items-center justify-center p-5 sm:p-10">
        <div className="login-card card glass w-full max-w-md p-7 sm:p-9">
          <div className="login-field mb-7">
            <p className="eyebrow">Welcome back</p>
            <h2 className="mt-1.5 text-3xl font-extrabold tracking-tight">Sign in</h2>
            <p className="mt-1.5 text-sm text-muted">Use your team email or username.</p>
          </div>
          {params.get('expired') && !error && <p className="mb-5 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm font-semibold text-warning">Your session ended. Please sign in again.</p>}
          {error && <p role="alert" className="mb-5 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">{error}</p>}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <Field className="login-field" label="Email / Username" error={errors.identifier?.message}>
              <div className="relative"><Icon name="mail" className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input className="input pl-10" autoComplete="username" placeholder="sabbir or sabbir@techof.dev" autoFocus {...register('identifier')} /></div>
            </Field>
            <Field className="login-field" label="Password" error={errors.password?.message}>
              <div className="relative">
                <Icon name="lock" className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input type={show ? 'text' : 'password'} className="input px-10" autoComplete="current-password" placeholder="••••••••" {...register('password')} />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:text-ink" aria-label={show ? 'Hide password' : 'Show password'}><Icon name={show ? 'eyeOff' : 'eye'} /></button>
              </div>
            </Field>
            <label className="login-field flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-muted">
              <input type="checkbox" className="h-4 w-4 rounded border-line accent-[rgb(var(--accent))]" {...register('remember')} /> Remember this session
            </label>
            <button className="bg-blue-500 flex items-center gap-2 justify-center rounded-lg  login-field w-full !py-3" disabled={isSubmitting}>{isSubmitting ? <><Spinner />Signing in…</> : <>Sign in<Icon name="arrow" /></>}</button>
          </form>
        </div>
      </section>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense fallback={null}><LoginInner /></Suspense>;
}
