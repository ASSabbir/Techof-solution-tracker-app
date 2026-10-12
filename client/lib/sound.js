// Notification sound, synthesised with the Web Audio API (no audio files to load or host).
// Browsers only allow sound after the person has interacted with the page once, so the context is unlocked on the first click or key press.
const ON_KEY = 'techof_sound';
const VOL_KEY = 'techof_sound_volume';

let ctx = null;

function getCtx() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

export function soundEnabled() {
  try { return localStorage.getItem(ON_KEY) !== 'off'; } catch { return true; }
}
export function setSoundEnabled(on) {
  try { localStorage.setItem(ON_KEY, on ? 'on' : 'off'); } catch {}
}
export function soundVolume() {
  try {
    const v = Number(localStorage.getItem(VOL_KEY));
    return Number.isFinite(v) && v > 0 ? Math.min(1, v) : 0.7;
  } catch { return 0.7; }
}
export function setSoundVolume(v) {
  try { localStorage.setItem(VOL_KEY, String(v)); } catch {}
}

// Call once; resumes audio on the first interaction.
export function unlockAudio() {
  if (typeof window === 'undefined') return undefined;
  const unlock = () => {
    const c = getCtx();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
  };
  const events = ['pointerdown', 'keydown', 'touchstart'];
  events.forEach((e) => window.addEventListener(e, unlock, { passive: true }));
  return () => events.forEach((e) => window.removeEventListener(e, unlock));
}

function tone(c, { freq, start, dur, vol }) {
  const osc = c.createOscillator();
  const osc2 = c.createOscillator(); // soft overtone for a "bell" feel
  const gain = c.createGain();
  osc.type = 'sine';
  osc2.type = 'triangle';
  osc.frequency.value = freq;
  osc2.frequency.value = freq * 2;
  const t0 = c.currentTime + start;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  const g2 = c.createGain();
  g2.gain.value = 0.25;
  osc.connect(gain);
  osc2.connect(g2).connect(gain);
  gain.connect(c.destination);
  osc.start(t0); osc2.start(t0);
  osc.stop(t0 + dur + 0.05); osc2.stop(t0 + dur + 0.05);
}

// Sound recipes: [frequency Hz, start offset s, length s, loudness multiplier]
const RECIPES = {
  default:  [[783.99, 0, 0.6, 1], [1046.5, 0.14, 0.6, 1]],                                   // notification: two-note chime
  meeting:  [[659.25, 0, 0.7, 1], [830.61, 0.16, 0.7, 1], [987.77, 0.32, 0.7, 1]],           // meeting: rising three-note ring
  alert:    [[880, 0, 0.35, 1.1], [880, 0.2, 0.35, 1.1]],                                    // deadline: urgent double ping
  clockin:  [[523.25, 0, 0.45, 1], [783.99, 0.12, 0.45, 1], [1046.5, 0.24, 0.7, 1]],         // clock in: bright rise, "welcome"
  clockout: [[783.99, 0, 0.5, 1], [659.25, 0.14, 0.5, 1], [523.25, 0.28, 0.8, 1]],           // clock out: calm fall, "rest well"
  create:   [[587.33, 0, 0.25, 0.9], [880, 0.09, 0.4, 0.9]],                                 // new task: quick pop
  complete: [[523.25, 0, 0.4, 1], [659.25, 0.1, 0.4, 1], [783.99, 0.2, 0.4, 1], [1046.5, 0.3, 0.9, 1.1], [1318.51, 0.42, 0.9, 0.7]], // task done: happy arpeggio
};

// kind: one of the RECIPES keys above
export function playChime(kind = 'default', { force = false } = {}) {
  if (!force && !soundEnabled()) return;
  const c = getCtx();
  if (!c) return;
  const notes = RECIPES[kind] || RECIPES.default;
  const go = () => {
    const vol = 0.35 * soundVolume();
    notes.forEach(([freq, start, dur, mult]) => tone(c, { freq, start, dur, vol: vol * mult }));
  };
  if (c.state === 'suspended') c.resume().then(go).catch(() => {});
  else go();
}

// Which sound a notification type uses.
export function kindFor(type = '') {
  if (type.startsWith('MEETING')) return 'meeting';
  if (type === 'TASK_OVERDUE' || type === 'TASK_REMINDER') return 'alert';
  return 'default';
}