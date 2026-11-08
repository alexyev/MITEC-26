// Readout card of the Build & failure tab (spec 9.7): CONNECT, and STRESS-TEST once a radio has failed.
// Numbers are tabular, with thousands separators and at most 3 significant digits (spec 6.4).
import { ROUTING } from '../../config/defaults';
import { PLAY } from '../../config/play';
import type { PlayModel } from '../../engine/playModel';
import { Kpi } from '../kit/Kpi';
import { Panel } from '../kit/Panel';
import { Section } from '../kit/Section';
import type { Scene } from './scene';

const count = new Intl.NumberFormat('en-US');
const seconds = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 3 });

/** Coverage with one decimal, but never "100.0" for a section that is not fully covered. */
function coverageText(share: number): string {
  const pct = share * 100;
  if (share >= 1) return '100';
  return (Math.floor(pct * 10) / 10).toFixed(1);
}

export function BuildReadout({ model, scene }: { model: PlayModel; scene: Scene }) {
  const net = scene.network;
  const latest = scene.latest;
  const stats = scene.stats;
  const coverage = coverageText(net.coverage);
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
          value={coverage}
          unit="%"
          bar={{ pct: net.coverage * 100, token: 'signal', targetPct: PLAY.coverageTargetPct }}
          note={`Target ${PLAY.coverageTargetPct}%`}
        />
      </Section>
      {latest && stats ? (
        <Section label="Stress-test">
          <Kpi
            label="Detected in"
            value={
              latest.record.detectS !== null && latest.detected
                ? seconds.format(latest.record.detectS - latest.record.failS)
                : `${latest.missedHellos}/${ROUTING.missedHellosToDown} missed`
            }
            unit={latest.detected ? 's' : undefined}
          />
          <Kpi
            label="Rerouted in"
            value={
              latest.record.reroutedS !== null && latest.rerouted
                ? seconds.format(latest.record.reroutedS - latest.record.failS)
                : '-'
            }
            unit={latest.rerouted ? 's' : undefined}
          />
          <Kpi
            label="Packets lost"
            value={count.format(stats.lost)}
            note={`${count.format(stats.sent)} sent · ${count.format(stats.delivered)} delivered`}
          />
          <Kpi label="Largest queue" value={count.format(stats.largestQueue)} />
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
    </Panel>
  );
}
