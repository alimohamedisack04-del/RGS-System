import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import TenantPicker from '../components/TenantPicker';
import UnitPanel from '../components/UnitPanel';
import { DeleteButton, Empty, ErrorBox, Field, LoadError, Loading, PageHead, Person, RentBadge, UnitBadge, useForm } from '../components/ui';
import { api, qs, useApi } from '../lib/api';
import { useApp } from '../lib/app';
import { Link, navigate, setQuery } from '../lib/router';
import { currency, money, monthName } from '../lib/format';

const period = (q) => { const d = new Date(); return [Number(q.year) || d.getFullYear(), Number(q.month) || d.getMonth() + 1]; };
const LAND_STATUS = { available: 'Available', rented: 'Rented', sold: 'Sold', reserved: 'Reserved' };
const LAND_PERIOD = { monthly: 'Per month', annual: 'Per year', total: 'Total / sale price' };
const LAND_UNITS = { m: 'm (e.g. 20 x 30 m)', 'sq m': 'Square metres (m²)', acre: 'Acre', hectare: 'Hectare', plot: 'Plot' };
const periodShort = { monthly: '/ month', annual: '/ year', total: 'total' };

// ===================================================================== APARTMENTS
export function Apartments({ query }) {
  const { can } = useApp();
  const [y, m] = period(query);
  const { data, error, reload } = useApi('/apartments' + qs({ year: y, month: m, q: query.q, building: query.building, status: query.status, pay: query.pay }));
  const [search, setSearch] = useState(query.q || '');
  return (
    <Layout title="Apartments">
      <PageHead title="Apartments" sub={data ? `${data.apartments.length} apartment(s)` : null}
        actions={can('manage') ? <Link className="btn btn-primary" to="/apartments/new"><i className="bi bi-plus-lg" /> Add Apartment</Link> : null} />
      <form className="filter-bar row g-2 align-items-end" onSubmit={(e) => { e.preventDefault(); setQuery({ q: search }); }}>
        <div className="col-12 col-lg-4"><label className="form-label">Search</label><input type="search" className="form-control" placeholder="Apartment, building, tenant, phone…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <div className="col-6 col-lg-2"><label className="form-label">Building</label><select className="form-select" value={query.building || ''} onChange={(e) => setQuery({ building: e.target.value })}><option value="">All buildings</option>{(data ? data.buildings : []).map((b) => <option key={b} value={b}>{b}</option>)}</select></div>
        <div className="col-6 col-lg-2"><label className="form-label">Status</label><select className="form-select" value={query.status || ''} onChange={(e) => setQuery({ status: e.target.value })}><option value="">Occupied + vacant</option><option value="occupied">Occupied</option><option value="vacant">Vacant</option></select></div>
        <div className="col-6 col-lg-2"><label className="form-label">Payment ({monthName(m, true)})</label><select className="form-select" value={query.pay || ''} onChange={(e) => setQuery({ pay: e.target.value })}><option value="">Any</option><option value="paid">Paid</option><option value="partial">Partial</option><option value="unpaid">Unpaid</option></select></div>
        <div className="col-6 col-lg-2 d-flex gap-2"><button className="btn btn-primary"><i className="bi bi-search" /> Search</button><Link className="btn btn-light" to="/apartments">Reset</Link></div>
      </form>
      {error ? <LoadError error={error} onRetry={reload} /> : !data ? <Loading /> : (
        <div className="card"><div className="table-responsive"><table className="table table-hover">
          <thead><tr><th>Apartment</th><th>Building</th><th>Tenant</th><th className="num">Rent</th><th>Status</th><th>{monthName(m, true)} rent</th><th /></tr></thead>
          <tbody>
            {!data.apartments.length ? <Empty cols={7} text="No apartments found." icon="bi-building" /> : null}
            {data.apartments.map((a) => (
              <tr key={a.unitId}>
                <td><Link className="cell-main" to={`/apartments/${a.unitId}`}>{a.code}</Link><div className="cell-sub">{a.kind}</div></td>
                <td>{a.location}</td>
                <td>{a.tenantName ? <Person name={a.tenantName} sub={a.tenantPhone} /> : <span className="text-muted">—</span>}</td>
                <td className="num">{money(a.rent)}</td><td><UnitBadge status={a.status} /></td>
                <td>{a.rentRow ? <RentBadge status={a.rentRow.payStatus} /> : <span className="text-muted">-</span>}</td>
                <td className="table-actions">
                  <Link className="btn btn-sm btn-light" to={`/apartments/${a.unitId}`}>View</Link>
                  {can('manage') ? <Link className="btn btn-sm btn-light" to={`/apartments/${a.unitId}/edit`}><i className="bi bi-pencil" /> Edit</Link> : null}
                  <DeleteButton path={`/apartments/${a.unitId}`} message={`Delete apartment ${a.code}? Its payment records will also be deleted.`} onDone={reload} />
                </td>
              </tr>))}
          </tbody>
        </table></div></div>
      )}
    </Layout>
  );
}

export function ApartmentView({ params, query }) {
  const { can } = useApp();
  const { data, error } = useApi(`/apartments/${params.id}`);
  const [year, setYear] = useState(Number(query.year) || new Date().getFullYear());
  if (error) return <Layout title="Apartment"><LoadError error={error} /></Layout>;
  if (!data) return <Layout title="Apartment"><Loading /></Layout>;
  const { apartment: a, tenant: t } = data;
  return (
    <Layout title={`${a.building} — ${a.apartmentNumber}`}>
      <PageHead title={`${a.building} — Apartment ${a.apartmentNumber}`} actions={<>
        <Link className="btn btn-light" to="/apartments"><i className="bi bi-arrow-left" /> Apartments</Link>
        {can('manage') ? <Link className="btn btn-outline-primary" to={`/apartments/${a.id}/edit`}><i className="bi bi-pencil" /> Edit / Assign tenant</Link> : null}
        <DeleteButton path={`/apartments/${a.id}`} className="" message={`Delete apartment ${a.apartmentNumber}? Its payment records will also be deleted.`} onDone={() => navigate('/apartments')} />
      </>} />
      <div className="card"><div className="card-body"><div className="dl-grid">
        <div><div className="k">Building</div><div className="v">{a.building}</div></div>
        <div><div className="k">Apartment</div><div className="v">{a.apartmentNumber}</div></div>
        <div><div className="k">Type</div><div className="v">{a.apartmentType || '-'}</div></div>
        <div><div className="k">Tenant</div><div className="v">{t ? <Link to={`/tenants/${t.id}`}>{t.fullName}</Link> : '-'}</div></div>
        <div><div className="k">Tenant phone</div><div className="v">{t && t.phone ? t.phone : '-'}</div></div>
        <div><div className="k">Monthly rent</div><div className="v">{money(a.monthlyRent)}</div></div>
        <div><div className="k">Status</div><div><UnitBadge status={a.status} /></div></div>
        {a.notes ? <div style={{ gridColumn: '1/-1' }}><div className="k">Notes</div><div style={{ whiteSpace: 'pre-line' }}>{a.notes}</div></div> : null}
      </div></div></div>
      <UnitPanel type="apartment" id={a.id} year={year} onYear={setYear} />
    </Layout>
  );
}

export function ApartmentForm({ params }) {
  const { toast, can } = useApp();
  const editing = !!params.id;
  const { data } = useApi(editing ? `/apartments/${params.id}` : null);
  const { data: list } = useApi('/apartments');
  const f = useForm({ apartmentNumber: '', building: '', apartmentType: '', monthlyRent: '', tenantId: '', notes: '', newTenantName: '', newTenantPhone: '' });
  useEffect(() => { if (data) f.setValues((v) => ({ ...v, ...data.apartment, tenantId: data.apartment.tenantId || '' })); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!can('manage')) return <Layout title="Apartment"><LoadError error={{ status: 403, message: 'You do not have permission to add or edit apartments.' }} /></Layout>;
  if (editing && !data) return <Layout title="Apartment"><Loading /></Layout>;
  const save = f.submit(async (v) => {
    const r = await api(editing ? `/apartments/${params.id}` : '/apartments', { method: editing ? 'PUT' : 'POST', body: v });
    toast(r.message); navigate(`/apartments/${r.id}`);
  });
  return (
    <Layout title={editing ? 'Edit Apartment' : 'Add Apartment'}>
      <PageHead title={editing ? `Edit Apartment ${data.apartment.apartmentNumber}` : 'Add Apartment'} />
      <ErrorBox errors={f.errors} />
      <form className="card" style={{ maxWidth: 860 }} onSubmit={save} data-form="apartment">
        <div className="card-body"><div className="row g-3">
          <Field label="Apartment number" required className="col-md-4"><input className="form-control" maxLength={30} required {...f.bind('apartmentNumber')} /></Field>
          <Field label="Building / location" required className="col-md-4"><input className="form-control" maxLength={150} required list="buildingList" {...f.bind('building')} />
            <datalist id="buildingList">{(list ? list.buildings : []).map((b) => <option key={b} value={b} />)}</datalist></Field>
          <Field label="Type" className="col-md-4"><input className="form-control" maxLength={50} placeholder="e.g. 2 Bedrooms" {...f.bind('apartmentType')} /></Field>
          <Field label="Monthly rent" required className="col-md-4"><div className="input-group"><span className="input-group-text">{currency()}</span><input type="number" step="0.01" min="0" className="form-control" required {...f.bind('monthlyRent')} /></div></Field>
          <div className="col-12"><TenantPicker values={f.values} setValues={f.setValues} /></div>
          <Field label="Notes" className="col-12"><textarea className="form-control" rows={2} {...f.bind('notes')} /></Field>
        </div></div>
        <div className="card-footer d-flex gap-2"><button className="btn btn-primary" disabled={f.busy}><i className="bi bi-save" /> Save</button><Link className="btn btn-light" to={editing ? `/apartments/${params.id}` : '/apartments'}>Cancel</Link></div>
      </form>
    </Layout>
  );
}

// ===================================================================== LANDS
export function Lands({ query }) {
  const { can } = useApp();
  const [y, m] = period(query);
  const { data, error, reload } = useApi('/lands' + qs({ year: y, month: m, q: query.q, status: query.status }));
  const [search, setSearch] = useState(query.q || '');
  return (
    <Layout title="Lands (Dhulal)">
      <PageHead title="Lands (Dhulal)" sub={data ? `${data.lands.length} plot(s)` : null}
        actions={can('manage') ? <Link className="btn btn-primary" to="/lands/new"><i className="bi bi-plus-lg" /> Add Land</Link> : null} />
      <form className="filter-bar row g-2 align-items-end" onSubmit={(e) => { e.preventDefault(); setQuery({ q: search }); }}>
        <div className="col-12 col-lg-5"><label className="form-label">Search</label><input type="search" className="form-control" placeholder="Plot, location, tenant or owner…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <div className="col-6 col-lg-3"><label className="form-label">Status</label><select className="form-select" value={query.status || ''} onChange={(e) => setQuery({ status: e.target.value })}><option value="">All statuses</option>{Object.entries(LAND_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div className="col-6 col-lg-3 d-flex gap-2"><button className="btn btn-primary"><i className="bi bi-search" /> Search</button><Link className="btn btn-light" to="/lands">Reset</Link></div>
      </form>
      {error ? <LoadError error={error} onRetry={reload} /> : !data ? <Loading /> : (
        <div className="card"><div className="table-responsive"><table className="table table-hover">
          <thead><tr><th>Plot</th><th>Location</th><th>Size</th><th className="num">Amount</th><th>Status</th><th>Tenant / owner</th><th>{monthName(m, true)} rent</th><th /></tr></thead>
          <tbody>
            {!data.lands.length ? <Empty cols={8} text="No land found." icon="bi-map" /> : null}
            {data.lands.map((l) => (
              <tr key={l.id}>
                <td><Link className="cell-main" to={`/lands/${l.id}`}>{l.name}</Link></td>
                <td>{l.location || '-'}</td><td>{l.size ? `${l.size} ${l.sizeUnit}` : '-'}</td>
                <td className="num">{money(l.amount)}<div className="cell-sub">{periodShort[l.amountPeriod]}</div></td>
                <td><UnitBadge status={l.status} /></td>
                <td>{l.tenantName ? <Person name={l.tenantName} sub={l.tenantPhone} /> : l.ownerName ? <Person name={l.ownerName} sub={l.ownerPhone} /> : <span className="text-muted">—</span>}</td>
                <td>{l.rentRow ? <RentBadge status={l.rentRow.payStatus} /> : <span className="text-muted">-</span>}</td>
                <td className="table-actions">
                  <Link className="btn btn-sm btn-light" to={`/lands/${l.id}`}>View</Link>
                  {can('manage') ? <Link className="btn btn-sm btn-light" to={`/lands/${l.id}/edit`}><i className="bi bi-pencil" /> Edit</Link> : null}
                  <DeleteButton path={`/lands/${l.id}`} message={`Delete land "${l.name}"? Its payment records will also be deleted.`} onDone={reload} />
                </td>
              </tr>))}
          </tbody>
        </table></div></div>
      )}
    </Layout>
  );
}

export function LandView({ params, query }) {
  const { can } = useApp();
  const { data, error } = useApi(`/lands/${params.id}`);
  const [year, setYear] = useState(Number(query.year) || new Date().getFullYear());
  if (error) return <Layout title="Land"><LoadError error={error} /></Layout>;
  if (!data) return <Layout title="Land"><Loading /></Layout>;
  const { land: l, tenant: t } = data;
  return (
    <Layout title={`Land: ${l.name}`}>
      <PageHead title={`Land: ${l.name}`} actions={<>
        <Link className="btn btn-light" to="/lands"><i className="bi bi-arrow-left" /> Lands</Link>
        {can('manage') ? <Link className="btn btn-outline-primary" to={`/lands/${l.id}/edit`}><i className="bi bi-pencil" /> Edit</Link> : null}
        <DeleteButton path={`/lands/${l.id}`} className="" message={`Delete land "${l.name}"? Its payment records will also be deleted.`} onDone={() => navigate('/lands')} />
      </>} />
      <div className="card"><div className="card-body"><div className="dl-grid">
        <div><div className="k">Location</div><div className="v">{l.location || '-'}</div></div>
        <div><div className="k">Size</div><div className="v">{l.size ? `${l.size} ${l.sizeUnit}` : '-'}</div></div>
        <div><div className="k">Amount</div><div className="v">{money(l.amount)} <span className="text-muted small">{LAND_PERIOD[l.amountPeriod]}</span></div></div>
        <div><div className="k">Status</div><div><UnitBadge status={l.status} /></div></div>
        <div><div className="k">Tenant</div><div className="v">{t ? <Link to={`/tenants/${t.id}`}>{t.fullName}</Link> : '-'}</div></div>
        <div><div className="k">Owner / buyer</div><div className="v">{l.ownerName || '-'}{l.ownerPhone ? <div className="cell-sub">{l.ownerPhone}</div> : null}</div></div>
        {l.notes ? <div style={{ gridColumn: '1/-1' }}><div className="k">Notes</div><div style={{ whiteSpace: 'pre-line' }}>{l.notes}</div></div> : null}
      </div></div></div>
      {l.status === 'rented' && l.amountPeriod === 'monthly' ? <UnitPanel type="land" id={l.id} year={year} onYear={setYear} />
        : <div className="alert alert-light border mt-3 mb-0">Monthly rent tracking is used for land with status <b>Rented</b> and amount <b>per month</b>.</div>}
    </Layout>
  );
}

export function LandForm({ params }) {
  const { toast, can } = useApp();
  const editing = !!params.id;
  const { data } = useApi(editing ? `/lands/${params.id}` : null);
  const f = useForm({ name: '', location: '', size: '', sizeUnit: 'm', amount: '', amountPeriod: 'monthly', status: 'available', tenantId: '', ownerName: '', ownerPhone: '', notes: '', newTenantName: '', newTenantPhone: '' });
  useEffect(() => { if (data) f.setValues((v) => ({ ...v, ...data.land, tenantId: data.land.tenantId || '' })); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!can('manage')) return <Layout title="Land"><LoadError error={{ status: 403, message: 'You do not have permission to add or edit land.' }} /></Layout>;
  if (editing && !data) return <Layout title="Land"><Loading /></Layout>;
  const save = f.submit(async (v) => {
    const r = await api(editing ? `/lands/${params.id}` : '/lands', { method: editing ? 'PUT' : 'POST', body: v });
    toast(r.message); navigate(`/lands/${r.id}`);
  });
  const withTenant = ['rented', 'reserved'].includes(f.values.status);
  return (
    <Layout title={editing ? 'Edit Land' : 'Add Land'}>
      <PageHead title={editing ? `Edit Land: ${data.land.name}` : 'Add Land'} />
      <ErrorBox errors={f.errors} />
      <form className="card" style={{ maxWidth: 900 }} onSubmit={save} data-form="land">
        <div className="card-body"><div className="row g-3">
          <Field label="Plot / property name" required><input name="name" className="form-control" maxLength={150} required {...f.bind('name')} /></Field>
          <Field label="Location"><input className="form-control" maxLength={150} {...f.bind('location')} /></Field>
          <Field label="Size" className="col-md-3"><input className="form-control" maxLength={50} placeholder="e.g. 20 x 30" {...f.bind('size')} /></Field>
          <Field label="Unit" className="col-md-3"><select className="form-select" {...f.bind('sizeUnit')}>{Object.entries(LAND_UNITS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Amount" required className="col-md-3"><div className="input-group"><span className="input-group-text">{currency()}</span><input name="amount" type="number" step="0.01" min="0" className="form-control" required {...f.bind('amount')} /></div></Field>
          <Field label="Amount is" className="col-md-3"><select className="form-select" {...f.bind('amountPeriod')}>{Object.entries(LAND_PERIOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Status" className="col-md-4"><select name="status" className="form-select" {...f.bind('status')}>{Object.entries(LAND_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          {withTenant ? <div className="col-12"><TenantPicker values={f.values} setValues={f.setValues} hint="A rented land needs a tenant (or an owner/tenant name below)." /></div> : null}
          <Field label="Owner / buyer name"><input className="form-control" maxLength={150} {...f.bind('ownerName')} /></Field>
          <Field label="Owner / buyer phone"><input className="form-control" maxLength={30} {...f.bind('ownerPhone')} /></Field>
          <Field label="Notes" className="col-12"><textarea className="form-control" rows={2} {...f.bind('notes')} /></Field>
        </div></div>
        <div className="card-footer d-flex gap-2"><button className="btn btn-primary" disabled={f.busy}><i className="bi bi-save" /> Save</button><Link className="btn btn-light" to={editing ? `/lands/${params.id}` : '/lands'}>Cancel</Link></div>
      </form>
    </Layout>
  );
}
