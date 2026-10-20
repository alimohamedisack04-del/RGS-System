import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { DeleteButton, ErrorBox, Field, LoadError, Loading, MonthSelect, PageHead, YearSelect, useForm } from '../components/ui';
import { api, qs, useApi } from '../lib/api';
import { useApp } from '../lib/app';
import { Link, navigate, setQuery } from '../lib/router';
import { currency, downloadCsv, fmtDate, money, periodLabel } from '../lib/format';

/** HRM sheet: every department with its staff (name, title, phone, salary), a TOTAL per department and the ALL TOTAL. */
export function HR({ query }) {
  const { can, toast } = useApp();
  const d0 = new Date();
  const y = Number(query.year) || d0.getFullYear(), m = Number(query.month) || d0.getMonth() + 1;
  const { data, error, reload } = useApi('/hr' + qs({ year: y, month: m, showLeft: query.showLeft }));
  const dep = useForm({ name: '' });
  if (!can('hr')) return <Layout title="HR"><LoadError error={{ status: 403, message: 'Only an admin or editor can open HR and salaries.' }} /></Layout>;
  if (error) return <Layout title="HR"><LoadError error={error} onRetry={reload} /></Layout>;
  if (!data) return <Layout title="HR"><Loading /></Layout>;
  const addDep = dep.submit(async (v) => { const r = await api('/hr/departments', { method: 'POST', body: v }); toast(r.message); dep.setValues({ name: '' }); reload(); });
  const csv = () => {
    const rows = [['HRM', periodLabel(y, m)], ['NAME', 'TITLE', 'PHONE', 'SALARY']];
    for (const d of data.departments) {
      rows.push([d.name]);
      d.employees.filter((e) => e.onPayroll).forEach((e) => rows.push([e.fullName, e.title, e.phone, e.salary]));
      rows.push(['TOTAL', '', '', d.total]);
    }
    rows.push(['ALL TOTAL', '', '', data.allTotal]);
    downloadCsv(`hrm-${y}-${String(m).padStart(2, '0')}.csv`, rows[0], rows.slice(1));
  };
  return (
    <Layout title="HR — Staff & Salaries">
      <PageHead title="HR — Staff & Salaries" sub={<>Salaries for <b>{periodLabel(y, m)}</b> · {data.staff} staff · <b id="hrAllTotal">{money(data.allTotal)}</b> a month</>}
        actions={<>
          <div className="d-flex gap-2"><MonthSelect value={m} onChange={(v) => setQuery({ month: v, year: y })} /><YearSelect value={y} onChange={(v) => setQuery({ year: v, month: m })} /></div>
          <button className="btn btn-light" onClick={() => window.print()}><i className="bi bi-printer" /> Print</button>
          <button className="btn btn-light" onClick={csv}><i className="bi bi-filetype-csv" /> Excel / CSV</button>
          <Link className="btn btn-primary" to="/hr/staff/new"><i className="bi bi-person-plus" /> Add staff</Link>
        </>} />
      <div className="print-only mb-3"><img src="/img/rgs-logo.svg" alt="" style={{ height: 36 }} /><h4 className="mb-0 mt-2">HRM — {periodLabel(y, m)}</h4></div>

      {!data.departments.length ? <div className="alert alert-info">No departments yet. Add the first one below (e.g. MANAGEMENT).</div> : null}
      {data.departments.map((d) => (
        <div className="card mb-3 hr-dept" key={d.id} data-dept={d.name}>
          <div className="card-header hr-dept-head">{d.name} <span className="card-sub">{d.staff} staff · {money(d.total)} / month</span>
            <div className="ms-auto d-flex gap-2 no-print">
              <Link className="btn btn-sm btn-light" to={`/hr/staff/new?department=${d.id}`}><i className="bi bi-plus-lg" /> Add to {d.name.toLowerCase()}</Link>
              {!d.employees.length ? <DeleteButton path={`/hr/departments/${d.id}`} message={`Delete department ${d.name}?`} onDone={reload} /> : null}
            </div></div>
          <div className="table-responsive"><table className="table table-hover mb-0 hr-table">
            <colgroup><col style={{ width: 48 }} /><col style={{ width: '28%' }} /><col style={{ width: '22%' }} /><col style={{ width: '18%' }} /><col style={{ width: '14%' }} /><col /></colgroup>
            <thead><tr><th>#</th><th>Name</th><th>Title</th><th>Phone</th><th className="num">Salary</th><th className="no-print" /></tr></thead>
            <tbody>
              {!d.employees.length ? <tr><td colSpan={6} className="empty">No staff in this department yet.</td></tr> : null}
              {d.employees.map((e, i) => (
                <tr key={e.id} className={e.onPayroll ? '' : 'text-muted'}>
                  <td className="text-muted">{i + 1}</td>
                  <td className="cell-main">{e.fullName}{!e.onPayroll ? <div className="cell-sub">{e.endDate ? 'Left ' + fmtDate(e.endDate) : 'Starts ' + fmtDate(e.startDate)} · not in this month</div> : e.endDate ? <div className="cell-sub">Leaves {fmtDate(e.endDate)}</div> : null}</td>
                  <td>{e.title || '-'}</td><td className="nowrap">{e.phone || '-'}</td>
                  <td className="num fw-600">{money(e.salary)}</td>
                  <td className="table-actions no-print">
                    <Link className="btn btn-sm btn-light" to={`/hr/staff/${e.id}/edit`}><i className="bi bi-pencil" /> Edit</Link>
                    <DeleteButton path={`/hr/employees/${e.id}`} message={`Delete ${e.fullName}? To keep past salary totals correct, set a "left" date instead.`} onDone={reload} />
                  </td>
                </tr>))}
            </tbody>
            <tfoot><tr><td colSpan={4}>TOTAL</td><td className="num">{money(d.total)}</td><td className="no-print" /></tr></tfoot>
          </table></div>
        </div>
      ))}
      <div className="card mb-3 hr-all-total"><div className="card-body d-flex flex-wrap align-items-center gap-3">
        <span className="kpi-icon ic-warn"><i className="bi bi-people" /></span>
        <div><div className="fw-600">ALL TOTAL — {periodLabel(y, m)}</div><div className="small text-muted">{data.departments.length} departments · {data.staff} staff · subtracted from net income on the dashboard</div></div>
        <div className="ms-auto kpi-value" id="hrAllTotalCard">{money(data.allTotal)}</div>
      </div></div>

      <div className="row g-3 no-print">
        <div className="col-lg-6"><form className="card" onSubmit={addDep} data-form="department">
          <div className="card-header">Add a department</div>
          <div className="card-body"><ErrorBox errors={dep.errors} />
            <div className="input-group"><input className="form-control" maxLength={80} placeholder="e.g. MAINTENANCE" {...dep.bind('name')} /><button className="btn btn-primary" disabled={dep.busy}><i className="bi bi-plus-lg" /> Add</button></div>
          </div></form></div>
        <div className="col-lg-6 d-flex align-items-center">
          <div className="form-check"><input className="form-check-input" type="checkbox" id="showLeft" checked={query.showLeft === '1'} onChange={(e) => setQuery({ showLeft: e.target.checked ? '1' : '' })} />
            <label className="form-check-label" htmlFor="showLeft">Also show staff who have left</label></div>
        </div>
      </div>
    </Layout>
  );
}

export function StaffForm({ params, query }) {
  const { toast, can } = useApp();
  const editing = !!params.id;
  const { data: sheet } = useApi('/hr');
  const { data } = useApi(editing ? `/hr/employees/${params.id}` : null);
  const today = new Date().toISOString().slice(0, 10);
  const f = useForm({ departmentId: query.department || '', fullName: '', title: '', phone: '', salary: '', startDate: today, endDate: '', notes: '' });
  useEffect(() => { if (data) f.setValues({ ...data.employee, salary: String(data.employee.salary) }); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (sheet && !f.values.departmentId && sheet.departments.length) f.setValues((v) => ({ ...v, departmentId: sheet.departments[0].id })); }, [sheet]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!can('hr')) return <Layout title="HR"><LoadError error={{ status: 403, message: 'Only an admin or editor can manage staff.' }} /></Layout>;
  if (!sheet || (editing && !data)) return <Layout title="Staff"><Loading /></Layout>;
  const save = f.submit(async (v) => {
    const r = await api(editing ? `/hr/employees/${params.id}` : '/hr/employees', { method: editing ? 'PUT' : 'POST', body: v });
    toast(r.message); navigate('/hr');
  });
  return (
    <Layout title={editing ? 'Edit staff' : 'Add staff'} crumb="HR">
      <PageHead title={editing ? `Edit: ${data.employee.fullName}` : 'Add staff'} />
      <ErrorBox errors={f.errors} />
      <form className="card" style={{ maxWidth: 820 }} onSubmit={save} data-form="staff">
        <div className="card-body"><div className="row g-3">
          <Field label="Department" required><select name="departmentId" className="form-select" required {...f.bind('departmentId')}>
            <option value="">Choose…</option>{sheet.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          <Field label="Name" required><input name="fullName" className="form-control" maxLength={150} required {...f.bind('fullName')} /></Field>
          <Field label="Title"><input name="title" className="form-control" maxLength={100} placeholder="e.g. Security Guard" {...f.bind('title')} /></Field>
          <Field label="Phone"><input name="phone" className="form-control" maxLength={30} {...f.bind('phone')} /></Field>
          <Field label="Monthly salary" required><div className="input-group"><span className="input-group-text">{currency()}</span><input name="salary" type="number" step="0.01" min="0" className="form-control" required {...f.bind('salary')} /></div></Field>
          <Field label="Started on" hint="The salary counts from this month."><input type="date" className="form-control" {...f.bind('startDate')} /></Field>
          <Field label="Left on (optional)" hint="Set this when the person leaves — the salary stops after that month and past totals stay correct."><input type="date" className="form-control" {...f.bind('endDate')} /></Field>
          <Field label="Notes" className="col-12"><textarea className="form-control" rows={2} {...f.bind('notes')} /></Field>
        </div></div>
        <div className="card-footer d-flex gap-2"><button className="btn btn-primary" disabled={f.busy}><i className="bi bi-save" /> Save</button><Link className="btn btn-light" to="/hr">Cancel</Link></div>
      </form>
    </Layout>
  );
}
