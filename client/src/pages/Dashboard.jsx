import Layout from '../components/Layout';
import TrendChart, { ChartLegend } from '../components/TrendChart';
import { DeltaChip, Kpi, LoadError, Loading, Meter, PeriodPicker, Person, RentBadge, Empty } from '../components/ui';
import ProfitLoss from '../components/ProfitLoss';
import { useApi, qs } from '../lib/api';
import { useApp } from '../lib/app';
import { Link, setQuery } from '../lib/router';
import { daysLeft } from '../lib/dates';
import { fmtDate, money, monthName, periodLabel } from '../lib/format';
import { payPath, unitPath } from '../lib/units';

export default function Dashboard({ query }) {
  const { user, can, meta } = useApp();
  const { data: d, error, reload } = useApi('/dashboard' + qs({ year: query.year, month: query.month }));
  const hr = new Date().getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  if (error) return <Layout title="Dashboard"><LoadError error={error} onRetry={reload} /></Layout>;
  if (!d) return <Layout title="Dashboard"><Loading /></Layout>;
  const s = d.summary, y = d.year, m = d.month;
  const units = Math.max(1, s.units), w = (n) => ((n / units) * 100).toFixed(2);
  const coll = (st) => `/collection${qs({ status: st, month: m, year: y })}`;
  const lc = d.lastClosing, lcRate = lc && lc.expected > 0 ? Math.min(100, Math.round((lc.collected / lc.expected) * 1000) / 10) : 0;
  const occ = d.occupancy;
  return (
    <Layout title="Dashboard">
      <div className="page-head">
        <div>
          <h1 className="page-title">{greet}, {user.fullName}</h1>
          <div className="page-sub">Overview for <b>{periodLabel(y, m)}</b></div>
        </div>
        <PeriodPicker year={y} month={m} onChange={(yy, mm) => setQuery({ year: yy, month: mm })} />
      </div>

      {lc ? (
        <div className="card mb-3 closing-banner" id="closingBanner"><div className="card-body d-flex flex-wrap align-items-center gap-4">
          <span className="kpi-icon ic-good"><i className="bi bi-calendar-check" /></span>
          <div><div className="fw-600">{periodLabel(lc.year, lc.month)} is closed</div><div className="small text-muted">{periodLabel(meta.year, meta.month)} has started — collection restarted from {money(0)}</div></div>
          <div><div className="small text-muted">Final collected</div><b>{money(lc.collected)}</b> <span className="text-muted small">of {money(lc.expected)}</span></div>
          <div style={{ minWidth: 160 }}><Meter pct={lcRate} /></div>
          <div><div className="small text-muted">Outstanding (now arrears)</div><b>{money(lc.outstanding)}</b></div>
          <Link className="btn btn-sm btn-primary ms-auto" to={`/statements/${lc.year}/${lc.month}`}>View statement</Link>
        </div></div>
      ) : null}
      {d.viewClosing ? (
        <div className="alert alert-info d-flex flex-wrap align-items-center gap-2"><span className="status status-paid">Closed</span> You are looking at {periodLabel(y, m)}, a closed month (closed {fmtDate(d.viewClosing.closedAt)}).
          <Link className="ms-auto" to={`/statements/${y}/${m}`}>Open its statement →</Link></div>
      ) : null}

      <ProfitLoss f={d.finance} prev={d.prevFinance} year={y} month={m} can={can} />

      <div className="row g-3 mb-3 kpi-row">
        <div className="col-sm-6 col-xl-3"><div className="card h-100"><div className="kpi">
          <div className="kpi-top"><span className="kpi-label">Rent collected</span><span className="kpi-icon ic-good"><i className="bi bi-wallet2" /></span></div>
          <div className="kpi-value" id="kCollected">{money(s.paid)}</div>
          <div className="mt-2"><Meter pct={s.collectionRate} /></div>
          <div className="kpi-foot">of {money(s.expected)} expected · {d.isCurrent ? daysLeft() : <><DeltaChip now={s.collectionRate} before={d.prev.collectionRate} /> vs {monthName(m === 1 ? 12 : m - 1, true)}</>}</div>
        </div></div></div>
        <div className="col-sm-6 col-xl-3"><div className="card h-100"><div className="kpi">
          <div className="kpi-top"><span className="kpi-label">Still to collect</span><span className="kpi-icon ic-warn"><i className="bi bi-hourglass-split" /></span></div>
          <div className="kpi-value">{money(s.remaining)}</div>
          <div className="kpi-foot"><Link to={coll('unpaid')} className="status status-unpaid">{s.unpaidUnits} unpaid</Link> <Link to={coll('partial')} className="status status-partial">{s.partialUnits} partial</Link></div>
          <div className="kpi-foot">{d.arrears.amount > 0 ? <>Earlier months: <b className="text-danger">{money(d.arrears.amount)}</b> ({d.arrears.units} unit{d.arrears.units === 1 ? '' : 's'})</> : 'No unpaid rent from earlier months'}</div>
        </div></div></div>
        <div className="col-sm-6 col-xl-3"><div className="card h-100"><div className="kpi">
          <div className="kpi-top"><span className="kpi-label">Mall rooms</span><span className="kpi-icon"><i className="bi bi-door-open" /></span></div>
          <div className="occ-split">
            <Link to="/rooms?status=occupied&category=room"><span className="n" id="roomsOccupied">{occ.roomsOcc.toLocaleString('en-US')}</span><span className="l"><span className="dot dot-occ" />Occupied</span></Link>
            <Link to="/rooms?status=vacant&category=room"><span className="n" id="roomsVacant">{occ.roomsVacant.toLocaleString('en-US')}</span><span className="l"><span className="dot dot-vac" />Vacant</span></Link>
          </div>
          <div className="kpi-foot">{occ.rooms} rooms · {occ.roomsRate}% occupied{occ.halls ? ` · Halls ${occ.hallsOcc}/${occ.halls} rented` : ''}</div>
        </div></div></div>
        <div className="col-sm-6 col-xl-3"><Kpi label="Active tenants" value={String(d.activeTenants)} icon="bi-people" ic="ic-neutral"
          foot={`${d.counts.rooms} rooms · ${d.counts.apartments} apartments · ${d.counts.lands} plots`} /></div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-xl-8"><div className="card h-100">
          <div className="card-header">Rent collected <span className="card-sub">last 6 months</span><ChartLegend /></div>
          <div className="card-body pt-2">
            <TrendChart data={d.trend} />
            <details className="mt-2 small"><summary className="text-muted">View as table</summary>
              <table className="table table-sm mt-2"><thead><tr><th>Month</th><th className="num">Expected</th><th className="num">Collected</th><th className="num">Rate</th></tr></thead>
                <tbody>{d.trend.map((t) => <tr key={`${t.y}-${t.m}`}><td>{periodLabel(t.y, t.m)}</td><td className="num">{money(t.expected)}</td><td className="num">{money(t.collected)}</td><td className="num">{t.rate}%</td></tr>)}</tbody></table>
            </details>
          </div>
        </div></div>
        <div className="col-xl-4"><div className="card h-100">
          <div className="card-header">Payment status <span className="card-sub">{s.units} units</span></div>
          <div className="card-body">
            <div className="stack-bar" role="img" aria-label={`Paid ${s.paidUnits}, partial ${s.partialUnits}, unpaid ${s.unpaidUnits}`}>
              {[['paid', 'Paid', '#36b753', s.paidUnits], ['partial', 'Partially paid', '#fab219', s.partialUnits], ['unpaid', 'Unpaid', '#d03b3b', s.unpaidUnits]].map(([k, l, c, n]) => (n
                ? <span key={k} className={`s-${k}`} style={{ width: w(n) + '%' }} data-tip={JSON.stringify({ t: l, r: [['units', String(n), c]] })} /> : null))}
            </div>
            <ul className="status-list">
              <li><Link to={coll('paid')}><RentBadge status="paid" /></Link><span className="cnt">{s.paidUnits}</span><span className="amt">{money(d.paidAmount)}</span></li>
              <li><Link to={coll('partial')}><RentBadge status="partial" /></Link><span className="cnt">{s.partialUnits}</span><span className="amt">{money(d.partialAmount)}</span></li>
              <li><Link to={coll('unpaid')}><RentBadge status="unpaid" /></Link><span className="cnt">{s.unpaidUnits}</span><span className="amt">{money(0)}</span></li>
              <li className="fw-600"><span>Remaining to collect</span><span className="cnt text-danger">{money(s.remaining)}</span></li>
            </ul>
            <div className="small text-muted border-top pt-2 mt-2">Collected today <b className="text-ink-2">{money(d.todayAmount)}</b> · {d.monthPayCount} payment(s) this month</div>
          </div>
        </div></div>
      </div>

      <div className="card">
        <div className="card-header">Outstanding rent <span className="card-sub">{d.outstandingCount} unit(s) not fully paid for {periodLabel(y, m)}</span>
          <Link className="btn btn-sm btn-light ms-auto" to={coll('unpaid')}>Open rent collection</Link></div>
        <div className="table-responsive"><table className="table table-hover">
          <thead><tr><th>Unit</th><th>Tenant</th><th>Status</th><th className="num">Rent</th><th className="num">Paid</th><th className="num">Remaining</th><th /></tr></thead>
          <tbody>
            {!d.outstanding.length ? <Empty cols={7} text="All rent for this month has been collected." icon="bi-check2-circle" /> : null}
            {d.outstanding.map((r) => (
              <tr key={r.key}>
                <td><Link className="cell-main" to={unitPath(r.unitType, r.unitId)}>{r.code}</Link><div className="cell-sub">{r.location}</div></td>
                <td><Person name={r.tenantName} sub={r.tenantPhone} /></td>
                <td><RentBadge status={r.payStatus} /></td>
                <td className="num">{money(r.rent)}</td><td className="num">{money(r.paid)}</td><td className="num fw-600">{money(r.remaining)}</td>
                <td className="table-actions">{can('pay') ? <Link className="btn btn-sm btn-outline-primary" to={payPath(r.key, y, m)}>Record payment</Link> : null}</td>
              </tr>))}
          </tbody>
        </table></div>
        {d.outstandingCount > 8 ? <div className="card-footer small"><Link to={coll('unpaid')}>View all {d.outstandingCount} units →</Link></div> : null}
      </div>
    </Layout>
  );
}
