// Walkthrough of the Build & failure tab (spec 9.8, D70): the build, a radio failure mid-build traced through a
// frontier robot's data, the build to its end, then "Your turn". The failure steps sit on hello times (D44).
import { ROUTING } from '../../config/defaults';
import { PLAY, PLAY_WALK } from '../../config/play';
import { coveringNode } from '../../engine/machines';
import { computeNetwork, type Graph } from '../../engine/network';
import {
  pathAt,
  presetFailS,
  queueAt,
  simulate,
  sourceNode,
  statsAt,
  type MachineSource,
  type SimChange,
} from '../../engine/packetSim';
import type { NetworkCost } from '../../engine/pricing';
import type { PlayModel } from '../../engine/playModel';
import { failureScenario, type FailureScenario } from '../../engine/scenario';
import { formatUsd } from '../survey/format';
import { formatShare } from './format';
import { stepStarts } from '../player/clock';
import type { WalkStep } from '../player/types';

const count = new Intl.NumberFormat('en-US');

/**
 * The walkthrough's packet simulation, without the user's changes: its traffic runs from the hold to the
 * resume, while the robot's data plays out, and stops there (D103).
 */
export interface WalkSim {
  startS: number;
  trafficUntilS: number;
  /** Radios on at the start: the partly built network of the hold. */
  online: Uint8Array;
  /** The robot, sending while the build holds. */
  sources: MachineSource[];
  /** The failure and its repair, and every radio the rest of the build switches on. */
  changes: SimChange[];
}

export interface BuildTimeline {
  steps: WalkStep[];
  /** Start time of every step. */
  starts: number[];
  buildStartS: number;
  /**
   * The build holds from `holdS` to `resumeS` while the robot's data and the failure play out in seconds;
   * the network reacts in seconds, the build takes weeks (D70). Traffic starts at `holdS`.
   */
  holdS: number;
  resumeS: number;
  holdBuildS: number;
  /** The build is finished here. */
  buildEndS: number;
  scenario: FailureScenario;
  /** Node id of the robot in the simulation. */
  robotNode: number;
  failedRadio: number;
  /** The radio that covers the robot; "Your turn" keeps its route highlighted. */
  watchedRadio: number;
  failS: number;
  /** The neighbors declare the radio down here (3/3 missed hellos). */
  detectS: number;
  /** The ticket goes out here, when the "Recovered" step starts. */
  ticketS: number;
  costS: number;
  yourTurnS: number;
  sim: WalkSim;
}

/** The full-site cost behind the cost step's caption; null when the pricing file cannot be costed. */
export type CostSummary = Pick<NetworkCost, 'modules' | 'totalUsd' | 'shareOfP3'> | null;

/** Build time at player time t: the build stands still while it holds. */
export function buildTimeAt(tl: BuildTimeline, t: number): number {
  if (t < tl.holdS) return t - tl.buildStartS;
  if (t < tl.resumeS) return tl.holdBuildS;
  return tl.holdBuildS + (t - tl.resumeS);
}

/** Player time at which the build reaches build time b (the end of the hold for b at the hold). */
export function timeOfBuild(tl: BuildTimeline, b: number): number {
  return b < tl.holdBuildS ? tl.buildStartS + b : tl.resumeS + (b - tl.holdBuildS);
}

/** Packets, routes and the dimmed map show while the robot's data plays out, and in "Your turn". */
export function dataShownAt(tl: BuildTimeline, t: number): boolean {
  return (t >= tl.holdS && t < tl.resumeS) || t >= tl.yourTurnS;
}

/** A tiny step before an event, to read the state just before it. */
const BEFORE_S = 1e-6;

export function buildTimeline(
  model: PlayModel,
  graph: Graph,
  cost: CostSummary = null,
): BuildTimeline {
  const scenario = failureScenario(model, graph);
  const { holdBuildS, uplink, failed, robot } = scenario;
  const label = (id: number) => (id === graph.baseId ? 'the base' : model.radios[id].label);
  const machine = PLAY.equipment.kinds[robot.glyph].name;
  const robotName = machine.toLowerCase();
  const n = ROUTING.missedHellosToDown;

  // The build step shows the first stage, inside the base's coverage; the power step starts when its
  // radios switch on and the coverage grows, and ends at the hold.
  const firstRadioS = Math.min(...model.radios.map((r) => r.onS));
  const buildStartS = PLAY_WALK.sectionS;
  const holdS = buildStartS + holdBuildS;
  const failS = presetFailS(graph, failed, holdS + PLAY_WALK.dataS);
  const lastHelloS = failS - PLAY.failAfterHelloS;
  const firstMissS = lastHelloS + ROUTING.helloIntervalS;
  const detectS = lastHelloS + n * ROUTING.helloIntervalS;
  const ticketS = detectS + PLAY_WALK.rerouteS;
  const resumeS = ticketS + PLAY_WALK.recoveredS;
  const restS = model.buildS - holdBuildS + PLAY_WALK.buildHoldS;
  const buildEndS = resumeS + model.buildS - holdBuildS;

  const robotNode = sourceNode(graph, 0);
  const sources: MachineSource[] = [
    {
      x: robot.x,
      y: robot.y,
      fromS: holdS,
      toS: resumeS,
      packetIntervalS: PLAY.scenario.robotPacketIntervalS,
    },
  ];
  // The repair goes in when the build resumes: a swap takes minutes, the build weeks.
  const changes: SimChange[] = [
    { tS: failS, radio: failed, kind: 'fail' },
    { tS: resumeS, radio: failed, kind: 'repair' },
  ];
  for (const r of model.radios) {
    if (!scenario.online[r.id])
      changes.push({ tS: resumeS + r.onS - holdBuildS, radio: r.id, kind: 'on' });
  }
  const walkSim: WalkSim = {
    startS: holdS,
    trafficUntilS: resumeS,
    online: scenario.online,
    sources,
    changes,
  };

  // Captions state what the simulation shows, up to the end of the hold.
  const sim = simulate({ graph, endS: resumeS, ...walkSim });
  const hopsAtS = (t: number) => pathAt(sim, robotNode, t).length - 1;
  const radioHops = scenario.route.length - 1;
  const extraHops = hopsAtS(resumeS - BEFORE_S) - hopsAtS(holdS);
  const end = statsAt(sim, resumeS - BEFORE_S);
  const waiting = statsAt(sim, detectS - BEFORE_S).queued;
  let queueNode = uplink;
  for (let i = 0; i < graph.nodeCount; i++) {
    if (queueAt(sim, i, detectS - BEFORE_S) > queueAt(sim, queueNode, detectS - BEFORE_S))
      queueNode = i;
  }
  const repair = sim.events.find((e) => e.kind === 'localRepair');

  // The robot's own link through the failure, by the coverage rule (D51).
  const alive = scenario.online.slice();
  alive[failed] = 0;
  const via = coveringNode(
    graph,
    computeNetwork(graph, alive).connected,
    PLAY.coverageRadiusM,
    robot.x,
    robot.y,
  );
  const robotLink =
    via >= 0
      ? `${label(via)} still covers the ${robotName}, so it keeps working.`
      : `The ${robotName} has no coverage left and stops.`;
  let lostText = `No data lost: all ${count.format(waiting)} queued packets reach the base.`;
  if (end.lost > 0) lostText = `${count.format(end.lost)} packets lost.`;
  else if (end.queued > 0)
    lostText = `No data lost; ${count.format(end.queued)} packets still queued.`;
  const hopsText =
    extraHops === 0
      ? 'The route is as short as before.'
      : `The route is ${extraHops} ${extraHops === 1 ? 'hop' : 'hops'} longer.`;
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
      durationS: holdBuildS - firstRadioS,
    },
    {
      id: 'robot',
      label: 'Robot data',
      caption: `Time slows mid-build. The ${robotName} reports via ${label(uplink)}, ${radioHops} hops from the base.`,
      durationS: failS - holdS,
    },
    {
      id: 'failure',
      label: 'Failure',
      caption: `Radio ${label(failed)} on its route fails. ${robotLink}`,
      durationS: firstMissS - failS,
    },
    {
      id: 'detection',
      label: 'Detection',
      caption: `Its neighbors miss ${n} hellos in a row. The data waits in a queue at ${label(queueNode)}.`,
      durationS: detectS - firstMissS,
    },
    {
      id: 'reroute',
      label: 'Reroute',
      caption: repair
        ? `${label(repair.node)} switches to its backup, ${label(repair.other)}, and the new route spreads.`
        : "The new route spreads from the failed radio's neighbors.",
      durationS: ticketS - detectS,
    },
    {
      id: 'recovered',
      label: 'Recovered',
      caption: `${lostText} ${hopsText}`,
      durationS: resumeS - ticketS,
    },
    {
      id: 'resume',
      label: 'Resume',
      caption: `A crew swaps ${label(failed)}; it rejoins at its next hello and the build carries on.`,
      durationS: restS,
    },
    {
      id: 'coverage',
      label: 'Coverage',
      caption: 'Green circles show where the signal reaches. The whole section is covered.',
      durationS: PLAY_WALK.coverageS,
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
    holdS,
    resumeS,
    holdBuildS,
    buildEndS,
    scenario,
    robotNode,
    failedRadio: failed,
    watchedRadio: uplink,
    failS,
    detectS,
    ticketS,
    costS: costCaption ? startOf('cost') : Infinity,
    yourTurnS: startOf('your-turn'),
    sim: walkSim,
  };
}

/** Steps whose motion is slowed for visibility (spec 0.5). */
export const SLOWED_STEPS = new Set([
  'robot',
  'failure',
  'detection',
  'reroute',
  'recovered',
  'your-turn',
]);
