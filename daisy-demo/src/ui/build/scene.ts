// The Build & failure scene at time t (spec 9.2 to 9.7): build state, network, packets, queues, routes and
// stress-test numbers, all computed from the inputs and t, never accumulated frame by frame (spec rule 6).
import { PLAY, PLAY_VIEW, PLAY_WALK, type EquipmentGlyph } from '../../config/play';
import { computeNetwork, type Graph, type NetworkState } from '../../engine/network';
import {
  failedAt,
  hopsAt,
  missedHellosAt,
  packetsAt,
  pathAt,
  queueAt,
  statsAt,
  type FailureRecord,
  type InFlight,
  type SimResult,
  type SimStats,
} from '../../engine/packetSim';
import {
  buildStateAt,
  buildStepAt,
  frontierAt,
  RadioBuild,
  type FrontierLane,
  type PlayModel,
} from '../../engine/playModel';
import type { BuildTimeline } from './walkthrough';

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

/** One machine or crew at the frontier, in world meters. */
export interface Equipment {
  glyph: EquipmentGlyph;
  phase: number;
  lane: number;
  x: number;
  y: number;
  /** Inside the coverage of a connected radio or the base. */
  online: boolean;
}

export interface Scene {
  t: number;
  /** Build step, and the progress through it (0 to 1) for the equipment's motion. */
  step: number;
  stepFrac: number;
  /** Lanes under frontier work (D49). */
  frontier: FrontierLane[];
  equipment: Equipment[];
  unitPlaced: Uint8Array;
  /** RadioBuild per radio. */
  radioBuild: Uint8Array;
  /** Time each radio switched on (Infinity when off), for the fade-in. */
  radioOnS: Float64Array;
  failed: Uint8Array;
  network: NetworkState;
  traffic: boolean;
  packets: InFlight[];
  queues: { node: number; count: number }[];
  /** Highlighted routes to the base (blue) and the old paths they replaced (dashed). */
  routes: number[][];
  oldRoutes: number[][];
  failures: FailureView[];
  stats: SimStats | null;
  /** The latest failure up to t, repaired or not, for the stress-test numbers. */
  latest: FailureView | null;
  /** Extra hops on the watched route compared with the healthy network; null while it has no route. */
  watchedExtraHops: number | null;
  ticket: { radio: number; unitNumber: number; col: number; row: number } | null;
}

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
  const step = buildStepAt(model, t - timeline.buildStartS);
  const stepFrac =
    step >= model.lastStep
      ? 0
      : Math.min(1, Math.max(0, (t - timeline.buildStartS) / PLAY.buildStepS - step));
  const { unitPlaced, radioState } = buildStateAt(model, step);
  const radioOnS = new Float64Array(model.radios.length).fill(Infinity);
  for (const r of model.radios) {
    if (radioState[r.id] === RadioBuild.On) {
      radioOnS[r.id] = timeline.buildStartS + r.onStep * PLAY.buildStepS;
    }
  }
  const traffic = t >= timeline.dataStartS;
  const failed = traffic ? failedAt(sim, t) : new Uint8Array(graph.nodeCount);
  const alive = new Uint8Array(model.radios.length);
  for (let i = 0; i < alive.length; i++) {
    alive[i] = radioState[i] === RadioBuild.On && !failed[i] ? 1 : 0;
  }
  const network = networkFor(graph, alive);

  const failures: FailureView[] = [];
  let latest: FailureView | null = null;
  for (const record of sim.failures) {
    if (!traffic || record.failS > t) continue;
    const repaired = record.rejoinS !== null && t >= record.rejoinS;
    // Routing tables change only at detection, so the tables at the failure are the old routes.
    const affected: FailureView['affected'] = [];
    for (const r of repaired ? [] : model.radios) {
      if (r.id === record.radio || failed[r.id]) continue;
      const oldPath = pathAt(sim, r.id, record.failS);
      if (oldPath.includes(record.radio)) affected.push({ source: r.id, oldPath });
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
  if (traffic) {
    const addRoute = (source: number) => {
      if (shown.has(source) || failed[source] || !network.alive[source]) return;
      shown.add(source);
      const path = pathAt(sim, source, t);
      if (path.length > 1) routes.push(path);
    };
    addRoute(timeline.watchedRadio);
    for (const f of failures) {
      for (const a of f.affected) {
        addRoute(a.source);
        if (f.rerouted) oldRoutes.push(a.oldPath);
      }
    }
  }

  const queues: Scene['queues'] = [];
  if (traffic) {
    for (let node = 0; node < graph.nodeCount; node++) {
      // A cut-off radio's queue only grows; its hollow ring tells that story, so it gets no badge.
      if (network.cutOff[node]) continue;
      const count = queueAt(sim, node, t);
      if (count > 0) queues.push({ node, count });
    }
  }

  const healthyHops = sim.versions[0].hops[timeline.watchedRadio];
  const watchedHops = traffic ? hopsAt(sim, timeline.watchedRadio, t) : healthyHops;

  let ticket: Scene['ticket'] = null;
  for (let i = failures.length - 1; i >= 0 && !ticket; i--) {
    const f = failures[i];
    // The ticket goes out when the walkthrough's "Recovered" step starts: the reroute step after detection.
    const shownS = (f.record.detectS ?? Infinity) + PLAY_WALK.rerouteS;
    if (t < shownS) continue;
    const radio = model.radios[f.record.radio];
    ticket = {
      radio: radio.id,
      unitNumber: radio.unitId + 1,
      col: radio.cellCol,
      row: radio.cellRow,
    };
  }

  const frontier = frontierAt(model, step);
  const equipment = frontierEquipment(model, graph, network, frontier, stepFrac);

  return {
    t,
    step,
    stepFrac,
    frontier,
    equipment,
    unitPlaced,
    radioBuild: radioState,
    radioOnS,
    failed,
    network,
    traffic,
    packets: traffic ? packetsAt(sim, t) : [],
    queues,
    routes,
    oldRoutes,
    failures,
    stats: traffic ? statsAt(sim, t) : null,
    latest,
    watchedExtraHops: watchedHops >= 0 ? watchedHops - healthyHops : null,
    ticket,
  };
}

/**
 * The machines of every frontier lane. Each drives the length of its lane once per build step, south to
 * north or back, alternating by lane and phase; lanes beside the base yard work only north of the yard.
 */
function frontierEquipment(
  model: PlayModel,
  graph: Graph,
  network: NetworkState,
  frontier: FrontierLane[],
  frac: number,
): Equipment[] {
  const out: Equipment[] = [];
  const yard = model.base.yard;
  const margin = PLAY_VIEW.equipmentMarginM;
  for (const f of frontier) {
    const x = (f.lane + 1 / 2) * model.lanePitchM;
    const besideYard = x > yard.x && x < yard.x + yard.w;
    const y0 = (besideYard ? yard.y + yard.h : 0) + margin;
    const y1 = model.heightM - margin;
    const northward = (f.lane + f.phase) % 2 === 0;
    const along = northward ? frac : 1 - frac;
    const glyphs = model.config.frontierPhases[f.phase].glyphs;
    glyphs.forEach((glyph, i) => {
      // A second machine of the same phase (the carrier behind the crane) trails the first.
      const trail = i * PLAY_VIEW.equipmentTrailM * (northward ? -1 : 1);
      const y = Math.min(y1, Math.max(y0, y0 + (y1 - y0) * along + trail));
      out.push({
        glyph,
        phase: f.phase,
        lane: f.lane,
        x,
        y,
        online: inCoverage(graph, network, x, y),
      });
    });
  }
  return out;
}

function inCoverage(graph: Graph, network: NetworkState, x: number, y: number): boolean {
  for (let id = 0; id < graph.nodeCount; id++) {
    if (!network.connected[id]) continue;
    if (Math.hypot(graph.x[id] - x, graph.y[id] - y) <= PLAY.coverageRadiusM) return true;
  }
  return false;
}
