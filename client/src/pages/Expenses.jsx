import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { NetAmount, ResultBadge } from '../components/ProfitLoss';
import { DeleteButton, Empty, ErrorBox, Kpi, LoadError, Loading, MonthSelect, PageHead, YearSelect, useForm } from '../components/ui';
import { api, qs, useApi } from '../lib/api';
import { useApp } from '../lib/app';
import { Link, navigate, setQuery } from '../lib/router';
import { currency, downloadCsv, fmtDate, money, periodLabel } from '../lib/format';

export function Expenses({ query }) {
  const { can, toast } = useApp();
  const d0 = new Date();
  const y = Number(query.year) || d0.getFullYear(), m = Number(query.month) || d0.getMonth() + 1;
  const { data, error, reload } = useApi('/expenses' + qs({ year: y, month: m, q: query.q }));
  const [search, setSearch] = useState(query.q || '');
  const f = useForm({ name: '', amount: '' });
  if (!can('expense')) return <Layout title="Expenses"><LoadError error={{ status: 403, message: 'You do not have permission to see expenses.' }} /></Layout>;
  const add = f.submit(async (v) => {
    const r = await api('/expenses', { method: 'POST', body: v });
    toast(r.message); f.setValues({ name: '', amount: '' });
    const now = new Date();
    if (y !== now.getFullYear() || m !== now.getMonth() + 1) setQuery({ year: now.getFullYear(), month: now.getMonth() + 1 }); else reload();
  });
  const isCurrent = y === d0.getFullYear() && m === d0.getMonth() + 1;
  return (
    <Layout title="Expenses">
      <PageHead title="Expenses" sub={<>Money spent in <b>{periodLabel(y, m)}</b></>}
        actions={<>
          <button className="btn btn-outline-secondary" disabled={!data} onClick={() => downloadCsv(`expenses-${y}-${String(m).padStart(2, '0')}.csv`, ['Date', 'Expense', 'Amount', 'Added by'], data.expenses.map((x) => [x.expenseDate, x.name, x.amount, x.createdByName]))}><i className="bi bi-filetype-csv" /> Excel / CSV</button>
          <button className="btn btn-outline-secondary" onClick={() => window.print()}><i className="bi bi-printer" /> Print</button>
        </>} />
      <div className="row g-3 mb-3">
        <div className="col-lg-5 no-print"><form className="card h-100" onSubmit={add} autoComplete="off" data-form="expenseAdd">
          <div className="card-header">Add expense</div>
          <div className="card-body">
            <ErrorBox errors={f.errors} />
            <div className="mb-3"><label className="form-label required" htmlFor="exName">Expense name</label><input id="exName" className="form-control" maxLength={150} placeholder="e.g. Electricity bill" {...f.bind('name')} /></div>
            <div className="mb-3"><label className="form-label required" htmlFor="exAmount">Price</label><div className="input-group"><span className="input-group-text">{currency()}</span><input id="exAmount" inputMode="decimal" className="form-control" placeholder="0.00" {...f.bind('amount')} /></div></div>
            <button className="btn btn-primary w-100" id="exSave" disabled={f.busy}><i className="bi bi-plus-lg" /> Save expense</button>
            <div className="form-text mt-2">Saved with today&apos;s date ({fmtDate(data ? data.today : null)}).</div>
          </div>
        </form></div>
        <div className="col-lg-7"><div className="row g-3">
          <div className="col-sm-6" id="exTotal"><Kpi label="Expenses" value={money(data ? data.total : 0)} foot={`${data ? data.expenses.length : 0} item(s)`} icon="bi-wallet" ic="ic-warn" /></div>
          <div className="col-sm-6"><Kpi label="Staff salaries" value={money(data ? data.salaries : 0)} foot={'on the payroll in ' + periodLabel(y, m)} icon="bi-person-badge" ic="ic-warn" /></div>
          <div className="col-sm-6"><Kpi label="Rent collected" value={money(data ? data.collected : 0)} foot={'for ' + periodLabel(y, m)} icon="bi-cash-stack" ic="ic-good" /></div>
          <div className="col-sm-6" id="exNet"><Kpi label={data && data.net < 0 ? 'Loss' : 'Profit'} value={<NetAmount value={data ? data.net : 0} />} foot={<>collected − expenses − salaries <ResultBadge value={data ? data.net : 0} /></>}
            icon={data && data.net < 0 ? 'bi-graph-down-arrow' : 'bi-graph-up-arrow'} ic={data && data.net < 0 ? 'ic-bad' : 'ic-good'} /></div>
        </div></div>
      </div>
      <div className="card">
        <div className="card-header flex-wrap gap-2"><span>Expenses — {periodLabel(y, m)}</span>
          <form className="d-flex flex-wrap gap-2 ms-auto no-print" onSubmit={(e) => { e.preventDefault(); setQuery({ q: search }); }}>
            <input type="search" className="form-control form-control-sm" style={{ width: 180 }} placeholder="Search name" value={search} onChange={(e) => setSearch(e.target.value)} />
            <MonthSelect value={m} onChange={(v) => setQuery({ month: v, year: y })} /><YearSelect value={y} onChange={(v) => setQuery({ year: v, month: m })} />
            <button className="btn btn-sm btn-light">Show</button>
          </form></div>
        {error ? <LoadError error={error} onRetry={reload} /> : !data ? <Loading /> : (
          <div className="table-responsive"><table className="table table-hover" id="exTable">
            <thead><tr><th>Date</th><th>Expense</th><th className="text-end">Price</th><th>Added by</th><th className="no-print" /></tr></thead>
            <tbody>
              {!data.expenses.length ? <Empty cols={5} text={isCurrent ? 'No expenses yet this month.' : 'No expenses for this month.'} icon="bi-wallet" /> : null}
              {data.expenses.map((x) => (
                <tr key={x.id}>
                  <td className="small text-muted">{fmtDate(x.expenseDate)}</td><td className="cell-main">{x.name}</td><td className="text-end fw-600">{money(x.amount)}</td><td className="small">{x.createdByName || '—'}</td>
                  <td className="table-actions text-end no-print">
                    {can('manage') ? <Link className="btn btn-sm btn-light" to={`/expenses/${x.id}/edit`}><i className="bi bi-pencil" /> Edit</Link> : null}
                    <DeleteButton path={`/expenses/${x.id}`} message={`Delete the expense "${x.name}" (${money(x.amount)})?`} onDone={reload} />
                  </td>
                </tr>))}
            </tbody>
            {data.expenses.length ? <tfoot className="table-light fw-bold"><tr><td colSpan={2}>Total</td><td className="text-end">{money(data.expenses.reduce((a, x) => a + x.amount, 0))}</td><td colSpan={2} /></tr></tfoot> : null}
          </table></div>
        )}
      </div>
    </Layout>
  );
}

export function ExpenseEdit({ params }) {
  const { toast, can } = useApp();
  const { data, error } = useApi(`/expenses/${params.id}`);
  const f = useForm({ name: '', amount: '' });
  useEffect(() => { if (data) f.setValues({ name: data.expense.name, amount: String(data.expense.amount) }); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!can('manage')) return <Layout title="Edit Expense"><LoadError error={{ status: 403, message: 'Only an editor or admin can edit expenses.' }} /></Layout>;
  if (error) return <Layout title="Edit Expense"><LoadError error={error} /></Layout>;
  if (!data) return <Layout title="Edit Expense"><Loading /></Layout>;
  const [yy, mm] = data.expense.expenseDate.split('-').map(Number);
  const save = f.submit(async (v) => {
    const r = await api(`/expenses/${params.id}`, { method: 'PUT', body: v });
    toast(r.message); navigate(`/expenses${qs({ year: yy, month: mm })}`);
  });
  return (
    <Layout title="Edit Expense">
      <PageHead title="Edit Expense" sub={'Added on ' + fmtDate(data.expense.expenseDate)} />
      <form className="card" style={{ maxWidth: 520 }} onSubmit={save} data-form="expenseEdit">
        <div className="card-body">
          <ErrorBox errors={f.errors} />
          <div className="mb-3"><label className="form-label required">Expense name</label><input className="form-control" maxLength={150} {...f.bind('name')} /></div>
          <div className="mb-1"><label className="form-label required">Price</label><div className="input-group"><span className="input-group-text">{currency()}</span><input name="amount" inputMode="decimal" className="form-control" {...f.bind('amount')} /></div></div>
        </div>
        <div className="card-footer d-flex gap-2"><button className="btn btn-primary" disabled={f.busy}><i className="bi bi-save" /> Save</button><Link className="btn btn-light" to={`/expenses${qs({ year: yy, month: mm })}`}>Cancel</Link></div>
      </form>
    </Layout>
  );
}
