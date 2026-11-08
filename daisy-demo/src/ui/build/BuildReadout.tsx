// Readout card of the Build & failure tab (spec 9.7, 10.3): CONNECT, STRESS-TEST once a radio has failed, and
// the full-site network cost from pricing.ts. Numbers are tabular with at most 3 significant digits (spec 6.4).
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { ROUTING, UI } from '../../config/defaults';
import { PERCENT, PLAY } from '../../config/play';
import type { NetworkCost } from '../../engine/pricing';
import type { PlayModel } from '../../engine/playModel';
import { Chip } from '../kit/Chip';
import { InlineBar } from '../kit/InlineBar';
import { Kpi } from '../kit/Kpi';
import { Panel } from '../kit/Panel';
import { Section } from '../kit/Section';
import { formatUsd } from '../survey/format';
import { formatCount, formatSeconds, formatShare } from './format';
import type { Scene } from './scene';

const ESTIMATE = 'Team estimate · not quotes';

/** Coverage with one decimal, but never "100.0" for a section that is not fully covered. */
function coverageText(share: number): string {
  if (share >= 1) return String(PERCENT.scale);
  const tenths =
    Math.floor(share * PERCENT.scale * PERCENT.coverageTenths) / PERCENT.coverageTenths;
  return tenths.toFixed(1);
}

export interface BuildReadoutProps {
  model: PlayModel;
  scene: Scene;
  cost: NetworkCost | null;
  pricingErrors: number;
  /** The walkthrough's cost step: highlight the cost section and scroll it into view. */
  costFocus: boolean;
  /** The breakdown opens by default from the cost step on (spec 10.3). */
  breakdownDefault: boolean;
}

export function BuildReadout({
  model,
  scene,
  cost,
  pricingErrors,
  costFocus,
  breakdownDefault,
}: BuildReadoutProps) {
  const net = scene.network;
  const latest = scene.latest;
  const stats = scene.stats;
  const failed = scene.failed.subarray(0, model.radios.length).reduce((n, f) => n + f, 0);

  return (
    <Panel corner="tr" title="Readout">
      <Section label="Connect">
        <Kpi
          label="Radios online"
          value={`${net.connectedRadios}/${model.radios.length}`}
          headline
          note={latest ? `${failed} failed · ${net.cutOffRadios} cut off` : undefined}
        />
        <Kpi
          label="Coverage"
          value={coverageText(net.coverage)}
          unit="%"
          bar={{
            pct: net.coverage * PERCENT.scale,
            token: 'signal',
            targetPct: PLAY.coverageTargetPct,
          }}
          note={`Target ${PLAY.coverageTargetPct}%`}
        />
      </Section>
      {latest && stats ? (
        <Section label="Stress-test">
          <Kpi
            label="Detected in"
            value={
              latest.record.detectS !== null && latest.detected
                ? formatSeconds(latest.record.detectS - latest.record.failS)
                : `${latest.missedHellos}/${ROUTING.missedHellosToDown} missed`
            }
            unit={latest.detected ? 's' : undefined}
          />
          <Kpi
            label="Rerouted in"
            value={
              latest.record.reroutedS !== null && latest.rerouted
                ? formatSeconds(latest.record.reroutedS - latest.record.failS)
                : '-'
            }
            unit={latest.rerouted ? 's' : undefined}
          />
          <Kpi
            label="Packets lost"
            value={formatCount(stats.lost)}
            note={`${formatCount(stats.sent)} sent · ${formatCount(stats.delivered)} delivered`}
          />
          <Kpi label="Largest queue" value={formatCount(stats.largestQueue)} />
          <Kpi
            label="Extra hops, watched route"
            value={
              scene.watchedExtraHops === null
                ? 'No route'
                : `${scene.watchedExtraHops > 0 ? '+' : ''}${scene.watchedExtraHops}`
            }
          />
        </Section>
      ) : null}
      <CostSection
        cost={cost}
        pricingErrors={pricingErrors}
        focus={costFocus}
        breakdownDefault={breakdownDefault}
      />
    </Panel>
  );
}

function CostSection({
  cost,
  pricingErrors,
  focus,
  breakdownDefault,
}: {
  cost: NetworkCost | null;
  pricingErrors: number;
  focus: boolean;
  breakdownDefault: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // null follows the walkthrough's default; a click sets it until the default changes again.
  const [choice, setChoice] = useState<{ open: boolean; forDefault: boolean } | null>(null);
  const expanded =
    choice && choice.forDefault === breakdownDefault ? choice.open : breakdownDefault;

  useEffect(() => {
    if (focus) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focus]);

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
    <div ref={ref} className={focus ? 'build-cost focus' : 'build-cost'}>
      <Section
        label="Cost · full site"
        aside={cost && !cost.verified ? <Chip text={ESTIMATE} /> : undefined}
      >
        {pricingErrors > 0 ? (
          <p className="build-warning" role="alert">
            The pricing file has {pricingErrors} error{pricingErrors === 1 ? '' : 's'}; see the
            console.
          </p>
        ) : null}
        {cost ? (
          <>
            <p className="build-cost-setup">
              {cost.label} · {formatCount(cost.modules)} modules
            </p>
            <Kpi label="Total" value={formatUsd(cost.totalUsd)} headline />
            <Kpi label="Per container" value={formatUsd(cost.perContainerUsd)} />
            <Kpi label="Per kWh of storage" value={formatUsd(cost.perKwhUsd)} />
            <Kpi label="Share of P3 hardware" value={formatShare(cost.shareOfP3)} />
            <button
              type="button"
              className="build-disclosure"
              aria-expanded={expanded}
              onClick={() => setChoice({ open: !expanded, forDefault: breakdownDefault })}
            >
              Breakdown
              <ChevronDown
                size={UI.icon.sizePx}
                strokeWidth={UI.icon.strokeWidth}
                aria-hidden="true"
                className={expanded ? 'build-chevron open' : 'build-chevron'}
              />
            </button>
            {expanded ? (
              <div className="build-breakdown">
                {rows.map((r) => (
                  <div className="build-breakdown-row" key={r.label}>
                    <span className="build-breakdown-label">
                      {r.label}
                      {r.detail ? <span className="build-breakdown-detail">{r.detail}</span> : null}
                    </span>
                    <InlineBar pct={(r.usd / cost.totalUsd) * PERCENT.scale} token="unit" />
                    <span className="build-breakdown-value num">{formatUsd(r.usd)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <p className="build-warning">The full-site cost is not available.</p>
        )}
      </Section>
    </div>
  );
}
