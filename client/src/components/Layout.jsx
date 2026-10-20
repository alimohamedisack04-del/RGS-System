/** App shell: navy sidebar with the RGS logo, top bar with room search, content area. */
import { useState } from 'react';
import { useApp } from '../lib/app';
import { Link, navigate, useLocation } from '../lib/router';
import { fmtDate, initials } from '../lib/format';

function activeKey(path) {
  const m = path.match(/^\/malls\/([a-f0-9]{24})(\/|$)/);
  if (m && !path.endsWith('/edit')) return 'mall-' + m[1];
  if (path === '/') return 'dashboard';
  if (path.startsWith('/collection')) return 'collection';
  if (path === '/payments/new') return 'record';
  if (path.startsWith('/payments') || path.startsWith('/receipts')) return 'payments';
  if (path.startsWith('/history')) return 'history';
  if (path.startsWith('/sections') || path.startsWith('/malls')) return 'malls';
  if (path.startsWith('/statements')) return 'reports';
  return path.split('/')[1] || 'dashboard';
}

export default function Layout({ title, crumb, children }) {
  const { meta, user, can, logout, settings } = useApp();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const key = activeKey(loc.path);
  const NavItem = ({ k, to, icon, label, count }) => (
    <Link to={to} className={`nl${key === k ? ' active' : ''}`} onClick={() => setOpen(false)}>
      <i className={`bi ${icon}`} /><span>{label}</span>{count ? <span className="nav-count">{count}</span> : null}
    </Link>
  );
  return (
    <div className="app-wrapper">
      <div className={`side-backdrop${open ? ' show' : ''}`} onClick={() => setOpen(false)} />
      <aside className={`app-sidebar no-print${open ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <div><img className="sidebar-logo" src="/img/rgs-logo-white.svg" alt={settings.company_name || 'RGS'} /><div className="brand-sub">Property Management</div></div>
          <button type="button" className="btn-close btn-close-white ms-auto d-lg-none" aria-label="Close menu" onClick={() => setOpen(false)} />
        </div>
        <nav className="sidebar-nav">
          <NavItem k="dashboard" to="/" icon="bi-grid-1x2" label="Dashboard" />
          <div className="nav-section">Rent</div>
          <NavItem k="collection" to="/collection" icon="bi-cash-stack" label="Rent Collection" count={meta.dueCount} />
          {can('pay') ? <NavItem k="record" to="/payments/new" icon="bi-plus-circle" label="Record Payment" /> : null}
          <NavItem k="payments" to="/payments" icon="bi-receipt" label="Payments" />
          <NavItem k="history" to="/history" icon="bi-clock-history" label="Payment History" />
          <div className="nav-section">Properties</div>
          <NavItem k="malls" to="/malls" icon="bi-buildings" label="Malls" />
          <NavItem k="rooms" to="/rooms" icon="bi-door-closed" label="Mall Rooms" />
          <NavItem k="apartments" to="/apartments" icon="bi-building" label="Apartments" />
          <NavItem k="lands" to="/lands" icon="bi-map" label="Lands (Dhulal)" />
          {meta.malls.length ? <div className="nav-section">Malls</div> : null}
          {meta.malls.map((m) => <NavItem key={m.id} k={'mall-' + m.id} to={'/malls/' + m.id} icon="bi-shop-window" label={m.name} />)}
          <div className="nav-section">Management</div>
          <NavItem k="tenants" to="/tenants" icon="bi-people" label="Tenants" />
          {can('expense') ? <NavItem k="expenses" to="/expenses" icon="bi-wallet" label="Expenses" /> : null}
          {can('hr') ? <NavItem k="hr" to="/hr" icon="bi-person-badge" label="HR (Staff)" /> : null}
          <NavItem k="reports" to="/reports" icon="bi-bar-chart-line" label="Reports" />
          {can('users') ? <NavItem k="users" to="/users" icon="bi-person-gear" label="Users" /> : null}
          <NavItem k="settings" to="/settings" icon="bi-gear" label="Settings" />
        </nav>
        <div className="sidebar-user">
          <span className="avatar">{initials(user.fullName)}</span>
          <div className="min-w-0"><div className="name text-truncate">{user.fullName}</div><div className="role">{user.role === 'admin' ? 'Administrator' : user.roleLabel}</div></div>
          <a className="logout" title="Logout" role="button" tabIndex={0} onClick={logout} onKeyDown={(e) => e.key === 'Enter' && logout()}><i className="bi bi-box-arrow-right" /><span className="visually-hidden">Logout</span></a>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-topbar no-print">
          <button className="menu-btn d-lg-none" type="button" aria-label="Open menu" onClick={() => setOpen(true)}>&#9776;</button>
          <div className="crumbs"><span>{settings.company_name}</span><span className="sep">/</span>{crumb ? <><span>{crumb}</span><span className="sep">/</span></> : null}<b className="text-truncate">{title}</b></div>
          <form className="topbar-search d-none d-md-flex" role="search" onSubmit={(e) => { e.preventDefault(); if (q.trim()) { navigate('/rooms?q=' + encodeURIComponent(q.trim())); setQ(''); } }}>
            <i className="bi bi-search" />
            <input type="search" id="topSearch" className="form-control form-control-sm" placeholder="Find room: number, tenant or phone" aria-label="Find room" value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
          <div className="ms-auto d-flex align-items-center gap-2">
            <span className="topbar-chip d-none d-md-inline-flex"><i className="bi bi-calendar3" />{fmtDate(meta.today)}</span>
            {can('pay') ? <Link to="/payments/new" className="btn btn-primary btn-sm"><i className="bi bi-plus-lg" /><span className="d-none d-sm-inline">Record payment</span></Link> : null}
          </div>
        </header>
        <main className="app-content">{children}</main>
        <footer className="app-footer no-print">&copy; {new Date().getFullYear()} {settings.company_name} &middot; {settings.system_name} &middot; MERN edition</footer>
      </div>
    </div>
  );
}
