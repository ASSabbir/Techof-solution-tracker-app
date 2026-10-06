import { setServerTime } from './clock';

const BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://techof-task.vercel.app/api').replace(/\/$/, '');
const KEY = 'techof_token';

export const tokenStore = {
  get() {
    if (typeof window === 'undefined') return null;
    try { return localStorage.getItem(KEY) || sessionStorage.getItem(KEY); } catch { return null; }
  },
  set(token, remember = true) {
    try {
      localStorage.removeItem(KEY);
      sessionStorage.removeItem(KEY);
      (remember ? localStorage : sessionStorage).setItem(KEY, token);
    } catch {}
  },
  clear() {
    try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch {}
  },
};

export class ApiError extends Error {
  constructor(message, status, code, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

function qs(params) {
  const sp = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== 'all') sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export async function api(path, { method = 'GET', body, params, signal } = {}) {
  const headers = { Accept: 'application/json' };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${BASE}${path}${qs(params)}`, { method, headers, signal, cache: 'no-store', body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError('Can’t reach the server. Check your connection and try again.', 0, 'NETWORK');
  }

  const serverTime = res.headers.get('x-server-time');
  if (serverTime) setServerTime(Number(serverTime));

  let json = null;
  try { json = await res.json(); } catch {}
  if (!res.ok || !json || json.ok === false) {
    if (res.status === 401 && path !== '/auth/login' && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('techof:unauthorized'));
    }
    throw new ApiError(json?.message || 'Something went wrong. Please try again.', res.status, json?.code, json?.fields);
  }
  return json.data;
}
