// The survey cost, small and off to the side (D63), in the Build tab's pattern (D54): a quiet chip at the
// right of the top row that opens a card with the cost and its breakdown, and from there the Alternatives.
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Scale } from 'lucide-react';
import { UI } from '../../config/defaults';
import { PERCENT } from '../../config/play';
import type { SurveyCost } from '../../engine/pricing';
import { DockPortal } from '../kit/dock';
import { InlineBar } from '../kit/InlineBar';
import { Kpi } from '../kit/Kpi';
import '../build/build.css';
import { formatHours, formatInt, formatUsd } from './format';
import { SurveyAlternativesSheet } from './SurveyAlternativesSheet';
import { surveyAlternatives } from './surveyAlternatives';

export interface SurveyCostChipProps {
  cost: SurveyCost;
  pricingErrors: number;
  /** The walkthrough's Done step: the card opens by itself while it plays. */
  focus: boolean;
}

interface Row {
  label: string;
  detail: string;
  usd: number;
}

const plural = (n: number, word: string) => `${formatInt(n)} ${word}${n === 1 ? '' : 's'}`;

/** The priced parts of a survey, in the order of the card; a part without a sourced price is left out. */
export function surveyCostRows(cost: SurveyCost): Row[] {
  const n = cost.vehicles;
  const rows: Row[] = [];
  if (cost.vehicleHoursUsd !== null)
    rows.push({
      label: '4x4 hire',
      detail: `${formatHours(cost.vehicleHours)} 4x4-hours`,
      usd: cost.vehicleHoursUsd,
    });
  if (cost.dronesUsd !== null)
    rows.push({ label: 'Drones', detail: `${plural(n, 'drone')}`, usd: cost.dronesUsd });
  if (cost.starlinkHardwareUsd !== null)
    rows.push({
      label: 'Starlink kits',
      detail: `${n} × ${formatUsd(cost.starlinkHardwareUsd / n)}, with mounting`,
      usd: cost.starlinkHardwareUsd,
    });
  if (cost.starlinkServiceUsd !== null)
    rows.push({
      label: 'Starlink service',
      detail: `${n} × ${plural(cost.starlinkMonths, 'month')}`,
      usd: cost.starlinkServiceUsd,
    });
  return rows;
}

/** The parts of a survey the figure leaves out, as a sentence, or null when everything is priced. */
export function unpricedText(cost: SurveyCost): string | null {
  const parts: string[] = [];
  if (cost.vehicleHoursUsd === null) parts.push('the 4x4 hire');
  if (cost.dronesUsd === null) parts.push(`the ${plural(cost.vehicles, 'drone')}`);
  if (parts.length === 0) return null;
  return `Without ${parts.join(' and ')}: no sourced price yet.`;
}

export function SurveyCostChip({ cost, pricingErrors, focus }: SurveyCostChipProps) {
  // null follows the walkthrough; a click decides until the walkthrough's default changes again.
  const [choice, setChoice] = useState<{ open: boolean; forFocus: boolean } | null>(null);
  const [sheet, setSheet] = useState(false);
  const open = choice && choice.forFocus === focus ? choice.open : focus;
  const rootRef = useRef<HTMLDivElement>(null);
  const toggle = (next: boolean) => setChoice({ open: next, forFocus: focus });

  // Escape and a click elsewhere close the card.
  useEffect(() => {
    if (!open || sheet) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setChoice({ open: false, forFocus: focus });
    };
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setChoice({ open: false, forFocus: focus });
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [open, sheet, focus]);

  const rows = surveyCostRows(cost);
  const fleet = plural(cost.vehicles, '4x4');
  const chipLabel = cost.complete ? 'Survey cost' : 'Survey connectivity';
  const unpriced = unpricedText(cost);

  return (
    <DockPortal slot="top">
      <div className="cost" ref={rootRef}>
        <button
          type="button"
          className={open ? 'cost-chip open' : 'cost-chip'}
          aria-expanded={open}
          aria-controls="survey-cost-card"
          onClick={() => toggle(!open)}
        >
          <span className="cost-chip-label">{chipLabel}</span>
          <span className="cost-chip-value num">{formatUsd(cost.pricedUsd)}</span>
          <ChevronDown
            size={UI.icon.sizePx}
            strokeWidth={UI.icon.strokeWidth}
            aria-hidden="true"
            className={open ? 'build-chevron open' : 'build-chevron'}
          />
        </button>
        {open ? (
          <section id="survey-cost-card" className="panel cost-card" aria-label="Survey cost">
            <div className="label">Survey · {fleet} with drones</div>
            {pricingErrors > 0 ? (
              <p className="build-warning" role="alert">
                The pricing file has {pricingErrors} error{pricingErrors === 1 ? '' : 's'}; see the
                console.
              </p>
            ) : null}
            <Kpi
              label={cost.complete ? 'Whole survey' : `Starlink on ${fleet}, for the survey`}
              value={formatUsd(cost.pricedUsd)}
              headline
            />
            <Kpi label="4x4-hours" value={formatHours(cost.vehicleHours)} unit="h" />
            <div className="build-breakdown">
              {rows.map((r) => (
                <div className="build-breakdown-row" key={r.label}>
                  <span className="build-breakdown-label">
                    {r.label}
                    <span className="build-breakdown-detail">{r.detail}</span>
                  </span>
                  <InlineBar pct={(r.usd / cost.pricedUsd) * PERCENT.scale} token="unit" />
                  <span className="build-breakdown-value num">{formatUsd(r.usd)}</span>
                </div>
              ))}
            </div>
            {unpriced ? <p className="survey-cost-note">{unpriced}</p> : null}
            <button type="button" className="build-btn cost-compare" onClick={() => setSheet(true)}>
              <Scale size={UI.icon.sizePx} strokeWidth={UI.icon.strokeWidth} aria-hidden="true" />
              Compare alternatives
            </button>
          </section>
        ) : null}
        {sheet ? (
          <SurveyAlternativesSheet
            rows={surveyAlternatives(cost)}
            onClose={() => setSheet(false)}
          />
        ) : null}
      </div>
    </DockPortal>
  );
}
