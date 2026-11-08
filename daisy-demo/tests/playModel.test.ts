import { describe, expect, it } from 'vitest';
import { PLAY } from '../src/config/play';
import {
  RadioBuild,
  buildDurationS,
  buildPlayModel,
  buildStateAt,
  buildStepAt,
  radioAt,
} from '../src/engine/playModel';

const model = buildPlayModel();

describe('buildPlayModel (T4.1)', () => {
  it('has 540 units and 45 radios on a 36 x 15 grid', () => {
    expect(model.units).toHaveLength(540);
    expect(model.radios).toHaveLength(45);
    expect(model.unitCols).toBe(36);
    expect(model.laneRows).toBe(15);
    expect(model.widthM).toBeCloseTo(511.2, 1);
    expect(model.heightM).toBeCloseTo(315, 1);
  });

  it('puts each radio on a NE unit corner within about 2 m of its cell center', () => {
    for (const r of model.radios) {
      const unit = model.units[r.unitId];
      expect(r.x).toBeCloseTo(unit.x + model.unitWidthM / 2, 6);
      expect(r.y).toBeCloseTo(unit.y + model.unitDepthM / 2, 6);
      const cx = (r.cellCol + 0.5) * model.cellWidthM;
      const cy = (r.cellRow + 0.5) * model.cellHeightM;
      expect(Math.hypot(r.x - cx, r.y - cy)).toBeLessThan(2.5);
      expect(Math.floor(unit.col / PLAY.unitsPerCell)).toBe(r.cellCol);
      expect(Math.floor(unit.lane / PLAY.lanesPerCell)).toBe(r.cellRow);
    }
    expect(radioAt(model, 6, 2).label).toBe('C6-2');
  });

  it('stands the base at the center of the middle cell', () => {
    expect(model.base.id).toBe(45);
    expect(model.base.x).toBeCloseTo(model.widthM / 2, 6);
    expect(model.base.y).toBeCloseTo(model.heightM / 2, 6);
  });

  it('builds symmetrically around the center, one column pair per step', () => {
    for (const unit of model.units) {
      const mirror = model.units[unit.lane * model.unitCols + (model.unitCols - 1 - unit.col)];
      expect(mirror.placedStep).toBe(unit.placedStep);
    }
    expect(model.placeSteps).toBe(18);
    for (let step = 1; step <= model.placeSteps; step++) {
      const added =
        buildStateAt(model, step).placedUnits - buildStateAt(model, step - 1).placedUnits;
      expect(added).toBe(2 * model.laneRows);
    }
    // The first step places the two middle columns.
    const first = model.units.filter((u) => u.placedStep === 1).map((u) => u.col);
    expect(new Set(first)).toEqual(new Set([17, 18]));
  });

  it('switches every radio on exactly commissionLagSteps after its unit', () => {
    for (const r of model.radios) {
      expect(r.placedStep).toBe(model.units[r.unitId].placedStep);
      expect(r.onStep - r.placedStep).toBe(PLAY.commissionLagSteps);
      expect(buildStateAt(model, r.onStep - 1).radioState[r.id]).toBe(RadioBuild.Placed);
      expect(buildStateAt(model, r.onStep).radioState[r.id]).toBe(RadioBuild.On);
      expect(buildStateAt(model, r.placedStep - 1).radioState[r.id]).toBe(RadioBuild.None);
    }
  });

  it('starts with only the base and ends with every radio on', () => {
    const start = buildStateAt(model, 0);
    expect(start.placedUnits).toBe(0);
    expect(start.onRadios).toBe(0);
    const end = buildStateAt(model, model.lastStep);
    expect(end.placedUnits).toBe(540);
    expect(end.onRadios).toBe(45);
    // The outermost radios sit on the second unit column from the edge (west) or the third (east), so the
    // last radio switches on one step before placeSteps + commissionLagSteps.
    expect(model.lastStep).toBe(Math.max(...model.radios.map((r) => r.onStep)));
    expect(model.lastStep).toBe(model.placeSteps + PLAY.commissionLagSteps - 1);
  });

  it('maps playback time to build steps, about 14 s for the whole build', () => {
    expect(buildStepAt(model, 0)).toBe(0);
    expect(buildStepAt(model, PLAY.buildStepS)).toBe(1);
    expect(buildStepAt(model, 1e6)).toBe(model.lastStep);
    expect(buildDurationS(model)).toBeCloseTo(model.lastStep * PLAY.buildStepS, 6);
    expect(Math.abs(buildDurationS(model) - 14)).toBeLessThan(1);
  });
});
