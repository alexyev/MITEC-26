// Radio network of the play model (spec 4, 9.3): lane and column links, shortest-hop routes to the base
// with a backup next hop, connected and cut-off radios, and coverage as the union of the radio circles.
import type { PlayModel } from './playModel';

/** Static network graph: every link that exists when both ends are alive. Node `baseId` is the base. */
export interface Graph {
  nodeCount: number;
  baseId: number;
  x: Float64Array;
  y: Float64Array;
  /** Neighbor ids of every node, ascending. */
  neighbors: number[][];
  /** Straight-line distance of every node to the base (route tie-break). */
  distToBase: Float64Array;
  /** Coverage sample grid over the play-model rectangle. */
  samples: { nx: number; ny: number; stepX: number; stepY: number; count: number };
  /** Sample indices inside each node's coverage circle. */
  cover: Int32Array[];
}

export interface Routing {
  /** Hops to the base, -1 when there is no route. */
  hops: Int32Array;
  /** Next hop toward the base, -1 for the base and for nodes with no route. */
  nextHop: Int32Array;
  /** Best other neighbor whose route avoids this node and its next hop, -1 when there is none. */
  backupHop: Int32Array;
}

export interface NetworkState {
  /** 1 when the node is on and not failed (the base is always alive). */
  alive: Uint8Array;
  routing: Routing;
  /** 1 when the node has a route to the base. */
  connected: Uint8Array;
  /** 1 for a radio that is alive but has no route to the base. */
  cutOff: Uint8Array;
  /** Links between alive nodes, as pairs `[a, b]` with `a < b`. */
  links: [number, number][];
  /** Radios (not the base) that are alive, and that are connected. */
  onlineRadios: number;
  connectedRadios: number;
  cutOffRadios: number;
  /** Share of the play-model rectangle within reach of a connected radio or the base, 0 to 1. */
  coverage: number;
}

export function buildGraph(model: PlayModel): Graph {
  const { config } = model;
  const radios = model.radios;
  const nodeCount = radios.length + 1;
  const baseId = model.base.id;
  const x = new Float64Array(nodeCount);
  const y = new Float64Array(nodeCount);
  for (const r of radios) {
    x[r.id] = r.x;
    y[r.id] = r.y;
  }
  x[baseId] = model.base.x;
  y[baseId] = model.base.y;

  const neighbors: number[][] = Array.from({ length: nodeCount }, () => []);
  const link = (a: number, b: number): void => {
    if (Math.hypot(x[a] - x[b], y[a] - y[b]) > config.linkRangeM) return;
    neighbors[a].push(b);
    neighbors[b].push(a);
  };
  // Radios link to their lane and column neighbors on the radio grid (spec 4); diagonals never link.
  const at = (col: number, row: number) =>
    col < config.cellCols && row < config.cellRows
      ? model.cellRadio[row * config.cellCols + col]
      : -1;
  for (const r of radios) {
    const east = at(r.cellCol + 1, r.cellRow);
    const north = at(r.cellCol, r.cellRow + 1);
    if (east >= 0) link(r.id, east);
    if (north >= 0) link(r.id, north);
  }
  // The base is a radio with the same link range: it links to every radio within range (decision D41).
  for (const r of radios) link(baseId, r.id);
  for (const list of neighbors) list.sort((a, b) => a - b);

  const distToBase = new Float64Array(nodeCount);
  for (let i = 0; i < nodeCount; i++)
    distToBase[i] = Math.hypot(x[i] - x[baseId], y[i] - y[baseId]);

  const nx = Math.max(1, Math.round(model.widthM / config.coverageSampleM));
  const ny = Math.max(1, Math.round(model.heightM / config.coverageSampleM));
  const stepX = model.widthM / nx;
  const stepY = model.heightM / ny;
  const radius = config.coverageRadiusM;
  const cover: Int32Array[] = [];
  for (let n = 0; n < nodeCount; n++) {
    const ids: number[] = [];
    const i0 = Math.max(0, Math.floor((x[n] - radius) / stepX));
    const i1 = Math.min(nx - 1, Math.ceil((x[n] + radius) / stepX));
    const j0 = Math.max(0, Math.floor((y[n] - radius) / stepY));
    const j1 = Math.min(ny - 1, Math.ceil((y[n] + radius) / stepY));
    for (let j = j0; j <= j1; j++) {
      const sy = (j + 1 / 2) * stepY;
      for (let i = i0; i <= i1; i++) {
        const sx = (i + 1 / 2) * stepX;
        if (Math.hypot(sx - x[n], sy - y[n]) <= radius) ids.push(j * nx + i);
      }
    }
    cover.push(Int32Array.from(ids));
  }

  return {
    nodeCount,
    baseId,
    x,
    y,
    neighbors,
    distToBase,
    samples: { nx, ny, stepX, stepY, count: nx * ny },
    cover,
  };
}

/** Is `a` a better next hop than `b`: fewer hops, then nearer the base, then the lower id (spec 9.3). */
function better(graph: Graph, hops: Int32Array, a: number, b: number): boolean {
  if (b < 0) return true;
  if (hops[a] !== hops[b]) return hops[a] < hops[b];
  if (graph.distToBase[a] !== graph.distToBase[b]) return graph.distToBase[a] < graph.distToBase[b];
  return a < b;
}

/** Shortest-hop routes to the base over the alive nodes (BFS), with a backup next hop per node. */
export function computeRouting(graph: Graph, alive: Uint8Array): Routing {
  const n = graph.nodeCount;
  const hops = new Int32Array(n).fill(-1);
  const nextHop = new Int32Array(n).fill(-1);
  const backupHop = new Int32Array(n).fill(-1);
  if (!alive[graph.baseId]) return { hops, nextHop, backupHop };

  hops[graph.baseId] = 0;
  const queue = [graph.baseId];
  for (let head = 0; head < queue.length; head++) {
    const u = queue[head];
    for (const v of graph.neighbors[u]) {
      if (alive[v] && hops[v] < 0) {
        hops[v] = hops[u] + 1;
        queue.push(v);
      }
    }
  }

  for (let i = 0; i < n; i++) {
    if (i === graph.baseId || hops[i] < 0) continue;
    for (const v of graph.neighbors[i]) {
      if (alive[v] && hops[v] === hops[i] - 1 && better(graph, hops, v, nextHop[i])) nextHop[i] = v;
    }
  }

  const routesThrough = (from: number, avoid: number): boolean => {
    for (let k = from; k >= 0; k = nextHop[k]) if (k === avoid) return true;
    return false;
  };
  for (let i = 0; i < n; i++) {
    if (i === graph.baseId || hops[i] < 0) continue;
    for (const v of graph.neighbors[i]) {
      if (!alive[v] || hops[v] < 0 || v === nextHop[i]) continue;
      // The base never fails, so a backup only has to avoid a next hop that is a radio.
      const avoidNext = nextHop[i] !== graph.baseId && routesThrough(v, nextHop[i]);
      if (routesThrough(v, i) || avoidNext) continue;
      if (better(graph, hops, v, backupHop[i])) backupHop[i] = v;
    }
  }
  return { hops, nextHop, backupHop };
}

/** Node path from a node to the base along the next hops (just the node when it has no route). */
export function routePath(routing: Routing, from: number): number[] {
  const path = [from];
  const limit = routing.nextHop.length;
  for (let k = routing.nextHop[from]; k >= 0 && path.length <= limit; k = routing.nextHop[k]) {
    path.push(k);
  }
  return path;
}

/** Covered share (0 to 1) of the sample grid, from the nodes that provide coverage (1 = covers). */
export function coverageShare(graph: Graph, covering: Uint8Array): number {
  const hit = new Uint8Array(graph.samples.count);
  let count = 0;
  for (let n = 0; n < graph.nodeCount; n++) {
    if (!covering[n]) continue;
    for (const s of graph.cover[n]) {
      if (!hit[s]) {
        hit[s] = 1;
        count++;
      }
    }
  }
  return count / graph.samples.count;
}

/**
 * Network state for a set of alive radios (on and not failed). The base is always alive.
 * Only connected radios and the base count as coverage (spec 9.3).
 */
export function computeNetwork(graph: Graph, aliveRadios: Uint8Array): NetworkState {
  const alive = new Uint8Array(graph.nodeCount);
  alive.set(aliveRadios.subarray(0, graph.nodeCount - 1));
  alive[graph.baseId] = 1;
  const routing = computeRouting(graph, alive);
  const connected = new Uint8Array(graph.nodeCount);
  const cutOff = new Uint8Array(graph.nodeCount);
  let onlineRadios = 0;
  let connectedRadios = 0;
  let cutOffRadios = 0;
  for (let i = 0; i < graph.nodeCount; i++) {
    if (routing.hops[i] >= 0) connected[i] = 1;
    if (i === graph.baseId || !alive[i]) continue;
    onlineRadios++;
    if (connected[i]) connectedRadios++;
    else {
      cutOff[i] = 1;
      cutOffRadios++;
    }
  }
  const links: [number, number][] = [];
  for (let a = 0; a < graph.nodeCount; a++) {
    if (!alive[a]) continue;
    for (const b of graph.neighbors[a]) if (b > a && alive[b]) links.push([a, b]);
  }
  return {
    alive,
    routing,
    connected,
    cutOff,
    links,
    onlineRadios,
    connectedRadios,
    cutOffRadios,
    coverage: coverageShare(graph, connected),
  };
}
