/** A very small client-side router (no extra package needed). */
import { useEffect, useState } from 'react';

const listeners = new Set();
const notify = () => listeners.forEach((f) => f());

// Memory mode (used by the in-chat test version, where the page address cannot change)
const memory = typeof window !== 'undefined' && window.__RGS_MEMORY_ROUTER__ ? { url: new URL('/', 'http://rgs.local') } : null;
/** Current location: {pathname, search, hash} */
export function getLoc() {
  if (memory) return { pathname: memory.url.pathname, search: memory.url.search, hash: memory.url.hash };
  return { pathname: window.location.pathname, search: window.location.search, hash: window.location.hash };
}

export function navigate(to, { replace = false } = {}) {
  if (memory) memory.url = new URL(to, memory.url);
  else if (replace) window.history.replaceState(null, '', to);
  else window.history.pushState(null, '', to);
  notify();
  if (!String(to).includes('#')) window.scrollTo(0, 0);
}

export function useLocation() {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((x) => x + 1);
    listeners.add(f);
    window.addEventListener('popstate', f);
    return () => { listeners.delete(f); window.removeEventListener('popstate', f); };
  }, []);
  const l = getLoc();
  return { path: l.pathname, search: l.search, hash: l.hash, query: Object.fromEntries(new URLSearchParams(l.search)) };
}

/** Change some query values on the current page (empty values are removed). */
export function setQuery(changes, { replace = false, hash = '' } = {}) {
  const l = getLoc();
  const p = new URLSearchParams(l.search);
  for (const [k, v] of Object.entries(changes)) {
    if (v === undefined || v === null || v === '') p.delete(k); else p.set(k, v);
  }
  const s = p.toString();
  navigate(l.pathname + (s ? '?' + s : '') + hash, { replace });
}

export function Link({ to, children, className, title, onClick, ...rest }) {
  return (
    <a href={to} className={className} title={title} {...rest}
      onClick={(e) => {
        if (onClick) onClick(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(to);
      }}>
      {children}
    </a>
  );
}

/** Match "/rooms/:id" style patterns. */
export function matchRoute(routes, path) {
  for (const [pattern, Component] of routes) {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
    const m = path.match(re);
    if (m) return { Component, params: Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}
