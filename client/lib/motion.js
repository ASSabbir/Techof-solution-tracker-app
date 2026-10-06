import gsap from 'gsap';

export { gsap };

// Respect both the OS "reduce motion" preference and the in-app Settings toggle.
export function motionOK() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  return document.documentElement.dataset.reduceMotion !== 'true';
}

// A small celebratory particle burst, used when a task is completed.
export function burst(el, colors = ['#34d399', '#22d3ee', '#818cf8', '#fbbf24']) {
  if (!motionOK() || !el) return;
  const rect = el.getBoundingClientRect();
  const originX = rect.left + rect.width / 2;
  const originY = rect.top + rect.height / 2;
  const layer = document.createElement('div');
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden';
  document.body.appendChild(layer);
  const dots = [];
  for (let i = 0; i < 22; i++) {
    const dot = document.createElement('span');
    const size = 5 + Math.random() * 6;
    dot.style.cssText = `position:absolute;left:${originX}px;top:${originY}px;width:${size}px;height:${size}px;border-radius:${Math.random() > 0.5 ? '50%' : '2px'};background:${colors[i % colors.length]}`;
    layer.appendChild(dot);
    dots.push(dot);
  }
  gsap.to(dots, {
    x: () => (Math.random() - 0.5) * 320,
    y: () => -60 - Math.random() * 220,
    rotation: () => Math.random() * 540,
    opacity: 0,
    scale: 0.4,
    duration: 1.1,
    ease: 'power3.out',
    stagger: 0.008,
    onComplete: () => layer.remove(),
  });
}
