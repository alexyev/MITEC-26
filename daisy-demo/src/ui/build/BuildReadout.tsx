// Readout card of the Build & failure tab (spec 9.7): CONNECT, and STRESS-TEST once a radio has failed. The cost
// sits apart in the top row (CostChip, D54). Numbers are tabular with at most 3 significant digits (spec 6.4).
import { Gauge } from 'lucide-react';
import { ROUTING } from '../../config/defaults';
import { PERCENT, PLAY } from '../../config/play';
import type { PlayModel } from '../../engine/playModel';
import { usePanelFold } from '../../state/panels';
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

const extraHopsText = (extra: number | null) =>
  extra === null ? 'No route' : `${extra > 0 ? '+' : ''}${extra}`;

/**
 * The watched row. While the robot sends (D70) it is the robot's link (D170): the radio it sends through, or
 * "Lost" while that radio is silent. Otherwise, the extra hops on the route of the radio that covered it. One
 * line either way, so the readout fits beside the legend at 1280 x 720 (D72).
 */
function WatchedKpi({ model, scene }: BuildReadoutProps) {
  const robot = scene.robot;
  if (!robot)
    return (
      <Kpi
        label={`Extra hops, ${model.radios[scene.watchedRadio].label} route`}
        value={extraHopsText(scene.watchedExtraHops)}
      />
    );
  const name = model.config.equipment.kinds[scene.machines[robot.index].glyph].name;
  const radio = (id: number) => model.radios[id]?.label ?? 'base';
  let value = 'No link';
  if (robot.linkDown) value = 'Lost';
  else if (robot.uplink >= 0) value = radio(robot.uplink);
  return <Kpi label={`${name} sends via`} value={value} />;
}

export interface BuildReadoutProps {
  model: PlayModel;
  scene: Scene;
}

export function BuildReadout({ model, scene }: BuildReadoutProps) {
  const net = scene.network;
  const latest = scene.latest;
  const stats = scene.stats;
  const fold = usePanelFold('build', 'readout');
  const failed = scene.failed.subarray(0, model.radios.length).reduce((n, f) => n + f, 0);

  return (
    <Panel corner="tr" title="Readout" chipIcon={Gauge} {...fold}>
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
          {scene.robot ? (
            <Kpi
              label="Handover in"
              value={
                scene.robot.handover
                  ? formatSeconds(scene.robot.handover.atS - latest.record.failS)
                  : '-'
              }
              unit={scene.robot.handover ? 's' : undefined}
            />
          ) : (
            <Kpi
              label="Rerouted in"
              value={
                latest.record.reroutedS !== null && latest.rerouted
                  ? formatSeconds(latest.record.reroutedS - latest.record.failS)
                  : '-'
              }
              unit={latest.rerouted ? 's' : undefined}
            />
          )}
          <Kpi
            label="Packets lost"
            value={formatCount(stats.lost)}
            note={`${formatCount(stats.sent)} sent · ${formatCount(stats.delivered)} delivered`}
          />
          <Kpi label="Largest queue" value={formatCount(stats.largestQueue)} />
          <WatchedKpi model={model} scene={scene} />
        </Section>
      ) : null}
    </Panel>
  );
}
