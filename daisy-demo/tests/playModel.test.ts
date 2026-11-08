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
const { base } = model;
const yardUnits = PLAY.unitsPerCell * PLAY.lanesPerCell;

describe('buildPlayModel (T4.1)', () => {
  it('has 27 north-south lanes of 20 units, less the base yard, and 44 radios plus the base', () => {
    expect(model.lanes).toBe(27);
    expect(model.unitsPerLane).toBe(20);
    expect(model.units).toHaveLength(540 - yardUnits);
    expect(model.radios).toHaveLength(44);
    expect(model.widthM).toBeCloseTo(567, 1);
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

  it('keeps the base yard, its whole cell at the center, free of units', () => {
    expect(base.id).toBe(44);
    expect(base.x).toBeCloseTo(model.widthM / 2, 6);
    expect(base.y).toBeCloseTo(model.heightM / 2, 6);
    expect(base.yard.w).toBeCloseTo(model.cellWidthM, 6);
    expect(base.yard.h).toBeCloseTo(model.cellHeightM, 6);
    for (const u of model.units) {
      const overlapX =
        u.x + model.unitSizeXM / 2 > base.yard.x &&
        u.x - model.unitSizeXM / 2 < base.yard.x + base.yard.w;
      const overlapY =
        u.y + model.unitSizeYM / 2 > base.yard.y &&
        u.y - model.unitSizeYM / 2 < base.yard.y + base.yard.h;
      expect(overlapX && overlapY).toBe(false);
    }
    expect(radioAt(model, PLAY.baseCell.col, PLAY.baseCell.row)).toBeUndefined();
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

  it('builds symmetrically around the center, one lane pair per step', () => {
    const at = new Map(model.units.map((u) => [`${u.lane}:${u.pos}`, u]));
    for (const unit of model.units) {
      const mirror = at.get(`${model.lanes - 1 - unit.lane}:${unit.pos}`);
      expect(mirror?.placedStep).toBe(unit.placedStep);
    }
    // Mirrored radios switch on together.
    for (const r of model.radios) {
      const mirror = radioAt(model, PLAY.cellCols - 1 - r.cellCol, r.cellRow);
      expect(mirror?.onStep).toBe(r.onStep);
    }
    expect(model.placeSteps).toBe(14);
    // Step 1 places the middle lane, then each step one lane on each side.
    const first = new Set(model.units.filter((u) => u.placedStep === 1).map((u) => u.lane));
    expect(first).toEqual(new Set([13]));
    const second = new Set(model.units.filter((u) => u.placedStep === 2).map((u) => u.lane));
    expect(second).toEqual(new Set([12, 14]));
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
    expect(end.placedUnits).toBe(model.units.length);
    expect(end.onRadios).toBe(44);
    expect(model.lastStep).toBe(Math.max(...model.radios.map((r) => r.onStep)));
  });

  it('maps playback time to build steps', () => {
    expect(buildStepAt(model, 0)).toBe(0);
    expect(buildStepAt(model, PLAY.buildStepS)).toBe(1);
    expect(buildStepAt(model, 1e6)).toBe(model.lastStep);
    expect(buildDurationS(model)).toBeCloseTo(model.lastStep * PLAY.buildStepS, 6);
  });
});
