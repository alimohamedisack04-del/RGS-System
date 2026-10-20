import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import TenantPicker from '../components/TenantPicker';
import UnitPanel from '../components/UnitPanel';
import { DeleteButton, Empty, ErrorBox, Field, LoadError, Loading, MonthSelect, PageHead, Person, RentBadge, UnitBadge, YearSelect, useForm } from '../components/ui';
import { Pager } from './Rent';
import { api, qs, useApi } from '../lib/api';
import { useApp } from '../lib/app';
import { Link, navigate, setQuery } from '../lib/router';
import { currency, money, monthName, periodLabel } from '../lib/format';

const period = (q) => { const d = new Date(); return [Number(q.year) || d.getFullYear(), Number(q.month) || d.getMonth() + 1]; };

export function Rooms({ query }) {
  const { can } = useApp();
  const [y, m] = period(query);
  const { data, error, reload } = useApi('/rooms' + qs({ year: y, month: m, q: query.q, mallId: query.mallId, sectionId: query.sectionId, category: query.category, status: query.status, pay: query.pay, page: query.page, list: query.list }));
  const [search, setSearch] = useState(query.q || '');
  useEffect(() => { setSearch(query.q || ''); }, [query.q]);
  // Search found one room (exact number / phone, or the only match) -> open its information page
  useEffect(() => { if (data && data.pick) navigate(`/rooms/${data.pick}${qs({ q: query.q, month: m, year: y })}`, { replace: true }); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  if (error) return <Layout title="Mall Rooms"><LoadError error={error} onRetry={reload} /></Layout>;
  if (!data || data.pick) return <Layout title="Mall Rooms"><Loading /></Layout>;
  return (
    <Layout title="Mall Rooms">
      <PageHead title="Mall Rooms" sub={`${data.total} room(s) · rent status for ${periodLabel(y, m)}`}
        actions={can('manage') ? <Link className="btn btn-primary" to={`/rooms/new${qs({ mallId: query.mallId })}`}><i className="bi bi-plus-lg" /> Add Room</Link> : null} />
      <form className="filter-bar row g-2 align-items-end" onSubmit={(e) => { e.preventDefault(); setQuery({ q: search, page: '', list: '' }); }}>
        <div className="col-12 col-lg-4"><label className="form-label">Search</label><input type="search" name="q" className="form-control" placeholder="Room number, tenant, phone..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <div className="col-6 col-lg-2"><label className="form-label">Mall</label><select name="mallId" className="form-select" value={query.mallId || ''} onChange={(e) => setQuery({ mallId: e.target.value, sectionId: '', page: '' })}><option value="">All malls</option>{data.malls.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
        <div className="col-6 col-lg-2"><label className="form-label">Section</label><select name="sectionId" className="form-select" disabled={!data.sections.length} value={data.sectionId || ''} onChange={(e) => setQuery({ sectionId: e.target.value, page: '' })}>
          <option value="">{data.sections.length ? 'All sections' : 'No sections'}</option>{data.sections.map((s) => <option key={s.id} value={s.id}>{query.mallId ? '' : s.mallName + ' · '}Section {s.name}</option>)}</select></div>
        <div className="col-6 col-lg-2"><label className="form-label">Kind</label><select name="category" className="form-select" value={query.category || ''} onChange={(e) => setQuery({ category: e.target.value, page: '' })}><option value="">Rooms + halls</option><option value="room">Rooms</option><option value="hall">Halls</option></select></div>
        <div className="col-6 col-lg-2"><label className="form-label">Room status</label><select name="status" className="form-select" value={query.status || ''} onChange={(e) => setQuery({ status: e.target.value, page: '' })}><option value="">Occupied + vacant</option><option value="occupied">Occupied</option><option value="vacant">Vacant</option></select></div>
        <div className="col-6 col-lg-2"><label className="form-label">Payment</label><select name="pay" className="form-select" value={query.pay || ''} onChange={(e) => setQuery({ pay: e.target.value, page: '' })}><option value="">Any payment status</option><option value="paid">Paid</option><option value="partial">Partially paid</option><option value="unpaid">Unpaid</option></select></div>
        <div className="col-6 col-lg-2"><label className="form-label">Month</label><MonthSelect className="form-select" value={m} onChange={(v) => setQuery({ month: v, year: y })} /></div>
        <div className="col-6 col-lg-2"><label className="form-label">Year</label><YearSelect className="form-select" value={y} onChange={(v) => setQuery({ year: v, month: m })} /></div>
        <div className="col-12 col-lg-3 d-flex gap-2"><button className="btn btn-primary"><i className="bi bi-search" /> Search</button><Link className="btn btn-light" to="/rooms">Reset</Link></div>
      </form>
      <div className="card">
        <div className="table-responsive"><table className="table table-hover" id="roomsTable">
          <thead><tr><th>Mall</th><th>Section</th><th>Room</th><th>Type</th><th>Tenant</th><th className="num">Rent</th><th>Status</th><th>{monthName(m, true)} Rent</th><th /></tr></thead>
          <tbody>
            {!data.rooms.length ? <Empty cols={9} text={query.q ? 'No rooms match your search.' : 'No rooms found.'} icon="bi-door-closed" /> : null}
            {data.rooms.map((r) => (
              <tr key={r.id}>
                <td>{r.mallName}</td><td>{r.category === 'hall' ? <span className="status status-occupied">Hall</span> : r.sectionName ? r.sectionName : <span className="text-muted">—</span>}</td>
                <td><Link className="cell-main" to={`/rooms/${r.id}`}>{r.roomNumber}</Link></td><td>{r.roomType}</td>
                <td>{r.tenantName ? <Person name={r.tenantName} sub={r.tenantPhone} /> : <span className="text-muted">—</span>}</td>
                <td className="num">{money(r.monthlyRent)}</td><td><UnitBadge status={r.status} /></td>
                <td>{r.rent ? <RentBadge status={r.rent.payStatus} /> : <span className="text-muted">-</span>}</td>
                <td className="table-actions">
                  <Link className="btn btn-sm btn-light" to={`/rooms/${r.id}`}>View</Link>
                  {can('manage') ? <Link className="btn btn-sm btn-light" to={`/rooms/${r.id}/edit`}><i className="bi bi-pencil" /> Edit</Link> : null}
                  <DeleteButton path={`/rooms/${r.id}`} message={`Delete room ${r.roomNumber}? Its payment records will also be deleted.`} onDone={reload} />
                </td>
              </tr>))}
          </tbody>
        </table></div>
        <Pager page={data.page} pages={data.pages} />
      </div>
    </Layout>
  );
}

export function RoomView({ params, query }) {
  const { can } = useApp();
  const { data, error } = useApi(`/rooms/${params.id}`);
  const [year, setYear] = useState(Number(query.year) || new Date().getFullYear());
  if (error) return <Layout title="Room"><LoadError error={error} /></Layout>;
  if (!data) return <Layout title="Room"><Loading /></Layout>;
  const { room: r, mall, section: sec, tenant: t } = data;
  const isHall = r.category === 'hall';
  const unitName = isHall ? r.roomNumber : `Room ${r.roomNumber}`;
  return (
    <Layout title={`${mall.name} — ${unitName}`}>
      {query.q ? (
        <div className="alert alert-info d-flex flex-wrap align-items-center gap-2 py-2 no-print" id="searchBanner">
          <i className="bi bi-search" /> Search result for <b>&ldquo;{query.q}&rdquo;</b>
          <Link className="ms-auto" to={`/rooms${qs({ q: query.q, list: 1 })}`}>Show all matches as a list</Link>
        </div>) : null}
      <PageHead title={`${mall.name} — ${unitName}`} actions={<>
        <Link className="btn btn-light" to={`/malls/${mall.id}`}><i className="bi bi-arrow-left" /> {mall.name}</Link>
        {can('manage') ? <Link className="btn btn-outline-primary" to={`/rooms/${r.id}/edit`}><i className="bi bi-pencil" /> Edit / Assign tenant</Link> : null}
        <Link className="btn btn-outline-secondary" to={`/history${qs({ unit: 'room:' + r.id })}`}><i className="bi bi-clock-history" /> Payment History</Link>
        <DeleteButton path={`/rooms/${r.id}`} className="" message={`Delete ${isHall ? r.roomNumber : 'room ' + r.roomNumber}? Its payment records will also be deleted.`} onDone={(res) => navigate(`/malls/${res.mallId}`)} />
      </>} />
      <div className="card"><div className="card-body"><div className="dl-grid">
        <div><div className="k">Mall</div><div className="v">{mall.name}</div></div>
        {isHall ? <div><div className="k">Kind</div><div className="v">Hall</div></div>
          : <div><div className="k">Section</div><div className="v">{sec ? <Link to={`/malls/${mall.id}?section=${sec.id}#rooms`}>Section {sec.name}</Link> : '—'}</div></div>}
        <div><div className="k">{isHall ? 'Hall' : 'Room number'}</div><div className="v">{r.roomNumber}</div></div>
        <div><div className="k">Name / type</div><div className="v">{r.roomType || '-'}</div></div>
        <div><div className="k">Tenant</div><div className="v">{t ? <Link to={`/tenants/${t.id}`}>{t.fullName}</Link> : '-'}</div></div>
        <div><div className="k">Tenant phone</div><div className="v">{t && t.phone ? t.phone : '-'}</div></div>
        <div><div className="k">Monthly rent</div><div className="v">{money(r.monthlyRent)}</div></div>
        <div><div className="k">Status</div><div><UnitBadge status={r.status} /></div></div>
        {r.notes ? <div style={{ gridColumn: '1/-1' }}><div className="k">Notes</div><div style={{ whiteSpace: 'pre-line' }}>{r.notes}</div></div> : null}
      </div></div></div>
      <UnitPanel type="room" id={r.id} year={year} onYear={setYear} />
    </Layout>
  );
}

export function RoomForm({ params, query }) {
  const { toast, can } = useApp();
  const editing = !!params.id;
  const { data } = useApi(editing ? `/rooms/${params.id}` : null);
  const { data: lists } = useApi('/lookups');
  const f = useForm({ mallId: query.mallId || '', category: query.category === 'hall' ? 'hall' : 'room', sectionId: query.sectionId || '', roomNumber: '', roomType: '', monthlyRent: '', tenantId: '', notes: '', newTenantName: '', newTenantPhone: '' });
  useEffect(() => { if (data) f.setValues((v) => ({ ...v, ...data.room, monthlyRent: data.room.monthlyRent, sectionId: data.room.sectionId || '', tenantId: data.room.tenantId || '' })); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (lists && !f.values.mallId && lists.malls.length === 1) f.setValues((v) => ({ ...v, mallId: lists.malls[0].id })); }, [lists]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!can('manage')) return <Layout title="Room"><LoadError error={{ status: 403, message: 'You do not have permission to add or edit rooms.' }} /></Layout>;
  if ((editing && !data) || !lists) return <Layout title="Room"><Loading /></Layout>;
  const sections = lists.sections.filter((s) => s.mallId === f.values.mallId);
  const isHall = f.values.category === 'hall';
  const what = isHall ? 'Hall' : 'Room';
  const save = f.submit(async (v) => {
    const r = await api(editing ? `/rooms/${params.id}` : '/rooms', { method: editing ? 'PUT' : 'POST', body: v });
    toast(r.message); navigate(`/rooms/${r.id}`);
  });
  return (
    <Layout title={editing ? `Edit ${what}` : `Add ${what}`}>
      <PageHead title={editing ? `Edit ${isHall ? data.room.roomNumber : 'Room ' + data.room.roomNumber}` : `Add ${what}`} />
      <ErrorBox errors={f.errors} />
      <form className="card" style={{ maxWidth: 860 }} onSubmit={save} data-form="room">
        <div className="card-body"><div className="row g-3">
          <Field label="Mall" required className="col-md-6"><select id="mallSelect" className="form-select" required value={f.values.mallId} onChange={(e) => f.setValues((v) => ({ ...v, mallId: e.target.value, sectionId: '' }))}>
            <option value="">Select a mall…</option>{lists.malls.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
          <Field label="Kind" className="col-md-2"><select id="categorySelect" className="form-select" {...f.bind('category')}><option value="room">Room</option><option value="hall">Hall</option></select></Field>
          {isHall ? <div className="col-md-4 d-flex align-items-end"><div className="form-text mb-2">Halls belong to the mall, not to a section.</div></div> : (
            <Field label="Section" className="col-md-4" hint={f.values.mallId && !sections.length ? 'This mall has no sections.' : null}><select id="sectionSelect" className="form-select" disabled={!sections.length} {...f.bind('sectionId')}>
              <option value="">{sections.length ? '-- No section --' : 'No sections'}</option>{sections.map((s) => <option key={s.id} value={s.id}>Section {s.name}</option>)}</select></Field>)}
          <Field label={isHall ? 'Hall name' : 'Room number'} required className="col-md-4" hint={isHall ? 'Type A for "Hall A".' : null}><input name="roomNumber" className="form-control" maxLength={30} required placeholder={isHall ? 'e.g. A' : 'e.g. C-33'} {...f.bind('roomNumber')} /></Field>
          <Field label="Name / type" className="col-md-4"><input className="form-control" maxLength={50} placeholder="Shop, Office…" {...f.bind('roomType')} /></Field>
          <Field label="Monthly rent" required className="col-md-4"><div className="input-group"><span className="input-group-text">{currency()}</span><input type="number" step="0.01" min="0" className="form-control" required {...f.bind('monthlyRent')} /></div></Field>
          <div className="col-12"><TenantPicker values={f.values} setValues={f.setValues} /></div>
          <Field label="Notes" className="col-12"><textarea className="form-control" rows={2} {...f.bind('notes')} /></Field>
        </div></div>
        <div className="card-footer d-flex gap-2"><button className="btn btn-primary" disabled={f.busy}><i className="bi bi-save" /> Save</button><Link className="btn btn-light" to={editing ? `/rooms/${params.id}` : '/rooms'}>Cancel</Link></div>
      </form>
    </Layout>
  );
}
