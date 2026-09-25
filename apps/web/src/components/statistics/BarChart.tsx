import { barPercent } from '@/lib/history-stats';

/**
 * Hand-written, server-rendered SVG bars. Every chart here is a visual duplicate
 * of an accessible table rendered just before it, so the wrapper is aria-hidden.
 * One hue only (teal), direct labels on every bar, text in ink tokens.
 */
export interface Bar {
  label: string;
  value: number;
  /** Text printed next to the bar, e.g. "3" or "3 · 33.3%". */
  valueText: string;
}

const BAR_FILL = 'var(--color-primary)';
const LINE = 'var(--color-line)';

export function ChartFrame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div aria-hidden="true" className="mt-4 rounded-card border border-line bg-[#fbfcfd] px-3 py-3 text-ink">
      <p className="text-[0.85rem] font-semibold text-ink-secondary">{label}</p>
      {children}
    </div>
  );
}

export function VerticalBars({ bars, height = 170 }: { bars: Bar[]; height?: number }) {
  const n = bars.length;
  if (n === 0) return null;
  const top = 22;
  const bottom = 24;
  const plot = height - top - bottom;
  const max = Math.max(...bars.map((b) => b.value));
  const col = 100 / n;
  const barW = col * 0.68;
  const barX = col * 0.16;
  return (
    <svg width="100%" height={height} role="presentation" focusable="false" className="mt-1 block">
      <line x1="0" x2="100%" y1={top + plot + 0.5} y2={top + plot + 0.5} stroke={LINE} strokeWidth="1" />
      {bars.map((bar, i) => {
        const h = (barPercent(bar.value, max) / 100) * plot;
        const y = top + plot - h;
        const cx = `${(i + 0.5) * col}%`;
        return (
          <g key={bar.label}>
            {h > 0 ? <rect x={`${i * col + barX}%`} y={y} width={`${barW}%`} height={h} rx={3} fill={BAR_FILL} /> : null}
            <text x={cx} y={y - 6} textAnchor="middle" fill="currentColor" className="tabular text-[0.78rem] font-semibold">
              {bar.valueText}
            </text>
            <text x={cx} y={height - 6} textAnchor="middle" fill="var(--color-ink-secondary)" className="tabular text-[0.82rem]">
              {bar.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function HorizontalBars({ bars, rowHeight = 30 }: { bars: Bar[]; rowHeight?: number }) {
  const n = bars.length;
  if (n === 0) return null;
  const max = Math.max(...bars.map((b) => b.value));
  // Label column, plot, then room for "count · share" text at the widest bar even at 360px.
  const labelW = 16;
  const plotX = labelW + 1;
  const plotW = 46;
  const height = n * rowHeight + 4;
  return (
    <svg width="100%" height={height} role="presentation" focusable="false" className="mt-1 block">
      <line x1={`${plotX}%`} x2={`${plotX}%`} y1="0" y2={height} stroke={LINE} strokeWidth="1" />
      {bars.map((bar, i) => {
        const pct = barPercent(bar.value, max) / 100;
        const w = pct * plotW;
        const cy = i * rowHeight + rowHeight / 2 + 2;
        return (
          <g key={bar.label}>
            <text x={`${labelW - 1}%`} y={cy} textAnchor="end" dominantBaseline="middle" fill="var(--color-ink-secondary)" className="tabular text-[0.85rem]">
              {bar.label}
            </text>
            {w > 0 ? <rect x={`${plotX}%`} y={cy - rowHeight * 0.32} width={`${w}%`} height={rowHeight * 0.64} rx={3} fill={BAR_FILL} /> : null}
            <text x={`${plotX + w + 1}%`} y={cy} textAnchor="start" dominantBaseline="middle" fill="currentColor" className="tabular text-[0.8rem] font-semibold">
              {bar.valueText}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
