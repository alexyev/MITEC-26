// Walkthrough of the Build & failure tab (spec 9.8): the steps and the times the scene needs from them.
// The failure steps sit on the failed radio's hello times, so 1/3, 2/3 and 3/3 land on step boundaries (D44).
import { ROUTING } from '../../config/defaults';
import { PLAY, PLAY_WALK } from '../../config/play';
import type { Graph } from '../../engine/network';
import { presetFailS } from '../../engine/packetSim';
import { buildDurationS, cellRadioId, type PlayModel } from '../../engine/playModel';
import { stepStarts } from '../player/clock';
import type { WalkStep } from '../player/types';

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

/** A caption for the cost step, or null while the cost section is not wired. */
export type CostCaption = string | null;

export function buildTimeline(
  model: PlayModel,
  graph: Graph,
  costCaption: CostCaption = null,
): BuildTimeline {
  const failedRadio = cellRadioId(model, PLAY.preset.failedCell.col, PLAY.preset.failedCell.row);
  const watchedRadio = cellRadioId(model, PLAY.preset.watchedCell.col, PLAY.preset.watchedCell.row);
  const buildS = buildDurationS(model) + PLAY_WALK.buildHoldS;
  // The build step shows the frontier layers; the power step starts when the first radio switches on.
  const firstRadioS = Math.min(...model.radios.map((r) => r.onStep)) * PLAY.buildStepS;
  const buildStartS = PLAY_WALK.sectionS;
  const dataStartS = buildStartS + buildS + PLAY_WALK.coverageS;
  const failS = presetFailS(graph, failedRadio, dataStartS + PLAY_WALK.dataS);
  const lastHelloS = failS - PLAY.preset.failAfterHelloS;
  const firstMissS = lastHelloS + ROUTING.helloIntervalS;
  const detectS = lastHelloS + ROUTING.missedHellosToDown * ROUTING.helloIntervalS;

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
      caption: 'Work moves out from the center in layers: grade, piles, trench, place, connect.',
      durationS: firstRadioS,
    },
    {
      id: 'power',
      label: 'Power',
      caption: 'Each radio switches on once its unit has power, so the frontier stays online.',
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
      caption: 'This radio fails.',
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
      caption: 'No data lost. The new path is 2 hops longer. A repair ticket is sent.',
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
