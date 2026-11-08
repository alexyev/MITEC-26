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
  uplinkChangeAt,
  type MachineSource,
  type SimChange,
} from '../src/engine/packetSim';
import { buildClockAt, buildPlayModel, radioAt } from '../src/engine/playModel';
import { edgeRadios, failureScenario } from '../src/engine/scenario';
import { featuredRadio } from '../src/ui/scene3d/featured';

// D70, D71, D170: a frontier robot sends its data through the edge radio that covers it, on the partly built
// network of the moment the walkthrough holds the build; that edge radio fails and the robot hands over to
// another edge radio that covers it. A failure inside the mesh still reroutes around it.
const model = buildPlayModel();
const graph = buildGraph(model);
const featured = featuredRadio(model);
const sc = failureScenario(model, graph, [featured]);
const label = (id: number): string =>
  id === graph.baseId ? 'base' : id >= graph.nodeCount ? 'robot' : model.radios[id].label;
const robot = sourceNode(graph, 0);
const startS = 0;
const source: MachineSource = {
  x: sc.robot.x,
  y: sc.robot.y,
  fromS: startS,
  toS: Infinity,
  packetIntervalS: PLAY.scenario.robotPacketIntervalS,
};
const runFailure = (radio: number, seed?: number) => {
  const failS = presetFailS(graph, radio, startS + 5);
  const endS = failS + 12;
  const sim = simulate({
    graph,
    startS,
    endS,
    online: sc.online,
    sources: [{ ...source, toS: endS }],
    changes: [{ tS: failS, radio, kind: 'fail' }],
    seed,
  });
  const record = sim.failures[0];
  return {
    sim,
    failS,
    endS,
    detectS: record.detectS as number,
    reroutedS: record.reroutedS as number,
  };
};
const edgeRun = runFailure(sc.failed);
const distance = (id: number) => Math.hypot(graph.x[id] - sc.robot.x, graph.y[id] - sc.robot.y);

describe('the failure scenario (D70, D170)', () => {
  it('holds the build in the foundations of the middle stage, at the first share that qualifies', () => {
    const clock = buildClockAt(model, sc.holdBuildS);
    expect(sc.stage).toBe(Math.floor(model.stages.length / 2));
    expect(clock.stage).toBe(sc.stage);
    expect(PLAY.frontierPhases[clock.phase].id).toBe('foundations');
    expect(PLAY.scenario.phaseShares).toContain(sc.phaseShare);
    expect(clock.frac).toBeCloseTo(sc.phaseShare, 9);
    // Halfway, every robot's edge radio is also the only cover of another machine; three quarters in, not.
    expect(sc.phaseShare).toBe(0.75);
    expect(sc.robot.glyph).toBe('pileRig');
  });

  it('fails the edge radio the robot sends through, on a partly built network', () => {
    const on = sc.online.reduce((n, v) => n + v, 0);
    expect(on).toBeGreaterThan(0);
    expect(on).toBeLessThan(model.radios.length);
    expect(sc.online[sc.failed]).toBe(1);
    expect(sc.edge[sc.failed]).toBe(1);
    // The robot's serving radio: the nearest connected radio that covers it (D51).
    const connected = computeNetwork(graph, sc.online).connected;
    expect(coveringNode(graph, connected, PLAY.coverageRadiusM, sc.robot.x, sc.robot.y)).toBe(
      sc.failed,
    );
    expect(sc.robot.coveredBy).toBe(sc.failed);
    expect(sc.route.map(label)).toEqual(['C8-2', 'C7-2', 'C6-2', 'C5-2', 'base']);
    // A commissioned radio beside it is missing: it borders the frontier, not the inside of the mesh.
    expect(graph.neighbors[sc.failed].some((v) => v !== graph.baseId && !sc.online[v])).toBe(true);
  });

  it('has another commissioned edge radio that covers the robot and takes it over', () => {
    expect(sc.handover).not.toBe(sc.failed);
    expect(sc.online[sc.handover]).toBe(1);
    expect(sc.edge[sc.handover]).toBe(1);
    expect(distance(sc.handover)).toBeLessThanOrEqual(PLAY.coverageRadiusM);
    expect(label(sc.handover)).toBe('C8-3');
    expect(sc.handoverRoute.map(label)).toEqual(['C8-3', 'C7-3', 'C6-3', 'C5-3', 'base']);
    expect(sc.handoverRoute).not.toContain(sc.failed);
  });

  it('leaves every other machine of the moment in coverage when the edge radio fails', () => {
    const clock = buildClockAt(model, sc.holdBuildS);
    const alive = sc.online.slice();
    alive[sc.failed] = 0;
    const without = computeNetwork(graph, alive).connected;
    const machines = machinesAt(model, graph, clock, [
      { fromFrac: 0, toFrac: clock.frac, connected: computeNetwork(graph, sc.online).connected },
    ]);
    expect(machines.length).toBeGreaterThan(1);
    for (const m of machines)
      expect(coveringNode(graph, without, PLAY.coverageRadiusM, m.x, m.y)).toBeGreaterThanOrEqual(
        0,
      );
  });

  it('keeps the "Take me there" radio out of the choice (D121)', () => {
    expect(label(featured)).toBe('C4-3');
    expect([sc.failed, sc.handover]).not.toContain(featured);
  });

  it('marks as edge the radios that are on with a side on the grid that has no radio on', () => {
    const all = new Uint8Array(model.radios.length).fill(1);
    const edge = edgeRadios(model, all);
    for (const r of model.radios) {
      const sides = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].filter(([dc, dr]) => {
        const col = r.cellCol + dc;
        const row = r.cellRow + dr;
        const inside = col >= 0 && col < PLAY.cellCols && row >= 0 && row < PLAY.cellRows;
        return inside && radioAt(model, col, row) !== undefined;
      });
      expect(edge[r.id], r.label).toBe(sides.length < 4 ? 1 : 0);
    }
    // At the hold the interior of the partly built mesh is not edge, and a radio that is off never is.
    expect(sc.edge[cellRadio(6, 2)]).toBe(0);
    expect(sc.edge[featured]).toBe(0);
    for (const r of model.radios) if (!sc.online[r.id]) expect(sc.edge[r.id]).toBe(0);
  });
});

describe('a robot whose edge radio fails (D71, D170)', () => {
  const { sim, failS, endS, detectS } = edgeRun;
  const relinks = sim.events.filter((e) => e.kind === 'uplink' && e.node === robot);
  const handover = relinks.find((e) => e.tS > failS);

  it('links through its edge radio and sends hop by hop to the base', () => {
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
    expect(first?.other).toBe(sc.failed);
  });

  it('relinks to the other edge radio within the hello timing', () => {
    expect(handover?.other).toBe(sc.handover);
    const t = handover?.tS as number;
    const expected = ROUTING.missedHellosToDown * ROUTING.helloIntervalS;
    expect(t - failS).toBeLessThanOrEqual(expected + ROUTING.helloIntervalS);
    expect(t - failS).toBeGreaterThanOrEqual(expected - ROUTING.helloIntervalS);
    // It hears the same hellos as the failed radio's neighbors, so it moves on when they declare it down.
    expect(t).toBeCloseTo(detectS, 9);
    expect(uplinkChangeAt(sim, robot, t)).toEqual({ from: sc.failed, to: sc.handover, atS: t });
    expect(uplinkChangeAt(sim, robot, t - 1e-6)).toBeNull();
    // Until then it holds its link to the silent radio; then it sends on the handover radio's route.
    for (const at of [failS + 0.1, detectS - 0.01])
      expect(pathAt(sim, robot, at)[1]).toBe(sc.failed);
    expect(pathAt(sim, robot, detectS + 0.01).map(label)).toEqual([
      'robot',
      ...sc.handoverRoute.map(label),
    ]);
    expect(hopsAt(sim, robot, detectS + 0.5)).toBe(sc.handoverRoute.length);
  });

  it('loses no packets and delivers every queued packet, the robot packets among them', () => {
    // The robot's data waits at the robot itself while its radio is silent.
    expect(queueAt(sim, robot, detectS - 1e-6)).toBeGreaterThan(5);
    expect(statsAt(sim, detectS - 1e-6).queued).toBe(queueAt(sim, robot, detectS - 1e-6));
    expect(statsAt(sim, detectS + 2).queued).toBe(0);
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

  it('gives the same events for the same seed, and different ones for another seed', () => {
    expect(runFailure(sc.failed).sim.events).toEqual(sim.events);
    expect(runFailure(sc.failed, 7).sim.events).not.toEqual(sim.events);
  });

  it('keeps the robot online by the coverage rule, covered by the handover radio', () => {
    const alive = sc.online.slice();
    alive[sc.failed] = 0;
    const connected = computeNetwork(graph, alive).connected;
    expect(coveringNode(graph, connected, PLAY.coverageRadiusM, sc.robot.x, sc.robot.y)).toBe(
      sc.handover,
    );
    // The machines rule (D51) through the failure: online all along, covered by the other edge radio.
    const clock = buildClockAt(model, sc.holdBuildS);
    const healthy = computeNetwork(graph, sc.online).connected;
    const machines = machinesAt(model, graph, clock, [
      { fromFrac: 0, toFrac: clock.frac, connected: healthy },
      { fromFrac: clock.frac, toFrac: clock.frac, connected },
    ]);
    const m = machines.find((x) => x.team === sc.team);
    expect(m?.online).toBe(true);
    expect(m?.coveredBy).toBe(sc.handover);
    expect(m?.x).toBeCloseTo(sc.robot.x, 9);
    expect(m?.y).toBeCloseTo(sc.robot.y, 9);
  });
});

describe('a robot whose route loses a radio inside the mesh (D70)', () => {
  // "Your turn" keeps the reroute through the mesh: fail C6-2, behind the front, on the robot's route.
  const inner = cellRadio(6, 2);
  const { sim, failS, endS, detectS, reroutedS } = runFailure(inner);

  it('detects the failure within missedHellosToDown x helloIntervalS +- helloIntervalS', () => {
    const record = sim.failures[0];
    const expected = ROUTING.missedHellosToDown * ROUTING.helloIntervalS;
    expect(Math.abs(detectS - record.failS - expected)).toBeLessThanOrEqual(ROUTING.helloIntervalS);
    expect(detectS).toBeCloseTo(
      record.lastHelloS + ROUTING.missedHellosToDown * ROUTING.helloIntervalS,
      9,
    );
    // Only radios that are on hear the hellos: the watchers are the failed radio's built neighbors.
    const downs = sim.events.filter((e) => e.kind === 'neighborDown' && e.other === inner);
    expect(downs.length).toBeGreaterThan(0);
    for (const e of downs) expect(sc.online[e.node]).toBe(1);
  });

  it('changes the robot route around the failed radio, keeping its own radio', () => {
    const before = pathAt(sim, robot, failS - 0.01);
    const after = pathAt(sim, robot, reroutedS + 0.5);
    expect(before).toContain(inner);
    expect(after).not.toContain(inner);
    expect(after.map(label)).toEqual(['robot', 'C8-2', 'C7-2', 'C7-3', 'C6-3', 'C5-3', 'base']);
    expect(hopsAt(sim, robot, reroutedS + 0.5) - hopsAt(sim, robot, failS - 0.01)).toBe(1);
    for (const t of [failS - 0.5, failS + 1, detectS + 0.5, endS]) {
      expect(pathAt(sim, robot, t)[1]).toBe(sc.failed);
    }
    expect(sim.events.filter((e) => e.kind === 'uplink' && e.tS > startS)).toEqual([]);
  });

  it('queues upstream of the failure and loses nothing', () => {
    expect(queueAt(sim, cellRadio(7, 2), detectS - 1e-6)).toBeGreaterThan(0);
    expect(statsAt(sim, reroutedS + 2).queued).toBe(0);
    expect(statsAt(sim, endS).lost).toBe(0);
  });
});

describe('a robot whose every covering radio fails (D71)', () => {
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
    expect(pathAt(s, robot, rejoined + 1)[1]).toBe(sc.failed);
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
