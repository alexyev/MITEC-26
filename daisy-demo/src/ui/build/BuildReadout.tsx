// Readout card of the Build & failure tab (spec 9.7): CONNECT, and STRESS-TEST once a radio has failed. The cost
// sits apart in the top row (CostChip, D54). Numbers are tabular with at most 3 significant digits (spec 6.4).
import { ROUTING } from '../../config/defaults';
import { PERCENT, PLAY } from '../../config/play';
import type { PlayModel } from '../../engine/playModel';
import { Kpi } from '../kit/Kpi';
import { Panel } from '../kit/Panel';
import { Section } from '../kit/Section';
import { formatCount, formatSeconds } from './format';
import type { Scene } from './scene';

/** Coverage with one decimal, but never "100.0" for a section that is not fully covered. */
function coverageText(share: number): string {
  if (share >= 1) return String(PERCENT.scale);
  const tenths =
    Math.floor(share * PERCENT.scale * PERCENT.coverageTenths) / PERCENT.coverageTenths;
  return tenths.toFixed(1);
}

/** The route the extra hops are about: the robot's while it sends (D70), else its radio's. */
function watchedLabel(model: PlayModel, scene: Scene): string {
  const robot = scene.robot ? scene.machines[scene.robot.index] : null;
  if (robot)
    return `Extra hops, ${model.config.equipment.kinds[robot.glyph].name.toLowerCase()} route`;
  return `Extra hops, ${model.radios[scene.watchedRadio].label} route`;
}

export interface BuildReadoutProps {
  model: PlayModel;
  scene: Scene;
}

export function BuildReadout({ model, scene }: BuildReadoutProps) {
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
            label={watchedLabel(model, scene)}
            value={
              scene.watchedExtraHops === null
                ? 'No route'
                : `${scene.watchedExtraHops > 0 ? '+' : ''}${scene.watchedExtraHops}`
            }
          />
        </Section>
      ) : null}
    </Panel>
  );
}
