/** Talk to the Express API. Every change sends the X-Requested-With header (CSRF protection). */
import { useCallback, useEffect, useRef, useState } from 'react';

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method,
    credentials: 'same-origin',
    headers: { 'X-Requested-With': 'RGS', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) {
    const e = new Error((data && data.error) || 'Something went wrong. Please try again.');
    e.status = res.status;
    e.errors = (data && data.errors) || [e.message];
    if (res.status === 401 && !path.startsWith('/auth/login')) onUnauthorized();
    throw e;
  }
  return data;
}

/** Load data for a page; reloads when `path` changes. */
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const seq = useRef(0);
  const load = useCallback(() => {
    if (!path) return;
    const n = ++seq.current;
    setState((s) => ({ ...s, loading: true }));
    api(path).then(
      (data) => n === seq.current && setState({ data, error: null, loading: false }),
      (error) => n === seq.current && setState({ data: null, error, loading: false }),
    );
  }, [path]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

/** Build "?a=1&b=2" without empty values. */
export function qs(params) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) if (v !== undefined && v !== null && v !== '') p.set(k, v);
  const s = p.toString();
  return s ? '?' + s : '';
}
