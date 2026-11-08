// The Build & failure scene at time t (spec 9.2 to 9.7): build state, network, packets, queues, routes and
// stress-test numbers, all computed from the inputs and t, never accumulated frame by frame (spec rule 6).
import { machinesAt, type CoverageSpan, type Machine } from '../../engine/machines';
import { computeNetwork, type Graph, type NetworkState } from '../../engine/network';
import {
  failedAt,
  hopsAt,
  missedHellosAt,
  nextHopAt,
  packetsAt,
  pathAt,
  queueAt,
  sentByAt,
  statsAt,
  type FailureRecord,
  type InFlight,
  type SimResult,
  type SimStats,
} from '../../engine/packetSim';
import {
  buildClockAt,
  buildStateAt,
  RadioBuild,
  type BuildClock,
  type PlayModel,
} from '../../engine/playModel';
import { PLAY_VIEW } from '../../config/play';
import { buildTimeAt, dataShownAt, timeOfBuild, type BuildTimeline } from './walkthrough';

export interface FailureView {
  record: FailureRecord;
  /** Seconds since the failure. */
  age: number;
  missedHellos: number;
  detected: boolean;
  rerouted: boolean;
  /** Sources whose route went through the failed radio, with their old path. */
  affected: { source: number; oldPath: number[] }[];
}

/** The robot whose data the walkthrough follows, while it sends (D70). */
export interface RobotView {
  /** Index into `machines`, and its node id in the simulation. */
  index: number;
  node: number;
  /** The radio it sends through, -1 while it has none; hops to the base, counting its own hop. */
  uplink: number;
  hops: number;
  sent: number;
}

export interface Scene {
  t: number;
  /** Seconds since the start of the build, and the stage and phase at work then (D51). */
  buildS: number;
  clock: BuildClock;
  /** Frontier machines: working inside coverage, stopped and offline outside it (D51). */
  machines: Machine[];
  /** The robot while it sends its data, else null. */
  robot: RobotView | null;
  /** World position of every machine source of the simulation, by its index. */
  sources: { x: number; y: number }[];
  unitPlaced: Uint8Array;
  /** RadioBuild per radio. */
  radioBuild: Uint8Array;
  /** Time each radio switched on (Infinity when off), for the fade-in. */
  radioOnS: Float64Array;
  failed: Uint8Array;
  network: NetworkState;
  /** The packet simulation is running (from the hold on), so its numbers are live. */
  traffic: boolean;
  /** Packets, routes and queues are on the map, over the dimmed map (D55, D70). */
  dataShown: boolean;
  packets: InFlight[];
  queues: { node: number; count: number }[];
  /** Highlighted routes to the base (blue) and the old paths they replaced (dashed). */
  routes: number[][];
  oldRoutes: number[][];
  failures: FailureView[];
  stats: SimStats | null;
  /** The latest failure up to t, repaired or not, for the stress-test numbers. */
  latest: FailureView | null;
  /** The radio whose route is watched after the walkthrough: the one that covered the robot. */
  watchedRadio: number;
  /** Extra hops on the watched route (the robot's while it sends) over the same network without failures;
   *  null while it has no route. */
  watchedExtraHops: number | null;
  ticket: { radio: number; unitNumber: number; col: number; row: number } | null;
  /**
   * From this time on nothing on the map moves or changes (D103): no packet is in flight, no queue or route
   * changes, the failure marks have played and the ticket is out. Infinity while traffic or events wait.
   */
  settleS: number;
}

/** The longest mark that keeps playing after its event: the route update ring, the fail flash, a radio's
 *  fade-in and the missed-hello label. */
const MARKS_TAIL_S = Math.max(
  PLAY_VIEW.updateRingS,
  PLAY_VIEW.failFlashS,
  PLAY_VIEW.radioFadeInS,
  PLAY_VIEW.helloLabelHoldS,
);

const networkCache = new Map<string, NetworkState>();

/** Network state for a set of alive radios, cached by the set (few distinct sets per session). */
function networkFor(graph: Graph, alive: Uint8Array): NetworkState {
  const key = alive.join('');
  let net = networkCache.get(key);
  if (!net) {
    net = computeNetwork(graph, alive);
    networkCache.set(key, net);
  }
  return net;
}

export function sceneAt(
  model: PlayModel,
  graph: Graph,
  timeline: BuildTimeline,
  sim: SimResult,
  t: number,
): Scene {
  const buildS = buildTimeAt(timeline, t);
  const clock = buildClockAt(model, buildS);
  const { unitPlaced, radioState } = buildStateAt(model, buildS);
  const radioOnS = new Float64Array(model.radios.length).fill(Infinity);
  for (const r of model.radios) {
    if (radioState[r.id] === RadioBuild.On) radioOnS[r.id] = timeOfBuild(timeline, r.onS);
  }
  const traffic = t >= timeline.holdS;
  const dataShown = dataShownAt(timeline, t);
  const none = new Uint8Array(graph.nodeCount);
  const failedAtTime = (time: number) => (time >= timeline.holdS ? failedAt(sim, time) : none);
  const networkAt = (failedNow: Uint8Array) => {
    const alive = new Uint8Array(model.radios.length);
    for (let i = 0; i < alive.length; i++) {
      alive[i] = radioState[i] === RadioBuild.On && !failedNow[i] ? 1 : 0;
    }
    return networkFor(graph, alive);
  };
  const failed = failedAtTime(t);
  const network = networkAt(failed);

  const machines =
    clock.done || buildS < 0
      ? []
      : machinesAt(
          model,
          graph,
          clock,
          coverageSpans(
            sim,
            timeline,
            clock,
            model.stages[clock.stage].phaseS,
            t,
            (time) => networkAt(failedAtTime(time)).connected,
          ),
        );
  const sc = timeline.scenario;
  const sending = t >= timeline.holdS && t < timeline.resumeS;
  const robotIndex =
    sending && clock.stage === sc.stage && clock.phase === sc.phase
      ? machines.findIndex((m) => m.team === sc.team)
      : -1;
  const robot: RobotView | null =
    robotIndex >= 0
      ? {
          index: robotIndex,
          node: timeline.robotNode,
          uplink: nextHopAt(sim, timeline.robotNode, t),
          hops: hopsAt(sim, timeline.robotNode, t),
          sent: sentByAt(sim, timeline.robotNode, t),
        }
      : null;

  const failures: FailureView[] = [];
  let latest: FailureView | null = null;
  for (const record of sim.failures) {
    if (!traffic || record.failS > t) continue;
    const repaired = record.rejoinS !== null && t >= record.rejoinS;
    // Routing tables change only at detection, so the tables at the failure are the old routes.
    const affected: FailureView['affected'] = [];
    const candidates = robot ? [robot.node] : model.radios.map((r) => r.id);
    for (const id of repaired ? [] : candidates) {
      if (id === record.radio || failed[id]) continue;
      const oldPath = pathAt(sim, id, record.failS);
      if (oldPath.includes(record.radio)) affected.push({ source: id, oldPath });
    }
    const view: FailureView = {
      record,
      age: t - record.failS,
      missedHellos: missedHellosAt(sim, record, t),
      detected: record.detectS !== null && t >= record.detectS,
      rerouted: record.reroutedS !== null && t >= record.reroutedS,
      affected,
    };
    latest = view;
    if (!repaired) failures.push(view);
  }

  const routes: number[][] = [];
  const oldRoutes: number[][] = [];
  const shown = new Set<number>();
  if (dataShown) {
    const addRoute = (source: number) => {
      const isRadio = source < graph.nodeCount;
      if (shown.has(source) || (isRadio && (failed[source] || !network.alive[source]))) return;
      shown.add(source);
      const path = pathAt(sim, source, t);
      if (path.length > 1) routes.push(path);
    };
    // While the robot sends, its route is the story; otherwise the watched radio's (D70).
    addRoute(robot ? robot.node : timeline.watchedRadio);
    for (const f of failures) {
      for (const a of f.affected) {
        addRoute(a.source);
        if (f.rerouted) oldRoutes.push(a.oldPath);
      }
    }
  }

  const queues: Scene['queues'] = [];
  if (dataShown) {
    for (let node = 0; node < graph.nodeCount; node++) {
      // A cut-off radio's queue only grows; its hollow ring tells that story, so it gets no badge.
      if (network.cutOff[node]) continue;
      const count = queueAt(sim, node, t);
      if (count > 0) queues.push({ node, count });
    }
  }

  // The watched route against the same built network without failures.
  const healthyHops = networkAt(none).routing.hops[timeline.watchedRadio] + (robot ? 1 : 0);
  const watchedHops = robot
    ? robot.hops
    : traffic
      ? hopsAt(sim, timeline.watchedRadio, t)
      : healthyHops;

  let ticket: Scene['ticket'] = null;
  // The ticket goes out when the walkthrough's "Recovered" step starts: the reroute step after detection.
  const ticketAt = (f: FailureView) =>
    (f.record.detectS ?? Infinity) + (timeline.ticketS - timeline.detectS);
  let settleS = sim.quietFromS + MARKS_TAIL_S;
  for (const f of failures) settleS = Math.max(settleS, ticketAt(f));
  for (let i = failures.length - 1; i >= 0 && !ticket; i--) {
    const f = failures[i];
    const shownS = ticketAt(f);
    if (t < shownS) continue;
    const radio = model.radios[f.record.radio];
    ticket = {
      radio: radio.id,
      unitNumber: radio.unitId + 1,
      col: radio.cellCol,
      row: radio.cellRow,
    };
  }

  return {
    t,
    buildS,
    clock,
    machines,
    robot,
    sources: (sim.input.sources ?? []).map((s) => ({ x: s.x, y: s.y })),
    unitPlaced,
    radioBuild: radioState,
    radioOnS,
    failed,
    network,
    traffic,
    dataShown,
    packets: dataShown ? packetsAt(sim, t) : [],
    queues,
    routes,
    oldRoutes,
    failures,
    stats: traffic ? statsAt(sim, t) : null,
    latest,
    watchedRadio: timeline.watchedRadio,
    watchedExtraHops: watchedHops >= 0 ? watchedHops - healthyHops : null,
    ticket,
    settleS,
  };
}

/**
 * The network through the current phase, split where a radio fails or is repaired, as shares of the phase.
 * Radios switch on only at stage ends, so the build itself never splits a phase. Times are player times;
 * the shares follow the build time, which stands still while the build holds (D70).
 */
function coverageSpans(
  sim: SimResult,
  timeline: BuildTimeline,
  clock: BuildClock,
  phaseS: number,
  t: number,
  connectedAt: (time: number) => Uint8Array,
): CoverageSpan[] {
  const frac = (time: number) =>
    Math.min(1, Math.max(0, (buildTimeAt(timeline, time) - clock.phaseStartS) / phaseS));
  const phaseStartS = Math.min(t, timeOfBuild(timeline, clock.phaseStartS));
  const cuts = new Set<number>();
  for (const spans of sim.down) {
    for (const d of spans) {
      for (const time of [d.from, d.to]) if (time > phaseStartS && time < t) cuts.add(time);
    }
  }
  const times = [phaseStartS, ...Array.from(cuts).sort((a, b) => a - b), t];
  const out: CoverageSpan[] = [];
  for (let i = 0; i + 1 < times.length; i++) {
    out.push({
      fromFrac: frac(times[i]),
      toFrac: frac(times[i + 1]),
      connected: connectedAt(times[i]),
    });
  }
  return out;
}
