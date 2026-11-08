// Discrete-event packet simulation of the play model (spec 9.4, 9.5): traffic from radios and machines, hellos,
// failure detection, local repair, route updates and queues, precomputed and then read back at any time t.
import { RNG, ROUTING } from '../config/defaults';
import { PLAY, type PlayConfig } from '../config/play';
import { coveringNode } from './machines';
import { computeRouting, type Graph, type Routing } from './network';
import { createRng } from './rng';

export interface RoutingConfig {
  helloIntervalS: number;
  missedHellosToDown: number;
  localRepair: boolean;
  updateFloodPerHopS: number;
  bufferMaxPackets: number;
}

/**
 * A user or walkthrough action: fail a radio, repair it (it rejoins at its next hello), or switch a radio on
 * for the first time when the build commissions it (it says hello at once, D71).
 */
export interface SimChange {
  tS: number;
  radio: number;
  kind: 'fail' | 'repair' | 'on';
}

/**
 * A machine that sends its own data (D71), such as a frontier robot's task status and safety messages. It
 * stands at (x, y) and links through the radio that covers it: the nearest node within the coverage radius
 * that has a known route to the base, the coverage rule of the machines (D51). It sends one packet every
 * `packetIntervalS` from `fromS` until `toS`. Its node id is `graph.nodeCount + k` (`sourceNode`).
 */
export interface MachineSource {
  x: number;
  y: number;
  fromS: number;
  toS: number;
  packetIntervalS: number;
}

export interface SimInput {
  graph: Graph;
  /** Traffic starts here, on a converged network with empty queues. */
  startS: number;
  /** Nothing is simulated after this time (Infinity for a live simulation that keeps running). */
  endS: number;
  changes: SimChange[];
  /** Radios that are on at `startS` (default: all); the others switch on with an 'on' change. */
  online?: Uint8Array;
  /** Machines that send their own data, linked through the radio that covers them (D71). */
  sources?: MachineSource[];
  seed?: number;
  routing?: RoutingConfig;
  play?: PlayConfig;
}

export type SimEventKind =
  | 'send'
  | 'hop'
  | 'hello'
  | 'helloTimeout'
  | 'neighborDown'
  | 'localRepair'
  | 'routeUpdate'
  | 'queueFlush'
  | 'delivered'
  | 'lost'
  | 'fail'
  | 'repair'
  | 'on'
  | 'uplink';

/**
 * One simulation event. `node` is where it happens; `other` is the other node (the next hop of a hop,
 * the silent radio of a hello timeout, the backup of a local repair, the new radio of a machine's uplink)
 * or -1; `value` is the missed-hello count of a hello timeout, the routing version of a route update, or 0.
 */
export interface SimEvent {
  tS: number;
  kind: SimEventKind;
  node: number;
  other: number;
  packet: number;
  value: number;
}

export interface FailureRecord {
  radio: number;
  failS: number;
  /** The failed radio's last hello before the failure. */
  lastHelloS: number;
  /** When its neighbors declared it down; null when it rejoined first. */
  detectS: number | null;
  /** When the last reachable radio switched to the routes without it; null before detection. */
  reroutedS: number | null;
  /** Routing version made at detection. */
  version: number | null;
  repairS: number | null;
  rejoinS: number | null;
}

interface Timeline {
  tS: number[];
  value: number[];
}

export interface SimResult {
  input: SimInput;
  /** The changes as applied, in time order. */
  changes: SimChange[];
  routing: RoutingConfig;
  hopS: number;
  helloPhase: Float64Array;
  sendPhase: Float64Array;
  events: SimEvent[];
  /** Routing tables: version 0 at the start, then one per detection or rejoin. */
  versions: Routing[];
  failures: FailureRecord[];
  /** Hops in departure order (`hopT0` is non-decreasing). A hop from a machine starts at its node id. */
  hopPacket: number[];
  hopFrom: number[];
  hopTo: number[];
  hopT0: number[];
  /** The dot is drawn until this time: arrival, or the moment its receiver failed. */
  hopVisibleEnd: number[];
  packetSource: number[];
  packetSentS: number[];
  sentTimes: number[];
  deliveredTimes: number[];
  lostTimes: number[];
  /** Per node, then per machine source: queue length over time. */
  queue: Timeline[];
  /** Per node and machine source: next hop (a machine's uplink) and hops to the base over time. */
  nextHop: Timeline[];
  hops: Timeline[];
  /** Per node and machine source: arrival times of the packets it forwarded successfully. */
  forwarded: number[][];
  /** Per node and machine source: times of the packets it sent itself. */
  sentBy: number[][];
  /** Largest queue anywhere, over time. */
  maxQueue: Timeline;
  /** Per radio: failed intervals [from, to), `to` = Infinity while failed. */
  down: { from: number; to: number }[][];
}

const enum Ev {
  Gen,
  Arrive,
  Fail,
  Miss,
  Repair,
  Rejoin,
  Switch,
  Flush,
  On,
  SourceGen,
}

interface HeapItem {
  t: number;
  seq: number;
  type: Ev;
  a: number;
  b: number;
  c: number;
}

/** Binary min-heap ordered by time, then by scheduling order. */
class EventHeap {
  private items: HeapItem[] = [];
  private seq = 0;

  get size(): number {
    return this.items.length;
  }

  push(t: number, type: Ev, a = 0, b = 0, c = 0): void {
    const items = this.items;
    items.push({ t, seq: this.seq++, type, a, b, c });
    let i = items.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(items[i], items[p])) break;
      [items[i], items[p]] = [items[p], items[i]];
      i = p;
    }
  }

  pop(): HeapItem {
    const items = this.items;
    const top = items[0];
    const last = items.pop() as HeapItem;
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < items.length && this.less(items[l], items[m])) m = l;
        if (r < items.length && this.less(items[r], items[m])) m = r;
        if (m === i) break;
        [items[i], items[m]] = [items[m], items[i]];
        i = m;
      }
    }
    return top;
  }

  peekTime(): number {
    return this.items[0].t;
  }

  private less(x: HeapItem, y: HeapItem): boolean {
    return x.t < y.t || (x.t === y.t && x.seq < y.seq);
  }
}

/** Hello and send phases of every radio, drawn from the seeded RNG (hello first, then send). */
export function simTiming(
  graph: Graph,
  seed: number = RNG.seed,
  routing: RoutingConfig = ROUTING,
  play: PlayConfig = PLAY,
): { helloPhase: Float64Array; sendPhase: Float64Array } {
  const rng = createRng(seed);
  const helloPhase = new Float64Array(graph.nodeCount);
  const sendPhase = new Float64Array(graph.nodeCount);
  for (let i = 0; i < graph.nodeCount; i++) {
    helloPhase[i] = rng.next() * routing.helloIntervalS;
    sendPhase[i] = rng.next() * play.packetIntervalS;
  }
  return { helloPhase, sendPhase };
}

/** The last hello of a radio at or before `t`. */
export function lastHelloAt(phase: number, intervalS: number, t: number): number {
  return phase + Math.floor((t - phase) / intervalS) * intervalS;
}

/** The next hello of a radio at or after `t`. */
export function nextHelloAt(phase: number, intervalS: number, t: number): number {
  return phase + Math.ceil((t - phase) / intervalS) * intervalS;
}

/**
 * Time of the walkthrough's failure (spec 9.5): just after the failed radio's first hello at or after
 * `notBeforeS`, so its neighbors count the missed hellos one interval apart from there.
 */
export function presetFailS(
  graph: Graph,
  radio: number,
  notBeforeS: number,
  seed: number = RNG.seed,
  routing: RoutingConfig = ROUTING,
  play: PlayConfig = PLAY,
): number {
  const { helloPhase } = simTiming(graph, seed, routing, play);
  return nextHelloAt(helloPhase[radio], routing.helloIntervalS, notBeforeS) + play.failAfterHelloS;
}

function pushTimeline(line: Timeline, t: number, value: number): void {
  const n = line.tS.length;
  if (n > 0 && line.value[n - 1] === value) return;
  if (n > 0 && line.tS[n - 1] === t) {
    line.value[n - 1] = value;
    return;
  }
  line.tS.push(t);
  line.value.push(value);
}

/** Node id of the k-th machine source: after the radios and the base. */
export function sourceNode(graph: Graph, k: number): number {
  return graph.nodeCount + k;
}

/** Number of entries of a sorted array that are at most `t`. */
export function countAtOrBefore(sorted: number[], t: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function timelineAt(line: Timeline, t: number, fallback: number): number {
  const i = countAtOrBefore(line.tS, t) - 1;
  return i >= 0 ? line.value[i] : fallback;
}

/** A simulation that is advanced step by step, so a click applies at once without replaying the past. */
export interface LiveSim {
  result: SimResult;
  /** Every event up to this time has been processed. */
  frontierS(): number;
  advanceTo(tS: number): void;
  /**
   * Apply a change at its time, or at the frontier when that is later; returns the change as applied.
   * Replaying the returned changes with `simulate` gives the same result.
   */
  addChange(change: SimChange): SimChange;
}

/** Run a simulation from `startS` to `endS` with all its changes (the pure form). */
export function simulate(input: SimInput): SimResult {
  const sim = createSim(input);
  sim.advanceTo(input.endS);
  return sim.result;
}

export function createSim(input: SimInput): LiveSim {
  const { graph, startS, endS } = input;
  const routing = input.routing ?? ROUTING;
  const play = input.play ?? PLAY;
  const { helloPhase, sendPhase } = simTiming(graph, input.seed ?? RNG.seed, routing, play);
  const n = graph.nodeCount;
  const base = graph.baseId;
  const interval = routing.helloIntervalS;
  const missed = Math.max(1, routing.missedHellosToDown);
  const sources = input.sources ?? [];
  /** Radios and the base, then the machine sources. */
  const all = n + sources.length;

  const truth = new Uint8Array(n);
  for (let i = 0; i < n; i++) truth[i] = input.online ? input.online[i] : 1;
  truth[base] = 1;
  const known = truth.slice();
  const versions: Routing[] = [computeRouting(graph, known)];
  const cur = new Int32Array(n);
  const NONE = -2;
  const override = new Int32Array(n).fill(NONE);
  const blocked = new Int32Array(all).fill(-1);
  const queues: number[][] = Array.from({ length: all }, () => []);
  const flushing = new Uint8Array(all);
  const latestFailure = new Int32Array(n).fill(-1);
  const rejoinToken = new Int32Array(n);
  /** The radio each machine sends through, -1 while none covers it. */
  const uplink = new Int32Array(sources.length).fill(-1);

  const result: SimResult = {
    input,
    changes: [],
    routing,
    hopS: play.hopS,
    helloPhase,
    sendPhase,
    events: [],
    versions,
    failures: [],
    hopPacket: [],
    hopFrom: [],
    hopTo: [],
    hopT0: [],
    hopVisibleEnd: [],
    packetSource: [],
    packetSentS: [],
    sentTimes: [],
    deliveredTimes: [],
    lostTimes: [],
    queue: Array.from({ length: all }, () => ({ tS: [], value: [] })),
    nextHop: Array.from({ length: all }, () => ({ tS: [], value: [] })),
    hops: Array.from({ length: all }, () => ({ tS: [], value: [] })),
    forwarded: Array.from({ length: all }, () => []),
    sentBy: Array.from({ length: all }, () => []),
    maxQueue: { tS: [], value: [] },
    down: Array.from({ length: n }, () => []),
  };
  const packetHops: number[] = [];
  let maxQueue = 0;
  const heap = new EventHeap();

  const emit = (tS: number, kind: SimEventKind, node: number, other = -1, packet = -1, value = 0) =>
    result.events.push({ tS, kind, node, other, packet, value });
  /** A machine source is always up; a radio is up while it is on and not failed. */
  const isUp = (i: number): boolean => i >= n || truth[i] === 1;
  const nextHopOf = (i: number): number => {
    if (i >= n) return uplink[i - n];
    return override[i] !== NONE ? override[i] : versions[cur[i]].nextHop[i];
  };
  const hopsOf = (i: number): number => {
    if (i < n) return versions[cur[i]].hops[i];
    const u = uplink[i - n];
    return u >= 0 && hopsOf(u) >= 0 ? hopsOf(u) + 1 : -1;
  };
  const recordRoute = (i: number, t: number): void => {
    pushTimeline(result.nextHop[i], t, nextHopOf(i));
    pushTimeline(result.hops[i], t, hopsOf(i));
  };
  /** The machines that send through radio i, whose hops change with its route. */
  const recordSourcesVia = (i: number, t: number): void => {
    for (let k = 0; k < sources.length; k++) if (uplink[k] === i) recordRoute(n + k, t);
  };
  /**
   * Every machine links through the radio that covers it on the routes it knows (the latest routing
   * version): it hears the same hellos as the radios around it, so it learns of a change when they do.
   */
  const relink = (t: number): void => {
    if (sources.length === 0) return;
    const latest = versions[versions.length - 1];
    const reachable = new Uint8Array(n);
    for (let i = 0; i < n; i++) reachable[i] = latest.hops[i] >= 0 ? 1 : 0;
    sources.forEach((s, k) => {
      const u = coveringNode(graph, reachable, play.coverageRadiusM, s.x, s.y);
      if (u === uplink[k]) return;
      uplink[k] = u;
      blocked[n + k] = -1;
      recordRoute(n + k, t);
      emit(t, 'uplink', n + k, u);
      startFlush(n + k, t);
    });
  };
  const recordQueue = (i: number, t: number): void => {
    pushTimeline(result.queue[i], t, queues[i].length);
    if (queues[i].length > maxQueue) {
      maxQueue = queues[i].length;
      pushTimeline(result.maxQueue, t, maxQueue);
    }
  };
  const lose = (p: number, t: number, at: number): void => {
    result.lostTimes.push(t);
    emit(t, 'lost', at, -1, p);
  };
  const enqueue = (i: number, p: number, t: number): void => {
    if (queues[i].length >= routing.bufferMaxPackets) {
      lose(p, t, i);
      return;
    }
    queues[i].push(p);
    recordQueue(i, t);
    startFlush(i, t);
  };
  const canSend = (i: number): boolean => {
    const nh = nextHopOf(i);
    return nh >= 0 && nh !== blocked[i];
  };
  const startFlush = (i: number, t: number): void => {
    if (flushing[i] || queues[i].length === 0 || !canSend(i)) return;
    flushing[i] = 1;
    emit(t, 'queueFlush', i, nextHopOf(i), -1, queues[i].length);
    heap.push(t, Ev.Flush, i);
  };
  const transmit = (i: number, p: number, t: number): void => {
    const nh = nextHopOf(i);
    const h = result.hopT0.length;
    result.hopPacket.push(p);
    result.hopFrom.push(i);
    result.hopTo.push(nh);
    result.hopT0.push(t);
    result.hopVisibleEnd.push(t + play.hopS);
    emit(t, 'hop', i, nh, p);
    heap.push(t + play.hopS, Ev.Arrive, p, i, h);
  };
  /** A packet is at node i: deliver it, send it on, or hold it in i's queue. */
  const forward = (i: number, p: number, t: number): void => {
    if (i === base) {
      result.deliveredTimes.push(t);
      emit(t, 'delivered', i, -1, p);
      return;
    }
    if (packetHops[p] >= play.maxPacketHops) {
      lose(p, t, i);
      return;
    }
    // Keep the queue in order: a new packet waits behind the queued ones.
    if (queues[i].length > 0 || !canSend(i)) {
      enqueue(i, p, t);
      return;
    }
    transmit(i, p, t);
  };
  /** Spread a new routing version from the given nodes, one flood hop per `updateFloodPerHopS`. */
  const flood = (sources: number[], version: number, t: number): number => {
    const dist = new Int32Array(n).fill(-1);
    const order: number[] = [];
    for (const s of sources) {
      if (truth[s] && dist[s] < 0) {
        dist[s] = 0;
        order.push(s);
      }
    }
    for (let head = 0; head < order.length; head++) {
      const u = order[head];
      for (const v of graph.neighbors[u]) {
        if (truth[v] && known[v] && dist[v] < 0) {
          dist[v] = dist[u] + 1;
          order.push(v);
        }
      }
    }
    let last = t;
    for (const u of order) {
      const at = t + (dist[u] + 1) * routing.updateFloodPerHopS;
      heap.push(at, Ev.Switch, u, version);
      last = Math.max(last, at);
    }
    return last;
  };

  /** A radio joins the routes when its hello is heard: on its first switch-on, or when it rejoins. */
  const join = (r: number, t: number): void => {
    truth[r] = 1;
    known[r] = 1;
    const version = versions.length;
    versions.push(computeRouting(graph, known));
    for (const v of graph.neighbors[r]) {
      if (blocked[v] === r) {
        blocked[v] = -1;
        startFlush(v, t);
      }
    }
    flood([r, ...graph.neighbors[r]], version, t);
    relink(t);
  };

  let frontier = startS;
  const changeEvent = { fail: Ev.Fail, repair: Ev.Repair, on: Ev.On } as const;
  const addChange = (c: SimChange): SimChange => {
    const applied = { ...c, tS: Math.max(c.tS, frontier) };
    const isRadio = applied.radio >= 0 && applied.radio < n && applied.radio !== base;
    if (applied.tS > endS || !isRadio) return applied;
    result.changes.push(applied);
    heap.push(applied.tS, changeEvent[applied.kind], applied.radio);
    return applied;
  };

  for (let i = 0; i < n; i++) recordRoute(i, startS);
  relink(startS);
  for (let k = 0; k < sources.length; k++) recordRoute(n + k, startS);
  for (const c of [...input.changes].sort((a, b) => a.tS - b.tS)) {
    if (c.tS >= startS) addChange(c);
  }
  for (let i = 0; i < n; i++) {
    if (i === base) continue;
    heap.push(nextHelloAt(sendPhase[i], play.packetIntervalS, startS), Ev.Gen, i);
  }
  sources.forEach((s, k) => {
    const first = Math.max(startS, s.fromS);
    if (first < s.toS) heap.push(first, Ev.SourceGen, k);
  });

  const advanceTo = (until: number): void => {
    const limit = Math.min(until, endS);
    while (heap.size > 0 && heap.peekTime() <= limit) step(heap.pop());
    frontier = Math.max(frontier, limit);
  };

  function step(ev: HeapItem): void {
    const t = ev.t;
    switch (ev.type) {
      case Ev.Gen: {
        const r = ev.a;
        heap.push(t + play.packetIntervalS, Ev.Gen, r);
        if (!truth[r]) break;
        const p = result.packetSource.length;
        result.packetSource.push(r);
        result.packetSentS.push(t);
        packetHops.push(0);
        result.sentTimes.push(t);
        result.sentBy[r].push(t);
        emit(t, 'send', r, -1, p);
        forward(r, p, t);
        break;
      }
      case Ev.SourceGen: {
        const k = ev.a;
        const s = sources[k];
        if (t + s.packetIntervalS < s.toS) heap.push(t + s.packetIntervalS, Ev.SourceGen, k);
        const p = result.packetSource.length;
        result.packetSource.push(n + k);
        result.packetSentS.push(t);
        packetHops.push(0);
        result.sentTimes.push(t);
        result.sentBy[n + k].push(t);
        emit(t, 'send', n + k, -1, p);
        forward(n + k, p, t);
        break;
      }
      case Ev.Arrive: {
        const p = ev.a;
        const from = ev.b;
        const to = result.hopTo[ev.c];
        if (!truth[to]) {
          // No acknowledgement: the sender keeps the packet and holds traffic for that neighbor.
          const died = result.down[to][result.down[to].length - 1]?.from ?? t;
          result.hopVisibleEnd[ev.c] = Math.max(result.hopT0[ev.c], died);
          blocked[from] = to;
          if (isUp(from)) enqueue(from, p, t);
          else lose(p, t, from);
          break;
        }
        packetHops[p]++;
        result.forwarded[from].push(t);
        forward(to, p, t);
        break;
      }
      case Ev.Fail: {
        const r = ev.a;
        rejoinToken[r]++;
        if (!truth[r]) break;
        truth[r] = 0;
        result.down[r].push({ from: t, to: Infinity });
        emit(t, 'fail', r);
        for (const p of queues[r]) lose(p, t, r);
        queues[r] = [];
        recordQueue(r, t);
        flushing[r] = 0;
        override[r] = NONE;
        const lastHelloS = lastHelloAt(helloPhase[r], interval, t);
        latestFailure[r] = result.failures.length;
        result.failures.push({
          radio: r,
          failS: t,
          lastHelloS,
          detectS: null,
          reroutedS: null,
          version: null,
          repairS: null,
          rejoinS: null,
        });
        for (let k = 1; k <= missed; k++) {
          heap.push(lastHelloS + k * interval, Ev.Miss, r, k, latestFailure[r]);
        }
        break;
      }
      case Ev.Miss: {
        const r = ev.a;
        const k = ev.b;
        const record = result.failures[ev.c];
        // A hello heard again (the radio rejoined) or a newer failure cancels this count.
        if (truth[r] || latestFailure[r] !== ev.c) break;
        const watchers = graph.neighbors[r].filter((v) => truth[v]);
        for (const v of watchers) emit(t, 'helloTimeout', v, r, -1, k);
        if (k < missed) break;
        known[r] = 0;
        for (const v of watchers) emit(t, 'neighborDown', v, r);
        const version = versions.length;
        versions.push(computeRouting(graph, known));
        record.detectS = t;
        record.version = version;
        if (routing.localRepair) {
          for (const v of watchers) {
            if (nextHopOf(v) !== r) continue;
            const backup = versions[cur[v]].backupHop[v];
            if (backup < 0 || !truth[backup] || !known[backup]) continue;
            override[v] = backup;
            blocked[v] = -1;
            recordRoute(v, t);
            recordSourcesVia(v, t);
            emit(t, 'localRepair', v, backup);
            startFlush(v, t);
          }
        }
        record.reroutedS = flood(watchers, version, t);
        relink(t);
        break;
      }
      case Ev.Repair: {
        const r = ev.a;
        emit(t, 'repair', r);
        const f = latestFailure[r];
        // Only a failed radio can be repaired; a radio the build has not switched on stays off.
        if (truth[r] || f < 0) break;
        if (result.failures[f].repairS === null) result.failures[f].repairS = t;
        heap.push(nextHelloAt(helloPhase[r], interval, t), Ev.Rejoin, r, rejoinToken[r]);
        break;
      }
      case Ev.Rejoin: {
        const r = ev.a;
        if (ev.b !== rejoinToken[r] || truth[r]) break;
        const span = result.down[r][result.down[r].length - 1];
        if (span) span.to = t;
        const f = latestFailure[r];
        if (f >= 0) result.failures[f].rejoinS = t;
        emit(t, 'hello', r);
        join(r, t);
        break;
      }
      case Ev.On: {
        const r = ev.a;
        // A new radio says hello as it starts; a radio that is on, or failed, is not switched on again.
        if (truth[r] || latestFailure[r] >= 0) break;
        emit(t, 'on', r);
        join(r, t);
        break;
      }
      case Ev.Switch: {
        const i = ev.a;
        const version = ev.b;
        if (!truth[i] || version <= cur[i]) break;
        cur[i] = version;
        override[i] = NONE;
        blocked[i] = -1;
        recordRoute(i, t);
        recordSourcesVia(i, t);
        emit(t, 'routeUpdate', i, -1, -1, version);
        startFlush(i, t);
        break;
      }
      case Ev.Flush: {
        const i = ev.a;
        if (!isUp(i) || queues[i].length === 0 || !canSend(i)) {
          flushing[i] = 0;
          break;
        }
        const p = queues[i].shift() as number;
        recordQueue(i, t);
        if (packetHops[p] >= play.maxPacketHops) lose(p, t, i);
        else transmit(i, p, t);
        if (queues[i].length > 0) heap.push(t + play.queueFlushIntervalS, Ev.Flush, i);
        else flushing[i] = 0;
        break;
      }
    }
  }

  return { result, frontierS: () => frontier, advanceTo, addChange };
}

// ---------------------------------------------------------------------------
// Read-back at time t (the view is a pure function of the result and t)
// ---------------------------------------------------------------------------

export interface InFlight {
  packet: number;
  source: number;
  from: number;
  to: number;
  /** Progress along the hop, 0 to 1. */
  f: number;
}

/** Packets moving along a hop at time t. */
export function packetsAt(sim: SimResult, t: number): InFlight[] {
  const out: InFlight[] = [];
  for (let h = countAtOrBefore(sim.hopT0, t) - 1; h >= 0; h--) {
    const t0 = sim.hopT0[h];
    if (t0 < t - sim.hopS) break;
    if (t >= sim.hopVisibleEnd[h]) continue;
    out.push({
      packet: sim.hopPacket[h],
      source: sim.packetSource[sim.hopPacket[h]],
      from: sim.hopFrom[h],
      to: sim.hopTo[h],
      f: (t - t0) / sim.hopS,
    });
  }
  return out;
}

export function queueAt(sim: SimResult, node: number, t: number): number {
  return timelineAt(sim.queue[node], t, 0);
}

export function nextHopAt(sim: SimResult, node: number, t: number): number {
  return timelineAt(sim.nextHop[node], t, sim.versions[0].nextHop[node] ?? -1);
}

/** Hops to the base at time t; a machine source counts its hop to the radio that covers it. */
export function hopsAt(sim: SimResult, node: number, t: number): number {
  return timelineAt(sim.hops[node], t, sim.versions[0].hops[node] ?? -1);
}

/** The route a node's packets take at time t, following each node's own next hop. */
export function pathAt(sim: SimResult, from: number, t: number): number[] {
  const path = [from];
  const seen = new Set(path);
  for (let k = nextHopAt(sim, from, t); k >= 0 && !seen.has(k); k = nextHopAt(sim, k, t)) {
    path.push(k);
    seen.add(k);
  }
  return path;
}

/** 1 for every node that has failed and not rejoined at time t. */
export function failedAt(sim: SimResult, t: number): Uint8Array {
  const out = new Uint8Array(sim.input.graph.nodeCount);
  sim.down.forEach((spans, i) => {
    if (spans.some((s) => s.from <= t && t < s.to)) out[i] = 1;
  });
  return out;
}

export function forwardedAt(sim: SimResult, node: number, t: number): number {
  return countAtOrBefore(sim.forwarded[node], t);
}

/** Packets a node or machine source has sent itself by time t. */
export function sentByAt(sim: SimResult, node: number, t: number): number {
  return countAtOrBefore(sim.sentBy[node], t);
}

/** Missed hellos a radio's neighbors have counted at time t (0 when none, `missedHellosToDown` once down). */
export function missedHellosAt(sim: SimResult, failure: FailureRecord, t: number): number {
  if (t < failure.failS) return 0;
  if (failure.rejoinS !== null && t >= failure.rejoinS) return 0;
  const k = Math.floor((t - failure.lastHelloS) / sim.routing.helloIntervalS);
  const cap = failure.detectS === null ? sim.routing.missedHellosToDown - 1 : Infinity;
  return Math.max(0, Math.min(k, sim.routing.missedHellosToDown, cap));
}

export interface SimStats {
  sent: number;
  delivered: number;
  lost: number;
  /** Packets waiting in queues right now. */
  queued: number;
  /** Largest single queue so far. */
  largestQueue: number;
}

export function statsAt(sim: SimResult, t: number): SimStats {
  let queued = 0;
  for (let i = 0; i < sim.queue.length; i++) queued += queueAt(sim, i, t);
  return {
    sent: countAtOrBefore(sim.sentTimes, t),
    delivered: countAtOrBefore(sim.deliveredTimes, t),
    lost: countAtOrBefore(sim.lostTimes, t),
    queued,
    largestQueue: timelineAt(sim.maxQueue, t, 0),
  };
}
