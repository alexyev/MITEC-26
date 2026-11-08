import { describe, expect, it } from 'vitest';
import { PLAY } from '../src/config/play';
import { buildGraph, computeNetwork, computeRouting, routePath } from '../src/engine/network';
import { buildPlayModel, buildStateAt, radioAt } from '../src/engine/playModel';

const model = buildPlayModel();
const graph = buildGraph(model);
const R = model.radios.length;

function aliveExcept(...failed: number[]): Uint8Array {
  const alive = new Uint8Array(R).fill(1);
  for (const f of failed) alive[f] = 0;
  return alive;
}

describe('buildGraph (T4.2)', () => {
  it('links lane and column neighbors and never diagonals', () => {
    for (const r of model.radios) {
      for (const v of graph.neighbors[r.id]) {
        if (v === graph.baseId) continue;
        const o = model.radios[v];
        expect(Math.abs(o.cellCol - r.cellCol) + Math.abs(o.cellRow - r.cellRow)).toBe(1);
      }
    }
    // Inner radios have 4 grid neighbors, corners 2.
    expect(graph.neighbors[radioAt(model, 1, 1).id]).toHaveLength(4);
    expect(graph.neighbors[radioAt(model, 0, 0).id]).toHaveLength(2);
  });

  it('links the base to the radios within link range around it', () => {
    const linked = graph.neighbors[graph.baseId].map((id) => model.radios[id].label).sort();
    expect(linked).toEqual(['C3-2', 'C4-1', 'C4-2', 'C4-3', 'C5-2']);
    for (const id of graph.neighbors[graph.baseId]) {
      expect(graph.distToBase[id]).toBeLessThanOrEqual(PLAY.linkRangeM);
    }
  });
});

describe('computeNetwork (T4.2)', () => {
  it('connects every radio of the finished grid with 100% coverage', () => {
    const net = computeNetwork(graph, aliveExcept());
    expect(net.connectedRadios).toBe(45);
    expect(net.cutOffRadios).toBe(0);
    expect(net.coverage).toBe(1);
    expect(Math.max(...net.routing.hops)).toBeGreaterThan(0);
  });

  it('routes the watched source west along the middle row', () => {
    const net = computeNetwork(graph, aliveExcept());
    const watched = radioAt(model, 8, 2).id;
    const labels = routePath(net.routing, watched).map((id) =>
      id === graph.baseId ? 'base' : model.radios[id].label,
    );
    expect(labels).toEqual(['C8-2', 'C7-2', 'C6-2', 'C5-2', 'base']);
  });

  it('keeps every radio connected when (6, 2) fails; coverage drops below 100% but stays above 95%', () => {
    const failed = radioAt(model, 6, 2).id;
    const net = computeNetwork(graph, aliveExcept(failed));
    expect(net.onlineRadios).toBe(44);
    expect(net.connectedRadios).toBe(44);
    expect(net.cutOffRadios).toBe(0);
    expect(net.coverage).toBeLessThan(1);
    expect(net.coverage * 100).toBeGreaterThan(PLAY.coverageTargetPct);
    expect(net.links.some(([a, b]) => a === failed || b === failed)).toBe(false);
    // The watched route is 2 hops longer.
    const watched = radioAt(model, 8, 2).id;
    expect(net.routing.hops[watched]).toBe(6);
  });

  it('cuts off the radios beyond a failed column', () => {
    const column = Array.from({ length: PLAY.cellRows }, (_, row) => radioAt(model, 6, row).id);
    const net = computeNetwork(graph, aliveExcept(...column));
    for (const r of model.radios) {
      if (r.cellCol === 6) {
        expect(net.alive[r.id]).toBe(0);
        continue;
      }
      expect(net.cutOff[r.id]).toBe(r.cellCol > 6 ? 1 : 0);
      expect(net.connected[r.id]).toBe(r.cellCol < 6 ? 1 : 0);
    }
    expect(net.cutOffRadios).toBe(10);
    expect(net.coverage).toBeLessThan(0.8);
  });

  it('gives a backup next hop that avoids the radio and its next hop', () => {
    const routing = computeRouting(graph, new Uint8Array(graph.nodeCount).fill(1));
    const upstream = radioAt(model, 7, 2).id;
    expect(routing.nextHop[upstream]).toBe(radioAt(model, 6, 2).id);
    const backup = routing.backupHop[upstream];
    expect(model.radios[backup].label).toBe('C7-1');
    const path = routePath(routing, backup);
    expect(path).not.toContain(upstream);
    expect(path).not.toContain(radioAt(model, 6, 2).id);
    expect(path[path.length - 1]).toBe(graph.baseId);
  });

  it('counts only connected radios as coverage during the build', () => {
    const state = buildStateAt(model, 0);
    const net = computeNetwork(
      graph,
      state.radioState.map((s) => (s === 2 ? 1 : 0)),
    );
    expect(net.onlineRadios).toBe(0);
    expect(net.coverage).toBeGreaterThan(0);
    expect(net.coverage).toBeLessThan(0.1);
  });
});
