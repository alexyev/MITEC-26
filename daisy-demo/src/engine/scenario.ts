// The walkthrough's failure mid-build (D70): the build moment it holds at, the frontier robot whose data it
// follows, the radio that covers the robot, and the radio on the robot's route to the base that fails.
import { machinesAt, type Machine } from './machines';
import { computeNetwork, routePath, type Graph } from './network';
import { buildClockAt, buildStateAt, RadioBuild, type PlayModel } from './playModel';

export interface FailureScenario {
  /** Build time the walkthrough holds at: `scenario.phaseShare` through its phase of the middle stage. */
  holdBuildS: number;
  stage: number;
  phase: number;
  /** The robot whose data the walkthrough follows: its team in the stage, and the machine at the hold. */
  team: number;
  robot: Machine;
  /** 1 for every radio that is on at the hold: the partly built network. */
  online: Uint8Array;
  /** The radio that covers the robot, and its route to the base on the network of the hold. */
  uplink: number;
  route: number[];
  /** The middle radio between the uplink and the base on that route: the radio that fails. */
  failed: number;
}

export function failureScenario(model: PlayModel, graph: Graph): FailureScenario {
  const { config } = model;
  const stage = model.stages[Math.floor(model.stages.length / 2)];
  const phase = config.frontierPhases.findIndex((p) => p.id === config.scenario.phase);
  if (!stage || phase < 0)
    throw new Error('The play model has no stage or phase to hold the build in.');
  const holdBuildS = stage.startS + (phase + config.scenario.phaseShare) * stage.phaseS;
  const clock = buildClockAt(model, holdBuildS);

  const { radioState } = buildStateAt(model, holdBuildS);
  const online = new Uint8Array(model.radios.length);
  for (let i = 0; i < online.length; i++) online[i] = radioState[i] === RadioBuild.On ? 1 : 0;
  const net = computeNetwork(graph, online);
  // Radios switch on only at stage ends, so the network is the same through the whole phase.
  const machines = machinesAt(model, graph, clock, [
    { fromFrac: 0, toFrac: clock.frac, connected: net.connected },
  ]);

  // The east face's robot with the longest route to the base, then the one nearest the base's row.
  const hopsOf = (m: Machine) => (m.coveredBy >= 0 ? net.routing.hops[m.coveredBy] : -1);
  const rowGap = (m: Machine) => Math.abs(m.y - model.base.y);
  let robot: Machine | null = null;
  for (const m of machines) {
    if (m.face !== 1 || m.coveredBy < 0 || m.coveredBy === graph.baseId) continue;
    const better =
      !robot ||
      hopsOf(m) > hopsOf(robot) ||
      (hopsOf(m) === hopsOf(robot) && rowGap(m) < rowGap(robot));
    if (better) robot = m;
  }
  if (!robot) throw new Error('No robot on the east face is covered by a radio at the hold.');

  const route = routePath(net.routing, robot.coveredBy);
  const between = route.slice(1, -1);
  if (between.length === 0)
    throw new Error('The robot is one hop from the base: nothing to reroute.');
  return {
    holdBuildS,
    stage: stage.index,
    phase,
    team: robot.team,
    robot,
    online,
    uplink: robot.coveredBy,
    route,
    failed: between[Math.floor((between.length - 1) / 2)],
  };
}
