/** Column chart: expected (light track) with collected (solid) in front. Hover shows details. */
import { money, moneyShort, monthName, periodLabel } from '../lib/format';

export default function TrendChart({ data }) {
  const W = 640, H = 230, pl = 46, pr = 10, pt = 26, pb = 30, iw = W - pl - pr, ih = H - pt - pb;
  const raw = Math.max(1, ...data.map((d) => Math.max(d.expected, d.collected)));
  const mag = Math.pow(10, Math.floor(Math.log10(raw / 4)));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s * 4 >= raw) || mag * 10;
  const max = step * 4;
  const y = (v) => pt + ih - (v / max) * ih;
  const slot = iw / Math.max(1, data.length), bw = Math.min(24, slot * 0.45);
  const thisYear = new Date().getFullYear();
  const col = (x, top, h, cls) => {
    if (h <= 0) return null;
    const r = Math.min(4, h);
    return <path className={cls} d={`M${x},${top + h}V${top + r}Q${x},${top} ${x + r},${top}H${x + bw - r}Q${x + bw},${top} ${x + bw},${top + r}V${top + h}Z`} />;
  };
  return (
    <svg className="trend-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Collected versus expected rent, last ${data.length} months`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const yy = y(step * i);
        return <g key={'g' + i}><line className="grid" x1={pl} x2={W - pr} y1={yy} y2={yy} /><text className="axis" x={pl - 8} y={yy + 4} textAnchor="end">{moneyShort(step * i)}</text></g>;
      })}
      {data.map((d, i) => {
        const x = pl + slot * i + (slot - bw) / 2, last = i === data.length - 1;
        const tip = JSON.stringify({ t: periodLabel(d.y, d.m), r: [['Collected', money(d.collected), '#36b753'], ['Expected', money(d.expected), '#a7dcb4'], ['Collection rate', d.rate + '%', '']] });
        return (
          <g key={`${d.y}-${d.m}`}>
            {col(x, y(d.expected), pt + ih - y(d.expected), 'bar-exp')}
            {col(x, y(d.collected), pt + ih - y(d.collected), 'bar-col')}
            <text className={`axis${last ? ' cur' : ''}`} x={x + bw / 2} y={H - 8} textAnchor="middle">{monthName(d.m, true)}{d.y !== thisYear ? ` '${String(d.y).slice(2)}` : ''}</text>
            {last ? <text className="lbl" x={x + bw / 2} y={Math.min(y(d.expected), y(d.collected)) - 8} textAnchor="middle">{moneyShort(d.collected)}</text> : null}
            <rect className="hit" x={pl + slot * i} y={pt} width={slot} height={ih} rx="6" tabIndex="0" data-tip={tip} />
          </g>
        );
      })}
    </svg>
  );
}

export function ChartLegend() {
  return (
    <div className="chart-legend ms-auto">
      <span><span className="key" style={{ background: 'var(--series-1)' }} />Collected</span>
      <span><span className="key" style={{ background: 'var(--series-track)' }} />Expected</span>
    </div>
  );
}
