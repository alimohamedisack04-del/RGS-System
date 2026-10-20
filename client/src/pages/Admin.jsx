import { useEffect } from 'react';
import Layout from '../components/Layout';
import { DeleteButton, ErrorBox, Field, LoadError, Loading, PageHead, useForm } from '../components/ui';
import { api, useApi } from '../lib/api';
import { useApp } from '../lib/app';
import { Link, navigate } from '../lib/router';
import { fmtDate } from '../lib/format';

export function Users() {
  const { data, error, reload } = useApi('/users');
  if (error) return <Layout title="Users"><LoadError error={error} onRetry={reload} /></Layout>;
  if (!data) return <Layout title="Users"><Loading /></Layout>;
  return (
    <Layout title="Users">
      <PageHead title="Users" sub={`${data.users.length} user(s)`} actions={<Link className="btn btn-primary" to="/users/new"><i className="bi bi-person-plus" /> Add User</Link>} />
      <div className="card"><div className="table-responsive"><table className="table table-hover">
        <thead><tr><th>Name</th><th>Username</th><th>Email</th><th>Role</th><th>Can delete</th><th>Status</th><th>Last login</th><th /></tr></thead>
        <tbody>{data.users.map((u) => (
          <tr key={u.id}>
            <td className="cell-main">{u.fullName}</td><td>{u.username}</td><td>{u.email || '-'}</td>
            <td><span className={`status status-role-${u.role}`}>{u.roleLabel}</span></td>
            <td>{u.role === 'admin' ? <i className="bi bi-check-lg text-success" aria-label="yes" /> : <span className="text-muted">-</span>}</td>
            <td>{u.isActive ? <span className="badge bg-success">Active</span> : <span className="badge bg-secondary">Disabled</span>}</td>
            <td className="small">{u.lastLogin ? fmtDate(u.lastLogin, true) : 'Never'}</td>
            <td className="table-actions text-end">
              <Link className="btn btn-sm btn-light" to={`/users/${u.id}/edit`}><i className="bi bi-pencil" /> Edit</Link>
              {u.id !== data.me ? <DeleteButton perm="users" path={`/users/${u.id}`} message={`Delete user "${u.username}"? Their recorded payments will be kept.`} onDone={reload} /> : null}
            </td>
          </tr>))}</tbody>
      </table></div></div>
    </Layout>
  );
}

export function UserForm({ params }) {
  const { toast, can } = useApp();
  const editing = !!params.id;
  const { data } = useApi(editing ? `/users/${params.id}` : null);
  const f = useForm({ fullName: '', username: '', email: '', password: '', role: 'cashier', isActive: true });
  useEffect(() => { if (data) f.setValues({ ...data.user, password: '' }); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!can('users')) return <Layout title="Users"><LoadError error={{ status: 403, message: 'Only an administrator can manage users.' }} /></Layout>;
  if (editing && !data) return <Layout title="Edit User"><Loading /></Layout>;
  const save = f.submit(async (v) => {
    const r = await api(editing ? `/users/${params.id}` : '/users', { method: editing ? 'PUT' : 'POST', body: v });
    toast(r.message); navigate('/users');
  });
  return (
    <Layout title={editing ? 'Edit User' : 'Add User'}>
      <PageHead title={editing ? `Edit User: ${data.user.username}` : 'Add User'} />
      <ErrorBox errors={f.errors} />
      <form className="card" style={{ maxWidth: 760 }} autoComplete="off" onSubmit={save} data-form="user">
        <div className="card-body"><div className="row g-3">
          <Field label="Full name" required><input className="form-control" maxLength={100} required {...f.bind('fullName')} /></Field>
          <Field label="Username" required><input className="form-control" maxLength={50} required {...f.bind('username')} /></Field>
          <Field label="Email"><input type="email" className="form-control" maxLength={150} {...f.bind('email')} /></Field>
          <Field label={editing ? 'New password' : 'Password'} required={!editing} hint={editing ? 'Leave empty to keep the current password.' : 'At least 8 characters.'}>
            <input type="password" className="form-control" minLength={8} required={!editing} autoComplete="new-password" {...f.bind('password')} /></Field>
          <Field label="Role" required hint={<><b>Cashier:</b> record payments, print receipts, add expenses, monthly report.<br /><b>Editor:</b> everything, but cannot delete anything and cannot manage users.<br /><b>Admin:</b> full access.</>}>
            <select className="form-select" {...f.bind('role')}><option value="cashier">Cashier</option><option value="editor">Editor</option><option value="admin">Admin</option></select></Field>
          <div className="col-md-6 pt-md-4"><div className="form-check"><input className="form-check-input" type="checkbox" id="isActive" {...f.bind('isActive', { type: 'checkbox' })} /><label className="form-check-label" htmlFor="isActive">Account active (can log in)</label></div></div>
        </div></div>
        <div className="card-footer d-flex gap-2"><button className="btn btn-primary" disabled={f.busy}><i className="bi bi-save" /> Save</button><Link className="btn btn-light" to="/users">Cancel</Link></div>
      </form>
    </Layout>
  );
}

export function Settings() {
  const { can, toast, loadMeta } = useApp();
  const { data } = useApi('/settings');
  const s = useForm({ company_name: '', system_name: '', company_phone: '', company_address: '', currency: '$', receipt_footer: '' });
  const p = useForm({ current: '', newPassword: '', confirm: '' });
  useEffect(() => { if (data) s.setValues(data.settings); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!data) return <Layout title="Settings"><Loading /></Layout>;
  const saveSettings = s.submit(async (v) => { const r = await api('/settings', { method: 'PUT', body: v }); toast(r.message); loadMeta(); });
  const savePassword = p.submit(async (v) => { const r = await api('/me/password', { method: 'PUT', body: v }); toast(r.message); p.setValues({ current: '', newPassword: '', confirm: '' }); });
  const keys = [['company_name', 'Company name'], ['system_name', 'System name'], ['company_phone', 'Company phone'], ['company_address', 'Company address'], ['currency', 'Currency symbol'], ['receipt_footer', 'Receipt footer text']];
  return (
    <Layout title="Settings">
      <PageHead title="Settings" />
      <div className="row g-3">
        {can('settings') ? (
          <div className="col-lg-7"><form className="card" onSubmit={saveSettings} data-form="settings">
            <div className="card-header">Company settings</div>
            <div className="card-body"><ErrorBox errors={s.errors} /><div className="row g-3">
              {keys.map(([k, l]) => <Field key={k} label={l}><input className="form-control" {...s.bind(k)} /></Field>)}
            </div></div>
            <div className="card-footer"><button className="btn btn-primary" disabled={s.busy}>Save settings</button></div>
          </form></div>
        ) : null}
        <div className="col-lg-5"><form className="card" onSubmit={savePassword} data-form="password">
          <div className="card-header">Change my password</div>
          <div className="card-body"><ErrorBox errors={p.errors} />
            <div className="mb-2"><label className="form-label">Current password</label><input type="password" className="form-control" autoComplete="current-password" {...p.bind('current')} /></div>
            <div className="mb-2"><label className="form-label">New password</label><input type="password" className="form-control" autoComplete="new-password" {...p.bind('newPassword')} /></div>
            <div><label className="form-label">Confirm new password</label><input type="password" className="form-control" autoComplete="new-password" {...p.bind('confirm')} /></div>
          </div>
          <div className="card-footer"><button className="btn btn-primary" disabled={p.busy}>Change password</button></div>
        </form></div>
      </div>
    </Layout>
  );
}
