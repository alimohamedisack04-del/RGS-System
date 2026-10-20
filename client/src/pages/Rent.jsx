import { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import UnitPanel from '../components/UnitPanel';
import { DeleteButton, Empty, ErrorBox, LoadError, Loading, Meter, MonthSelect, PageHead, Person, RentBadge, YearSelect } from '../components/ui';
import { api, qs, useApi } from '../lib/api';
import { useApp } from '../lib/app';
import { Link, navigate, setQuery } from '../lib/router';
import { currency, downloadCsv, fmtDate, initials, money, monthName, periodLabel, unitTypeLabel } from '../lib/format';
import { payPath, unitPath } from '../lib/units';

const thisPeriod = (q) => { const d = new Date(); return [Number(q.year) || d.getFullYear(), Number(q.month) || d.getMonth() + 1]; };

// ===================================================================== RENT COLLECTION
export function Collection({ query }) {
  const { can, confirm, toast, meta, loadMeta } = useApp();
  const [y, m] = thisPeriod(query);
  const { data, error, reload } = useApi('/rent' + qs({ year: y, month: m, type: query.type, mallId: query.mallId, sectionId: query.sectionId, status: query.status, q: query.q }));
  const [search, setSearch] = useState(query.q || '');
  const mark = (r, action) => {
    const msg = action === 'paid'
      ? `Mark ${r.code} (${r.tenantName || ''}) as PAID for ${periodLabel(y, m)}? A payment of ${money(r.remaining)} dated today will be recorded.`
      : `Mark ${r.code} as UNPAID for ${periodLabel(y, m)}? All payments for this month (${money(r.paid)}) will be deleted.`;
    confirm(msg, async () => {
      try { const res = await api('/payments/mark', { method: 'POST', body: { action, unit: r.key, year: y, month: m } }); toast(res.message, res.type || 'success'); reload(); loadMeta(); } catch (e) { toast(e.message, 'danger'); }
    }, action === 'paid' ? { okLabel: 'Mark as paid', okClass: 'btn-success' } : { okLabel: 'Mark as unpaid' });
  };
  const exportCsv = () => downloadCsv(`rent-collection-${y}-${String(m).padStart(2, '0')}.csv`, ['Type', 'Property', 'Unit', 'Tenant', 'Phone', 'Rent', 'Paid', 'Remaining', 'Status', 'Last payment'],
    data.rows.map((r) => [unitTypeLabel(r.unitType), r.location, r.code, r.tenantName, r.tenantPhone, r.rent, r.paid, r.remaining, r.payStatus, r.lastDate || '']));
  const s = data && data.summary;
  return (
    <Layout title="Rent Collection">
      <PageHead title="Rent Collection" sub={<>Who has paid for <b>{periodLabel(y, m)}</b> and who still owes</>}
        actions={<>
          <button className="btn btn-light" onClick={exportCsv} disabled={!data}><i className="bi bi-download" /> Export</button>
          <button className="btn btn-light" onClick={() => window.print()}><i className="bi bi-printer" /> Print</button>
          {can('pay') ? <Link className="btn btn-primary" to={`/payments/new${qs({ month: m, year: y })}`}><i className="bi bi-plus-lg" /> Record payment</Link> : null}
        </>} />
      <form className="filter-bar row g-2 align-items-end no-print" onSubmit={(e) => { e.preventDefault(); setQuery({ q: search }); }}>
        <div className="col-6 col-md-2"><label className="form-label">Month</label><MonthSelect className="form-select" value={m} onChange={(v) => setQuery({ month: v, year: y })} /></div>
        <div className="col-6 col-md-2"><label className="form-label">Year</label><YearSelect className="form-select" value={y} onChange={(v) => setQuery({ year: v, month: m })} /></div>
        <div className="col-6 col-md-2"><label className="form-label">Property type</label>
          <select className="form-select" name="type" value={query.type || ''} onChange={(e) => setQuery({ type: e.target.value })}>
            <option value="">All types</option><option value="room">Mall Rooms</option><option value="apartment">Apartments</option><option value="land">Lands</option></select></div>
        <div className="col-6 col-md-2"><label className="form-label">Mall</label>
          <select className="form-select" name="mallId" value={query.mallId || ''} onChange={(e) => setQuery({ mallId: e.target.value, sectionId: '' })}>
            <option value="">All malls</option>{meta.malls.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
        <div className="col-6 col-md-2"><label className="form-label">Status</label>
          <select className="form-select" name="status" value={query.status || ''} onChange={(e) => setQuery({ status: e.target.value })}>
            <option value="">All statuses</option><option value="paid">Paid</option><option value="partial">Partially paid</option><option value="unpaid">Unpaid</option></select></div>
        <div className="col-6 col-md-2"><label className="form-label">Section</label>
          <select className="form-select" name="sectionId" value={(data && data.filters.sectionId) || ''} disabled={!data || !data.sections.length} onChange={(e) => setQuery({ sectionId: e.target.value })}>
            <option value="">{data && data.sections.length ? 'All sections' : query.mallId ? 'No sections' : 'Choose a mall first'}</option>
            {data ? data.sections.map((x) => <option key={x.id} value={x.id}>Section {x.name}</option>) : null}</select></div>
        <div className="col-12 col-md-6"><label className="form-label">Search</label>
          <div className="input-group"><input type="search" className="form-control" placeholder="Unit or tenant" value={search} onChange={(e) => setSearch(e.target.value)} />
            <button className="btn btn-primary" type="submit"><i className="bi bi-search" /> Search</button></div></div>
      </form>
      {error ? <LoadError error={error} onRetry={reload} /> : !data ? <Loading /> : (
        <>
          <div className="summary-strip">
            <div><div className="lbl">Expected</div><div className="val">{money(s.expected)}</div></div>
            <div><div className="lbl">Collected</div><div className="val">{money(s.paid)}</div></div>
            <div><div className="lbl">Remaining</div><div className="val">{money(s.remaining)}</div></div>
            <div><div className="lbl"><span className="dot dot-paid" />Paid</div><div className="val">{s.paidUnits}</div></div>
            <div><div className="lbl"><span className="dot dot-partial" />Partial</div><div className="val">{s.partialUnits}</div></div>
            <div><div className="lbl"><span className="dot dot-unpaid" />Unpaid</div><div className="val">{s.unpaidUnits}</div></div>
          </div>
          <div className="card">
            <div className="card-header">{periodLabel(y, m)} <span className="card-sub">{data.rows.length} unit(s)</span><span className="ms-auto" style={{ minWidth: 200 }}><Meter pct={s.collectionRate} /></span></div>
            <div className="table-responsive"><table className="table table-hover" id="collectionTable">
              <thead><tr><th>Unit</th><th>Tenant</th><th className="num">Rent</th><th className="num">Paid</th><th className="num">Remaining</th><th>Status</th><th className="text-end no-print">Actions</th></tr></thead>
              <tbody>
                {!data.rows.length ? <Empty cols={7} text="No rented units match your filters." icon="bi-search" /> : null}
                {data.rows.map((r) => (
                  <tr key={r.key} data-unit={r.code}>
                    <td><Link className="cell-main" to={unitPath(r.unitType, r.unitId)}>{r.code}</Link>
                      <div className="cell-sub">{unitTypeLabel(r.unitType, r.category)} · {r.location || '-'}{r.sectionName ? ' · Section ' + r.sectionName : ''}</div></td>
                    <td><Person name={r.tenantName} sub={r.tenantPhone} /></td>
                    <td className="num">{money(r.rent)}</td><td className="num">{money(r.paid)}</td>
                    <td className={`num ${r.remaining > 0 ? 'fw-600' : 'text-muted'}`}>{money(r.remaining)}</td>
                    <td className="st"><RentBadge status={r.payStatus} /></td>
                    <td className="table-actions no-print">
                      {r.payStatus !== 'paid' && can('pay') ? <>
                        <Link className="btn btn-sm btn-primary" to={payPath(r.key, y, m)}>Record</Link>
                        <button className="btn btn-sm btn-outline-success" data-act="markPaid" onClick={() => mark(r, 'paid')} title="Record the full remaining amount as paid today"><i className="bi bi-check2" /> Mark paid</button>
                      </> : null}
                      <Link className="btn btn-sm btn-light" to={`/history${qs({ unit: r.key, year: y })}`} title="Payment history"><i className="bi bi-clock-history" /> History</Link>
                      {r.paid > 0 && can('unpay') ? <button className="btn btn-sm btn-outline-danger" data-act="markUnpaid" onClick={() => mark(r, 'unpaid')}><i className="bi bi-arrow-counterclockwise" /> Mark unpaid</button> : null}
                    </td>
                  </tr>))}
              </tbody>
              {data.rows.length ? <tfoot><tr><td colSpan={2}>Total</td><td className="num">{money(s.expected)}</td><td className="num">{money(s.paid)}</td><td className="num">{money(s.remaining)}</td><td colSpan={2} /></tr></tfoot> : null}
            </table></div>
          </div>
        </>
      )}
    </Layout>
  );
}

// ===================================================================== RECORD PAYMENT
export function RecordPayment({ query }) {
  const { toast, loadMeta, can } = useApp();
  const [y0, m0] = thisPeriod(query);
  const today = new Date(); const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [f, setF] = useState({ unit: query.unit || '', month: m0, year: y0, amount: '', paymentDate: iso, paymentMethod: 'Cash', reference: '', notes: '' });
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const { data: list } = useApi('/units/payable');
  const [st, setSt] = useState(null);
  useEffect(() => {
    if (!f.unit) { setSt(null); return; }
    const [t, id] = f.unit.split(':');
    let live = true;
    api(`/units/${t}/${id}/status${qs({ year: f.year, month: f.month })}`).then((d) => {
      if (!live) return;
      setSt(d);
      setF((x) => (x.amount === '' && d.remaining > 0 ? { ...x, amount: d.remaining.toFixed(2) } : x));
    }, () => live && setSt({ error: true }));
    return () => { live = false; };
  }, [f.unit, f.month, f.year]);
  const groups = useMemo(() => {
    const g = { room: [], apartment: [], land: [] };
    for (const u of (list ? list.units : [])) g[u.unitType].push(u);
    return g;
  }, [list]);
  if (!can('pay')) return <Layout title="Record Payment"><LoadError error={{ status: 403, message: 'You do not have permission to record payments.' }} /></Layout>;
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErrors([]);
    try {
      const r = await api('/payments', { method: 'POST', body: f });
      toast(r.message);
      loadMeta();
      navigate(`/receipts/${r.payment.id}`);
    } catch (err) { setErrors(err.errors || [err.message]); window.scrollTo(0, 0); } finally { setBusy(false); }
  };
  const pct = st && st.rent > 0 ? Math.min(100, Math.round((st.paid / st.rent) * 100)) : 0;
  return (
    <Layout title="Record Payment">
      <PageHead title="Record Payment" sub="Select the unit and month — the status (Paid / Partial / Unpaid) is calculated automatically." />
      <ErrorBox errors={errors} />
      <div className="row g-3">
        <div className="col-lg-7">
          <form className="card" id="paymentForm" onSubmit={submit}>
            <div className="card-body"><div className="row g-3">
              <div className="col-12"><div className="form-section-title mb-0">1 · Unit and month</div></div>
              <div className="col-12"><label className="form-label required" htmlFor="unitSelect">Room / Apartment / Land</label>
                <select id="unitSelect" className="form-select" value={f.unit} onChange={(e) => setF((x) => ({ ...x, unit: e.target.value, amount: '' }))} required>
                  <option value="">Select a unit…</option>
                  {[['room', 'Mall Rooms'], ['apartment', 'Apartments'], ['land', 'Lands']].map(([g, l]) => (groups[g].length ? (
                    <optgroup key={g} label={l}>{groups[g].map((u) => <option key={u.key} value={u.key}>{u.label} — {u.tenantName || 'No tenant'}</option>)}</optgroup>) : null))}
                </select></div>
              <div className="col-6"><label className="form-label required">Month</label><MonthSelect className="form-select" value={f.month} onChange={(v) => setF((x) => ({ ...x, month: v, amount: '' }))} /></div>
              <div className="col-6"><label className="form-label required">Year</label><YearSelect className="form-select" value={f.year} onChange={(v) => setF((x) => ({ ...x, year: v, amount: '' }))} /></div>
              <div className="col-12 pt-2"><div className="form-section-title mb-0">2 · Payment</div></div>
              <div className="col-md-6"><label className="form-label required" htmlFor="amountInput">Amount paid</label>
                <div className="input-group"><span className="input-group-text">{currency()}</span><input type="number" step="0.01" min="0.01" id="amountInput" className="form-control" required value={f.amount} onChange={set('amount')} /></div>
                {st && st.remaining > 0 ? <button type="button" className="btn btn-link btn-sm px-0" onClick={() => setF((x) => ({ ...x, amount: st.remaining.toFixed(2) }))}>Use remaining amount</button> : null}</div>
              <div className="col-md-6"><label className="form-label required">Payment date</label><input type="date" className="form-control" required value={f.paymentDate} onChange={set('paymentDate')} /></div>
              <div className="col-md-6"><label className="form-label">Payment method</label>
                <select className="form-select" value={f.paymentMethod} onChange={set('paymentMethod')}>{(list ? list.methods : ['Cash']).map((x) => <option key={x} value={x}>{x === 'Bank' ? 'Bank transfer' : x}</option>)}</select></div>
              <div className="col-md-6"><label className="form-label">Reference no. <span className="text-muted fw-normal">(optional)</span></label><input className="form-control" maxLength={100} value={f.reference} onChange={set('reference')} placeholder="e.g. EVC transaction ID" /></div>
              <div className="col-12"><label className="form-label">Notes</label><input className="form-control" maxLength={255} value={f.notes} onChange={set('notes')} /></div>
            </div></div>
            <div className="card-footer d-flex gap-2">
              <button type="submit" className="btn btn-primary" id="savePay" disabled={busy}><i className="bi bi-check2-circle" /> {busy ? 'Saving…' : 'Save payment'}</button>
              <Link className="btn btn-light" to={`/collection${qs({ month: f.month, year: f.year })}`}>Cancel</Link>
            </div>
          </form>
        </div>
        <div className="col-lg-5"><div className="card" id="unitInfo">
          <div className="card-header">Rent status</div>
          <div className="card-body" id="unitInfoBody">
            {!st ? <div className="empty"><i className="bi bi-cursor fs-3 d-block mb-2" />Select a unit to see the rent, the amount already paid and the balance.</div>
              : st.error ? <div className="text-danger">Unit not found.</div> : (
                <>
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <div className="person"><span className="avatar">{initials(st.unit.tenantName)}</span><div><div className="cell-main">{st.unit.tenantName || '—'}</div><div className="cell-sub">{st.unit.label}</div></div></div>
                    <RentBadge status={st.status} /></div>
                  <div className="kpi-label">Remaining for {periodLabel(st.year, st.month)}</div><div className="kpi-value mb-2" id="remainingVal">{money(st.remaining)}</div>
                  <div className="meter-row"><div className={`meter sm${pct >= 100 ? ' good' : ''}`}><span style={{ width: pct + '%' }} /></div><span className="pct">{pct}%</span></div>
                  <table className="table table-sm mt-3 mb-0"><tbody>
                    <tr><td className="text-muted">Monthly rent</td><td className="num">{money(st.rent)}</td></tr>
                    <tr><td className="text-muted">Already paid</td><td className="num">{money(st.paid)}</td></tr>
                  </tbody></table>
                  {st.remaining <= 0 ? <div className="alert alert-success py-2 mt-3 mb-0 small">Rent for {periodLabel(st.year, st.month)} is fully paid.</div> : null}
                </>)}
          </div>
        </div></div>
      </div>
    </Layout>
  );
}

// ===================================================================== RECEIPT
export function Receipt({ params }) {
  const { data, error } = useApi(`/payments/${params.id}`);
  if (error) return <Layout title="Receipt"><LoadError error={error} /></Layout>;
  if (!data) return <Loading />;
  const p = data.payment, s = data.settings, u = data.unit;
  const total = data.paidUpTo;
  return (
    <div className="container py-3">
      <div className="d-flex flex-wrap justify-content-center gap-2 no-print mb-2">
        <button className="btn btn-primary" onClick={() => window.print()}><i className="bi bi-printer" /> Print receipt</button>
        <Link className="btn btn-outline-secondary" to={`/collection${qs({ month: p.periodMonth, year: p.periodYear })}`}><i className="bi bi-cash-coin" /> Rent Collection</Link>
        <Link className="btn btn-outline-secondary" to="/payments/new"><i className="bi bi-plus-circle" /> Record another</Link>
        <Link className="btn btn-outline-secondary" to="/"><i className="bi bi-speedometer2" /> Dashboard</Link>
      </div>
      <div className="receipt" id="receipt">
        <div className="receipt-top">
          <div className="d-flex gap-3 align-items-center">
            <img className="receipt-logo" src="/img/rgs-logo.svg" alt={s.company_name} />
            <div><div className="co">{s.company_name}</div><div className="co-sub">Property Management System</div>
              <div className="co-sub">{s.company_address}{s.company_phone ? ' · ' + s.company_phone : ''}</div></div>
          </div>
          <div className="rno"><div className="k">Receipt</div><div className="v">{p.receiptNo}</div><div className="co-sub">{fmtDate(p.paymentDate)}</div></div>
        </div>
        <div className="receipt-amount">
          <div><div className="k">Amount paid</div><div className="v">{money(p.amountPaid)}</div></div>
          <div className="text-end"><div className="k mb-1">Status for the month</div><span id="rcStatus"><RentBadge status={data.status} /></span></div>
        </div>
        <div className="receipt-body"><table><tbody>
          <tr><td>Tenant</td><td>{p.tenantName || '-'}{data.tenantPhone ? <div className="cell-sub">{data.tenantPhone}</div> : null}</td></tr>
          <tr><td>Property</td><td>{unitTypeLabel(p.unitType, u && u.category)} · {u ? u.location || '-' : '-'}</td></tr>
          <tr><td>Unit</td><td>{u ? u.code : p.unitLabel}</td></tr>
          <tr><td>Rent month</td><td>{periodLabel(p.periodYear, p.periodMonth)}</td></tr>
          <tr><td>Monthly rent</td><td>{money(p.rentAmount)}</td></tr>
          {total - p.amountPaid > 0 ? <tr><td>Total paid this month</td><td>{money(total)}</td></tr> : null}
          <tr><td>Remaining</td><td id="rcRem" className={data.remaining > 0 ? 'text-danger' : ''}>{money(data.remaining)}</td></tr>
          <tr><td>Payment method</td><td>{p.paymentMethod || '-'}{p.reference ? ' · ' + p.reference : ''}</td></tr>
          <tr><td>Received by</td><td>{p.receivedByName || '-'}</td></tr>
        </tbody></table></div>
        <div className="receipt-sign"><div>Tenant signature</div><div>Cashier signature</div></div>
        <div className="receipt-foot">{s.receipt_footer}<br />Printed {fmtDate(data.printedAt, true)}</div>
      </div>
    </div>
  );
}

// ===================================================================== PAYMENTS LIST
export function Payments({ query }) {
  const { meta } = useApp();
  const year = Number(query.year) || new Date().getFullYear();
  const month = Number(query.month) || 0;
  const params = { year, month: month || '', type: query.type, mallId: query.mallId, status: query.status, q: query.q, from: query.from, to: query.to };
  const { data, error, reload } = useApi('/payments' + qs({ ...params, page: query.page }));
  const [search, setSearch] = useState(query.q || '');
  const exportCsv = async () => {
    const all = await api('/payments' + qs({ ...params, all: 1 }));
    downloadCsv(`payments-${year}${month ? '-' + month : ''}.csv`, ['Receipt', 'Payment date', 'Type', 'Unit', 'Tenant', 'Month', 'Rent', 'Amount paid', 'Month status', 'Method', 'Reference', 'Received by'],
      all.rows.map((p) => [p.receiptNo, p.paymentDate, unitTypeLabel(p.unitType), p.unitLabel, p.tenantName, periodLabel(p.periodYear, p.periodMonth), p.rentAmount, p.amountPaid, p.monthStatus, p.paymentMethod, p.reference, p.receivedByName]));
  };
  return (
    <Layout title="Payments">
      <PageHead title="Payments" sub={data ? <>{data.total} payment(s) · <b>{money(data.amount)}</b></> : null}
        actions={<><button className="btn btn-light" onClick={exportCsv}><i className="bi bi-download" /> Export</button><Link className="btn btn-primary" to="/payments/new"><i className="bi bi-plus-lg" /> Record payment</Link></>} />
      <form className="filter-bar row g-2 align-items-end" onSubmit={(e) => { e.preventDefault(); setQuery({ q: search, page: '' }); }}>
        <div className="col-6 col-md-2"><label className="form-label">Month</label><MonthSelect className="form-select" allLabel="All months" value={month} onChange={(v) => setQuery({ month: v || '', page: '' })} /></div>
        <div className="col-6 col-md-2"><label className="form-label">Year</label><YearSelect className="form-select" value={year} onChange={(v) => setQuery({ year: v, page: '' })} /></div>
        <div className="col-6 col-md-2"><label className="form-label">Type</label><select className="form-select" value={query.type || ''} onChange={(e) => setQuery({ type: e.target.value, page: '' })}><option value="">All types</option><option value="room">Mall Rooms</option><option value="apartment">Apartments</option><option value="land">Lands</option></select></div>
        <div className="col-6 col-md-2"><label className="form-label">Mall</label><select className="form-select" value={query.mallId || ''} onChange={(e) => setQuery({ mallId: e.target.value, page: '' })}><option value="">All malls</option>{meta.malls.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
        <div className="col-6 col-md-2"><label className="form-label">Month status</label><select className="form-select" value={query.status || ''} onChange={(e) => setQuery({ status: e.target.value, page: '' })}><option value="">Any</option><option value="paid">Paid</option><option value="partial">Partial</option></select></div>
        <div className="col-6 col-md-2"><label className="form-label">From</label><input type="date" className="form-control" value={query.from || ''} onChange={(e) => setQuery({ from: e.target.value, page: '' })} /></div>
        <div className="col-6 col-md-2"><label className="form-label">To</label><input type="date" className="form-control" value={query.to || ''} onChange={(e) => setQuery({ to: e.target.value, page: '' })} /></div>
        <div className="col-12 col-md-6"><label className="form-label">Search</label><div className="input-group"><input type="search" className="form-control" placeholder="Tenant, unit, receipt or reference" value={search} onChange={(e) => setSearch(e.target.value)} /><button className="btn btn-primary"><i className="bi bi-search" /> Search</button></div></div>
      </form>
      {error ? <LoadError error={error} onRetry={reload} /> : !data ? <Loading /> : (
        <div className="card"><div className="table-responsive"><table className="table table-hover" id="paymentsTable">
          <thead><tr><th>Receipt</th><th>Tenant</th><th>Unit · Month</th><th className="num">Amount</th><th>Status</th><th>Method</th><th className="text-end">Actions</th></tr></thead>
          <tbody>
            {!data.rows.length ? <Empty cols={7} text="No payments match your filters." icon="bi-receipt" /> : null}
            {data.rows.map((p) => (
              <tr key={p.id}>
                <td className="nowrap"><Link className="cell-main" to={`/receipts/${p.id}`}>{p.receiptNo}</Link><div className="cell-sub">{fmtDate(p.paymentDate)}</div></td>
                <td><Person name={p.tenantName} sub={p.receivedByName ? 'by ' + p.receivedByName : ''} /></td>
                <td className="min-w-0"><div className="cell-main">{p.unitLabel}</div><div className="cell-sub">{monthName(p.periodMonth, true)} {p.periodYear}</div></td>
                <td className="num"><b>{money(p.amountPaid)}</b><div className="cell-sub">of {money(p.rentAmount)}</div></td>
                <td><RentBadge status={p.monthStatus} /></td>
                <td className="small">{p.paymentMethod || '-'}{p.reference ? <div className="cell-sub">{p.reference}</div> : null}</td>
                <td className="table-actions text-end">
                  <Link className="btn btn-sm btn-light" to={`/receipts/${p.id}`}><i className="bi bi-printer" /> Receipt</Link>
                  <DeleteButton perm="unpay" path={`/payments/${p.id}`} message={`Delete payment ${p.receiptNo} (${money(p.amountPaid)})? The month status will be recalculated.`} onDone={reload} />
                </td>
              </tr>))}
          </tbody>
        </table></div>
          <Pager page={data.page} pages={data.pages} />
        </div>
      )}
    </Layout>
  );
}

export function Pager({ page, pages }) {
  if (pages <= 1) return null;
  const items = [];
  for (let p = Math.max(1, page - 3); p <= Math.min(pages, page + 3); p++) items.push(p);
  return (
    <div className="card-footer d-flex justify-content-end"><nav><ul className="pagination pagination-sm mb-0 flex-wrap">
      <li className={`page-item${page <= 1 ? ' disabled' : ''}`}><button className="page-link" onClick={() => setQuery({ page: page - 1 })}>&laquo;</button></li>
      {items.map((p) => <li key={p} className={`page-item${p === page ? ' active' : ''}`}><button className="page-link" onClick={() => setQuery({ page: p })}>{p}</button></li>)}
      <li className={`page-item${page >= pages ? ' disabled' : ''}`}><button className="page-link" onClick={() => setQuery({ page: page + 1 })}>&raquo;</button></li>
    </ul></nav></div>
  );
}

// ===================================================================== PAYMENT HISTORY
export function History({ query }) {
  const { meta } = useApp();
  const year = Number(query.year) || new Date().getFullYear();
  const { data: all } = useApi('/units/all');
  if (query.unit) {
    const [type, id] = query.unit.split(':');
    const u = all && all.units.find((x) => x.key === query.unit);
    return (
      <Layout title="Payment History" crumb="Payment History">
        <PageHead title={'Payment History' + (u ? ' — ' + u.label : '')} actions={<>
          <Link className="btn btn-light" to={`/history${qs({ year })}`}><i className="bi bi-arrow-left" /> All history</Link>
          <Link className="btn btn-outline-secondary" to={unitPath(type, id)}><i className="bi bi-eye" /> View unit</Link>
          <button className="btn btn-outline-secondary" onClick={() => window.print()}><i className="bi bi-printer" /> Print</button></>} />
        <UnitPicker units={all ? all.units : []} value={query.unit} onChange={(k) => setQuery({ unit: k })} />
        {u ? <div className="card"><div className="card-body d-flex flex-wrap gap-4">
          <div><div className="small text-muted">Unit</div><div className="cell-main">{u.label}</div></div>
          <div><div className="small text-muted">Type</div><div className="cell-main">{unitTypeLabel(u.unitType)}</div></div>
          <div><div className="small text-muted">Tenant</div><div className="cell-main">{u.tenantName || '-'}</div></div>
          <div><div className="small text-muted">Phone</div><div className="cell-main">{u.tenantPhone || '-'}</div></div>
          <div><div className="small text-muted">Monthly rent</div><div className="cell-main">{money(u.rent)}</div></div>
        </div></div> : null}
        <UnitPanel type={type} id={id} year={year} onYear={(yy) => setQuery({ year: yy })} />
      </Layout>
    );
  }
  return <HistoryList query={query} year={year} malls={meta.malls} units={all ? all.units : []} />;
}

function UnitPicker({ units, value, onChange }) {
  return (
    <div className="filter-bar row g-2 align-items-end no-print"><div className="col-md-8"><label className="form-label">Room / Apartment / Land</label>
      <select className="form-select" name="unit" value={value || ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose a unit to see its full history…</option>
        {units.map((u) => <option key={u.key} value={u.key}>{unitTypeLabel(u.unitType, u.category)} — {u.label}{u.tenantName ? ' — ' + u.tenantName : ''}</option>)}
      </select></div></div>
  );
}

function HistoryList({ query, year, malls, units }) {
  const month = Number(query.month) || 0;
  const { data, error, reload } = useApi('/history' + qs({ year, month: month || '', type: query.type, mallId: query.mallId, status: query.status, q: query.q, page: query.page }));
  const [search, setSearch] = useState(query.q || '');
  return (
    <Layout title="Payment History">
      <PageHead title="Payment History" sub="Month-by-month rent status. Choose a unit to see its 12-month history and receipts." />
      <UnitPicker units={units} value="" onChange={(k) => setQuery({ unit: k })} />
      <form className="filter-bar row g-2 align-items-end" onSubmit={(e) => { e.preventDefault(); setQuery({ q: search, page: '' }); }}>
        <div className="col-6 col-md-2"><label className="form-label">Month</label><MonthSelect className="form-select" allLabel="All months" value={month} onChange={(v) => setQuery({ month: v || '', page: '' })} /></div>
        <div className="col-6 col-md-2"><label className="form-label">Year</label><YearSelect className="form-select" value={year} onChange={(v) => setQuery({ year: v, page: '' })} /></div>
        <div className="col-6 col-md-2"><label className="form-label">Type</label><select className="form-select" value={query.type || ''} onChange={(e) => setQuery({ type: e.target.value, page: '' })}><option value="">All types</option><option value="room">Mall Rooms</option><option value="apartment">Apartments</option><option value="land">Lands</option></select></div>
        <div className="col-6 col-md-2"><label className="form-label">Mall</label><select className="form-select" value={query.mallId || ''} onChange={(e) => setQuery({ mallId: e.target.value, page: '' })}><option value="">All malls</option>{malls.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
        <div className="col-6 col-md-2"><label className="form-label">Status</label><select className="form-select" value={query.status || ''} onChange={(e) => setQuery({ status: e.target.value, page: '' })}><option value="">All statuses</option><option value="paid">Paid</option><option value="partial">Partial</option><option value="unpaid">Unpaid</option></select></div>
        <div className="col-12 col-md-6"><label className="form-label">Tenant or unit</label><div className="input-group"><input type="search" className="form-control" value={search} onChange={(e) => setSearch(e.target.value)} /><button className="btn btn-primary"><i className="bi bi-search" /> Search</button></div></div>
      </form>
      {error ? <LoadError error={error} onRetry={reload} /> : !data ? <Loading /> : (
        <div className="card">
          <div className="card-header">{data.total} row(s) <span className="card-sub">Expected {money(data.summary.expected)} · Paid {money(data.summary.paid)} · Remaining {money(data.summary.remaining)}</span></div>
          <div className="table-responsive"><table className="table table-hover">
            <thead><tr><th>Month</th><th>Unit</th><th>Tenant</th><th className="text-end">Rent</th><th className="text-end">Paid</th><th className="text-end">Remaining</th><th>Payment date</th><th>Status</th><th className="no-print" /></tr></thead>
            <tbody>
              {!data.rows.length ? <Empty cols={9} text="Nothing to show for these filters." /> : null}
              {data.rows.map((r) => (
                <tr key={`${r.key}-${r.year}-${r.month}`}>
                  <td className="nowrap">{monthName(r.month, true)} {r.year}</td>
                  <td><Link className="cell-main" to={`/history${qs({ unit: r.key, year: r.year })}`}>{r.code}</Link><div className="cell-sub">{r.location}</div></td>
                  <td><Person name={r.tenantName} /></td>
                  <td className="text-end">{money(r.rent)}</td><td className="text-end">{money(r.paid)}</td><td className="text-end">{money(r.remaining)}</td>
                  <td>{r.lastDate ? fmtDate(r.lastDate) : '-'}</td><td><RentBadge status={r.payStatus} /></td>
                  <td className="table-actions no-print"><Link className="btn btn-sm btn-light" to={`/history${qs({ unit: r.key, year: r.year })}`}>History</Link></td>
                </tr>))}
            </tbody>
          </table></div>
          <Pager page={data.page} pages={data.pages} />
        </div>
      )}
    </Layout>
  );
}
