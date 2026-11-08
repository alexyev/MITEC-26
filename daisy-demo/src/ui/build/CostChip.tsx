// The full-site network cost, small and off to the side (D54): a quiet chip at the right of the top row that
// opens a card with the cost and its breakdown on demand, and from there the Alternatives comparison.
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, CircleHelp, ExternalLink, Scale } from 'lucide-react';
import { UI } from '../../config/defaults';
import { PERCENT } from '../../config/play';
import type { NetworkCost } from '../../engine/pricing';
import { DockPortal } from '../kit/dock';
import { InlineBar } from '../kit/InlineBar';
import { Kpi } from '../kit/Kpi';
import { formatUsd } from '../survey/format';
import { AlternativesSheet } from './AlternativesSheet';
import type { Alternatives } from './alternatives';
import { formatCount, formatShare } from './format';

const LINKS = UI.costCardLinks;

/** The radio technology of a setup label ("HaLow · integrated antennas" is "HaLow"): the card shows only this. */
const setupName = (label: string) => label.split(' · ')[0];

export interface CostChipProps {
  cost: NetworkCost | null;
  pricingErrors: number;
  alternatives: Alternatives | null;
  /** The walkthrough's cost step: the card opens by itself while it plays (spec 10.3). */
  focus: boolean;
}

export function CostChip({ cost, pricingErrors, alternatives, focus }: CostChipProps) {
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

  const rows = cost
    ? [
        {
          label: 'Modules',
          detail: `${formatCount(cost.modules)} × ${formatUsd(cost.moduleUsd)}`,
          usd: cost.modulesUsd,
        },
        {
          label: 'Batteries',
          detail: `${formatCount(cost.packs)} × ${formatUsd(cost.batteryUsd)}, reused fleet`,
          usd: cost.batteriesUsd,
        },
        { label: 'Base', detail: '', usd: cost.basesUsd },
        { label: 'Spares', detail: '', usd: cost.sparesUsd },
        { label: 'Contingency', detail: '', usd: cost.contingencyUsd },
      ]
    : [];

  return (
    <DockPortal slot="top">
      <div className="cost" ref={rootRef} data-tour="cost">
        <button
          type="button"
          className={open ? 'cost-chip open' : 'cost-chip'}
          aria-expanded={open}
          aria-controls="cost-card"
          onClick={() => toggle(!open)}
        >
          <span className="cost-chip-label">Network cost</span>
          <span className="cost-chip-value num">{cost ? formatUsd(cost.totalUsd) : '-'}</span>
          <ChevronDown
            size={UI.icon.sizePx}
            strokeWidth={UI.icon.strokeWidth}
            aria-hidden="true"
            className={open ? 'build-chevron open' : 'build-chevron'}
          />
        </button>
        {open ? (
          <section
            id="cost-card"
            className="panel cost-card"
            aria-label="Network cost, full site"
            data-tour="cost-card"
          >
            <div className="cost-setup">
              <span className="label">{cost ? setupName(cost.label) : 'Not available'}</span>
              {cost && setupName(cost.label) === 'HaLow' ? (
                <a
                  className="cost-help"
                  href={LINKS.haLowUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={LINKS.haLowHelp}
                  title={LINKS.haLowHelp}
                >
                  <CircleHelp
                    size={UI.icon.sizePx - 2}
                    strokeWidth={UI.icon.strokeWidth}
                    aria-hidden="true"
                  />
                </a>
              ) : null}
            </div>
            <a
              className="cost-proven"
              href={LINKS.provenUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <strong>{LINKS.provenLabel}:</strong> {LINKS.provenDetail}
              <ExternalLink size={12} strokeWidth={UI.icon.strokeWidth} aria-hidden="true" />
            </a>
            {pricingErrors > 0 ? (
              <p className="build-warning" role="alert">
                The pricing file has {pricingErrors} error{pricingErrors === 1 ? '' : 's'}; see the
                console.
              </p>
            ) : null}
            {cost ? (
              <>
                <Kpi
                  label={`${formatCount(cost.modules)} radios on the full site`}
                  value={formatUsd(cost.totalUsd)}
                  headline
                />
                <Kpi label="Per container" value={formatUsd(cost.perContainerUsd)} />
                <Kpi label="Per kWh of storage" value={formatUsd(cost.perKwhUsd)} />
                <Kpi label="Share of P3 hardware" value={formatShare(cost.shareOfP3)} />
                <div className="build-breakdown">
                  {rows.map((r) => (
                    <div className="build-breakdown-row" key={r.label}>
                      <span className="build-breakdown-label">
                        {r.label}
                        {r.detail ? (
                          <span className="build-breakdown-detail">{r.detail}</span>
                        ) : null}
                      </span>
                      <InlineBar pct={(r.usd / cost.totalUsd) * PERCENT.scale} token="neutral" />
                      <span className="build-breakdown-value num">{formatUsd(r.usd)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="build-warning">The full-site cost is not available.</p>
            )}
            {alternatives ? (
              <button
                type="button"
                className="build-btn cost-compare"
                onClick={() => setSheet(true)}
              >
                <Scale size={UI.icon.sizePx} strokeWidth={UI.icon.strokeWidth} aria-hidden="true" />
                Compare alternatives
              </button>
            ) : null}
          </section>
        ) : null}
        {sheet && alternatives ? (
          <AlternativesSheet alternatives={alternatives} onClose={() => setSheet(false)} />
        ) : null}
      </div>
    </DockPortal>
  );
}
