// The walkthrough's failure mid-build (D70, D170): the build moment it holds at, the frontier robot whose data it
// follows, the edge radio the robot sends through, which fails, and the other edge radio that takes the robot over.
import { coveringNode, machinesAt, type Machine } from './machines';
import { computeNetwork, routePath, type Graph } from './network';
import { buildClockAt, buildStateAt, RadioBuild, type PlayModel } from './playModel';

export interface FailureScenario {
  /** Build time the walkthrough holds at: `phaseShare` of the way through its phase of a stage. */
  holdBuildS: number;
  phaseShare: number;
  stage: number;
  phase: number;
  /** The robot whose data the walkthrough follows: its team in the stage, and the machine at the hold. */
  team: number;
  robot: Machine;
  /** 1 for every radio that is on at the hold: the partly built network. */
  online: Uint8Array;
  /** 1 for every radio that is on at the hold and on the outer edge of that network (`edgeRadios`). */
  edge: Uint8Array;
  /**
   * The edge radio the robot sends through at the hold (the nearest that covers it, D51), and its route to
   * the base. It is the radio that fails.
   */
  failed: number;
  route: number[];
  /**
   * The other edge radio that covers the robot: the one it connects to once the failed radio is gone, by the
   * same coverage rule, and its route to the base on the network without the failed radio.
   */
  handover: number;
  handoverRoute: number[];
}

/** The four grid neighbors of a radio cell: east, west, north, south. */
const SIDES: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * 1 for every radio that is on and on the outer edge of the network the `online` radios form (D170): one of
 * its four sides on the radio grid has no radio that is on, because that radio is not built yet or the site
 * ends there.
 */
export function edgeRadios(model: PlayModel, online: Uint8Array): Uint8Array {
  const { cellCols, cellRows } = model.config;
  const edge = new Uint8Array(model.radios.length);
  for (const r of model.radios) {
    if (!online[r.id]) continue;
    for (const [dc, dr] of SIDES) {
      const col = r.cellCol + dc;
      const row = r.cellRow + dr;
      const inside = col >= 0 && col < cellCols && row >= 0 && row < cellRows;
      const id = inside ? model.cellRadio[row * cellCols + col] : -1;
      if (id < 0 || !online[id]) {
        edge[r.id] = 1;
        break;
      }
    }
  }
  return edge;
}

/** Stage indices from the middle stage outward: middle, one later, one earlier, two later, and so on. */
function stagesFromMiddle(count: number): number[] {
  const mid = Math.floor(count / 2);
  const out = [mid];
  for (let k = 1; out.length < count; k++) {
    if (mid + k < count) out.push(mid + k);
    if (mid - k >= 0) out.push(mid - k);
  }
  return out;
}

/**
 * The walkthrough's failure (D170). It holds the build part of the way through the scenario's phase of the
 * middle stage, at the first of `scenario.phaseShares` where a robot qualifies, else in the nearest stage that
 * has one. A robot qualifies when it sends through an edge radio and another edge radio also covers it, which it
 * reaches once the first is gone, and when that failure leaves every other machine of the moment in coverage
 * too, so only the handover changes. The radio that fails is that first edge radio. Radios in `exclude` (the
 * "Take me there" radio, D121) never fail and never take over. Among qualifying robots the east face's comes
 * first, then the longest route to the base, then the one nearest the base's row.
 */
export function failureScenario(
  model: PlayModel,
  graph: Graph,
  exclude: readonly number[] = [],
): FailureScenario {
  const { config } = model;
  const phase = config.frontierPhases.findIndex((p) => p.id === config.scenario.phase);
  if (model.stages.length === 0 || phase < 0)
    throw new Error('The play model has no stage or phase to hold the build in.');
  const excluded = new Set(exclude);
  const radius = config.coverageRadiusM;

  const holds = stagesFromMiddle(model.stages.length).flatMap((s) =>
    config.scenario.phaseShares.map((phaseShare) => ({ s, phaseShare })),
  );
  for (const { s, phaseShare } of holds) {
    const stage = model.stages[s];
    const holdBuildS = stage.startS + (phase + phaseShare) * stage.phaseS;
    const clock = buildClockAt(model, holdBuildS);
    if (clock.done || clock.stage !== s || clock.phase !== phase) continue;

    const { radioState } = buildStateAt(model, holdBuildS);
    const online = new Uint8Array(model.radios.length);
    for (let i = 0; i < online.length; i++) online[i] = radioState[i] === RadioBuild.On ? 1 : 0;
    const edge = edgeRadios(model, online);
    const net = computeNetwork(graph, online);
    // Radios switch on only at stage ends, so the network is the same through the whole phase.
    const machines = machinesAt(model, graph, clock, [
      { fromFrac: 0, toFrac: clock.frac, connected: net.connected },
    ]);

    const usable = (id: number) =>
      id >= 0 && id !== graph.baseId && edge[id] === 1 && !excluded.has(id);
    // Ranking: east face first, then the longest route to the base, then the row nearest the base's.
    const rank = (m: Machine) => [
      m.face === 1 ? 0 : 1,
      -net.routing.hops[m.coveredBy],
      Math.abs(m.y - model.base.y),
    ];
    const before = (a: Machine, b: Machine) => {
      const ra = rank(a);
      const rb = rank(b);
      const k = ra.findIndex((v, i) => v !== rb[i]);
      return k >= 0 && ra[k] < rb[k];
    };
    let best: { robot: Machine; handover: number } | null = null;
    const teams = new Set<number>();
    for (const m of machines) {
      // The team's lead machine is the one the walkthrough follows (the scene finds it by its team).
      if (teams.has(m.team)) continue;
      teams.add(m.team);
      if (!usable(m.coveredBy)) continue;
      const alive = online.slice();
      alive[m.coveredBy] = 0;
      const without = computeNetwork(graph, alive).connected;
      const next = coveringNode(graph, without, radius, m.x, m.y);
      if (!usable(next)) continue;
      if (machines.some((o) => coveringNode(graph, without, radius, o.x, o.y) < 0)) continue;
      if (!best || before(m, best.robot)) best = { robot: m, handover: next };
    }
    if (!best) continue;

    const failed = best.robot.coveredBy;
    const alive = online.slice();
    alive[failed] = 0;
    return {
      holdBuildS,
      phaseShare,
      stage: stage.index,
      phase,
      team: best.robot.team,
      robot: best.robot,
      online,
      edge,
      failed,
      route: routePath(net.routing, failed),
      handover: best.handover,
      handoverRoute: routePath(computeNetwork(graph, alive).routing, best.handover),
    };
  }
  throw new Error(
    'No robot at the hold sends through an edge radio that another edge radio backs.',
  );
}
