import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useApp } from '../lib/app';
import { getLoc, navigate } from '../lib/router';

export default function Login() {
  const { loadMeta } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState([]);
  useEffect(() => { api('/auth/login-info').then((d) => setDemo(d.demoLogins || [])).catch(() => {}); }, []);
  const fillDemo = (a) => { setUsername(a.username); setPassword(a.password); setError(''); };
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      await api('/auth/login', { method: 'POST', body: { username, password } });
      const next = new URLSearchParams(getLoc().search).get('next');
      await loadMeta();
      navigate(next && next.startsWith('/') && !next.startsWith('//') ? next : '/', { replace: true });
    } catch (err) {
      setError(err.message);
      setPassword('');
    } finally { setBusy(false); }
  };
  return (
    <div className="login-shell">
      <div className="login-brand">
        <div><img src="/img/rgs-logo-white.svg" alt="RGS" style={{ height: 46, width: 'auto' }} /><div className="brand-sub" style={{ color: '#9fb0c8', marginTop: 6 }}>Property Management System</div></div>
        <div className="my-4">
          <h2>Rent, tenants and properties — in one place.</h2>
          <p className="hide-sm">Track monthly rent for malls, apartments and land, record payments, print receipts and see who still owes — at a glance.</p>
          <ul className="login-points hide-sm">
            <li><i className="bi bi-cash-stack" />Monthly rent collection &amp; receipts</li>
            <li><i className="bi bi-buildings" />Malls, rooms, apartments and land</li>
            <li><i className="bi bi-bar-chart-line" />Live dashboard and printable reports</li>
          </ul>
        </div>
        <div className="small hide-sm" style={{ color: '#8390a7' }}>&copy; {new Date().getFullYear()} RGS</div>
      </div>
      <div className="login-form-wrap">
        <form className="login-form" onSubmit={submit}>
          <h1>Sign in</h1>
          <p className="text-muted mb-4">Enter your username and password to continue.</p>
          {error ? <div className="alert alert-danger py-2" role="alert"><i className="bi bi-exclamation-circle" /> {error}</div> : null}
          <div className="mb-3"><label className="form-label" htmlFor="username">Username</label>
            <input className="form-control" id="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus /></div>
          <div className="mb-4"><label className="form-label" htmlFor="password">Password</label>
            <input type="password" className="form-control" id="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <button className="btn btn-primary btn-lg w-100" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} <i className="bi bi-arrow-right" /></button>
          {demo.length ? (
            <div className="demo-logins" id="demoLogins">
              <div className="demo-logins-title">Test accounts <span>— click one to fill in</span></div>
              {demo.map((a) => (
                <button type="button" key={a.username} className="demo-login" data-user={a.username} onClick={() => fillDemo(a)}>
                  <span className="dl-cred"><b>{a.username}</b> / {a.password}</span>
                  <span className="dl-role">{a.role}</span>
                  <span className="dl-can">{a.can}</span>
                </button>
              ))}
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}
