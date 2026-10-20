/** Small shared UI pieces (RGS design system). */
import { useState } from 'react';
import { money, initials, rateClass, MONTHS, shiftMonth } from '../lib/format';
import { useApp } from '../lib/app';
import { api } from '../lib/api';

export function PageHead({ title, sub, actions }) {
  return (
    <div className="page-head">
      <div><h1 className="page-title">{title}</h1>{sub ? <div className="page-sub">{sub}</div> : null}</div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}

export function Loading() {
  return <div className="loading-box"><span className="spinner" /><div className="mt-2 small">Loading…</div></div>;
}

export function LoadError({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="card"><div className="card-body text-center py-5">
      <span className="kpi-icon ic-bad mx-auto mb-3" style={{ width: 52, height: 52, fontSize: 22 }}><i className={`bi ${error.status === 403 ? 'bi-shield-lock' : 'bi-exclamation-diamond'}`} /></span>
      <h2 className="h5">{error.status === 403 ? 'Access denied' : error.status === 404 ? 'Not found' : 'Could not load this page'}</h2>
      <p className="text-muted">{error.message}</p>
      {onRetry && error.status !== 403 && error.status !== 404 ? <button className="btn btn-primary" onClick={onRetry}>Try again</button> : null}
    </div></div>
  );
}

export function ErrorBox({ errors }) {
  if (!errors || !errors.length) return null;
  return (
    <div className="alert alert-danger" role="alert">
      <div className="fw-600 mb-1"><i className="bi bi-exclamation-circle" /> Please fix the following</div>
      <ul className="mb-0 ps-3">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
    </div>
  );
}

export function Kpi({ label, value, foot, icon, ic = '', extra, id }) {
  return (
    <div className="card h-100" id={id}><div className="kpi">
      <div className="kpi-top"><span className="kpi-label">{label}</span><span className={`kpi-icon ${ic}`}><i className={`bi ${icon}`} /></span></div>
      <div className="kpi-value">{value}</div>{extra}<div className="kpi-foot">{foot}</div>
    </div></div>
  );
}

export function Meter({ pct, cls }) {
  const p = Math.max(0, Math.min(100, Math.round((Number(pct) || 0) * 10) / 10));
  return <div className="meter-row"><div className={`meter sm ${cls ?? rateClass(p)}`}><span style={{ width: p + '%' }} /></div><span className="pct">{p}%</span></div>;
}

export const RentBadge = ({ status }) => {
  const t = { paid: 'Paid', partial: 'Partial', unpaid: 'Unpaid', na: 'Not due' };
  return <span className={`status status-${status === 'na' ? 'na' : status}`}>{t[status] || 'Unpaid'}</span>;
};
export const UnitBadge = ({ status }) => {
  const t = { occupied: 'Occupied', vacant: 'Vacant', available: 'Available', rented: 'Rented', sold: 'Sold', reserved: 'Reserved' };
  return <span className={`status status-${status}`}>{t[status] || status}</span>;
};

export function Person({ name, sub, onClick, href }) {
  if (!name) return <span className="text-muted">—</span>;
  return (
    <div className="person"><span className="avatar">{initials(name)}</span>
      <div className="min-w-0">{href || onClick ? <a className="cell-main" href={href} onClick={onClick}>{name}</a> : <span className="cell-main">{name}</span>}
        {sub ? <div className="cell-sub">{sub}</div> : null}</div>
    </div>
  );
}

export function Empty({ cols, text, icon = 'bi-inbox' }) {
  return <tr><td colSpan={cols} className="empty"><i className={`bi ${icon} d-block mb-1`} style={{ fontSize: 22 }} />{text}</td></tr>;
}

export function MonthSelect({ value, onChange, className = 'form-select form-select-sm w-auto', allLabel }) {
  return (
    <select className={className} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label="Month">
      {allLabel ? <option value={0}>{allLabel}</option> : null}
      {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
    </select>
  );
}
export function YearSelect({ value, onChange, className = 'form-select form-select-sm w-auto' }) {
  const now = new Date().getFullYear();
  const years = [];
  for (let y = now + 1; y >= now - 6; y--) years.push(y);
  if (!years.includes(value)) years.push(value);
  return <select className={className} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label="Year">{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>;
}
/** Month + year pickers that update the URL query. */
export function PeriodPicker({ year, month, onChange, children }) {
  return (
    <div className="d-flex gap-2 flex-wrap">
      {children}
      <MonthSelect value={month} onChange={(m) => onChange(year, m)} />
      <YearSelect value={year} onChange={(y) => onChange(y, month)} />
    </div>
  );
}

export function DeltaChip({ now, before, unit = ' pts' }) {
  const d = Math.round((now - before) * 10) / 10;
  if (Math.abs(d) < 0.05) return <span className="delta flat">± 0{unit}</span>;
  return <span className={`delta ${d > 0 ? 'up' : 'down'}`}><i className={`bi bi-arrow-${d > 0 ? 'up' : 'down'}-short`} />{Math.abs(d)}{unit}</span>;
}

/** Delete button with the in-app confirmation box. */
export function DeleteButton({ path, message, onDone, label = 'Delete', className = 'btn-sm', id, perm = 'delete' }) {
  const { confirm, toast, can } = useApp();
  if (!can(perm)) return null;
  return (
    <button type="button" id={id} className={`btn btn-outline-danger ${className}`} title="Delete"
      onClick={() => confirm(message, async () => {
        try { const r = await api(path, { method: 'DELETE' }); toast(r.message); onDone && onDone(r); } catch (e) { toast(e.message, 'danger'); }
      }, { okLabel: 'Delete' })}>
      <i className="bi bi-trash3" />{label ? ' ' + label : ''}
    </button>
  );
}

/** Field helpers for forms */
export function Field({ label, required, children, hint, className = 'col-md-6' }) {
  return (
    <div className={className}>
      <label className={`form-label${required ? ' required' : ''}`}>{label}</label>
      {children}
      {hint ? <div className="form-text">{hint}</div> : null}
    </div>
  );
}

/** Controlled form state */
export function useForm(initial) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const bind = (name, { type = 'text' } = {}) => (type === 'checkbox'
    ? { name, checked: !!values[name], onChange: (e) => setValues((v) => ({ ...v, [name]: e.target.checked })) }
    : { name, value: values[name] ?? '', onChange: (e) => setValues((v) => ({ ...v, [name]: e.target.value })) });
  const submit = (fn) => async (e) => {
    if (e) e.preventDefault();
    if (busy) return;
    setBusy(true); setErrors([]);
    try { await fn(values); } catch (err) { setErrors(err.errors || [err.message]); window.scrollTo(0, 0); } finally { setBusy(false); }
  };
  return { values, setValues, errors, setErrors, busy, bind, submit };
}

export { money, shiftMonth };
