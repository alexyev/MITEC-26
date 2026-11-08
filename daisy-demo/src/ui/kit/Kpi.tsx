// Readout row (spec 6.4): the label at left, the tabular value right-aligned with its unit in 12 px,
// and an optional full-width bar with a target tick under it.
import { InlineBar } from './InlineBar';
import type { KpiProps } from './types';

export function Kpi({ label, value, unit, bar, headline, note }: KpiProps) {
  return (
    <div className={headline ? 'kpi headline' : 'kpi'}>
      <div className="kpi-row">
        <span className="kpi-label">{label}</span>
        <span className="kpi-value num">
          {value}
          {unit ? <span className="kpi-unit">{unit}</span> : null}
        </span>
      </div>
      {bar ? (
        <InlineBar pct={bar.pct} token={bar.token} targetPct={bar.targetPct} width="fill" />
      ) : null}
      {note ? <div className="kpi-note">{note}</div> : null}
    </div>
  );
}
