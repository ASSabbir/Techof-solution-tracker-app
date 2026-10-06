'use client';
import { useLayoutEffect, useRef } from 'react';
import { gsap, motionOK } from '@/lib/motion';

// Staggered entrance for every [data-anim] child inside the returned ref.
// Pass `ready` (e.g. "data has loaded") so the animation runs once content exists.
export function useEnter(ready = true, { selector = '[data-anim]', y = 18, stagger = 0.06, duration = 0.55 } = {}) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (!ready || !ref.current || !motionOK()) return undefined;
    const ctx = gsap.context(() => {
      gsap.from(selector, { y, opacity: 0, duration, ease: 'power3.out', stagger, clearProps: 'transform,opacity' });
    }, ref);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  return ref;
}
