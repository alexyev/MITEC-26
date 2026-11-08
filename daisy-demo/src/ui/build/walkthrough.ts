// Walkthrough of the Build & failure tab (spec 9.8): the steps and the times the scene needs from them.
// The failure steps sit on the failed radio's hello times, so 1/3, 2/3 and 3/3 land on step boundaries (D44).
import { ROUTING } from '../../config/defaults';
import { PLAY, PLAY_WALK } from '../../config/play';
import { computeNetwork, presetRadios, type Graph } from '../../engine/network';
import { presetFailS, simulate, statsAt } from '../../engine/packetSim';
import type { NetworkCost } from '../../engine/pricing';
import { formatUsd } from '../survey/format';
import { formatShare } from './format';
import type { PlayModel } from '../../engine/playModel';
import { stepStarts } from '../player/clock';
import type { WalkStep } from '../player/types';

const count = new Intl.NumberFormat('en-US');

export interface BuildTimeline {
  steps: WalkStep[];
  /** Start time of every step. */
  starts: number[];
  buildStartS: number;
  /** Traffic starts here: the packet simulation's start. */
  dataStartS: number;
  failedRadio: number;
  watchedRadio: number;
  failS: number;
  /** The neighbors declare the radio down here (3/3 missed hellos). */
  detectS: number;
  costS: number;
  yourTurnS: number;
}

/** The full-site cost behind the cost step's caption; null when the pricing file cannot be costed. */
export type CostSummary = Pick<NetworkCost, 'modules' | 'totalUsd' | 'shareOfP3'> | null;

export function buildTimeline(
  model: PlayModel,
  graph: Graph,
  cost: CostSummary = null,
): BuildTimeline {
  const { watched: watchedRadio, failed: failedRadio } = presetRadios(model, graph);
  const buildS = model.buildS + PLAY_WALK.buildHoldS;
  // The build step shows the first stage, inside the base's coverage; the power step starts when its
  // radios switch on and the coverage grows.
  const firstRadioS = Math.min(...model.radios.map((r) => r.onS));
  const buildStartS = PLAY_WALK.sectionS;
  const dataStartS = buildStartS + buildS + PLAY_WALK.coverageS;
  const failS = presetFailS(graph, failedRadio, dataStartS + PLAY_WALK.dataS);
  const lastHelloS = failS - PLAY.failAfterHelloS;
  const firstMissS = lastHelloS + ROUTING.helloIntervalS;
  const detectS = lastHelloS + ROUTING.missedHellosToDown * ROUTING.helloIntervalS;
  const recoveredS = detectS + PLAY_WALK.rerouteS;

  // Captions state what the simulation shows: the detour's extra hops and the packets lost by recovery.
  const alive = new Uint8Array(model.radios.length).fill(1);
  const healthy = computeNetwork(graph, alive).routing.hops[watchedRadio];
  alive[failedRadio] = 0;
  const detour = computeNetwork(graph, alive).routing.hops[watchedRadio];
  const extraHops = detour - healthy;
  const lost = statsAt(
    simulate({
      graph,
      startS: dataStartS,
      endS: recoveredS,
      changes: [{ tS: failS, radio: failedRadio, kind: 'fail' }],
    }),
    recoveredS,
  ).lost;
  const lostText = lost === 0 ? 'No data lost.' : `${count.format(lost)} packets lost.`;
  const hopsText =
    extraHops === 0
      ? 'The new path is as short as the old one.'
      : `The new path is ${extraHops} ${extraHops === 1 ? 'hop' : 'hops'} longer.`;
  const costCaption = cost
    ? `The full site needs ${count.format(cost.modules)} of these radios: about ${formatUsd(
        cost.totalUsd,
      )}, ${formatShare(cost.shareOfP3)} of the P3 hardware.`
    : null;

  const steps: WalkStep[] = [
    {
      id: 'section',
      label: 'Section',
      caption: 'A small section of the site. The base at the center links to Starlink.',
      durationS: PLAY_WALK.sectionS,
    },
    {
      id: 'build',
      label: 'Build',
      caption:
        "Stage 1 works only inside the base's coverage: grade, piles, trench, place, connect.",
      durationS: firstRadioS,
    },
    {
      id: 'power',
      label: 'Power',
      caption:
        'Each finished stage switches its radios on; coverage grows and the next stage starts.',
      durationS: buildS - firstRadioS,
    },
    {
      id: 'coverage',
      label: 'Coverage',
      caption: 'Green circles show where the signal reaches. The whole section is covered.',
      durationS: PLAY_WALK.coverageS,
    },
    {
      id: 'data',
      label: 'Data',
      caption: 'Blue dots are data. Each radio sends to the base through its neighbors.',
      durationS: failS - dataStartS,
    },
    {
      id: 'failure',
      label: 'Failure',
      caption: "This radio fails. Its neighbors' circles overlap, so the ground stays covered.",
      durationS: firstMissS - failS,
    },
    {
      id: 'detection',
      label: 'Detection',
      caption: 'Its neighbors miss three hellos in a row. Data waits in a queue.',
      durationS: detectS - firstMissS,
    },
    {
      id: 'reroute',
      label: 'Reroute',
      caption: 'The traffic goes around the failed radio, down another lane and column.',
      durationS: PLAY_WALK.rerouteS,
    },
    {
      id: 'recovered',
      label: 'Recovered',
      caption: `${lostText} ${hopsText} A repair ticket is sent.`,
      durationS: PLAY_WALK.recoveredS,
    },
  ];
  if (costCaption) {
    steps.push({ id: 'cost', label: 'Cost', caption: costCaption, durationS: PLAY_WALK.costS });
  }
  steps.push({
    id: 'your-turn',
    label: 'Your turn',
    caption: 'Your turn: click any radio to fail it. Click it again to repair it.',
    durationS: Infinity,
  });

  const starts = stepStarts(steps);
  const startOf = (id: string) => starts[steps.findIndex((s) => s.id === id)];
  return {
    steps,
    starts,
    buildStartS,
    dataStartS,
    failedRadio,
    watchedRadio,
    failS,
    detectS,
    costS: costCaption ? startOf('cost') : Infinity,
    yourTurnS: startOf('your-turn'),
  };
}

/** Steps whose motion is slowed for visibility (spec 0.5). */
export const SLOWED_STEPS = new Set([
  'data',
  'failure',
  'detection',
  'reroute',
  'recovered',
  'cost',
  'your-turn',
]);
