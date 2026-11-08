import { describe, expect, it } from 'vitest';
import { ROUTING } from '../src/config/defaults';
import { PLAY } from '../src/config/play';
import { coveringNode, machinesAt } from '../src/engine/machines';
import { buildGraph, computeNetwork } from '../src/engine/network';
import {
  hopsAt,
  pathAt,
  presetFailS,
  queueAt,
  sentByAt,
  simulate,
  sourceNode,
  statsAt,
  type MachineSource,
  type SimChange,
} from '../src/engine/packetSim';
import { buildClockAt, buildPlayModel } from '../src/engine/playModel';
import { failureScenario } from '../src/engine/scenario';

// D70, D71: a frontier robot sends its data through the radio that covers it, on the partly built network
// of the moment the walkthrough holds the build, while a radio on its route fails.
const model = buildPlayModel();
const graph = buildGraph(model);
const sc = failureScenario(model, graph);
const label = (id: number): string =>
  id === graph.baseId ? 'base' : id >= graph.nodeCount ? 'robot' : model.radios[id].label;
const robot = sourceNode(graph, 0);
const startS = 0;
const failS = presetFailS(graph, sc.failed, startS + 5);
const endS = failS + 12;
const source: MachineSource = {
  x: sc.robot.x,
  y: sc.robot.y,
  fromS: startS,
  toS: endS,
  packetIntervalS: PLAY.scenario.robotPacketIntervalS,
};
const preset: SimChange[] = [{ tS: failS, radio: sc.failed, kind: 'fail' }];
const run = (seed?: number) =>
  simulate({ graph, startS, endS, online: sc.online, sources: [source], changes: preset, seed });
const sim = run();
const record = sim.failures[0];
const detectS = record.detectS as number;
const reroutedS = record.reroutedS as number;

describe('the failure scenario (D70)', () => {
  it('holds the build halfway through the foundations of the middle stage', () => {
    const clock = buildClockAt(model, sc.holdBuildS);
    expect(sc.stage).toBe(Math.floor(model.stages.length / 2));
    expect(clock.stage).toBe(sc.stage);
    expect(PLAY.frontierPhases[clock.phase].id).toBe('foundations');
    expect(clock.frac).toBeCloseTo(PLAY.scenario.phaseShare, 9);
    expect(sc.robot.glyph).toBe('pileRig');
  });

  it('follows a robot on a partly built network, several radio hops from the base', () => {
    const on = sc.online.reduce((n, v) => n + v, 0);
    expect(on).toBeGreaterThan(0);
    expect(on).toBeLessThan(model.radios.length);
    expect(sc.route.map(label)).toEqual(['C8-2', 'C7-2', 'C6-2', 'C5-2', 'base']);
    expect(label(sc.uplink)).toBe('C8-2');
    // The failed radio is behind the front and not the robot's own radio.
    expect(label(sc.failed)).toBe('C6-2');
    expect(sc.online[sc.failed]).toBe(1);
  });
});

describe('a robot as a packet source (D71)', () => {
  it('links through the radio that covers it and sends hop by hop to the base', () => {
    expect(pathAt(sim, robot, startS + 1).map(label)).toEqual([
      'robot',
      'C8-2',
      'C7-2',
      'C6-2',
      'C5-2',
      'base',
    ]);
    expect(hopsAt(sim, robot, startS + 1)).toBe(sc.route.length);
    expect(sentByAt(sim, robot, endS)).toBe(
      Math.ceil((endS - startS) / PLAY.scenario.robotPacketIntervalS),
    );
    const first = sim.events.find((e) => e.kind === 'hop' && e.node === robot);
    expect(first?.other).toBe(sc.uplink);
  });

  it('gives the same events for the same seed, and different ones for another seed', () => {
    expect(run().events).toEqual(sim.events);
    expect(run(7).events).not.toEqual(sim.events);
  });

  it('detects the failure within missedHellosToDown x helloIntervalS +- helloIntervalS', () => {
    const expected = ROUTING.missedHellosToDown * ROUTING.helloIntervalS;
    expect(Math.abs(detectS - record.failS - expected)).toBeLessThanOrEqual(ROUTING.helloIntervalS);
    expect(detectS).toBeCloseTo(
      record.lastHelloS + ROUTING.missedHellosToDown * ROUTING.helloIntervalS,
      9,
    );
    // Only radios that are on hear the hellos: the watchers are the failed radio's built neighbors.
    const downs = sim.events.filter((e) => e.kind === 'neighborDown' && e.other === sc.failed);
    expect(downs.length).toBeGreaterThan(0);
    for (const e of downs) expect(sc.online[e.node]).toBe(1);
  });

  it('changes the robot route around the failed radio', () => {
    const before = pathAt(sim, robot, failS - 0.01);
    const after = pathAt(sim, robot, reroutedS + 0.5);
    expect(before).toContain(sc.failed);
    expect(after).not.toContain(sc.failed);
    expect(after[after.length - 1]).toBe(graph.baseId);
    expect(after.map(label)).toEqual(['robot', 'C8-2', 'C7-2', 'C7-3', 'C6-3', 'C5-3', 'base']);
    expect(hopsAt(sim, robot, reroutedS + 0.5) - hopsAt(sim, robot, failS - 0.01)).toBe(1);
  });

  it('loses no packets and delivers every queued packet, the robot packets among them', () => {
    const queuedAtDetect = statsAt(sim, detectS - 1e-6).queued;
    expect(queuedAtDetect).toBeGreaterThan(0);
    expect(queueAt(sim, cellRadio(7, 2), detectS - 1e-6)).toBeGreaterThan(0);
    expect(statsAt(sim, reroutedS + 2).queued).toBe(0);
    expect(statsAt(sim, endS).lost).toBe(0);
    const delivered = new Set(
      sim.events.filter((e) => e.kind === 'delivered').map((e) => e.packet),
    );
    const settled = sim.packetSentS.filter((t) => t <= endS - 2).length;
    for (let p = 0; p < settled; p++) expect(delivered.has(p)).toBe(true);
    const robotPackets = sim.packetSource
      .map((src, p) => ({ src, p }))
      .filter(({ src, p }) => src === robot && sim.packetSentS[p] <= endS - 2);
    expect(robotPackets.length).toBeGreaterThan(20);
    for (const { p } of robotPackets) expect(delivered.has(p)).toBe(true);
  });

  it('keeps the robot online by the coverage rule, matching its link in the simulation', () => {
    const alive = sc.online.slice();
    alive[sc.failed] = 0;
    const connected = computeNetwork(graph, alive).connected;
    const via = coveringNode(graph, connected, PLAY.coverageRadiusM, sc.robot.x, sc.robot.y);
    expect(via).toBe(sc.uplink);
    // The machines rule (D51) through the failure: online, covered by the same radio.
    const clock = buildClockAt(model, sc.holdBuildS);
    const healthy = computeNetwork(graph, sc.online).connected;
    const machines = machinesAt(model, graph, clock, [
      { fromFrac: 0, toFrac: clock.frac, connected: healthy },
      { fromFrac: clock.frac, toFrac: clock.frac, connected },
    ]);
    const m = machines.find((x) => x.team === sc.team);
    expect(m?.online).toBe(true);
    expect(m?.coveredBy).toBe(sc.uplink);
    expect(m?.x).toBeCloseTo(sc.robot.x, 9);
    expect(m?.y).toBeCloseTo(sc.robot.y, 9);
    for (const t of [failS - 0.5, failS + 1, detectS + 0.5, endS]) {
      expect(pathAt(sim, robot, t)[1]).toBe(sc.uplink);
    }
  });
});

describe('a robot whose own radio fails (D71)', () => {
  // Fail every radio that covers the robot: it has no coverage, so by the rule it stops.
  const covering = model.radios
    .filter(
      (r) =>
        sc.online[r.id] && Math.hypot(r.x - sc.robot.x, r.y - sc.robot.y) <= PLAY.coverageRadiusM,
    )
    .map((r) => r.id);
  const t0 = 3.05;
  const repairS = t0 + 8;
  const changes: SimChange[] = [
    ...covering.map((radio) => ({ tS: t0, radio, kind: 'fail' as const })),
    ...covering.map((radio) => ({ tS: repairS, radio, kind: 'repair' as const })),
  ];
  const s = simulate({
    graph,
    startS: 0,
    endS: repairS + 6,
    online: sc.online,
    sources: [{ ...source, toS: repairS + 6 }],
    changes,
  });
  const detected = Math.max(...s.failures.map((f) => f.detectS as number));

  it('has no coverage while they are down, so it stops (D51)', () => {
    expect(covering.length).toBeGreaterThan(0);
    const alive = sc.online.slice();
    for (const r of covering) alive[r] = 0;
    const connected = computeNetwork(graph, alive).connected;
    expect(coveringNode(graph, connected, PLAY.coverageRadiusM, sc.robot.x, sc.robot.y)).toBe(-1);
  });

  it('loses its link at detection, holds its packets, and sends them once its radio is back', () => {
    expect(pathAt(s, robot, detected + 0.1)).toEqual([robot]);
    expect(hopsAt(s, robot, detected + 0.1)).toBe(-1);
    expect(queueAt(s, robot, repairS - 0.01)).toBeGreaterThan(10);
    const rejoined = Math.max(...s.failures.map((f) => f.rejoinS as number));
    expect(pathAt(s, robot, rejoined + 1)[1]).toBe(sc.uplink);
    expect(queueAt(s, robot, rejoined + 3)).toBe(0);
    expect(statsAt(s, repairS + 6).lost).toBe(0);
    const uplinks = s.events.filter((e) => e.kind === 'uplink' && e.node === robot);
    expect(uplinks.map((e) => e.other)).toContain(-1);
  });
});

describe('radios the build switches on mid-simulation (D71)', () => {
  it('join the routes at once and start sending', () => {
    // A radio of the next stage, beside one that is on.
    const later = model.radios.find(
      (r) => !sc.online[r.id] && graph.neighbors[r.id].some((v) => sc.online[v] === 1),
    );
    expect(later).toBeDefined();
    const id = (later as (typeof model.radios)[number]).id;
    const s = simulate({
      graph,
      startS: 0,
      endS: 10,
      online: sc.online,
      changes: [{ tS: 2, radio: id, kind: 'on' }],
    });
    expect(hopsAt(s, id, 1.9)).toBe(-1);
    expect(hopsAt(s, id, 2.5)).toBeGreaterThan(0);
    expect(sentByAt(s, id, 2)).toBe(0);
    expect(sentByAt(s, id, 10)).toBeGreaterThan(5);
    expect(statsAt(s, 10).lost).toBe(0);
  });

  it('ignores a repair of a radio that never failed, so an unbuilt radio stays off', () => {
    const later = model.radios.find((r) => !sc.online[r.id]) as (typeof model.radios)[number];
    const s = simulate({
      graph,
      startS: 0,
      endS: 5,
      online: sc.online,
      changes: [{ tS: 1, radio: later.id, kind: 'repair' }],
    });
    expect(hopsAt(s, later.id, 4)).toBe(-1);
    expect(sentByAt(s, later.id, 5)).toBe(0);
  });
});

function cellRadio(col: number, row: number): number {
  return model.radios.findIndex((r) => r.cellCol === col && r.cellRow === row);
}
