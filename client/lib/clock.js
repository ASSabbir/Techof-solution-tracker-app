'use client';
import { useSyncExternalStore } from 'react';

// The backend is the source of truth for time. Every API response carries an X-Server-Time
// header; we keep the offset between it and the browser clock so countdowns can't be
// manipulated by changing the computer's clock.
let offset = 0;
export const setServerTime = (serverMs) => {
  if (Number.isFinite(serverMs)) offset = serverMs - Date.now();
};
export const serverNow = () => Date.now() + offset;

const listeners = new Set();
let timer = null;
let snapshot = 0;

function tick() {
  snapshot = serverNow();
  listeners.forEach((l) => l());
}
function getSnapshot() {
  if (!snapshot) snapshot = serverNow();
  return snapshot;
}
function subscribe(listener) {
  listeners.add(listener);
  if (!timer) {
    snapshot = serverNow();
    timer = setInterval(tick, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

// One shared 1-second ticker for every countdown on the page.
export function useServerNow() {
  return useSyncExternalStore(subscribe, getSnapshot, () => 0);
}
