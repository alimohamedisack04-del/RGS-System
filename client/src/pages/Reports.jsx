import Layout from '../components/Layout';
import ProfitLoss, { NetAmount, ResultBadge } from '../components/ProfitLoss';
import { Empty, Kpi, LoadError, Loading, Meter, MonthSelect, PageHead, Person, RentBadge, YearSelect } from '../components/ui';
import { api, qs, useApi } from '../lib/api';
import { useApp } from '../lib/app';
import { Link, navigate, setQuery } from '../lib/router';
import { downloadCsv, fmtDate, money, monthName, periodLabel, rateClass, shiftMonth, unitTypeLabel } from '../lib/format';

const period = (q) => { const d = new Date(); return [Number(q.year) || d.getFullYear(), Number(q.month) || d.getMonth() + 1]; };

function ReportNav({ active, year, month, onCsv }) {
  const { can, settings } = useApp();
  const tab = (key, to, label) => <li className="nav-item"><Link className={`nav-link${active === key ? ' active' : ''}`} to={to}>{label}</Link></li>;
  return (
    <>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3 no-print">
        <ul className="nav nav-pills">
          {tab('monthly', `/reports${qs({ month, year })}`, 'Monthly Rent')}
          {can('reports') ? tab('malls', `/reports/malls${qs({ month, year })}`, 'Malls') : null}
          {can('reports') ? tab('apartments', `/reports/apartments${qs({ month, year })}`, 'Apartments') : null}
          {tab('closings', '/statements', 'Monthly statements')}
        </ul>
        {active !== 'closings' ? <div className="d-flex gap-2 ms-md-3"><MonthSelect value={month} onChange={(v) => setQuery({ month: v, year })} /><YearSelect value={year} onChange={(v) => setQuery({ year: v, month })} /></div> : null}
        <div className="ms-auto d-flex gap-2">
          <button className="btn btn-sm btn-outline-secondary" onClick={() => window.print()}><i className="bi bi-printer" /> Print</button>
          <button className="btn btn-sm btn-outline-secondary" onClick={() => window.print()} title="In the print window choose 'Save as PDF'"><i className="bi bi-filetype-pdf" /> PDF</button>
          {onCsv ? <button className="btn btn-sm btn-outline-secondary" data-act="csvReport" onClick={onCsv}><i className="bi bi-filetype-csv" /> Excel / CSV</button> : null}
        </div>
      </div>
      <div className="print-only mb-3">
        <img src="/img/rgs-logo.svg" alt="" style={{ height: 36, width: 'auto', marginBottom: 8 }} />
        <h4 className="mb-0">{settings.company_name}</h4>
        {month ? <div>{periodLabel(year, month)} · Printed {fmtDate(new Date().toISOString().slice(0, 10))}</div> : null}
      </div>
    </>
  );
}

export function ReportMonthly({ query }) {
  const [y, m] = period(query);
  const { can } = useApp();
  const { data: d, error, reload } = useApi('/reports/monthly' + qs({ year: y, month: m }));
  const csv = () => downloadCsv(`monthly-rent-report-${y}-${String(m).padStart(2, '0')}.csv`, ['Type', 'Property', 'Unit', 'Tenant', 'Rent', 'Paid', 'Remaining', 'Status'],
    [['SUMMARY', periodLabel(y, m)], ['Total Expected Rent', d.summary.expected], ['Total Paid', d.summary.paid], ['Total Remaining', d.summary.remaining], ['Expenses', d.expenses], ['Salaries', d.salaries], ['Net Income (paid - expenses - salaries)', d.net], ['Result', d.net > 0 ? 'Profit' : d.net < 0 ? 'Loss' : 'Break-even'], [],
      ...d.rows.map((r) => [unitTypeLabel(r.unitType), r.location, r.code, r.tenantName, r.rent, r.paid, r.remaining, r.payStatus])]);
  const s = d && d.summary;
  return (
    <Layout title="Monthly Rent Report" crumb="Reports">
      <PageHead title="Monthly Rent Report" />
      <ReportNav active="monthly" year={y} month={m} onCsv={d ? csv : null} />
      {error ? <LoadError error={error} onRetry={reload} /> : !d ? <Loading /> : (
        <div id="printArea">
          <ProfitLoss f={d.finance} year={y} month={m} can={can} id="reportProfitLoss" />
          <div className="row g-3 mb-3">
            {[['Total Expected Rent', money(s.expected)], ['Total Paid', money(s.paid)], ['Total Unpaid (nothing paid)', money(s.unpaid)], ['Total Remaining', money(s.remaining)],
              ['Paid Units', s.paidUnits], ['Unpaid Units', s.unpaidUnits], ['Partially Paid Units', s.partialUnits], ['Collection Rate', s.collectionRate + '%']].map(([l, v]) => (
              <div className="col-6 col-lg-3" key={l}><div className="card h-100"><div className="card-body"><div className="kpi-label">{l}</div><div className="kpi-value">{v}</div></div></div></div>))}
          </div>
          <div className="card mb-3"><div className="card-header">By property type</div>
            <div className="table-responsive"><table className="table">
              <thead><tr><th>Type</th><th className="text-end">Units</th><th className="text-end">Expected</th><th className="text-end">Paid</th><th className="text-end">Remaining</th><th className="text-end">Paid</th><th className="text-end">Partial</th><th className="text-end">Unpaid</th></tr></thead>
              <tbody>{d.byType.map((t) => <tr key={t.type}><td>{{ room: 'Mall Rooms', apartment: 'Apartments', land: 'Lands' }[t.type]}</td><td className="text-end">{t.units}</td><td className="text-end">{money(t.expected)}</td><td className="text-end">{money(t.paid)}</td><td className="text-end">{money(t.remaining)}</td><td className="text-end">{t.paidUnits}</td><td className="text-end">{t.partialUnits}</td><td className="text-end">{t.unpaidUnits}</td></tr>)}</tbody>
              <tfoot className="table-light fw-bold"><tr><td>Total</td><td className="text-end">{s.units}</td><td className="text-end">{money(s.expected)}</td><td className="text-end">{money(s.paid)}</td><td className="text-end">{money(s.remaining)}</td><td className="text-end">{s.paidUnits}</td><td className="text-end">{s.partialUnits}</td><td className="text-end">{s.unpaidUnits}</td></tr></tfoot>
            </table></div></div>
          <div className="card"><div className="card-header">Unit details — {periodLabel(y, m)}</div>
            <div className="table-responsive"><table className="table table-sm table-hover">
              <thead><tr><th>Type</th><th>Property</th><th>Unit</th><th>Tenant</th><th className="text-end">Rent</th><th className="text-end">Paid</th><th className="text-end">Remaining</th><th>Status</th></tr></thead>
              <tbody>
                {!d.rows.length ? <Empty cols={8} text="No rented units for this month." /> : null}
                {d.rows.map((r) => <tr key={r.key}><td>{unitTypeLabel(r.unitType)}</td><td>{r.location}</td><td>{r.code}</td><td><Person name={r.tenantName} /></td><td className="text-end">{money(r.rent)}</td><td className="text-end">{money(r.paid)}</td><td className="text-end">{money(r.remaining)}</td><td><RentBadge status={r.payStatus} /></td></tr>)}
              </tbody>
            </table></div></div>
        </div>
      )}
    </Layout>
  );
}

export function ReportMalls({ query }) {
  const [y, m] = period(query);
  const { data: d, error, reload } = useApi('/reports/malls' + qs({ year: y, month: m }));
  const tot = d ? d.malls.reduce((a, x) => ({ rooms: a.rooms + x.totalRooms, occ: a.occ + x.occupied, vac: a.vac + x.vacant, pot: a.pot + x.potential, exp: a.exp + x.expected, paid: a.paid + x.paid, rem: a.rem + x.remaining }), { rooms: 0, occ: 0, vac: 0, pot: 0, exp: 0, paid: 0, rem: 0 }) : null;
  const csv = () => downloadCsv(`mall-report-${y}-${String(m).padStart(2, '0')}.csv`, ['Mall', 'Total Rooms', 'Occupied', 'Vacant', 'Full-occupancy income', 'Expected', 'Paid', 'Remaining', 'Paid units', 'Partial units', 'Unpaid units'],
    d.malls.map((x) => [x.name, x.totalRooms, x.occupied, x.vacant, x.potential, x.expected, x.paid, x.remaining, x.paidUnits, x.partialUnits, x.unpaidUnits]));
  return (
    <Layout title="Mall Report" crumb="Reports">
      <PageHead title="Mall Report" />
      <ReportNav active="malls" year={y} month={m} onCsv={d ? csv : null} />
      {error ? <LoadError error={error} onRetry={reload} /> : !d ? <Loading /> : (
        <div className="card" id="printArea"><div className="table-responsive"><table className="table table-hover">
          <thead><tr><th>Mall</th><th className="text-end">Total Rooms</th><th className="text-end">Occupied</th><th className="text-end">Vacant</th><th className="text-end">Full-occupancy income</th><th className="text-end">Expected Rent</th><th className="text-end">Paid Rent</th><th className="text-end">Remaining</th><th>Units (paid / partial / unpaid)</th></tr></thead>
          <tbody>
            {!d.malls.length ? <Empty cols={9} text="No malls." /> : null}
            {d.malls.map((x) => <tr key={x.id}><td><Link className="cell-main" to={`/malls/${x.id}${qs({ month: m, year: y })}`}>{x.name}</Link></td><td className="text-end">{x.totalRooms}</td><td className="text-end">{x.occupied}</td><td className="text-end">{x.vacant}</td><td className="text-end">{money(x.potential)}</td><td className="text-end">{money(x.expected)}</td><td className="text-end">{money(x.paid)}</td><td className="text-end">{money(x.remaining)}</td>
              <td><span className="dot dot-paid" />{x.paidUnits} &nbsp; <span className="dot dot-partial" />{x.partialUnits} &nbsp; <span className="dot dot-unpaid" />{x.unpaidUnits}</td></tr>)}
          </tbody>
          {d.malls.length ? <tfoot className="table-light fw-bold"><tr><td>Total</td><td className="text-end">{tot.rooms}</td><td className="text-end">{tot.occ}</td><td className="text-end">{tot.vac}</td><td className="text-end">{money(tot.pot)}</td><td className="text-end">{money(tot.exp)}</td><td className="text-end">{money(tot.paid)}</td><td className="text-end">{money(tot.rem)}</td><td /></tr></tfoot> : null}
        </table></div></div>
      )}
    </Layout>
  );
}

export function ReportApartments({ query }) {
  const [y, m] = period(query);
  const { data: d, error, reload } = useApi('/reports/apartments' + qs({ year: y, month: m }));
  const csv = () => downloadCsv(`apartment-report-${y}-${String(m).padStart(2, '0')}.csv`, ['Building', 'Apartment', 'Tenant', 'Rent', 'Paid', 'Remaining', 'Status'],
    d.rows.map((r) => [r.location, r.code, r.tenantName, r.rent, r.paid, r.remaining, r.payStatus]));
  return (
    <Layout title="Apartment Report" crumb="Reports">
      <PageHead title="Apartment Report" />
      <ReportNav active="apartments" year={y} month={m} onCsv={d ? csv : null} />
      {error ? <LoadError error={error} onRetry={reload} /> : !d ? <Loading /> : (
        <div id="printArea">
          <div className="card mb-3"><div className="table-responsive"><table className="table">
            <thead><tr><th>Building</th><th className="text-end">Apartments</th><th className="text-end">Occupied</th><th className="text-end">Vacant</th><th className="text-end">Expected</th><th className="text-end">Paid</th><th className="text-end">Remaining</th><th style={{ minWidth: 150 }}>Collection</th></tr></thead>
            <tbody>{d.buildings.map((b) => <tr key={b.name}><td className="cell-main">{b.name}</td><td className="text-end">{b.total}</td><td className="text-end">{b.occupied}</td><td className="text-end">{b.vacant}</td><td className="text-end">{money(b.expected)}</td><td className="text-end">{money(b.paid)}</td><td className="text-end">{money(b.remaining)}</td><td><Meter pct={b.collectionRate} cls={rateClass(b.collectionRate)} /></td></tr>)}</tbody>
          </table></div></div>
          <div className="card"><div className="card-header">Apartments — {periodLabel(y, m)}</div><div className="table-responsive"><table className="table table-sm table-hover">
            <thead><tr><th>Building</th><th>Apartment</th><th>Tenant</th><th className="text-end">Rent</th><th className="text-end">Paid</th><th className="text-end">Remaining</th><th>Status</th></tr></thead>
            <tbody>{d.rows.map((r) => <tr key={r.key}><td>{r.location}</td><td>{r.code}</td><td><Person name={r.tenantName} /></td><td className="text-end">{money(r.rent)}</td><td className="text-end">{money(r.paid)}</td><td className="text-end">{money(r.remaining)}</td><td><RentBadge status={r.payStatus} /></td></tr>)}</tbody>
          </table></div></div>
        </div>
      )}
    </Layout>
  );
}

export function Statements() {
  const { data: d, error, reload } = useApi('/closings');
  const csv = () => downloadCsv('monthly-statements.csv', ['Month', 'Expected', 'Collected at closing', 'Late payments since', 'Outstanding at closing', 'Paid units', 'Partial units', 'Unpaid units', 'Closed at'],
    d.closings.map((c) => [periodLabel(c.year, c.month), c.expected, c.collected, Math.max(0, c.late), c.outstanding, c.paidUnits, c.partialUnits, c.unpaidUnits, c.closedAt]));
  const cur = d && d.current;
  return (
    <Layout title="Monthly statements" crumb="Reports">
      <PageHead title="Monthly statements" sub={`Each month is closed automatically when it ends. Its final numbers are saved here, and the new month starts from ${money(0)}.`} />
      <ReportNav active="closings" year={cur ? cur.year : 0} month={0} onCsv={d ? csv : null} />
      {error ? <LoadError error={error} onRetry={reload} /> : !d ? <Loading /> : (
        <>
          <div className="card mb-3"><div className="card-body d-flex flex-wrap align-items-center gap-4">
            <div><span className="status status-partial">Open</span></div>
            <div><div className="small text-muted">Current month</div><div className="fw-600" id="openMonth">{periodLabel(cur.year, cur.month)}</div></div>
            <div><div className="small text-muted">Collected so far</div><div className="fw-600">{money(cur.paid)} <span className="text-muted fw-normal">of {money(cur.expected)}</span></div></div>
            <div style={{ minWidth: 180 }}><Meter pct={cur.collectionRate} /></div>
            <div className="small text-muted">Closes automatically on <b>{fmtDate(`${cur.next[0]}-${String(cur.next[1]).padStart(2, '0')}-01`)}</b></div>
            <Link className="btn btn-sm btn-light ms-auto" to="/collection">Open rent collection</Link>
          </div></div>
          <div className="card"><div className="card-header">Closed months <span className="card-sub">{d.closings.length} statement(s)</span></div>
            <div className="table-responsive"><table className="table table-hover" id="closingsTable">
              <thead><tr><th>Month</th><th className="num">Expected</th><th className="num">Collected at closing</th><th style={{ minWidth: 150 }}>Collection</th><th className="num">Late payments since</th><th className="num">Outstanding at closing</th><th>Paid / partial / unpaid</th><th className="text-end">Statement</th></tr></thead>
              <tbody>
                {!d.closings.length ? <Empty cols={8} text="No closed months yet. The current month will appear here when it ends." icon="bi-calendar-check" /> : null}
                {d.closings.map((c) => {
                  const rate = c.expected > 0 ? Math.min(100, Math.round((c.collected / c.expected) * 1000) / 10) : 0;
                  return (
                    <tr key={c.id} data-month={`${c.year}-${c.month}`}>
                      <td className="nowrap"><Link className="cell-main" to={`/statements/${c.year}/${c.month}`}>{periodLabel(c.year, c.month)}</Link><div className="cell-sub">Closed {fmtDate(c.closedAt)} · {c.closedByName ? 'updated by ' + c.closedByName : 'automatic'}</div></td>
                      <td className="num">{money(c.expected)}</td><td className="num fw-600">{money(c.collected)}</td><td><Meter pct={rate} /></td>
                      <td className="num">{c.late > 0.004 ? '+' + money(c.late) : <span className="text-muted">—</span>}</td>
                      <td className="num">{money(c.outstanding)}</td>
                      <td className="nowrap small"><span className="dot dot-paid" />{c.paidUnits} &nbsp;<span className="dot dot-partial" />{c.partialUnits} &nbsp;<span className="dot dot-unpaid" />{c.unpaidUnits}</td>
                      <td className="table-actions"><Link className="btn btn-sm btn-light" to={`/statements/${c.year}/${c.month}`}>Open</Link></td>
                    </tr>);
                })}
              </tbody>
            </table></div></div>
        </>
      )}
    </Layout>
  );
}

export function Statement({ params }) {
  const { confirm, toast } = useApp();
  const y = Number(params.year), m = Number(params.month);
  const { data: d, error, reload } = useApi(`/closings/${y}/${m}`);
  if (error) return <Layout title="Statement" crumb="Reports"><LoadError error={error} /></Layout>;
  if (!d) return <Layout title="Statement" crumb="Reports"><Loading /></Layout>;
  const c = d.closing, now = d.now.summary;
  const late = now.paid - c.collected, rate = c.expected > 0 ? Math.min(100, Math.round((c.collected / c.expected) * 1000) / 10) : 0;
  const [ny, nm] = d.next;
  const nowBy = new Map(d.now.properties.map((p) => [p.kind + '|' + p.name, p]));
  const tot = c.properties.reduce((a, p) => { const n = (nowBy.get(p.kind + '|' + p.name) || p).collected; return { e: a.e + p.expected, c: a.c + p.collected, n: a.n + n }; }, { e: 0, c: 0, n: 0 });
  const net = d.net;
  const refresh = () => confirm(`Update the saved statement of ${periodLabel(y, m)} with today's numbers (including late payments)?`, async () => {
    try { const r = await api(`/closings/${y}/${m}/refresh`, { method: 'POST', body: {} }); toast(r.message); reload(); } catch (e) { toast(e.message, 'danger'); }
  }, { okLabel: 'Update statement', okClass: 'btn-primary' });
  const [py, pm] = shiftMonth(y, m, -1);
  return (
    <Layout title={`Statement — ${periodLabel(y, m)}`} crumb="Reports">
      <PageHead title={`Statement — ${periodLabel(y, m)}`} sub={<>Closed {fmtDate(c.closedAt, true)} · {c.closedByName ? 'updated by ' + c.closedByName : 'closed automatically when the month ended'}</>}
        actions={<>
          <Link className="btn btn-light" to="/statements"><i className="bi bi-arrow-left" /> All statements</Link>
          <button className="btn btn-light" onClick={() => navigate(`/statements/${py}/${pm}`)}>‹ {monthName(pm, true)}</button>
          <button className="btn btn-outline-secondary" onClick={() => window.print()}><i className="bi bi-printer" /> Print</button>
          {d.canRefresh ? <button className="btn btn-primary" data-act="refreshClosing" onClick={refresh}><i className="bi bi-arrow-repeat" /> Update statement</button> : null}
        </>} />
      <div className="row g-3 mb-3">
        <div className="col-xl-5"><div className="card h-100 kpi-hero"><div className="kpi">
          <div className="kpi-top"><span className="kpi-label">Rent collected — {periodLabel(y, m)} (final)</span><span className="kpi-icon ic-good"><i className="bi bi-calendar-check" /></span></div>
          <div className="kpi-value">{money(c.collected)}</div>
          <div className="kpi-foot">of <b className="text-ink-2">{money(c.expected)}</b> expected · outstanding at closing <b className="text-ink-2">{money(c.outstanding)}</b></div>
          <div className="mt-3"><Meter pct={rate} /></div>
          <div className="d-flex flex-wrap gap-4 mt-3 pt-3 border-top small">
            <div><div className="text-muted"><span className="dot dot-paid" />Paid units</div><b>{c.paidUnits}</b></div>
            <div><div className="text-muted"><span className="dot dot-partial" />Partial</div><b>{c.partialUnits}</b></div>
            <div><div className="text-muted"><span className="dot dot-unpaid" />Unpaid</div><b>{c.unpaidUnits}</b></div>
            <div><div className="text-muted">Units with rent</div><b>{c.units}</b></div>
          </div>
          <div className="d-flex flex-wrap gap-4 mt-3 pt-3 border-top small">
            <div><div className="text-muted">Expenses in {monthName(m)}</div><b>{money(d.expenses)}</b></div>
            <div><div className="text-muted">Salaries</div><b>{money(d.salaries)}</b></div>
            <div><div className="text-muted">Profit / loss (collected now − expenses − salaries)</div><NetAmount value={net} /> <ResultBadge value={net} /></div>
          </div>
        </div></div></div>
        <div className="col-xl-7"><div className="row g-3 h-100">
          <div className="col-6"><Kpi label="Late payments since closing" value={money(Math.max(0, late))} foot={late > 0.004 ? `Rent for ${monthName(m)} paid after the month ended` : 'Nothing paid after closing'} icon="bi-clock-history" ic={late > 0.004 ? '' : 'ic-neutral'} /></div>
          <div className="col-6"><Kpi label="Collected now (incl. late)" value={money(now.paid)} foot={`${now.collectionRate}% of expected`} icon="bi-wallet2" ic="ic-good" /></div>
          <div className="col-6"><Kpi label="Still outstanding now" value={money(now.remaining)} foot="Shown as arrears on the dashboard" icon="bi-exclamation-diamond" ic={now.remaining > 0 ? 'ic-bad' : 'ic-good'} /></div>
          <div className="col-6"><Kpi label="Next month" value={periodLabel(ny, nm)} foot={`Started from ${money(0)} collected`} icon="bi-arrow-right-circle" ic="ic-neutral" /></div>
        </div></div>
      </div>
      <div className="card">
        <div className="card-header">By property <span className="card-sub">numbers saved at closing · &quot;now&quot; includes late payments</span></div>
        <div className="table-responsive"><table className="table table-hover">
          <thead><tr><th>Property</th><th>Occupancy</th><th className="num">Expected</th><th className="num">Collected at closing</th><th style={{ minWidth: 150 }}>Collection</th><th className="num">Collected now</th></tr></thead>
          <tbody>{c.properties.map((p) => {
            const n = (nowBy.get(p.kind + '|' + p.name) || p).collected;
            return (
              <tr key={p.kind + p.name}>
                <td><span className="cell-main">{p.name}</span><div className="cell-sub">{p.kind}</div></td>
                <td className="nowrap"><span className="fw-600">{p.occ}</span><span className="text-muted">/{p.units}</span></td>
                <td className="num">{money(p.expected)}</td><td className="num fw-600">{money(p.collected)}</td>
                <td>{p.expected > 0 ? <Meter pct={p.rate} cls={rateClass(p.rate)} /> : <span className="text-muted small">No rent due</span>}</td>
                <td className="num">{money(n)}{n - p.collected > 0.004 ? <div className="cell-sub">+{money(n - p.collected)} late</div> : null}</td>
              </tr>);
          })}</tbody>
          <tfoot><tr><td colSpan={2}>Total</td><td className="num">{money(tot.e)}</td><td className="num">{money(tot.c)}</td><td /><td className="num">{money(tot.n)}</td></tr></tfoot>
        </table></div>
      </div>
    </Layout>
  );
}
