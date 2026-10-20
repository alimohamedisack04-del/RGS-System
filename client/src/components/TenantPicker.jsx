/** Choose an existing tenant OR type a new one (used by room / apartment / land forms). */
import { useState } from 'react';
import { useApi } from '../lib/api';

export default function TenantPicker({ values, setValues, hint = 'Leave empty if the unit is vacant.' }) {
  const { data } = useApi('/tenants/options');
  const [showNew, setShowNew] = useState(!!values.newTenantName);
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));
  return (
    <div className="form-section">
      <label className="form-label" htmlFor="tenantSelect">Tenant</label>
      <select id="tenantSelect" name="tenantId" className="form-select" value={values.tenantId || ''} onChange={set('tenantId')}>
        <option value="">-- No tenant (vacant) --</option>
        {(data ? data.tenants : []).map((t) => <option key={t.id} value={t.id}>{t.fullName}{t.phone ? ' - ' + t.phone : ''}</option>)}
      </select>
      <div className="form-text">{hint}</div>
      <div className="mt-2"><a className="small" role="button" onClick={() => setShowNew((x) => !x)}><i className="bi bi-person-plus" /> Or add a new tenant</a></div>
      {showNew ? (
        <div className="row g-2 mt-1">
          <div className="col-md-7"><input name="newTenantName" className="form-control" maxLength={150} placeholder="New tenant full name" value={values.newTenantName || ''} onChange={set('newTenantName')} /></div>
          <div className="col-md-5"><input name="newTenantPhone" className="form-control" maxLength={30} placeholder="Phone" value={values.newTenantPhone || ''} onChange={set('newTenantPhone')} /></div>
          <div className="col-12 form-text">If you type a new name here, it is used instead of the dropdown.</div>
        </div>
      ) : null}
    </div>
  );
}
