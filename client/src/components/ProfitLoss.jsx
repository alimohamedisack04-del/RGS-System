/** Profit / loss of a month: rent collected − expenses − staff salaries.
 *  Green when there is a profit, red when there is a loss. */
import { Link } from '../lib/router';
import { money, monthName, periodLabel } from '../lib/format';
import { qs } from '../lib/api';

export const resultOf = (net) => (net > 0.004 ? 'profit' : net < -0.004 ? 'loss' : 'even');
const LABEL = { profit: 'Profit', loss: 'Loss', even: 'Break-even' };
const ICON = { profit: 'bi-arrow-up-right', loss: 'bi-arrow-down-right', even: 'bi-dash' };

/** Net amount coloured by result (+$ profit in green, −$ loss in red). */
export function NetAmount({ value, id, className = '' }) {
  const r = resultOf(value);
  return <span id={id} className={`net-amt net-${r} ${className}`}>{r === 'profit' ? '+' : r === 'loss' ? '−' : ''}{money(Math.abs(value))}</span>;
}

export function ResultBadge({ value }) {
  const r = resultOf(value);
  return <span className={`pl-badge pl-${r}`}><i className={`bi ${ICON[r]}`} /> {LABEL[r]}</span>;
}

/** f = { collected, expenses, salaries, costs, net }   prev = same for the month before (optional) */
export default function ProfitLoss({ f, prev, year, month, can, id = 'profitLoss' }) {
  const r = resultOf(f.net);
  const share = f.collected > 0 ? Math.round((f.costs / f.collected) * 100) : f.costs > 0 ? 100 : 0;
  const change = prev ? Math.round((f.net - prev.net) * 100) / 100 : null;
  const [py, pm] = month === 1 ? [year - 1, 12] : [year, month - 1];
  const line = (label, value, sign, to, rid) => (
    <div className="pl-line">
      <span className="pl-l">{label}</span>
      <span className="pl-v">{sign ? <span className="pl-sign">{sign}</span> : null}{to ? <Link id={rid} to={to}>{money(value)}</Link> : <span id={rid}>{money(value)}</span>}</span>
    </div>
  );
  return (
    <div className={`card pl-card pl-card-${r}`} id={id} data-result={r}>
      <div className="pl-body">
        <div className="pl-main">
          <div className="pl-title">Profit / Loss · {periodLabel(year, month)}</div>
          <div className="pl-net"><NetAmount value={f.net} id="kNet" /> <ResultBadge value={f.net} /></div>
          <div className="pl-sub">
            {r === 'loss' ? <>Expenses and salaries are <b>{money(Math.abs(f.net))}</b> more than the rent collected.</>
              : r === 'profit' ? <>Rent collected covers all expenses and salaries with <b>{money(f.net)}</b> left.</>
                : <>Rent collected exactly covers expenses and salaries.</>}
          </div>
          {change !== null ? <div className="pl-prev">{monthName(pm, true)} {py}: <NetAmount value={prev.net} /> · change <span className={change > 0 ? 'text-success' : change < 0 ? 'text-danger' : 'text-muted'}>{change > 0 ? '+' : change < 0 ? '−' : '±'}{money(Math.abs(change))}</span></div> : null}
        </div>
        <div className="pl-calc">
          {line('Rent collected', f.collected, '', null, 'kCollectedNet')}
          {line('Expenses', f.expenses, '−', can && can('expense') ? `/expenses${qs({ month, year })}` : null, 'kExpenses')}
          {line('Staff salaries', f.salaries, '−', can && can('hr') ? `/hr${qs({ month, year })}` : null, 'kSalaries')}
          <div className="pl-line pl-total"><span className="pl-l">{r === 'loss' ? 'Net loss' : 'Net profit'}</span><NetAmount value={f.net} className="pl-v" /></div>
          <div className="pl-share">
            <div className="pl-bar"><span style={{ width: Math.min(100, share) + '%' }} /></div>
            <span>Costs = {share}% of rent collected</span>
          </div>
        </div>
      </div>
    </div>
  );
}
