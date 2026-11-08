import { describe, expect, it } from 'vitest';
import { PLAY } from '../src/config/play';
import { buildGraph, computeNetwork, computeRouting, routePath } from '../src/engine/network';
import { buildPlayModel, buildStateAt, cellRadioId } from '../src/engine/playModel';

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
    expect(graph.neighbors[cellRadioId(model, 1, 1)]).toHaveLength(4);
    expect(graph.neighbors[cellRadioId(model, 0, 0)]).toHaveLength(2);
  });

  it('links the base to the six radios around its pad', () => {
    const linked = graph.neighbors[graph.baseId].map((id) => model.radios[id].label).sort();
    expect(linked).toEqual(['C4-1', 'C4-2', 'C4-3', 'C5-1', 'C5-2', 'C5-3']);
    for (const id of graph.neighbors[graph.baseId]) {
      expect(graph.distToBase[id]).toBeLessThanOrEqual(PLAY.linkRangeM);
    }
  });
});

describe('computeNetwork (T4.2)', () => {
  it('connects every radio of the finished grid with 100% coverage', () => {
    const net = computeNetwork(graph, aliveExcept());
    expect(net.connectedRadios).toBe(50);
    expect(net.cutOffRadios).toBe(0);
    expect(net.coverage).toBe(1);
    expect(Math.max(...net.routing.hops)).toBeGreaterThan(0);
  });

  it('routes the watched source west along the middle row', () => {
    const net = computeNetwork(graph, aliveExcept());
    const watched = cellRadioId(model, 9, 2);
    const labels = routePath(net.routing, watched).map((id) =>
      id === graph.baseId ? 'base' : model.radios[id].label,
    );
    expect(labels).toEqual(['C9-2', 'C8-2', 'C7-2', 'C6-2', 'C5-2', 'base']);
  });

  it('keeps every radio connected and the ground covered when (7, 2) fails: the circles overlap (D51)', () => {
    const failed = cellRadioId(model, 7, 2);
    const net = computeNetwork(graph, aliveExcept(failed));
    expect(net.onlineRadios).toBe(49);
    expect(net.connectedRadios).toBe(49);
    expect(net.cutOffRadios).toBe(0);
    // At the real range-to-spacing ratio the neighbors' circles reach over the failed radio's cell.
    expect(net.coverage).toBe(1);
    expect(net.links.some(([a, b]) => a === failed || b === failed)).toBe(false);
    // The watched route is 1 hop longer: the base also links (5, 3), so the detour is short.
    const watched = cellRadioId(model, 9, 2);
    expect(net.routing.hops[watched]).toBe(6);
  });

  it('cuts off the radios beyond a failed column', () => {
    const column = Array.from({ length: PLAY.cellRows }, (_, row) => cellRadioId(model, 7, row));
    const net = computeNetwork(graph, aliveExcept(...column));
    for (const r of model.radios) {
      if (r.cellCol === 7) {
        expect(net.alive[r.id]).toBe(0);
        continue;
      }
      expect(net.cutOff[r.id]).toBe(r.cellCol > 7 ? 1 : 0);
      expect(net.connected[r.id]).toBe(r.cellCol < 7 ? 1 : 0);
    }
    expect(net.cutOffRadios).toBe(10);
    expect(net.coverage).toBeLessThan(0.8);
  });

  it('gives a backup next hop that avoids the radio and its next hop', () => {
    const routing = computeRouting(graph, new Uint8Array(graph.nodeCount).fill(1));
    const upstream = cellRadioId(model, 8, 2);
    expect(routing.nextHop[upstream]).toBe(cellRadioId(model, 7, 2));
    const backup = routing.backupHop[upstream];
    expect(model.radios[backup].label).toBe('C8-3');
    const path = routePath(routing, backup);
    expect(path).not.toContain(upstream);
    expect(path).not.toContain(cellRadioId(model, 7, 2));
    expect(path[path.length - 1]).toBe(graph.baseId);
  });

  it('counts only connected radios as coverage during the build', () => {
    const state = buildStateAt(model, 0);
    const net = computeNetwork(
      graph,
      state.radioState.map((s) => (s === 2 ? 1 : 0)),
    );
    expect(net.onlineRadios).toBe(0);
    // Only the base's circle, which lies inside the section.
    const circle = (Math.PI * PLAY.coverageRadiusM ** 2) / (model.widthM * model.heightM);
    expect(net.coverage).toBeCloseTo(circle, 2);
  });
});
