import { describe, expect, it } from 'vitest';
import { PLAY } from '../src/config/play';
import {
  RadioBuild,
  buildDurationS,
  buildPlayModel,
  buildStateAt,
  buildStepAt,
  frontierAt,
  lanePhaseAt,
  PHASE_PLANNED,
  phaseLive,
  radioAt,
} from '../src/engine/playModel';

const model = buildPlayModel();
const { base } = model;
const padUnits = PLAY.basePadLanes * PLAY.basePadUnits;
const phaseIds = PLAY.frontierPhases.map((p) => p.id);
const lead = phaseIds.indexOf('placement');

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
    // 15 lane steps from the two middle lanes out, after 3 steps of frontier work on them.
    expect(lead).toBe(3);
    expect(model.placeSteps).toBe(15 + lead);
    const placedOn = (step: number) =>
      new Set(model.units.filter((u) => u.placedStep === step).map((u) => u.lane));
    expect(placedOn(lead)).toEqual(new Set());
    expect(placedOn(lead + 1)).toEqual(new Set([14, 15]));
    expect(placedOn(lead + 2)).toEqual(new Set([13, 16]));
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
    expect(end.onRadios).toBe(50);
    expect(model.lastStep).toBe(model.placeSteps + PLAY.commissionLagSteps);
  });

  it('maps playback time to build steps', () => {
    expect(buildStepAt(model, 0)).toBe(0);
    expect(buildStepAt(model, PLAY.buildStepS)).toBe(1);
    expect(buildStepAt(model, 1e6)).toBe(model.lastStep);
    expect(buildDurationS(model)).toBeCloseTo(model.lastStep * PLAY.buildStepS, 6);
  });
});

describe('frontier phases (T4.4, D49)', () => {
  const live = phaseLive(model);

  it('walks every lane through the phases in order, one step each, then live when its radio is on', () => {
    for (let lane = 0; lane < model.lanes; lane++) {
      const seen: number[] = [];
      for (let step = 0; step <= model.lastStep + 1; step++) {
        const phase = lanePhaseAt(model, lane, step);
        if (seen[seen.length - 1] !== phase) seen.push(phase);
      }
      expect(seen).toEqual([PHASE_PLANNED, 0, 1, 2, 3, 4, live]);
      const unit = model.units.find((u) => u.lane === lane);
      if (!unit) continue;
      expect(lanePhaseAt(model, lane, unit.placedStep)).toBe(phaseIds.indexOf('placement'));
      expect(lanePhaseAt(model, lane, unit.placedStep - 1)).toBe(phaseIds.indexOf('trenching'));
      expect(lanePhaseAt(model, lane, unit.placedStep + PLAY.commissionLagSteps)).toBe(live);
    }
    // A radio switches on exactly when its lane goes live.
    for (const r of model.radios) {
      const lane = model.units[r.unitId].lane;
      expect(lanePhaseAt(model, lane, r.onStep - 1)).toBe(phaseIds.indexOf('connection'));
      expect(lanePhaseAt(model, lane, r.onStep)).toBe(live);
    }
  });

  it('orders the layers outward on both faces and mirrors them', () => {
    for (let step = 1; step <= model.lastStep; step++) {
      const lanes = frontierAt(model, step);
      for (const f of lanes) {
        expect(lanePhaseAt(model, model.lanes - 1 - f.lane, step)).toBe(f.phase);
      }
      // Moving outward on the east face, the phase index falls: connection, placement, ... grading.
      const east = lanes.filter((f) => f.face >= 0).sort((a, b) => a.lane - b.lane);
      for (let i = 1; i < east.length; i++) expect(east[i].phase).toBe(east[i - 1].phase - 1);
      const west = lanes.filter((f) => f.face <= 0).sort((a, b) => b.lane - a.lane);
      for (let i = 1; i < west.length; i++) expect(west[i].phase).toBe(west[i - 1].phase - 1);
    }
    // Mid-build every phase is active once on each face.
    const mid = frontierAt(model, 8).filter((f) => f.face > 0);
    expect(mid.map((f) => phaseIds[f.phase])).toEqual([
      'connection',
      'placement',
      'trenching',
      'foundations',
      'grading',
    ]);
    expect(frontierAt(model, 0)).toEqual([]);
    expect(frontierAt(model, model.lastStep)).toEqual([]);
  });
});
