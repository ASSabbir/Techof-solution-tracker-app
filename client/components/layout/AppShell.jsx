'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import { NAV } from '@/lib/constants';
import { gsap, motionOK } from '@/lib/motion';
import { useAuth, useUI } from '@/components/contexts';
import { Avatar, Spinner } from '@/components/ui/primitives';
import Icon from '@/components/ui/Icon';
import Notifications from './Notifications';

function Brand({ collapsed }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-3 px-2">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-black text-white shadow-glow dark:text-slate-950" style={{ backgroundImage: 'linear-gradient(135deg, rgb(var(--accent)), rgb(var(--accent-2)))' }}>T</span>
      {!collapsed && <span className="leading-tight"><span className="block text-sm font-extrabold tracking-tight">TechOf</span><span className="block text-[11px] font-semibold text-muted">Solution Tracker</span></span>}
    </Link>
  );
}

function NavList({ collapsed, onNavigate }) {
  const pathname = usePathname();
  const isActive = (href) => (href === '/tasks/my' ? pathname.startsWith('/tasks') && !pathname.startsWith('/tasks/team') : href === '/tasks/team' ? pathname.startsWith('/tasks/team') : pathname === href || pathname.startsWith(`${href}/`));
  return (
    <nav className="mt-6 space-y-1">
      {NAV.map((item) => {
        const active = isActive(item.href);
        return (
          <Link key={item.href} href={item.href} onClick={onNavigate} title={collapsed ? item.label : undefined} data-nav className={clsx('nav-link', active && 'nav-link-active', collapsed && 'justify-center px-0')}>
            {active && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full" style={{ backgroundImage: 'linear-gradient(180deg, rgb(var(--accent)), rgb(var(--accent-2)))' }} />}
            <Icon name={item.icon} className={clsx('h-[18px] w-[18px] shrink-0', active && 'text-accent')} />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export default function AppShell({ children }) {
  const { user, ready, logout } = useAuth();
  const ui = useUI();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const drawerRef = useRef(null);
  const mainRef = useRef(null);
  const navRef = useRef(null);

  useEffect(() => { setCollapsed(localStorage.getItem('techof_sidebar') === 'collapsed'); }, []);
  const toggleCollapse = () => setCollapsed((c) => { localStorage.setItem('techof_sidebar', c ? 'open' : 'collapsed'); return !c; });

  useEffect(() => { if (ready && !user) router.replace('/login'); }, [ready, user, router]);
  useEffect(() => { setDrawer(false); }, [pathname]);

  // Page transition
  useLayoutEffect(() => {
    if (!mainRef.current || !motionOK()) return;
    gsap.fromTo(mainRef.current, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out', clearProps: 'transform,opacity' });
  }, [pathname]);

  // Sidebar entrance (once)
  useLayoutEffect(() => {
    if (!user || !navRef.current || !motionOK()) return;
    gsap.from(navRef.current.querySelectorAll('[data-nav]'), { x: -16, opacity: 0, duration: 0.45, stagger: 0.04, ease: 'power3.out', clearProps: 'transform,opacity' });
  }, [!!user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mobile drawer slide
  useLayoutEffect(() => {
    if (!drawerRef.current || !motionOK()) return;
    gsap.to(drawerRef.current, { x: drawer ? 0 : '-105%', duration: 0.35, ease: drawer ? 'power3.out' : 'power2.in' });
  }, [drawer]);

  if (!ready || !user) {
    return <div className="grid min-h-screen place-items-center text-muted"><Spinner className="h-6 w-6" /></div>;
  }

  return (
    <div className="mesh min-h-screen">
      {/* Desktop sidebar */}
      <aside className={clsx('fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-line bg-surface/80 px-3 py-5 backdrop-blur-xl transition-[width] duration-300 lg:flex', collapsed ? 'w-[76px]' : 'w-64')}>
        <Brand collapsed={collapsed} />
        <div ref={navRef} className="flex-1 overflow-y-auto"><NavList collapsed={collapsed} /></div>
        <button onClick={toggleCollapse} className="btn-ghost mt-3 justify-start" aria-label="Toggle sidebar">
          <Icon name={collapsed ? 'expand' : 'collapse'} className="h-[18px] w-[18px]" />{!collapsed && 'Collapse'}
        </button>
        <div className={clsx('mt-3 flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-2.5', collapsed && 'justify-center')}>
          <Avatar user={user} size="sm" />
          {!collapsed && (<><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{user.name}</p><p className="truncate text-[11px] text-muted">{user.email}</p></div>
            <button onClick={logout} className="btn-ghost !p-2" aria-label="Log out" title="Log out"><Icon name="logout" /></button></>)}
        </div>
      </aside>

      {/* Mobile drawer */}
      <div className={clsx('fixed inset-0 z-50 lg:hidden', drawer ? 'pointer-events-auto' : 'pointer-events-none')}>
        <div className={clsx('absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity', drawer ? 'opacity-100' : 'opacity-0')} onClick={() => setDrawer(false)} />
        <div ref={drawerRef} className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-line bg-surface px-3 py-5" style={{ transform: 'translateX(-105%)' }}>
          <div className="flex items-center justify-between"><Brand /><button className="btn-ghost !p-2" onClick={() => setDrawer(false)} aria-label="Close menu"><Icon name="close" className="h-5 w-5" /></button></div>
          <div className="flex-1 overflow-y-auto"><NavList onNavigate={() => setDrawer(false)} /></div>
          <button onClick={logout} className="btn-soft mt-3"><Icon name="logout" />Log out</button>
        </div>
      </div>

      <div className={clsx('transition-[padding] duration-300', collapsed ? 'lg:pl-[76px]' : 'lg:pl-64')}>
        <header className="glass sticky top-0 z-30 flex items-center gap-3 border-b border-line px-4 py-3 sm:px-6">
          <button className="btn-soft !p-2.5 lg:hidden" onClick={() => setDrawer(true)} aria-label="Open menu"><Icon name="menu" className="h-5 w-5" /></button>
          <div className="hidden min-w-0 lg:block"><p className="truncate text-sm font-extrabold tracking-tight">TechOf Solution Tracker</p></div>
          <div className="ml-auto flex items-center gap-2.5">
            <button onClick={() => ui.openAddTask()} className="btn-primary"><Icon name="plus" /><span className="hidden sm:inline">Add Task</span></button>
            <Notifications />
            <Link href="/profile" className="hidden sm:block"><Avatar user={user} size="sm" ring /></Link>
          </div>
        </header>
        <main ref={mainRef} className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
