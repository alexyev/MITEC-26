import { describe, expect, it } from 'vitest';
import { ROUTING } from '../src/config/defaults';
import { PLAY } from '../src/config/play';
import { buildGraph, presetRadios } from '../src/engine/network';
import {
  createSim,
  failedAt,
  hopsAt,
  missedHellosAt,
  packetsAt,
  pathAt,
  presetFailS,
  queueAt,
  simulate,
  statsAt,
  type SimChange,
} from '../src/engine/packetSim';
import { buildPlayModel, cellRadioId } from '../src/engine/playModel';

const model = buildPlayModel();
const graph = buildGraph(model);
const { failed, watched } = presetRadios(model, graph);
const upstream = cellRadioId(model, 8, 2);
const failS = presetFailS(graph, failed, 5);
const endS = failS + 30;
const preset: SimChange[] = [{ tS: failS, radio: failed, kind: 'fail' }];
const sim = simulate({ graph, startS: 0, endS, changes: preset });
const record = sim.failures[0];
const label = (id: number): string => (id === graph.baseId ? 'base' : model.radios[id].label);

describe('simulate: preset failure (T4.3)', () => {
  it('fails the radio just after one of its hellos', () => {
    expect(record.radio).toBe(failed);
    expect(record.failS).toBeCloseTo(record.lastHelloS + PLAY.failAfterHelloS, 9);
    expect(failedAt(sim, failS - 0.01)[failed]).toBe(0);
    expect(failedAt(sim, failS)[failed]).toBe(1);
  });

  it('detects the failure within missedHellosToDown x helloIntervalS +- helloIntervalS', () => {
    const expected = ROUTING.missedHellosToDown * ROUTING.helloIntervalS;
    const delay = (record.detectS as number) - record.failS;
    expect(Math.abs(delay - expected)).toBeLessThanOrEqual(ROUTING.helloIntervalS);
    // The neighbors count 1/3, 2/3 and 3/3 one hello interval apart.
    const at = (k: number) => record.lastHelloS + k * ROUTING.helloIntervalS;
    expect(missedHellosAt(sim, record, at(1) - 0.01)).toBe(0);
    expect(missedHellosAt(sim, record, at(1))).toBe(1);
    expect(missedHellosAt(sim, record, at(2))).toBe(2);
    expect(missedHellosAt(sim, record, at(3))).toBe(3);
    expect(record.detectS).toBeCloseTo(at(3), 9);
    const downs = sim.events.filter((e) => e.kind === 'neighborDown' && e.other === failed);
    expect(downs.map((e) => label(e.node)).sort()).toEqual(['C7-1', 'C6-2', 'C8-2', 'C7-3'].sort());
  });

  it('repairs locally at once, then floods the route update', () => {
    const repairs = sim.events.filter((e) => e.kind === 'localRepair');
    expect(repairs.map((e) => [label(e.node), label(e.other)])).toEqual([['C8-2', 'C8-3']]);
    expect(repairs[0].tS).toBe(record.detectS);
    expect(record.reroutedS as number).toBeGreaterThan(record.detectS as number);
    expect((record.reroutedS as number) - (record.detectS as number)).toBeLessThan(0.5);
  });

  it('queues at the upstream neighbor during detection and empties the queue after the reroute', () => {
    expect(queueAt(sim, upstream, failS - 0.01)).toBe(0);
    const peak = queueAt(sim, upstream, (record.detectS as number) - 1e-6);
    expect(peak).toBeGreaterThanOrEqual(4);
    expect(queueAt(sim, upstream, (record.reroutedS as number) + 1)).toBe(0);
    expect(statsAt(sim, endS).largestQueue).toBe(peak);
  });

  it('loses no packets and delivers every queued packet after the reroute', () => {
    const stats = statsAt(sim, endS);
    expect(stats.lost).toBe(0);
    const delivered = new Set(
      sim.events.filter((e) => e.kind === 'delivered').map((e) => e.packet),
    );
    const settled = sim.packetSentS.filter((t) => t <= endS - 2).length;
    for (let p = 0; p < settled; p++) expect(delivered.has(p)).toBe(true);
    expect(statsAt(sim, (record.reroutedS as number) + 2).queued).toBe(0);
  });

  it('makes the watched route 1 hop longer', () => {
    const before = pathAt(sim, watched, failS - 0.01).map(label);
    const after = pathAt(sim, watched, (record.reroutedS as number) + 1).map(label);
    expect(before).toEqual(['C9-2', 'C8-2', 'C7-2', 'C6-2', 'C5-2', 'base']);
    expect(after).toEqual(['C9-2', 'C8-2', 'C8-3', 'C7-3', 'C6-3', 'C5-3', 'base']);
    expect(hopsAt(sim, watched, endS) - hopsAt(sim, watched, 0)).toBe(1);
  });

  it('shows packets in flight as dots on hops', () => {
    const dots = packetsAt(sim, failS - 0.5);
    expect(dots.length).toBeGreaterThan(5);
    for (const d of dots) {
      expect(d.f).toBeGreaterThanOrEqual(0);
      expect(d.f).toBeLessThan(1);
      expect(graph.neighbors[d.from]).toContain(d.to);
    }
    // Nothing moves into or out of the failed radio after detection.
    const later = packetsAt(sim, (record.detectS as number) + 0.5);
    expect(later.some((d) => d.to === failed || d.from === failed)).toBe(false);
  });

  it('gives the same events for the same seed, and different ones for another seed', () => {
    const again = simulate({ graph, startS: 0, endS, changes: preset });
    expect(again.events).toEqual(sim.events);
    const other = simulate({ graph, startS: 0, endS, changes: preset, seed: 7 });
    expect(other.events).not.toEqual(sim.events);
  });
});

describe('simulate: user failures and repairs (T4.3)', () => {
  it('rejoins a repaired radio at its next hello and restores the short route', () => {
    const repairS = failS + 10;
    const s = simulate({
      graph,
      startS: 0,
      endS: failS + 20,
      changes: [...preset, { tS: repairS, radio: failed, kind: 'repair' }],
    });
    const rec = s.failures[0];
    expect(rec.rejoinS as number).toBeGreaterThanOrEqual(repairS);
    expect((rec.rejoinS as number) - repairS).toBeLessThan(ROUTING.helloIntervalS);
    expect(failedAt(s, (rec.rejoinS as number) - 0.001)[failed]).toBe(1);
    expect(failedAt(s, rec.rejoinS as number)[failed]).toBe(0);
    expect(hopsAt(s, watched, (rec.rejoinS as number) + 1)).toBe(5);
    expect(statsAt(s, failS + 20).lost).toBe(0);
  });

  it('queues the traffic of cut-off radios and loses only what they held when they failed', () => {
    const column = Array.from({ length: PLAY.cellRows }, (_, row) => cellRadioId(model, 6, row));
    const changes = column.map((radio) => ({ tS: 2, radio, kind: 'fail' as const }));
    const s = simulate({ graph, startS: 0, endS: 20, changes });
    const east = cellRadioId(model, 8, 0);
    expect(queueAt(s, east, 19)).toBeGreaterThan(10);
    expect(hopsAt(s, east, 19)).toBe(-1);
    // A radio whose route stays west of the cut keeps delivering.
    const west = cellRadioId(model, 0, 0);
    expect(queueAt(s, west, 19)).toBe(0);
  });

  it('applies a live click at the frontier and matches the pure replay', () => {
    const live = createSim({ graph, startS: 0, endS: Infinity, changes: preset });
    for (let t = 0; t <= failS + 12; t += 1 / 60) live.advanceTo(t);
    const clickS = failS + 12;
    const applied = live.addChange({
      tS: clickS - 5,
      radio: cellRadioId(model, 2, 1),
      kind: 'fail',
    });
    expect(applied.tS).toBeCloseTo(live.frontierS(), 9);
    for (let t = clickS; t <= clickS + 10; t += 1 / 60) live.advanceTo(t);
    const end = live.frontierS();
    const pure = simulate({ graph, startS: 0, endS: end, changes: live.result.changes });
    expect(live.result.events).toEqual(pure.events);
    expect(live.result.failures[1].detectS).not.toBeNull();
  });

  it('stays fast enough to recompute on a click after ten minutes of play', () => {
    const changes: SimChange[] = [
      ...preset,
      { tS: 100, radio: cellRadioId(model, 2, 1), kind: 'fail' },
      { tS: 200, radio: cellRadioId(model, 2, 1), kind: 'repair' },
    ];
    const t0 = performance.now();
    const s = simulate({ graph, startS: 0, endS: 600, changes });
    const ms = performance.now() - t0;
    expect(s.sentTimes.length).toBeGreaterThan(20_000);
    expect(ms).toBeLessThan(1000);
  });
});
