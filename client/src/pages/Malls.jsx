import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import TrendChart, { ChartLegend } from '../components/TrendChart';
import { DeleteButton, Empty, ErrorBox, Field, LoadError, Loading, Meter, PageHead, Person, RentBadge, UnitBadge, MonthSelect, YearSelect, useForm } from '../components/ui';
import { api, qs, useApi } from '../lib/api';
import { useApp } from '../lib/app';
import { Link, getLoc, navigate, setQuery } from '../lib/router';
import { currency, money, monthName, periodLabel } from '../lib/format';
import { rentRange } from '../lib/fmtx';

const period = (q) => { const d = new Date(); return [Number(q.year) || d.getFullYear(), Number(q.month) || d.getMonth() + 1]; };

// ===================================================================== MALLS LIST
export function Malls({ query }) {
  const { can } = useApp();
  const [y, m] = period(query);
  const { data, error, reload } = useApi('/malls' + qs({ year: y, month: m, q: query.q }));
  const { loadMeta } = useApp();
  const [search, setSearch] = useState(query.q || '');
  return (
    <Layout title="Malls">
      <PageHead title="Malls" sub={data ? `${data.malls.length} mall(s) · ${periodLabel(y, m)}` : null}
        actions={<>
          <form className="d-flex flex-wrap flex-xl-nowrap gap-2" onSubmit={(e) => { e.preventDefault(); setQuery({ q: search }); }}>
            <input type="search" className="form-control" style={{ width: 180 }} placeholder="Search mall..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <MonthSelect className="form-select" value={m} onChange={(v) => setQuery({ month: v, year: y })} />
            <YearSelect className="form-select" value={y} onChange={(v) => setQuery({ year: v, month: m })} />
          </form>
          {can('manage') ? <Link className="btn btn-primary" to="/malls/new"><i className="bi bi-plus-lg" /> Add Mall</Link> : null}
        </>} />
      {error ? <LoadError error={error} onRetry={reload} /> : !data ? <Loading /> : (
        <div className="row g-3">
          {!data.malls.length ? (
            <div className="col-12"><div className="card"><div className="card-body text-center text-muted py-5">
              {query.q ? 'No malls match your search.' : 'No malls yet.'}
              {can('manage') && !query.q ? <div className="mt-3"><Link className="btn btn-primary" to="/malls/new"><i className="bi bi-plus-lg" /> Add a mall</Link></div> : null}
            </div></div></div>) : null}
          {data.malls.map((x) => (
            <div className="col-md-6 col-xl-4" key={x.id}><div className="card h-100">
              <div className="card-body">
                <h3 className="h5 mb-0"><Link to={`/malls/${x.id}`}>{x.name}</Link></h3>
                <div className="small text-muted"><i className="bi bi-geo-alt" /> {x.location || '-'}{x.sections ? ` · ${x.sections} sections` : ''}</div>
                <div className="row text-center g-2 my-3">
                  <div className="col-4"><div className="fw-bold fs-5">{x.totalRooms}</div><div className="small text-muted">Rooms</div></div>
                  <div className="col-4"><div className="fw-bold fs-5">{x.occupied}</div><div className="small text-muted">Occupied</div></div>
                  <div className="col-4"><div className="fw-bold fs-5">{x.vacant}</div><div className="small text-muted">Vacant</div></div>
                </div>
                {x.halls ? <div className="small mb-2"><span className="status status-occupied">{x.halls} halls</span> <span className="text-muted">{x.hallsOccupied} occupied · {x.halls - x.hallsOccupied} vacant</span></div> : null}
                <div className="small">
                  <div className="d-flex justify-content-between"><span>Full-occupancy income</span><strong>{money(x.potential)}</strong></div>
                  <div className="d-flex justify-content-between"><span>Expected ({monthName(m, true)})</span><strong>{money(x.expected)}</strong></div>
                  <div className="d-flex justify-content-between"><span>Rent income ({monthName(m, true)})</span><strong>{money(x.paid)}</strong></div>
                  <div className="d-flex justify-content-between"><span>Rent income {y} so far</span><strong>{money(x.incomeYear)}</strong></div>
                  <div className="d-flex justify-content-between"><span>Remaining</span><strong>{money(x.remaining)}</strong></div>
                </div>
              </div>
              <div className="card-footer d-flex gap-2">
                <Link className="btn btn-sm btn-outline-primary" to={`/malls/${x.id}${qs({ month: m, year: y })}#rooms`}><i className="bi bi-eye" /> View rooms</Link>
                <Link className="btn btn-sm btn-light" to={`/malls/${x.id}/sections`}><i className="bi bi-grid-3x3-gap" /> Sections</Link>
                {can('manage') ? <Link className="btn btn-sm btn-light" to={`/malls/${x.id}/edit`}><i className="bi bi-pencil" /> Edit</Link> : null}
                <span className="ms-auto"><DeleteButton path={`/malls/${x.id}`} message={`Delete "${x.name}"? ALL its rooms and their payment records will be deleted too. This cannot be undone.`} onDone={() => { reload(); loadMeta(); }} /></span>
              </div>
            </div></div>))}
        </div>
      )}
    </Layout>
  );
}

// ===================================================================== MALL VIEW
export function MallView({ params, query }) {
  const { can } = useApp();
  const [y, m] = period(query);
  const { data, error, reload } = useApi(`/malls/${params.id}/overview` + qs({ year: y, month: m, section: query.section, q: query.q, list: query.list }));
  const [search, setSearch] = useState(query.q || '');
  // Search found exactly one room -> open its page
  useEffect(() => { if (data && data.pick) navigate(`/rooms/${data.pick}${qs({ q: data.search, month: m, year: y })}`, { replace: true }); }, [data, m, y]);
  // Opened with #rooms (View rooms) -> jump to the rooms list
  useEffect(() => { if (data && getLoc().hash === '#rooms') { const el = document.getElementById('rooms'); if (el) el.scrollIntoView(); } }, [data]);
  if (error) return <Layout title="Mall"><LoadError error={error} onRetry={reload} /></Layout>;
  if (!data || data.pick) return <Layout title="Mall"><Loading /></Layout>;
  const { mall, sections, income: inc, rooms } = data;
  const cur = sections.find((s) => s.id === data.sectionId) || null;
  const title = mall.name + (cur ? ' — Section ' + cur.name : '');
  const occupied = rooms.filter((r) => r.tenantId).length;
  const tot = sections.reduce((a, s) => ({ rooms: a.rooms + s.rooms, occ: a.occ + s.occupied, pot: a.pot + s.potential, col: a.col + (data.collectedBySection[s.id] || 0) }), { rooms: 0, occ: 0, pot: 0, col: 0 });
  const roomsLink = (sid) => `/malls/${mall.id}${qs({ section: sid, month: m, year: y })}#rooms`;
  return (
    <Layout title={title}>
      <PageHead title={title} sub={<><i className="bi bi-geo-alt" /> {mall.location || '-'} · {data.totalRooms} rooms{sections.length ? ` in ${sections.length} sections` : ''}{mall.description ? ' · ' + mall.description : ''}</>}
        actions={<>
          <div className="d-flex gap-2"><MonthSelect value={m} onChange={(v) => setQuery({ month: v, year: y })} /><YearSelect value={y} onChange={(v) => setQuery({ year: v, month: m })} /></div>
          <Link className="btn btn-light btn-sm" to={`/malls/${mall.id}/sections`}><i className="bi bi-grid-3x3-gap" /> Sections</Link>
          {can('manage') ? <><Link className="btn btn-primary btn-sm" to={`/rooms/new${qs({ mallId: mall.id, sectionId: data.sectionId })}`}><i className="bi bi-plus-lg" /> Add room</Link>
            <Link className="btn btn-light btn-sm" to={`/rooms/new${qs({ mallId: mall.id, category: 'hall' })}`}><i className="bi bi-easel" /> Add hall</Link>
            <Link className="btn btn-light btn-sm" to={`/malls/${mall.id}/edit`}><i className="bi bi-pencil" /> Edit mall</Link></> : null}
        </>} />

      <div className="row g-3 mb-3">
        <div className="col-xl-7"><div className="card h-100 kpi-hero"><div className="kpi">
          <div className="kpi-top"><span className="kpi-label">Rent income — {periodLabel(y, m)}{cur ? ' · Section ' + cur.name : ''}</span><span className="kpi-icon ic-good"><i className="bi bi-wallet2" /></span></div>
          <div className="kpi-value" id="mallIncome">{money(inc.month)}</div>
          <div className="kpi-foot">collected of <b className="text-ink-2">{money(inc.expected)}</b> expected from occupied {data.halls.length ? 'rooms and halls' : 'rooms'} · {money(inc.potential)} at full occupancy{data.halls.length && !cur ? ` (rooms ${money(inc.potentialRooms)} + halls ${money(inc.potentialHalls)})` : ''}</div>
          <div className="mt-3"><Meter pct={inc.rate} /></div>
          <div className="row g-2 mt-2 small">
            <div className="col-4"><div className="text-muted"><span className="dot dot-paid" />Fully paid rooms</div><b id="fullRooms">{inc.paidUnits}</b> · {money(inc.fullAmount)}</div>
            <div className="col-4"><div className="text-muted"><span className="dot dot-partial" />Partially paid</div><b>{inc.partialUnits}</b> · {money(inc.partialAmount)}</div>
            <div className="col-4"><div className="text-muted"><span className="dot dot-unpaid" />Not paid yet</div><b>{inc.unpaidUnits}</b> · {money(inc.remaining)} due</div>
          </div>
          <div className="d-flex flex-wrap gap-4 mt-3 pt-3 border-top small">
            <div><div className="text-muted">Income {y} (Jan – {monthName(m, true)})</div><b id="yearIncome">{money(inc.year)}</b></div>
            <div><div className="text-muted">Total income (all time)</div><b>{money(inc.all)}</b></div>
            <div><div className="text-muted">Rooms</div><b>{rooms.length}</b> · {occupied} occupied · {rooms.length - occupied} vacant</div>
          </div>
        </div></div></div>
        <div className="col-xl-5"><div className="card h-100">
          <div className="card-header">Rent income by month <span className="card-sub">last 6 months</span><ChartLegend /></div>
          <div className="card-body pt-2"><TrendChart data={data.trend} /></div>
        </div></div>
      </div>

      {data.halls.length && !cur ? (
        <div className="card mb-3" id="halls">
          <div className="card-header">Halls <span className="card-sub">{data.halls.length} hall(s) · rent status for {periodLabel(y, m)}</span>
            {can('manage') ? <Link className="btn btn-sm btn-light ms-auto" to={`/rooms/new${qs({ mallId: mall.id, category: 'hall' })}`}><i className="bi bi-plus-lg" /> Add hall</Link> : null}</div>
          <div className="table-responsive"><table className="table table-hover" id="hallTable">
            <thead><tr><th>Hall</th><th>Tenant</th><th className="num">Monthly rent</th><th>Status</th><th>{monthName(m, true)} rent</th><th className="text-end">Actions</th></tr></thead>
            <tbody>{data.halls.map((h) => (
              <tr key={h.id} data-hall={h.roomNumber}>
                <td><Link className="cell-main" to={`/rooms/${h.id}`}>{h.roomNumber}</Link><div className="cell-sub">{h.roomType || 'Hall'}</div></td>
                <td>{h.tenantId ? <Person name={h.tenantName} sub={h.tenantPhone} href={`/tenants/${h.tenantId}`} onClick={(e) => { e.preventDefault(); navigate(`/tenants/${h.tenantId}`); }} /> : <span className="text-muted">—</span>}</td>
                <td className="num">{money(h.monthlyRent)}</td>
                <td><UnitBadge status={h.status} /></td>
                <td>{h.rent ? <><RentBadge status={h.rent.payStatus} />{h.rent.payStatus === 'partial' ? <div className="cell-sub">{money(h.rent.paid)} / {money(h.rent.rent)}</div> : null}</> : <span className="text-muted small">—</span>}</td>
                <td className="table-actions">
                  {h.rent && h.rent.payStatus !== 'paid' && can('pay') ? <Link className="btn btn-sm btn-primary" to={`/payments/new${qs({ unit: 'room:' + h.id, month: m, year: y })}`}>Record</Link> : null}
                  <Link className="btn btn-sm btn-light" to={`/history${qs({ unit: 'room:' + h.id, year: y })}`}><i className="bi bi-clock-history" /> History</Link>
                  {can('manage') ? <Link className="btn btn-sm btn-light" to={`/rooms/${h.id}/edit`}><i className="bi bi-pencil" /> {h.tenantId ? 'Edit' : 'Assign tenant'}</Link> : null}
                </td>
              </tr>))}</tbody>
          </table></div>
        </div>
      ) : null}

      {sections.length && cur ? (
        <div className="section-pills mb-3 no-print" id="sectionPills">
          <Link className="btn btn-sm btn-light" to={`/malls/${mall.id}${qs({ month: m, year: y })}`}><i className="bi bi-arrow-left" /> All sections</Link>
          {sections.map((s) => <Link key={s.id} className={`btn btn-sm ${s.id === cur.id ? 'btn-primary' : 'btn-light'}`} to={roomsLink(s.id)}>Section {s.name} <span className="opacity-75">({s.rooms})</span></Link>)}
        </div>
      ) : sections.length ? (
        <div className="card mb-3">
          <div className="card-header">Sections <span className="card-sub">{sections.length} sections · {periodLabel(y, m)}</span>
            {can('manage') ? <Link className="btn btn-sm btn-light ms-auto" to={`/malls/${mall.id}/sections`}><i className="bi bi-gear" /> Manage sections</Link> : null}</div>
          <div className="table-responsive"><table className="table table-hover" id="sectionTable">
            <thead><tr><th>Section</th><th className="num">Rooms</th><th className="num">Occupied</th><th className="num">Vacant</th><th style={{ minWidth: 140 }}>Occupancy</th><th className="num">Rent per room</th><th className="num">Full-occupancy income</th><th className="num">Collected {monthName(m, true)}</th><th /></tr></thead>
            <tbody>{sections.map((s) => (
              <tr key={s.id}>
                <td className="nowrap"><Link className="cell-main" to={roomsLink(s.id)}>Section {s.name}</Link>{s.description ? <div className="cell-sub">{s.description}</div> : null}</td>
                <td className="num fw-600">{s.rooms}</td><td className="num">{s.occupied}</td><td className="num">{s.vacant}</td>
                <td>{s.rooms ? <Meter pct={(s.occupied / s.rooms) * 100} cls="" /> : <span className="text-muted small">No rooms</span>}</td>
                <td className="num">{rentRange(s.minRent, s.maxRent)}</td><td className="num">{money(s.potential)}</td><td className="num">{money(data.collectedBySection[s.id] || 0)}</td>
                <td className="table-actions"><Link className="btn btn-sm btn-light" to={roomsLink(s.id)}>View rooms</Link></td>
              </tr>))}</tbody>
            <tfoot><tr><td>Total</td><td className="num">{tot.rooms}</td><td className="num">{tot.occ}</td><td className="num">{tot.rooms - tot.occ}</td><td>{tot.rooms ? <Meter pct={(tot.occ / tot.rooms) * 100} cls="" /> : null}</td><td /><td className="num">{money(tot.pot)}</td><td className="num">{money(tot.col)}</td><td /></tr></tfoot>
          </table></div>
        </div>
      ) : null}

      <div className="card" id="rooms" style={{ scrollMarginTop: 140 }}>
        <div className="card-header">{cur ? `Section ${cur.name} rooms` : 'Rooms'} <span className="card-sub">{rooms.length} room(s) · rent status for {periodLabel(y, m)}</span>
          <form className="ms-auto d-flex gap-2" onSubmit={(e) => { e.preventDefault(); setQuery({ q: search, list: '' }, { hash: '#rooms' }); }}>
            {sections.length ? <select className="form-select form-select-sm" aria-label="Section" value={data.sectionId || ''} onChange={(e) => setQuery({ section: e.target.value }, { hash: '#rooms' })}>
              <option value="">All sections</option>{sections.map((s) => <option key={s.id} value={s.id}>Section {s.name} ({s.rooms})</option>)}</select> : null}
            <input type="search" name="q" className="form-control form-control-sm" placeholder="Room no., tenant or phone" style={{ maxWidth: 200 }} value={search} onChange={(e) => setSearch(e.target.value)} />
            <button className="btn btn-sm btn-primary"><i className="bi bi-search" /> Search</button>
          </form></div>
        <div className="table-responsive"><table className="table table-hover">
          <thead><tr><th>Room</th>{sections.length ? <th>Section</th> : null}<th>Tenant</th><th className="num">Monthly rent</th><th>Room status</th><th>{monthName(m, true)} rent</th><th className="text-end">Actions</th></tr></thead>
          <tbody>
            {!rooms.length ? <Empty cols={sections.length ? 7 : 6} text={data.search ? 'No rooms match your search.' : 'No rooms here yet.'} icon="bi-door-closed" /> : null}
            {rooms.map((r) => (
              <tr key={r.id}>
                <td><Link className="cell-main" to={`/rooms/${r.id}`}>{r.roomNumber}</Link><div className="cell-sub">{r.roomType}</div></td>
                {sections.length ? <td>{r.sectionName ? 'Section ' + r.sectionName : <span className="text-muted">—</span>}</td> : null}
                <td>{r.tenantId ? <Person name={r.tenantName} sub={r.tenantPhone} href={`/tenants/${r.tenantId}`} onClick={(e) => { e.preventDefault(); navigate(`/tenants/${r.tenantId}`); }} /> : <span className="text-muted">—</span>}</td>
                <td className="num">{money(r.monthlyRent)}</td>
                <td><UnitBadge status={r.status} /></td>
                <td>{r.rent ? <><RentBadge status={r.rent.payStatus} />{r.rent.payStatus === 'partial' ? <div className="cell-sub">{money(r.rent.paid)} / {money(r.rent.rent)}</div> : null}</> : <span className="text-muted small">—</span>}</td>
                <td className="table-actions">
                  {r.rent && r.rent.payStatus !== 'paid' && can('pay') ? <Link className="btn btn-sm btn-primary" to={`/payments/new${qs({ unit: 'room:' + r.id, month: m, year: y })}`}>Record</Link> : null}
                  <Link className="btn btn-sm btn-light" to={`/history${qs({ unit: 'room:' + r.id, year: y })}`}><i className="bi bi-clock-history" /> History</Link>
                  {can('manage') ? <Link className="btn btn-sm btn-light" to={`/rooms/${r.id}/edit`}><i className="bi bi-pencil" /> {r.tenantId ? 'Edit' : 'Assign tenant'}</Link> : null}
                </td>
              </tr>))}
          </tbody>
        </table></div>
      </div>
    </Layout>
  );
}

// ===================================================================== MALL FORM
export function MallForm({ params }) {
  const { toast, loadMeta } = useApp();
  const editing = !!params.id;
  const { data, error } = useApi(editing ? `/malls/${params.id}` : null);
  const f = useForm({ name: '', location: '', description: '' });
  useEffect(() => { if (data) f.setValues(data.mall); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  if (error) return <Layout title="Mall"><LoadError error={error} /></Layout>;
  if (editing && !data) return <Layout title="Edit Mall"><Loading /></Layout>;
  const save = f.submit(async (v) => {
    const r = await api(editing ? `/malls/${params.id}` : '/malls', { method: editing ? 'PUT' : 'POST', body: v });
    toast(r.message); await loadMeta();
    navigate(editing ? `/malls/${r.id}` : `/malls/${r.id}/sections`);
  });
  return (
    <Layout title={editing ? 'Edit Mall' : 'Add Mall'}>
      <PageHead title={editing ? `Edit Mall: ${data.mall.name}` : 'Add Mall'} />
      <ErrorBox errors={f.errors} />
      <form className="card" style={{ maxWidth: 760 }} onSubmit={save} data-form="mall">
        <div className="card-body"><div className="row g-3">
          <Field label="Mall name" required><input className="form-control" maxLength={150} required {...f.bind('name')} /></Field>
          <Field label="Location"><input className="form-control" maxLength={255} {...f.bind('location')} /></Field>
          <Field label="Description" className="col-12"><textarea className="form-control" rows={3} {...f.bind('description')} /></Field>
        </div></div>
        <div className="card-footer d-flex gap-2"><button className="btn btn-primary" disabled={f.busy}><i className="bi bi-save" /> Save</button><Link className="btn btn-light" to={editing ? `/malls/${params.id}` : '/malls'}>Cancel</Link></div>
      </form>
    </Layout>
  );
}

// ===================================================================== SECTIONS
export function Sections({ params }) {
  const { can, toast } = useApp();
  const { data, error, reload } = useApi(`/malls/${params.id}/sections`);
  const f = useForm({ name: '', description: '', rooms: '', start: 1, rent: '', roomType: 'Shop' });
  if (error) return <Layout title="Sections"><LoadError error={error} onRetry={reload} /></Layout>;
  if (!data) return <Layout title="Sections"><Loading /></Layout>;
  const { mall, sections } = data;
  const tot = sections.reduce((a, s) => ({ rooms: a.rooms + s.rooms, occ: a.occ + s.occupied, pot: a.pot + s.potential }), { rooms: 0, occ: 0, pot: 0 });
  const add = f.submit(async (v) => {
    const r = await api(`/malls/${mall.id}/sections`, { method: 'POST', body: v });
    toast(r.message); f.setValues({ name: '', description: '', rooms: '', start: 1, rent: '', roomType: 'Shop' }); reload();
  });
  return (
    <Layout title={`${mall.name} — Sections`}>
      <PageHead title={`${mall.name} — Sections`} sub={`${sections.length} section(s) · ${tot.rooms} rooms in sections`}
        actions={<Link className="btn btn-light" to={`/malls/${mall.id}`}><i className="bi bi-arrow-left" /> Back to mall</Link>} />
      <div className="row g-3">
        <div className={can('manage') ? 'col-xl-8' : 'col-12'}><div className="card">
          <div className="card-header">Sections <span className="card-sub">full-occupancy income {money(tot.pot)} / month</span></div>
          <div className="table-responsive"><table className="table table-hover">
            <thead><tr><th>Section</th><th className="num">Rooms</th><th className="num">Occupied</th><th className="num">Rent per room</th><th className="num">Income / month</th><th className="text-end">Actions</th></tr></thead>
            <tbody>
              {!sections.length ? <Empty cols={6} text="No sections yet. Add the first section on the right." icon="bi-grid-3x3-gap" /> : null}
              {sections.map((s) => (
                <tr key={s.id} data-sec={s.name}>
                  <td className="nowrap"><Link className="cell-main" to={`/malls/${mall.id}?section=${s.id}#rooms`}>Section {s.name}</Link>{s.description ? <div className="cell-sub">{s.description}</div> : null}</td>
                  <td className="num fw-600">{s.rooms}</td><td className="num">{s.occupied} <span className="text-muted">/ {s.rooms}</span></td>
                  <td className="num">{rentRange(s.minRent, s.maxRent)}</td><td className="num">{money(s.potential)}</td>
                  <td className="table-actions">
                    <Link className="btn btn-sm btn-light" to={`/malls/${mall.id}?section=${s.id}#rooms`}><i className="bi bi-eye" /> Rooms</Link>
                    {can('manage') ? <Link className="btn btn-sm btn-light" to={`/sections/${s.id}`}><i className="bi bi-pencil" /> Edit</Link> : null}
                    <DeleteButton path={`/sections/${s.id}`} message={`Delete section ${s.name}? Its ${s.rooms} room(s) will stay in the mall without a section. (To remove the rooms too, delete them from the rooms list.)`} onDone={reload} />
                  </td>
                </tr>))}
            </tbody>
            {sections.length ? <tfoot><tr><td>Total</td><td className="num">{tot.rooms}</td><td className="num">{tot.occ} <span className="text-muted">/ {tot.rooms}</span></td><td /><td className="num">{money(tot.pot)}</td><td /></tr></tfoot> : null}
          </table></div>
        </div></div>
        {can('manage') ? (
          <div className="col-xl-4"><form className="card" onSubmit={add} data-form="sectionAdd">
            <div className="card-header">Add a section</div>
            <div className="card-body"><ErrorBox errors={f.errors} /><div className="row g-3">
              <Field label="Section name" required className="col-5"><input className="form-control" maxLength={30} required placeholder="e.g. I" {...f.bind('name')} /></Field>
              <Field label="Description" className="col-7"><input className="form-control" maxLength={255} placeholder="optional" {...f.bind('description')} /></Field>
              <div className="col-12"><div className="form-section-title mb-0">Create its rooms now</div></div>
              <Field label="Number of rooms" className="col-6"><input type="number" min="0" max="500" className="form-control" placeholder="e.g. 20" {...f.bind('rooms')} /></Field>
              <Field label="First number" className="col-6"><input type="number" min="1" className="form-control" {...f.bind('start')} /></Field>
              <Field label="Rent per room" className="col-6"><div className="input-group"><span className="input-group-text">{currency()}</span><input type="number" step="0.01" min="0" className="form-control" {...f.bind('rent')} /></div></Field>
              <Field label="Room type" className="col-6"><input className="form-control" maxLength={100} {...f.bind('roomType')} /></Field>
              <div className="col-12 form-text">Rooms are numbered automatically, e.g. section <b>I</b> with 20 rooms → I-01 … I-20. All new rooms start as vacant.</div>
            </div></div>
            <div className="card-footer"><button className="btn btn-primary" disabled={f.busy}><i className="bi bi-plus-lg" /> Add section</button></div>
          </form></div>
        ) : null}
      </div>
    </Layout>
  );
}

export function SectionEdit({ params }) {
  const { toast, can } = useApp();
  const { data, error, reload } = useApi(`/sections/${params.id}`);
  const [errors, setErrors] = useState([]);
  const [d, setD] = useState(null), [r, setR] = useState(null), [a, setA] = useState(null);
  useEffect(() => {
    if (!data) return;
    const s = data.section, rent = s.maxRent !== null ? Number(s.maxRent).toFixed(2) : '';
    setD({ name: s.name, description: s.description, sortOrder: s.sortOrder });
    setR({ rent, scope: 'all' });
    setA({ rooms: '', start: data.nextNumber, rent, roomType: 'Shop' });
  }, [data]);
  if (error) return <Layout title="Section"><LoadError error={error} onRetry={reload} /></Layout>;
  if (!data || !d) return <Layout title="Section"><Loading /></Layout>;
  if (!can('manage')) return <Layout title="Section"><LoadError error={{ status: 403, message: 'You do not have permission to change sections.' }} /></Layout>;
  const s = data.section, mall = data.mall;
  const send = (action, body) => async (e) => {
    e.preventDefault(); setErrors([]);
    try { const res = await api(`/sections/${s.id}`, { method: 'PUT', body: { action, ...body } }); toast(res.message); reload(); } catch (err) { setErrors(err.errors || [err.message]); window.scrollTo(0, 0); }
  };
  const bind = (state, setter, k) => ({ value: state[k] ?? '', onChange: (e) => setter((x) => ({ ...x, [k]: e.target.value })) });
  return (
    <Layout title={`${mall.name} — Section ${s.name}`}>
      <PageHead title={`${mall.name} — Section ${s.name}`} sub={`${s.rooms} rooms · ${s.occupied} occupied · rent ${rentRange(s.minRent, s.maxRent)} · income ${money(s.potential)} / month`}
        actions={<><Link className="btn btn-light" to={`/malls/${mall.id}/sections`}><i className="bi bi-arrow-left" /> All sections</Link>
          <Link className="btn btn-light" to={`/malls/${mall.id}?section=${s.id}#rooms`}><i className="bi bi-eye" /> View rooms</Link></>} />
      <ErrorBox errors={errors} />
      <div className="row g-3">
        <div className="col-lg-4"><form className="card h-100" onSubmit={send('details', d)} data-action="details">
          <div className="card-header">Section details</div>
          <div className="card-body">
            <div className="mb-3"><label className="form-label required">Section name</label><input className="form-control" maxLength={30} required {...bind(d, setD, 'name')} /></div>
            <div className="mb-3"><label className="form-label">Description</label><input className="form-control" maxLength={255} {...bind(d, setD, 'description')} /></div>
            <div><label className="form-label">Display order</label><input type="number" className="form-control" {...bind(d, setD, 'sortOrder')} /></div>
          </div>
          <div className="card-footer"><button className="btn btn-primary">Save details</button></div>
        </form></div>
        <div className="col-lg-4"><form className="card h-100" onSubmit={send('rent', r)} data-action="rent">
          <div className="card-header">Set rent for this section</div>
          <div className="card-body">
            <div className="mb-3"><label className="form-label required">New monthly rent per room</label><div className="input-group"><span className="input-group-text">{currency()}</span><input type="number" step="0.01" min="0" id="secRent" className="form-control" required {...bind(r, setR, 'rent')} /></div></div>
            <div className="form-check"><input className="form-check-input" type="radio" id="scAll" checked={r.scope === 'all'} onChange={() => setR((x) => ({ ...x, scope: 'all' }))} /><label className="form-check-label" htmlFor="scAll">All {s.rooms} rooms</label></div>
            <div className="form-check"><input className="form-check-input" type="radio" id="scVac" checked={r.scope === 'vacant'} onChange={() => setR((x) => ({ ...x, scope: 'vacant' }))} /><label className="form-check-label" htmlFor="scVac">Only the {s.vacant} vacant rooms</label></div>
            <div className="form-text mt-2">Months that already have payments keep the rent that was used then.</div>
          </div>
          <div className="card-footer"><button className="btn btn-primary">Update rent</button></div>
        </form></div>
        <div className="col-lg-4"><form className="card h-100" onSubmit={send('rooms', a)} data-action="rooms">
          <div className="card-header">Add more rooms</div>
          <div className="card-body"><div className="row g-3">
            <div className="col-6"><label className="form-label required">Number of rooms</label><input type="number" min="1" max="500" className="form-control" required {...bind(a, setA, 'rooms')} /></div>
            <div className="col-6"><label className="form-label">First number</label><input type="number" min="1" className="form-control" {...bind(a, setA, 'start')} /></div>
            <div className="col-6"><label className="form-label required">Rent per room</label><input type="number" step="0.01" min="0" className="form-control" required {...bind(a, setA, 'rent')} /></div>
            <div className="col-6"><label className="form-label">Room type</label><input className="form-control" {...bind(a, setA, 'roomType')} /></div>
            <div className="col-12 form-text">Next room will be <b>{s.name}-{String(data.nextNumber).padStart(2, '0')}</b>.</div>
          </div></div>
          <div className="card-footer"><button className="btn btn-primary"><i className="bi bi-plus-lg" /> Add rooms</button></div>
        </form></div>
      </div>
    </Layout>
  );
}
