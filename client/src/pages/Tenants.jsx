import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { DeleteButton, Empty, ErrorBox, Field, LoadError, Loading, PageHead, Person, useForm } from '../components/ui';
import { api, qs, useApi } from '../lib/api';
import { useApp } from '../lib/app';
import { Link, navigate, setQuery } from '../lib/router';
import { fmtDate, money, periodLabel, unitTypeLabel } from '../lib/format';
import { unitPath } from '../lib/units';

export function Tenants({ query }) {
  const { can } = useApp();
  const { data, error, reload } = useApi('/tenants' + qs({ q: query.q, type: query.type }));
  const [search, setSearch] = useState(query.q || '');
  return (
    <Layout title="Tenants">
      <PageHead title="Tenants" sub={data ? `${data.tenants.length} tenant(s)` : null}
        actions={can('manage') ? <Link className="btn btn-primary" to="/tenants/new"><i className="bi bi-person-plus" /> Add Tenant</Link> : null} />
      <form className="filter-bar row g-2 align-items-end" onSubmit={(e) => { e.preventDefault(); setQuery({ q: search }); }}>
        <div className="col-md-6"><label className="form-label">Search</label><input type="search" className="form-control" placeholder="Search name, phone, property or unit" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <div className="col-6 col-md-3"><label className="form-label">Rents a</label><select className="form-select" value={query.type || ''} onChange={(e) => setQuery({ type: e.target.value })}><option value="">Any unit</option><option value="room">Mall room</option><option value="apartment">Apartment</option><option value="land">Land</option></select></div>
        <div className="col-6 col-md-3 d-flex gap-2"><button className="btn btn-primary"><i className="bi bi-search" /> Search</button><Link className="btn btn-light" to="/tenants">Reset</Link></div>
      </form>
      {error ? <LoadError error={error} onRetry={reload} /> : !data ? <Loading /> : (
        <div className="card"><div className="table-responsive"><table className="table table-hover">
          <thead><tr><th>Tenant</th><th>Phone</th><th>Units</th><th>Since</th><th /></tr></thead>
          <tbody>
            {!data.tenants.length ? <Empty cols={5} text="No tenants found." icon="bi-people" /> : null}
            {data.tenants.map((t) => (
              <tr key={t.id}>
                <td><Person name={t.fullName} sub={t.email} href={`/tenants/${t.id}`} onClick={(e) => { e.preventDefault(); navigate(`/tenants/${t.id}`); }} /></td>
                <td className="nowrap">{t.phone || '-'}</td>
                <td>{t.units.length ? t.units.map((u) => <div key={u.key}><Link to={unitPath(u.unitType, u.unitId)}>{u.label}</Link> <span className="text-muted small">· {money(u.rent)}</span></div>) : <span className="text-muted small">No unit</span>}</td>
                <td className="nowrap">{t.startDate ? fmtDate(t.startDate) : '-'}</td>
                <td className="table-actions">
                  <Link className="btn btn-sm btn-light" to={`/tenants/${t.id}`}>View</Link>
                  {can('manage') ? <Link className="btn btn-sm btn-light" to={`/tenants/${t.id}/edit`}><i className="bi bi-pencil" /> Edit</Link> : null}
                  <DeleteButton path={`/tenants/${t.id}`} message={`Delete tenant "${t.fullName}"? Their units will become vacant. Payment history is kept.`} onDone={reload} />
                </td>
              </tr>))}
          </tbody>
        </table></div></div>
      )}
    </Layout>
  );
}

export function TenantView({ params }) {
  const { can, confirm, toast } = useApp();
  const { data, error, reload } = useApi(`/tenants/${params.id}`);
  if (error) return <Layout title="Tenant"><LoadError error={error} /></Layout>;
  if (!data) return <Layout title="Tenant"><Loading /></Layout>;
  const t = data.tenant;
  const moveOut = (u) => confirm(`Remove ${t.fullName} from ${u.label}? The unit becomes vacant. Payment history is kept.`, async () => {
    try { const r = await api(`/tenants/${t.id}/release`, { method: 'POST', body: { unit: u.key } }); toast(r.message); reload(); } catch (e) { toast(e.message, 'danger'); }
  }, { okLabel: 'Move out', okClass: 'btn-warning' });
  return (
    <Layout title={`Tenant: ${t.fullName}`}>
      <PageHead title={`Tenant: ${t.fullName}`} actions={<>
        <Link className="btn btn-light" to="/tenants"><i className="bi bi-arrow-left" /> Back</Link>
        {can('manage') ? <Link className="btn btn-outline-primary" to={`/tenants/${t.id}/edit`}>Edit / Assign unit</Link> : null}
        <DeleteButton path={`/tenants/${t.id}`} className="" message={`Delete tenant "${t.fullName}"? Their units will become vacant. Payment history is kept.`} onDone={() => navigate('/tenants')} />
      </>} />
      <div className="row g-3">
        <div className="col-lg-5"><div className="card h-100"><div className="card-body"><div className="dl-grid">
          <div><div className="k">Phone</div><div className="v">{t.phone || '-'}</div></div>
          <div><div className="k">Email</div><div className="v">{t.email || '-'}</div></div>
          <div><div className="k">Address</div><div className="v">{t.address || '-'}</div></div>
          <div><div className="k">Tenant since</div><div className="v">{t.startDate ? fmtDate(t.startDate) : '-'}</div></div>
          <div><div className="k">Total paid</div><div className="v">{money(data.totalPaid)}</div></div>
          {t.notes ? <div style={{ gridColumn: '1/-1' }}><div className="k">Notes</div><div style={{ whiteSpace: 'pre-line' }}>{t.notes}</div></div> : null}
        </div></div></div></div>
        <div className="col-lg-7"><div className="card h-100">
          <div className="card-header">Units rented</div>
          <div className="table-responsive"><table className="table">
            <thead><tr><th>Unit</th><th>Type</th><th className="num">Monthly rent</th><th /></tr></thead>
            <tbody>
              {!data.units.length ? <tr><td colSpan={4} className="empty">No unit assigned.</td></tr> : null}
              {data.units.map((u) => (
                <tr key={u.key}>
                  <td><Link className="cell-main" to={unitPath(u.unitType, u.unitId)}>{u.label}</Link></td><td>{unitTypeLabel(u.unitType)}</td><td className="num">{money(u.rent)}</td>
                  <td className="table-actions">
                    <Link className="btn btn-sm btn-light" to={`/history${qs({ unit: u.key })}`}><i className="bi bi-clock-history" /> History</Link>
                    {can('manage') ? <button className="btn btn-sm btn-outline-warning" data-act="moveOut" onClick={() => moveOut(u)}><i className="bi bi-box-arrow-right" /> Move out</button> : null}
                  </td>
                </tr>))}
            </tbody>
          </table></div>
        </div></div>
      </div>
      <div className="card mt-3"><div className="card-header">Payments <span className="card-sub">latest 50</span></div>
        <div className="table-responsive"><table className="table table-sm table-hover">
          <thead><tr><th>Receipt</th><th>Unit</th><th>Month</th><th className="num">Paid</th><th>Date</th><th /></tr></thead>
          <tbody>
            {!data.payments.length ? <tr><td colSpan={6} className="empty">No payments yet.</td></tr> : null}
            {data.payments.map((p) => (
              <tr key={p.id}><td><Link className="cell-main" to={`/receipts/${p.id}`}>{p.receiptNo}</Link></td><td>{p.unitLabel}</td><td>{periodLabel(p.periodYear, p.periodMonth)}</td>
                <td className="num fw-600">{money(p.amountPaid)}</td><td>{fmtDate(p.paymentDate)}</td><td className="table-actions"><Link className="btn btn-sm btn-light" to={`/receipts/${p.id}`}><i className="bi bi-printer" /> Receipt</Link></td></tr>))}
          </tbody>
        </table></div>
      </div>
    </Layout>
  );
}

export function TenantForm({ params }) {
  const { toast, can } = useApp();
  const editing = !!params.id;
  const { data } = useApi(editing ? `/tenants/${params.id}` : null);
  const { data: vacant } = useApi('/units-vacant');
  const today = new Date().toISOString().slice(0, 10);
  const f = useForm({ fullName: '', phone: '', email: '', address: '', startDate: editing ? '' : today, notes: '', assignUnit: '' });
  useEffect(() => { if (data) f.setValues((v) => ({ ...v, ...data.tenant })); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!can('manage')) return <Layout title="Tenant"><LoadError error={{ status: 403, message: 'You do not have permission to add or edit tenants.' }} /></Layout>;
  if (editing && !data) return <Layout title="Tenant"><Loading /></Layout>;
  const save = f.submit(async (v) => {
    const r = await api(editing ? `/tenants/${params.id}` : '/tenants', { method: editing ? 'PUT' : 'POST', body: v });
    toast(r.message); navigate(`/tenants/${r.id}`);
  });
  return (
    <Layout title={editing ? 'Edit Tenant' : 'Add Tenant'}>
      <PageHead title={editing ? `Edit Tenant: ${data.tenant.fullName}` : 'Add Tenant'} />
      <ErrorBox errors={f.errors} />
      <form className="card" style={{ maxWidth: 860 }} onSubmit={save} data-form="tenant">
        <div className="card-body"><div className="row g-3">
          <Field label="Full name" required><input name="full_name" className="form-control" maxLength={150} required {...f.bind('fullName')} /></Field>
          <Field label="Phone"><input className="form-control" maxLength={30} {...f.bind('phone')} /></Field>
          <Field label="Email"><input type="email" className="form-control" maxLength={150} {...f.bind('email')} /></Field>
          <Field label="Address"><input className="form-control" maxLength={255} {...f.bind('address')} /></Field>
          <Field label="Tenant since"><input type="date" className="form-control" {...f.bind('startDate')} /></Field>
          <Field label="Assign to a vacant unit" hint="Optional. The unit becomes occupied by this tenant.">
            <select name="assign_unit" className="form-select" {...f.bind('assignUnit')}>
              <option value="">-- Do not assign now --</option>
              {(vacant ? vacant.units : []).map((u) => <option key={u.key} value={u.key}>{unitTypeLabel(u.unitType)} - {u.label} ({money(u.rent)})</option>)}
            </select></Field>
          <Field label="Notes" className="col-12"><textarea className="form-control" rows={2} {...f.bind('notes')} /></Field>
        </div></div>
        <div className="card-footer d-flex gap-2"><button className="btn btn-primary" disabled={f.busy}><i className="bi bi-save" /> Save</button><Link className="btn btn-light" to={editing ? `/tenants/${params.id}` : '/tenants'}>Cancel</Link></div>
      </form>
    </Layout>
  );
}
