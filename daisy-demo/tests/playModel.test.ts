import { describe, expect, it } from 'vitest';
import { PLAY } from '../src/config/play';
import {
  RadioBuild,
  buildClockAt,
  buildPlayModel,
  buildStateAt,
  radioAt,
  routeShare,
  unitStatusAt,
} from '../src/engine/playModel';

const model = buildPlayModel();
const { base } = model;
const padUnits = PLAY.basePadLanes * PLAY.basePadUnits;
const phaseIds = PLAY.frontierPhases.map((p) => p.id);
const placing = phaseIds.indexOf('placement');
const phases = phaseIds.length;
const R = PLAY.coverageRadiusM;

describe('buildPlayModel (T4.1)', () => {
  it('has 30 north-south lanes of 20 units, less the base pad, and one radio per cell', () => {
    expect(model.lanes).toBe(30);
    expect(model.unitsPerLane).toBe(20);
    expect(model.units).toHaveLength(600 - padUnits);
    expect(model.radios).toHaveLength(50);
    expect(model.widthM).toBeCloseTo(630, 1);
    expect(model.heightM).toBeCloseTo(284, 1);
  });

  it('stands every unit with its long side north-south', () => {
    expect(model.unitSizeYM).toBeGreaterThan(model.unitSizeXM);
    expect(model.unitSizeYM).toBeCloseTo(12.2, 6);
    expect(model.unitPitchM).toBeCloseTo(14.2, 6);
    // Units of one lane share x; lanes are 21 m apart.
    const lane0 = model.units.filter((u) => u.lane === 0);
    expect(new Set(lane0.map((u) => u.x)).size).toBe(1);
    expect(lane0).toHaveLength(20);
    expect(model.lanePitchM).toBe(21);
  });

  it('keeps the base pad at the center free of units', () => {
    expect(base.id).toBe(50);
    expect(base.x).toBeCloseTo(model.widthM / 2, 6);
    expect(base.y).toBeCloseTo(model.heightM / 2, 6);
    expect(base.yard.w).toBeCloseTo(PLAY.basePadLanes * model.lanePitchM, 6);
    expect(base.yard.h).toBeCloseTo(PLAY.basePadUnits * model.unitPitchM, 6);
    expect(base.yard.x + base.yard.w / 2).toBeCloseTo(model.widthM / 2, 6);
    for (const u of model.units) {
      const overlapX =
        u.x + model.unitSizeXM / 2 > base.yard.x &&
        u.x - model.unitSizeXM / 2 < base.yard.x + base.yard.w;
      const overlapY =
        u.y + model.unitSizeYM / 2 > base.yard.y &&
        u.y - model.unitSizeYM / 2 < base.yard.y + base.yard.h;
      expect(overlapX && overlapY).toBe(false);
    }
  });

  it('puts each radio on a NE unit corner within about 2 m of its cell center', () => {
    for (const r of model.radios) {
      const unit = model.units[r.unitId];
      expect(r.x).toBeCloseTo(unit.x + model.unitSizeXM / 2, 6);
      expect(r.y).toBeCloseTo(unit.y + model.unitSizeYM / 2, 6);
      const cx = (r.cellCol + 0.5) * model.cellWidthM;
      const cy = (r.cellRow + 0.5) * model.cellHeightM;
      expect(Math.hypot(r.x - cx, r.y - cy)).toBeLessThan(2.5);
      expect(Math.floor(unit.lane / PLAY.lanesPerCell)).toBe(r.cellCol);
      expect(Math.floor(unit.pos / PLAY.unitsPerCell)).toBe(r.cellRow);
    }
    expect(radioAt(model, 6, 2)?.label).toBe('C6-2');
  });
});

describe('staged build (D51)', () => {
  const corners = (id: number) => {
    const u = model.units[id];
    return [-1, 1].flatMap((dx) =>
      [-1, 1].map((dy) => ({
        x: u.x + (dx * model.unitSizeXM) / 2,
        y: u.y + (dy * model.unitSizeYM) / 2,
      })),
    );
  };

  it('works every unit in exactly one stage, from the base outward', () => {
    const seen = new Set<number>();
    for (const stage of model.stages) {
      for (const id of stage.units) {
        expect(seen.has(id)).toBe(false);
        seen.add(id);
        expect(model.units[id].stage).toBe(stage.index);
      }
    }
    expect(seen.size).toBe(model.units.length);
    expect(model.stages.length).toBeGreaterThan(2);
  });

  it('puts every stage zone inside the coverage of the base and the radios of earlier stages', () => {
    for (const stage of model.stages) {
      const sources = [
        { x: base.x, y: base.y },
        ...model.radios.filter((r) => r.stage < stage.index),
      ];
      for (const id of stage.units) {
        for (const p of corners(id)) {
          expect(sources.some((q) => Math.hypot(q.x - p.x, q.y - p.y) <= R)).toBe(true);
        }
      }
    }
    // Stage 1 is the ground inside the base's own coverage.
    expect(model.stages[0].units.every((id) => model.units[id].stage === 0)).toBe(true);
    expect(
      model.stages[0].units.every((id) =>
        corners(id).every((p) => Math.hypot(base.x - p.x, base.y - p.y) <= R),
      ),
    ).toBe(true);
  });

  it("switches a stage's radios on when its connection phase ends, and never before", () => {
    for (const r of model.radios) {
      const stage = model.stages[r.stage];
      expect(stage.radios).toContain(r.id);
      expect(r.onS).toBeCloseTo(stage.startS + phases * stage.phaseS, 9);
      expect(r.placedS).toBe(model.units[r.unitId].placedS);
      expect(buildStateAt(model, r.onS - 1e-6).radioState[r.id]).toBe(RadioBuild.Placed);
      expect(buildStateAt(model, r.onS).radioState[r.id]).toBe(RadioBuild.On);
      expect(buildStateAt(model, r.placedS - 1e-6).radioState[r.id]).toBe(RadioBuild.None);
    }
  });

  it("places every unit during its stage's placement phase, in its team's route order", () => {
    for (const stage of model.stages) {
      const from = stage.startS + placing * stage.phaseS;
      for (const team of stage.teams) {
        team.route.forEach((id, i) => {
          const u = model.units[id];
          expect(u.placedS).toBeCloseTo(from + routeShare(i, team.route.length) * stage.phaseS, 9);
          expect(u.placedS).toBeLessThanOrEqual(from + stage.phaseS + 1e-9);
        });
      }
      // Teams work their own face: west teams west of the base, east teams east of it.
      for (const team of stage.teams) {
        for (const id of team.route) {
          expect(Math.sign(model.units[id].x - base.x)).toBe(team.face);
        }
      }
    }
  });

  it('starts with only the base and ends with every radio on', () => {
    const start = buildStateAt(model, 0);
    expect(start.placedUnits).toBe(0);
    expect(start.onRadios).toBe(0);
    const end = buildStateAt(model, model.buildS);
    expect(end.placedUnits).toBe(model.units.length);
    expect(end.onRadios).toBe(50);
  });

  it('runs the phases of every stage in order, then reports the build as done', () => {
    for (const stage of model.stages) {
      const order = [];
      for (let p = 0; p < phases; p++) {
        const c = buildClockAt(model, stage.startS + (p + 0.5) * stage.phaseS);
        expect(c.stage).toBe(stage.index);
        expect(c.frac).toBeCloseTo(0.5, 9);
        order.push(c.phase);
      }
      expect(order).toEqual([0, 1, 2, 3, 4]);
    }
    expect(buildClockAt(model, model.buildS).done).toBe(true);
    expect(buildClockAt(model, -1)).toMatchObject({ stage: 0, phase: 0, frac: 0 });
  });

  it("tells a unit's status: planned, the phase of its stage, then live", () => {
    const unit = model.units[model.stages[2].units[0]];
    const stage = model.stages[2];
    expect(unitStatusAt(model, unit.id, stage.startS - 1e-6).kind).toBe('planned');
    expect(unitStatusAt(model, unit.id, stage.startS + 1.5 * stage.phaseS)).toMatchObject({
      kind: 'work',
      phase: 1,
    });
    expect(unitStatusAt(model, unit.id, model.buildS).kind).toBe('live');
  });
});
