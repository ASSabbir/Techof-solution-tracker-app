'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { gsap, motionOK } from '@/lib/motion';
import Icon from './Icon';

const SIZES = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-2xl', xl: 'max-w-4xl' };

export default function Modal({ open, onClose, title, subtitle, children, size = 'md', footer, dismissible = true }) {
  const [mounted, setMounted] = useState(open);
  const overlay = useRef(null);
  const panel = useRef(null);

  useEffect(() => { if (open) setMounted(true); }, [open]);

  useLayoutEffect(() => {
    if (!mounted || !panel.current) return;
    if (open) {
      if (motionOK()) {
        gsap.fromTo(overlay.current, { opacity: 0 }, { opacity: 1, duration: 0.22 });
        gsap.fromTo(panel.current, { y: 28, scale: 0.96, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.38, ease: 'power3.out' });
      }
    } else if (!motionOK()) {
      setMounted(false);
    } else {
      gsap.to(panel.current, { y: 14, scale: 0.97, opacity: 0, duration: 0.2, ease: 'power2.in' });
      gsap.to(overlay.current, { opacity: 0, duration: 0.2, onComplete: () => setMounted(false) });
    }
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && dismissible) onClose?.(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose, dismissible]);

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div ref={overlay} className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => dismissible && onClose?.()} />
      <div ref={panel} className={clsx('card relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-b-none sm:rounded-b-2xl', SIZES[size])}>
        {(title || dismissible) && (
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
            <div>
              {title && <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>}
              {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
            </div>
            {dismissible && (
              <button onClick={onClose} className="btn-ghost -mr-2 -mt-1 rounded-lg p-2" aria-label="Close">
                <Icon name="close" className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
        <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line bg-surface-2/50 px-5 py-4 sm:px-6">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
