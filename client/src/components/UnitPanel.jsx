/** Rent panel for a room / apartment / land: this month's rent, 12-month grid and payments. */
import { useApi, qs } from '../lib/api';
import { useApp } from '../lib/app';
import { Link } from '../lib/router';
import { fmtDate, money, monthName, periodLabel } from '../lib/format';
import { payPath } from '../lib/units';
import { DeleteButton, Loading, Person, RentBadge } from './ui';

export default function UnitPanel({ type, id, year, onYear }) {
  const { can } = useApp();
  const { data, reload } = useApi(`/units/${type}/${id}${qs({ year })}`);
  if (!data) return <Loading />;
  const u = data.unit, c = data.current;
  return (
    <>
      <div className="row g-3 mt-1">
        <div className="col-lg-4"><div className="card h-100">
          <div className="card-header">Rent — {periodLabel(c.year, c.month)}</div>
          <div className="card-body">
            {u.isLet || c.paid > 0 ? (
              <>
                <div className="mb-3"><RentBadge status={c.status} /></div>
                <table className="table table-sm table-borderless mb-3"><tbody>
                  <tr><td className="text-muted">Monthly rent</td><td className="text-end fw-semibold">{money(c.rent)}</td></tr>
                  <tr><td className="text-muted">Paid</td><td className="text-end text-success fw-semibold">{money(c.paid)}</td></tr>
                  <tr><td className="text-muted">Remaining</td><td className="text-end text-danger fw-semibold">{money(c.remaining)}</td></tr>
                </tbody></table>
                {c.status !== 'paid' && can('pay') ? <Link className="btn btn-primary w-100" to={payPath(u.key)}><i className="bi bi-plus-circle" /> Record Payment</Link> : null}
              </>
            ) : <p className="text-muted mb-0">This unit is vacant — no rent is expected.</p>}
          </div>
        </div></div>
        <div className="col-lg-8"><div className="card h-100">
          <div className="card-header d-flex align-items-center"><span>Monthly status {data.year}</span>
            <div className="ms-auto btn-group btn-group-sm">
              <button className="btn btn-light" onClick={() => onYear(data.year - 1)}><i className="bi bi-chevron-left" /> {data.year - 1}</button>
              <button className="btn btn-light" onClick={() => onYear(data.year + 1)}>{data.year + 1} <i className="bi bi-chevron-right" /></button>
            </div></div>
          <div className="card-body"><div className="month-grid">
            {data.history.map((g) => (
              <div key={g.month} className={`month-cell ${g.status}`}>
                <div className="m">{monthName(g.month, true)} {data.year}</div>
                {g.status === 'na' ? <div className="a">Not due</div> : <><div><RentBadge status={g.status} /></div><div className="a">{money(g.paid)} / {money(g.rent)}</div></>}
              </div>))}
          </div></div>
        </div></div>
      </div>
      <div className="card mt-3">
        <div className="card-header">Payment transactions</div>
        <div className="table-responsive"><table className="table table-sm table-hover">
          <thead><tr><th>Receipt</th><th>Month</th><th>Tenant</th><th className="text-end">Rent</th><th className="text-end">Paid</th><th>Date</th><th>Method / Ref</th><th>Received by</th><th /></tr></thead>
          <tbody>
            {!data.payments.length ? <tr><td colSpan={9} className="empty">No payments recorded yet.</td></tr> : null}
            {data.payments.map((p) => (
              <tr key={p.id}>
                <td className="nowrap"><Link className="cell-main" to={`/receipts/${p.id}`}>{p.receiptNo}</Link></td>
                <td className="nowrap">{periodLabel(p.periodYear, p.periodMonth)}</td>
                <td><Person name={p.tenantName} /></td>
                <td className="text-end">{money(p.rentAmount)}</td><td className="text-end fw-semibold">{money(p.amountPaid)}</td>
                <td className="text-nowrap">{fmtDate(p.paymentDate)}</td>
                <td className="small">{p.paymentMethod || '-'}{p.reference ? <><br /><span className="text-muted">{p.reference}</span></> : null}</td>
                <td className="small">{p.receivedByName || '-'}</td>
                <td className="text-end table-actions">
                  <Link className="btn btn-sm btn-light" to={`/receipts/${p.id}`}><i className="bi bi-printer" /> Receipt</Link>
                  <DeleteButton perm="unpay" path={`/payments/${p.id}`} message={`Delete payment ${p.receiptNo} (${money(p.amountPaid)})? The month status will be recalculated.`} onDone={reload} />
                </td>
              </tr>))}
          </tbody>
        </table></div>
      </div>
    </>
  );
}
