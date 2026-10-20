/** App-wide state: logged-in user, permissions, settings, sidebar data, toasts and confirmation dialogs. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler } from './api';
import { setCurrency } from './format';
import { navigate } from './router';

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export function AppProvider({ children }) {
  const [meta, setMeta] = useState(null);       // null = loading, false = logged out
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);

  const loadMeta = useCallback(async () => {
    try {
      const m = await api('/meta');
      setCurrency(m.settings.currency);
      setMeta(m);
      return m;
    } catch (e) {
      if (e.status === 401) setMeta(false);
      else setMeta((old) => old || false);
      return null;
    }
  }, []);

  useEffect(() => { loadMeta(); }, [loadMeta]);
  useEffect(() => { setUnauthorizedHandler(() => setMeta(false)); }, []);

  const toast = useCallback((message, type = 'success') => {
    const id = Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === 'danger' ? 7000 : 4500);
  }, []);

  /** In-app confirmation box (browser confirm() pop-ups are avoided). */
  const confirm = useCallback((message, onOk, { okLabel = 'Yes, continue', okClass = 'btn-danger' } = {}) => {
    setDialog({ message, onOk, okLabel, okClass });
  }, []);

  const logout = useCallback(async () => {
    try { await api('/auth/logout', { method: 'POST', body: {} }); } catch { /* ignore */ }
    setMeta(false);
    navigate('/login');
    toast('You have been logged out.', 'info');
  }, [toast]);

  const value = useMemo(() => ({
    meta, setMeta, loadMeta, toast, confirm, logout,
    user: meta ? meta.user : null,
    settings: meta ? meta.settings : {},
    can: (perm) => !!(meta && meta.perms.includes(perm)),
  }), [meta, loadMeta, toast, confirm, logout]);

  return (
    <AppCtx.Provider value={value}>
      {children}
      <div className="toast-rgs no-print" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`alert alert-${t.type} d-flex align-items-start gap-2`} role="status">
            <i className={`bi ${t.type === 'danger' ? 'bi-exclamation-octagon' : t.type === 'warning' ? 'bi-exclamation-triangle' : t.type === 'info' ? 'bi-info-circle' : 'bi-check-circle'}`} />
            <div className="flex-grow-1">{t.message}</div>
            <button type="button" className="btn-close btn-sm" aria-label="Close" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} />
          </div>
        ))}
      </div>
      {dialog && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setDialog(null); }}>
          <div className="mbox" role="dialog" aria-modal="true" id="confirmBox">
            <div className="mhead"><span className="kpi-icon ic-warn"><i className="bi bi-exclamation-triangle" /></span>Please confirm</div>
            <div className="mbody">{dialog.message}</div>
            <div className="mfoot">
              <button type="button" className="btn btn-light" onClick={() => setDialog(null)}>Cancel</button>
              <button type="button" className={`btn ${dialog.okClass}`} id="confirmOk" autoFocus
                onClick={() => { const f = dialog.onOk; setDialog(null); f && f(); }}>{dialog.okLabel}</button>
            </div>
          </div>
        </div>
      )}
    </AppCtx.Provider>
  );
}
