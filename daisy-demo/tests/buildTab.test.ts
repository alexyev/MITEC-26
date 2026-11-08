import { describe, expect, it } from 'vitest';
import { ROUTING } from '../src/config/defaults';
import { PLAY, PLAY_VIEW, PLAY_WALK } from '../src/config/play';
import { failedAt, hopsAt, queueAt, simulate, statsAt } from '../src/engine/packetSim';
import { cellRadioId, UnitState } from '../src/engine/playModel';
import { findSetup, PRICING } from '../src/engine/pricing';
import { getSiteModel } from '../src/state/model';
import {
  FULL_SITE_COST,
  PLAY_GRAPH,
  PLAY_MODEL,
  PLAY_TIMELINE,
  simAt,
  useBuildStore,
} from '../src/state/build';
import { sceneAt } from '../src/ui/build/scene';
import { buildTimeAt } from '../src/ui/build/walkthrough';

const tl = PLAY_TIMELINE;
const start = (id: string) => tl.starts[tl.steps.findIndex((s) => s.id === id)];
const scene = (t: number) => sceneAt(PLAY_MODEL, PLAY_GRAPH, tl, simAt([], t).result, t);
const label = (id: number) => (id === PLAY_GRAPH.baseId ? 'base' : PLAY_MODEL.radios[id].label);

describe('Build & failure walkthrough (T4.4, D70)', () => {
  it('fails a radio mid-build, finishes the build, and ends with an open "Your turn"', () => {
    expect(tl.steps.map((s) => s.id)).toEqual([
      'section',
      'build',
      'power',
      'robot',
      'failure',
      'handover',
      'recovered',
      'resume',
      'coverage',
      'cost',
      'your-turn',
    ]);
    expect(tl.steps[tl.steps.length - 1].durationS).toBe(Infinity);
    for (const s of tl.steps) expect(s.caption.length).toBeLessThanOrEqual(90);
    // The robot step starts at the hold, mid-build; the build ends after the resume step.
    expect(start('robot')).toBeCloseTo(tl.holdS, 9);
    expect(tl.holdBuildS).toBeGreaterThan(0);
    expect(tl.holdBuildS).toBeLessThan(PLAY_MODEL.buildS);
    expect(start('resume')).toBeCloseTo(tl.resumeS, 9);
    expect(start('coverage')).toBeCloseTo(tl.buildEndS + PLAY_WALK.buildHoldS, 9);
  });

  it('puts the failure and the handover at detection on step boundaries (D170)', () => {
    expect(start('failure')).toBeCloseTo(tl.failS, 9);
    const lastHello = tl.failS - PLAY.failAfterHelloS;
    expect(tl.detectS).toBeCloseTo(
      lastHello + ROUTING.missedHellosToDown * ROUTING.helloIntervalS,
      9,
    );
    expect(start('handover')).toBeCloseTo(tl.detectS, 9);
    expect(tl.handoverS).toBeCloseTo(tl.detectS, 9);
    expect(start('recovered') - start('handover')).toBeCloseTo(PLAY_WALK.handoverS, 9);
    expect(tl.failS - tl.holdS).toBeGreaterThanOrEqual(PLAY_WALK.dataS);
    expect(tl.failS - tl.holdS).toBeLessThan(PLAY_WALK.dataS + ROUTING.helloIntervalS + 0.1);
  });

  it('holds the build while the failure plays out, and resumes it where it stood', () => {
    expect(buildTimeAt(tl, tl.holdS - 1)).toBeCloseTo(tl.holdBuildS - 1, 9);
    for (const t of [tl.holdS, tl.failS, tl.detectS, tl.resumeS - 0.01]) {
      expect(buildTimeAt(tl, t)).toBe(tl.holdBuildS);
    }
    expect(buildTimeAt(tl, tl.resumeS + 2)).toBeCloseTo(tl.holdBuildS + 2, 9);
    expect(buildTimeAt(tl, tl.buildEndS)).toBeCloseTo(PLAY_MODEL.buildS, 9);
    const a = scene(tl.holdS + 0.01);
    const b = scene(tl.resumeS - 0.01);
    expect(b.clock).toEqual(a.clock);
    expect(b.machines.map((m) => [m.x, m.y])).toEqual(a.machines.map((m) => [m.x, m.y]));
  });
});

describe('real-life ranges, scaled (D51)', () => {
  const { pricing } = PRICING;
  const site = getSiteModel().site;
  const halow = findSetup(pricing);
  const reach = halow.rangeM * pricing.placement.spacingFactor;
  // Full-site radio spacing of networkCost: every n-th unit along a lane, every m-th lane across.
  const alongM = Math.floor(reach / site.unitPitchM) * site.unitPitchM;
  const acrossM = Math.floor(reach / site.rowPitchM) * site.rowPitchM;

  it('takes the coverage and link range from the HaLow range over the full-site column spacing', () => {
    expect(halow.id).toBe('halowIntegrated');
    const scaled = (PLAY_MODEL.cellWidthM * halow.rangeM) / acrossM;
    expect(PLAY.coverageRadiusM).toBeCloseTo(scaled, 0);
    expect(PLAY.linkRangeM).toBeCloseTo(scaled, 0);
  });

  it('confirms the coverage of a finished column reaches past the next column of radios', () => {
    // A column of radios covers a strip this wide on either side, along the whole lane.
    const strip = (r: number, rowSpacing: number) => Math.sqrt(r * r - (rowSpacing / 2) ** 2);
    expect(strip(halow.rangeM, alongM)).toBeGreaterThan(acrossM);
    expect(strip(PLAY.coverageRadiusM, PLAY_MODEL.cellHeightM)).toBeGreaterThan(
      PLAY_MODEL.cellWidthM,
    );
  });
});

describe('one design: play model and full-site cost (T4.4, D50)', () => {
  it('draws the radio grid of the full-site cost design, 10 across the lanes by 5 along them', () => {
    const cost = FULL_SITE_COST;
    expect(cost).not.toBeNull();
    if (!cost) return;
    // networkCost counts gridCols modules along a lane (north-south) and gridRows across lanes.
    expect(PLAY.cellCols).toBe(cost.gridRows);
    expect(PLAY.cellRows).toBe(cost.gridCols);
    expect(PLAY_MODEL.radios).toHaveLength(cost.modules);
  });

  it('takes every number of the cost and failure captions from the code', () => {
    const cost = FULL_SITE_COST as NonNullable<typeof FULL_SITE_COST>;
    const caption = (id: string) => tl.steps.find((s) => s.id === id)?.caption ?? '';
    expect(caption('cost')).toContain(`needs ${cost.modules} of these radios`);
    expect(caption('cost')).toContain(`${(cost.shareOfP3 * 100).toFixed(2)}%`);
    expect(caption('cost')).not.toMatch(/74\.6|\b45\b/);

    const sim = simAt([], tl.resumeS - 0.01).result;
    const waiting = statsAt(sim, tl.detectS - 1e-6).queued;
    expect(caption('robot')).toBe(
      'Time slows mid-build. The pile rig sends via edge radio C8-2, 4 hops from the base.',
    );
    expect(caption('failure')).toBe(
      "Edge radio C8-2 fails and the pile rig's link drops. Still in coverage, it keeps working.",
    );
    expect(caption('handover')).toBe(
      `The pile rig connects to C8-3, another edge radio, and sends the ${waiting} packets it held.`,
    );
    expect(caption('recovered')).toBe(
      `No data lost: all ${waiting} packets queued reach the base, on a route as short as before.`,
    );
    expect(caption('resume')).toContain('A crew swaps C8-2');
  });
});

describe('sceneAt (T4.4, D70)', () => {
  const robotPath = (sc: ReturnType<typeof scene>) =>
    sc.routes[0].map((id) => (id >= PLAY_GRAPH.nodeCount ? 'robot' : label(id)));

  it('builds from the base outward, without data, up to the hold', () => {
    const first = scene(tl.buildStartS - 0.01);
    expect(first.unitState.every((p) => p === UnitState.Planned)).toBe(true);
    expect(first.network.coverage).toBeGreaterThan(0);
    const before = scene(tl.holdS - 0.01);
    expect(before.traffic).toBe(false);
    expect(before.packets).toHaveLength(0);
    expect(before.robot).toBeNull();
    expect(before.network.connectedRadios).toBeLessThan(PLAY_MODEL.radios.length);
  });

  it('takes every unit through planned, placed, commissioned and live, in order (D102)', () => {
    const seen = new Set<number>();
    let prev = scene(0).unitState;
    for (let t = 0; t <= start('coverage'); t += 0.05) {
      const now = scene(t).unitState;
      for (let i = 0; i < now.length; i++) {
        expect(now[i]).toBeGreaterThanOrEqual(prev[i]);
        seen.add(now[i]);
      }
      prev = now;
    }
    expect([...seen].sort()).toEqual([
      UnitState.Planned,
      UnitState.Placed,
      UnitState.Commissioned,
      UnitState.Live,
    ]);
    expect(prev.every((u) => u === UnitState.Live)).toBe(true);
  });

  it('shows the robot sending on its route through the partly built network', () => {
    const s = scene(start('robot') + 2);
    expect(s.dataShown).toBe(true);
    expect(s.robot).not.toBeNull();
    const robot = s.robot as NonNullable<typeof s.robot>;
    expect(s.machines[robot.index].glyph).toBe('pileRig');
    expect(s.machines[robot.index].online).toBe(true);
    expect(robotPath(s)).toEqual(['robot', 'C8-2', 'C7-2', 'C6-2', 'C5-2', 'base']);
    expect(s.packets.some((p) => p.source === robot.node)).toBe(true);
    expect(s.sources[0].x).toBeCloseTo(s.machines[robot.index].x, 9);
    expect(s.sources[0].y).toBeCloseTo(s.machines[robot.index].y, 9);
    expect(s.latest).toBeNull();
  });

  it('shows the robot on a live, highlighted link to its edge radio before the failure (D170)', () => {
    const s = scene(start('failure') - 0.01);
    const robot = s.robot as NonNullable<typeof s.robot>;
    expect(robot.uplink).toBe(tl.failedRadio);
    expect(robot.linkDown).toBe(false);
    expect(robot.handover).toBeNull();
    expect(s.access).toEqual([{ radio: tl.failedRadio, kind: 'live', age: Infinity }]);
    expect(s.oldRoutes).toEqual([]);
  });

  it('fails the edge radio: the link drops and the robot holds its data, still working (D170)', () => {
    const failed = tl.failedRadio;
    const atFail = scene(start('failure'));
    expect(atFail.failed[failed]).toBe(1);
    // Overlapping circles: the robot keeps its coverage and keeps working (D51).
    for (const m of atFail.machines) expect(m.online).toBe(true);
    const robot = atFail.robot as NonNullable<typeof atFail.robot>;
    expect(robot.linkDown).toBe(true);
    expect(atFail.access).toEqual([{ radio: failed, kind: 'down', age: 0 }]);
    // No live route while its data waits; the old one is dashed from the failure on.
    expect(atFail.routes).toEqual([]);
    const name = (id: number) => (id >= PLAY_GRAPH.nodeCount ? 'robot' : label(id));
    expect(atFail.oldRoutes.map((r) => r.map(name))).toEqual([
      ['robot', 'C8-2', 'C7-2', 'C6-2', 'C5-2', 'base'],
    ]);

    const detecting = scene(start('handover') - 0.01);
    expect(detecting.latest?.missedHellos).toBe(ROUTING.missedHellosToDown - 1);
    expect(detecting.queues.find((q) => q.node === tl.robotNode)?.count).toBeGreaterThan(5);
    expect(detecting.robot?.queued).toBeGreaterThan(5);
    expect(detecting.ticket).toBeNull();
    for (const m of detecting.machines) expect(m.online).toBe(true);
  });

  it('hands the robot over to the other edge radio, then delivers its data, losing nothing', () => {
    const failed = tl.failedRadio;
    const to = tl.handoverRadio;
    expect(label(to)).toBe('C8-3');
    const handover = scene(start('handover') + 0.01);
    const robot = handover.robot as NonNullable<typeof handover.robot>;
    expect(robot.uplink).toBe(to);
    expect(robot.linkDown).toBe(false);
    expect(robot.handover).toEqual({ from: failed, to, atS: tl.handoverS });
    expect(handover.access.map((a) => [a.radio, a.kind])).toEqual([
      [to, 'live'],
      [failed, 'dropped'],
    ]);
    expect(robotPath(handover)).toEqual(['robot', 'C8-3', 'C7-3', 'C6-3', 'C5-3', 'base']);
    // The dropped link fades out; the new one stays.
    const later = scene(tl.handoverS + PLAY_VIEW.handoverFadeS + 0.01);
    expect(later.access.map((a) => a.kind)).toEqual(['live']);

    const recovered = scene(start('recovered') + 0.01);
    expect(recovered.oldRoutes.map((r) => r.includes(failed))).toEqual([true]);
    expect(robotPath(recovered)).toEqual(['robot', 'C8-3', 'C7-3', 'C6-3', 'C5-3', 'base']);
    expect(recovered.watchedExtraHops).toBe(0);
    expect(recovered.ticket?.radio).toBe(failed);
    expect(recovered.stats?.lost).toBe(0);
    expect(recovered.stats?.queued).toBe(0);
  });

  it('states every name and number of the failure steps from the simulation (D170)', () => {
    const caption = (id: string) => tl.steps.find((s) => s.id === id)?.caption ?? '';
    const sim = simAt([], tl.resumeS).result;
    const held = queueAt(sim, tl.robotNode, tl.handoverS - 1e-6);
    expect(caption('robot')).toContain('edge radio C8-2, 4 hops');
    expect(caption('failure')).toContain('Edge radio C8-2 fails');
    expect(caption('handover')).toContain(`connects to C8-3, another edge radio`);
    expect(caption('handover')).toContain(`the ${held} packets it held`);
    expect(caption('recovered')).toContain(`all ${held} packets queued reach the base`);
    expect(caption('recovered')).toContain('as short as before');
  });

  it('repairs the radio as the build resumes and finishes the build on the full network', () => {
    const resumed = scene(start('resume') + ROUTING.helloIntervalS + 0.01);
    expect(resumed.failed[tl.failedRadio]).toBe(0);
    expect(resumed.ticket).toBeNull();
    expect(resumed.dataShown).toBe(false);
    expect(resumed.robot).toBeNull();
    const covered = scene(start('coverage'));
    expect(covered.machines).toEqual([]);
    expect(covered.network.connectedRadios).toBe(PLAY_MODEL.radios.length);
    expect(covered.network.coverage).toBe(1);
    expect(covered.stats?.lost).toBe(0);
    // The simulation knows every radio the build switched on.
    const sim = simAt([], start('coverage')).result;
    for (const r of PLAY_MODEL.radios)
      expect(hopsAt(sim, r.id, start('coverage'))).toBeGreaterThan(0);
  });

  it('shows the watched radio\'s route in "Your turn", with no traffic until a click (D103)', () => {
    const s = scene(tl.yourTurnS + 1);
    expect(s.dataShown).toBe(true);
    expect(s.packets).toEqual([]);
    expect(s.routes[0].map(label)).toEqual(['C8-2', 'C7-2', 'C6-2', 'C5-2', 'base']);
    expect(s.watchedExtraHops).toBe(0);
  });
});

describe('build store (T4.4)', () => {
  it('fails and repairs radios in "Your turn" and replays to the same result', () => {
    const store = useBuildStore.getState();
    store.resetInputs();
    const radio = cellRadioId(PLAY_MODEL, 2, 1);
    const t0 = tl.yourTurnS + 1;
    store.toggleRadio(radio, t0);
    const t1 = t0 + 10;
    expect(failedAt(simAt(useBuildStore.getState().userChanges, t1).result, t1)[radio]).toBe(1);
    useBuildStore.getState().repairAll(t1);
    const changes = useBuildStore.getState().userChanges;
    // The walkthrough's radio was repaired as the build resumed: only the user's radio needs one.
    expect(changes.filter((c) => c.kind === 'repair').map((c) => c.radio)).toEqual([radio]);
    const t2 = t1 + 5;
    const live = simAt(changes, t2).result;
    expect(failedAt(live, t2).every((f) => f === 0)).toBe(true);
    const pure = simulate({
      graph: PLAY_GRAPH,
      endS: t2,
      ...tl.sim,
      changes: [...tl.sim.changes, ...changes],
    });
    expect(live.events.filter((e) => e.tS <= t2)).toEqual(pure.events);
    useBuildStore.getState().resetInputs();
  });
});
