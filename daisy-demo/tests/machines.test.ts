import { describe, expect, it } from 'vitest';
import { PLAY } from '../src/config/play';
import { coveringNode, machinesAt, routePoint, type CoverageSpan } from '../src/engine/machines';
import { buildGraph, computeNetwork } from '../src/engine/network';
import {
  buildClockAt,
  buildPlayModel,
  buildStateAt,
  RadioBuild,
  type BuildClock,
} from '../src/engine/playModel';
import { PLAY_GRAPH, PLAY_MODEL, PLAY_TIMELINE, simAt } from '../src/state/build';
import { sceneAt } from '../src/ui/build/scene';

// D51: machines only work inside coverage. A machine without coverage stops where it stands, shows offline,
// and resumes from there when coverage returns.
const model = buildPlayModel();
const graph = buildGraph(model);
const R = PLAY.coverageRadiusM;
const phases = PLAY.frontierPhases.length;
/** Fractions of a phase to check: every tenth. */
const FRACS = Array.from({ length: 11 }, (_, i) => i / 10);

/** Connected nodes at a build time, with some radios failed. */
function connectedAt(buildS: number, failed: number[] = []): Uint8Array {
  const { radioState } = buildStateAt(model, buildS);
  const alive = new Uint8Array(model.radios.length);
  for (let i = 0; i < alive.length; i++) {
    alive[i] = radioState[i] === RadioBuild.On && !failed.includes(i) ? 1 : 0;
  }
  return computeNetwork(graph, alive).connected;
}

/** The machines at a build time with an unchanged network through the phase. */
function machinesAtTime(buildS: number) {
  const clock = buildClockAt(model, buildS);
  return {
    clock,
    machines: machinesAt(model, graph, clock, [
      { fromFrac: 0, toFrac: clock.frac, connected: connectedAt(buildS) },
    ]),
  };
}

describe('machines work only inside coverage (D51)', () => {
  it('at every phase of every stage, every machine is online and inside a connected circle', () => {
    let checked = 0;
    for (const stage of model.stages) {
      for (let p = 0; p < phases; p++) {
        for (const f of FRACS) {
          const t = stage.startS + (p + Math.min(f, 0.999)) * stage.phaseS;
          const { machines } = machinesAtTime(t);
          const connected = connectedAt(t);
          expect(machines.length).toBeGreaterThan(0);
          for (const m of machines) {
            expect(m.online).toBe(true);
            expect(m.coveredBy).toBeGreaterThanOrEqual(0);
            expect(connected[m.coveredBy]).toBe(1);
            expect(
              Math.hypot(graph.x[m.coveredBy] - m.x, graph.y[m.coveredBy] - m.y),
            ).toBeLessThanOrEqual(R);
            checked++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(500);
  });

  it('keeps every team route covered along its whole length, including the moves between lanes', () => {
    for (const stage of model.stages) {
      const connected = connectedAt(stage.startS);
      for (const team of stage.teams) {
        for (let i = 0; i <= (team.route.length - 1) * 4; i++) {
          const p = routePoint(model, team.route, i / 4);
          expect(coveringNode(graph, connected, R, p.x, p.y)).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('has machines at work through the mid-build failure, and none after the build (D70)', () => {
    const { machines } = machinesAtTime(model.buildS);
    expect(machines).toEqual([]);
    const tl = PLAY_TIMELINE;
    for (const t of [tl.failS, tl.detectS, tl.detectS + 2]) {
      const scene = sceneAt(PLAY_MODEL, PLAY_GRAPH, tl, simAt([], t).result, t);
      expect(scene.machines.length).toBeGreaterThan(0);
    }
    const after = sceneAt(
      PLAY_MODEL,
      PLAY_GRAPH,
      tl,
      simAt([], tl.yourTurnS + 5).result,
      tl.yourTurnS + 5,
    );
    expect(after.machines).toEqual([]);
  });

  it('every machine in the walkthrough build is online, the failure included, by the coverage rule', () => {
    const tl = PLAY_TIMELINE;
    for (let t = tl.buildStartS; t < tl.buildEndS; t += 0.05) {
      const scene = sceneAt(PLAY_MODEL, PLAY_GRAPH, tl, simAt([], t).result, t);
      for (const m of scene.machines) {
        const by = coveringNode(graph, scene.network.connected, R, m.x, m.y);
        expect(m.online).toBe(by >= 0);
        expect(m.online).toBe(true);
      }
    }
  });
});

describe('a machine that loses coverage stops offline and resumes (D51)', () => {
  // A stage beyond the base's reach, and a team whose position at 30% of the phase only radios cover.
  const stage = model.stages[3];
  const phase = 1;
  const t0 = stage.startS + phase * stage.phaseS;
  const clockAt = (frac: number): BuildClock => ({
    stage: stage.index,
    phase,
    frac,
    phaseStartS: t0,
    done: false,
  });
  const healthy = connectedAt(t0);
  const before = machinesAt(model, graph, clockAt(0.3), [
    { fromFrac: 0, toFrac: 0.3, connected: healthy },
  ]);
  const m0 = before[0];
  // Fail every radio whose circle reaches the machine, so it has no coverage at all.
  const failed = model.radios
    .filter((r) => healthy[r.id] && Math.hypot(r.x - m0.x, r.y - m0.y) <= R)
    .map((r) => r.id);
  const down = connectedAt(t0, failed);
  const spans = (until: number): CoverageSpan[] => {
    const all: CoverageSpan[] = [
      { fromFrac: 0, toFrac: 0.3, connected: healthy },
      { fromFrac: 0.3, toFrac: 0.6, connected: down },
      { fromFrac: 0.6, toFrac: 1, connected: healthy },
    ];
    return all
      .filter((s) => s.fromFrac < until || s.fromFrac === 0)
      .map((s) => ({ ...s, toFrac: Math.min(s.toFrac, until) }));
  };

  it('finds a machine that only radios cover', () => {
    expect(Math.hypot(model.base.x - m0.x, model.base.y - m0.y)).toBeGreaterThan(R);
    expect(failed.length).toBeGreaterThan(0);
    expect(m0.online).toBe(true);
  });

  it('stops where it stands and shows offline while it has no coverage', () => {
    const during = machinesAt(model, graph, clockAt(0.5), spans(0.5))[0];
    expect(during.online).toBe(false);
    expect(during.coveredBy).toBe(-1);
    expect(during.x).toBeCloseTo(m0.x, 9);
    expect(during.y).toBeCloseTo(m0.y, 9);
    expect(during.progress).toBeCloseTo(m0.progress, 9);
  });

  it('resumes from there when coverage returns, and has lost the time it waited', () => {
    const after = machinesAt(model, graph, clockAt(0.8), spans(0.8))[0];
    expect(after.online).toBe(true);
    // 30% before the failure plus 20% after the repair; the 30% in between is lost.
    const team = stage.teams[after.team];
    const last = team.route.length - 1;
    expect(after.progress * last).toBeCloseTo(Math.min(last, 0.5 * last), 6);
    const nominal = machinesAt(model, graph, clockAt(0.8), [
      { fromFrac: 0, toFrac: 0.8, connected: healthy },
    ])[0];
    expect(after.progress).toBeLessThan(nominal.progress);
  });
});
