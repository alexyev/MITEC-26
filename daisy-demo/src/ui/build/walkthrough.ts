// Walkthrough of the Build & failure tab (spec 9.8, D70, D170): the build, an edge radio failure mid-build traced
// through a frontier robot's data and its handover to another edge radio, the build to its end, then "Your turn".
// The failure steps sit on hello times (D44).
import { ROUTING } from '../../config/defaults';
import { PLAY, PLAY_WALK } from '../../config/play';
import type { Graph } from '../../engine/network';
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
import { featuredRadio } from '../scene3d/featured';
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
  /** The edge radio the robot sends through, which fails (D170). */
  failedRadio: number;
  /** The edge radio the robot connects to once the failed radio is gone; -1 when none covers it. */
  handoverRadio: number;
  /** The radio that covered the robot at the hold; "Your turn" keeps its route highlighted. */
  watchedRadio: number;
  failS: number;
  /** The neighbors declare the radio down here (3/3 missed hellos), and the "Handover" step starts. */
  detectS: number;
  /** The robot links to the handover radio here: when it, like the neighbors, has missed the hellos. */
  handoverS: number;
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
  // The "Take me there" radio stays up: the 3D view is there to show its four beams (D121, D170).
  const scenario = failureScenario(model, graph, [featuredRadio(model)]);
  const { holdBuildS, failed, robot } = scenario;
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
  const detectS = lastHelloS + n * ROUTING.helloIntervalS;
  const ticketS = detectS + PLAY_WALK.handoverS;
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
  // The robot's handover (D170): the radio it links to once it, like the failed radio's neighbors, has missed
  // its hellos. The coverage rule (D51) picks the same radio the scenario chose.
  const relink = sim.events.find(
    (e) => e.kind === 'uplink' && e.node === robotNode && e.tS > failS,
  );
  const handoverRadio = relink ? relink.other : -1;
  const handoverS = relink ? relink.tS : Infinity;
  const held = relink ? queueAt(sim, robotNode, handoverS - BEFORE_S) : 0;
  const waiting = statsAt(sim, detectS - BEFORE_S).queued;
  const packets = (k: number) => `${count.format(k)} ${k === 1 ? 'packet' : 'packets'}`;

  let lostText = `No data lost: all ${packets(waiting)} queued reach the base`;
  if (end.lost > 0) lostText = `${packets(end.lost)} lost`;
  else if (end.queued > 0) lostText = `No data lost; ${packets(end.queued)} still queued`;
  const hopsText =
    extraHops === 0
      ? 'on a route as short as before.'
      : `on a route ${Math.abs(extraHops)} ${Math.abs(extraHops) === 1 ? 'hop' : 'hops'} ${
          extraHops > 0 ? 'longer' : 'shorter'
        }.`;
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
      caption: `Time slows mid-build. The ${robotName} sends via edge radio ${label(failed)}, ${radioHops} hops from the base.`,
      durationS: failS - holdS,
    },
    {
      id: 'failure',
      label: 'Edge radio fails',
      caption: `Edge radio ${label(failed)} fails and the ${robotName}'s link drops. Still in coverage, it keeps working.`,
      durationS: detectS - failS,
    },
    {
      id: 'handover',
      label: 'Handover',
      caption:
        handoverRadio >= 0
          ? `The ${robotName} connects to ${label(handoverRadio)}, another edge radio, and sends the ${packets(held)} it held.`
          : `No other radio covers the ${robotName}, so it stops.`,
      durationS: ticketS - detectS,
    },
    {
      id: 'recovered',
      label: 'Recovered',
      caption: `${lostText}, ${hopsText}`,
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
    handoverRadio,
    watchedRadio: failed,
    failS,
    detectS,
    handoverS,
    ticketS,
    costS: costCaption ? startOf('cost') : Infinity,
    yourTurnS: startOf('your-turn'),
    sim: walkSim,
  };
}

/** Steps whose motion is slowed for visibility (spec 0.5). */
export const SLOWED_STEPS = new Set(['robot', 'failure', 'handover', 'recovered', 'your-turn']);
