// 4x4 survey planning (spec 8.2): one equal-width strip per 4x4, back-and-forth north-south passes, a time
// model per leg, and the hour each ground cell is surveyed, so the view is a pure function of the hour.
import { SURVEY } from '../config/survey';
import { UNITS } from '../config/units';
import type { Rect } from './types';

export interface SurveyConfig {
  maxVehicles: number;
  defaultVehicles: number;
  swathM: number;
  surveySpeedKmh: number;
  transitSpeedKmh: number;
  cellM: number;
  playbackHoursPerS: number;
}

export interface Point {
  x: number;
  y: number;
}

/** A leg is a straight drive: base to strip or back ('transit'), a survey pass, or the shift to the next pass. */
export type LegKind = 'transit' | 'pass' | 'shift';

export interface SurveyLeg {
  kind: LegKind;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Start and end of the leg in hours after Send. */
  t0H: number;
  t1H: number;
  /** Distance driven before this leg, and the length of the leg, in km. */
  km0: number;
  lengthKm: number;
  /** Survey distance (passes and shifts) driven before this leg, in km. */
  surveyKm0: number;
}

export interface VehiclePlan {
  /** 0-based; the UI names it "4x4 #(id + 1)". */
  id: number;
  strip: Rect;
  /** Number of north-south passes, and their spacing (at most `swathM`). */
  passes: number;
  passSpacingM: number;
  /** True when the passes go from the strip's west edge toward the east. */
  eastward: boolean;
  legs: SurveyLeg[];
  /** Hours from Send until this 4x4 is back at the base. */
  driveH: number;
  driveKm: number;
  /** Distance on passes and shifts, in km. */
  surveyKm: number;
}

export interface SurveyPlan {
  area: Rect;
  base: Point;
  config: SurveyConfig;
  vehicles: VehiclePlan[];
  /** Ground cells of `cellM`, row-major from the south-west corner: id = row * cellCols + col. */
  cellCols: number;
  cellRows: number;
  /** Hour after Send at which each cell is surveyed. */
  cellSurveyedH: Float32Array;
  /** The same hours, sorted, so the surveyed share at any hour is one binary search. */
  sortedCellH: Float32Array;
  /** Hours until the last 4x4 is back at the base (spec 8.2, step 5). */
  finishH: number;
  /** Sum of every 4x4's drive time (spec 10.4). */
  vehicleHours: number;
}

/** Where a 4x4 is at an hour, and what its hover card shows. */
export interface VehicleState {
  x: number;
  y: number;
  /** 'base' before Send and after the 4x4 is back. */
  kind: LegKind | 'base';
  /** Heading in radians (0 = east, counter-clockwise), from the current or the last leg. */
  heading: number;
  km: number;
  /** Share of this 4x4's survey distance done, 0 to 1. */
  stripProgress: number;
  timeLeftH: number;
  done: boolean;
}

interface PassRef {
  vehicle: number;
  leg: number;
}

function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * f;
}

/** Index of the last element of a sorted array that is at most `value`, plus one. */
function upperBound(sorted: ArrayLike<number>, value: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Equal-width strips with north-south boundaries, west to east, that tile the area exactly. */
export function surveyStrips(area: Rect, count: number): Rect[] {
  const strips: Rect[] = [];
  const width = area.w / count;
  for (let i = 0; i < count; i++) {
    const x0 = area.x + i * width;
    const x1 = i === count - 1 ? area.x + area.w : area.x + (i + 1) * width;
    strips.push({ x: x0, y: area.y, w: x1 - x0, h: area.h });
  }
  return strips;
}

/**
 * Plans the survey of `area` by `count` 4x4s that start and end at `base` (spec 8.2).
 * Each strip gets `ceil(width / swathM)` evenly spaced passes, so the spacing is at most `swathM` and
 * the passes of one strip tile it exactly. A 4x4 starts at the strip edge nearest the base (the strip
 * that contains the base starts at its west edge) and the first pass starts at the end nearer the base.
 */
export function planSurvey(
  area: Rect,
  base: Point,
  count: number,
  config: SurveyConfig = SURVEY,
): SurveyPlan {
  if (!Number.isInteger(count) || count < 1)
    throw new Error(`4x4 count must be at least 1: ${count}`);
  const passMPerH = config.surveySpeedKmh * UNITS.mPerKm;
  const transitMPerH = config.transitSpeedKmh * UNITS.mPerKm;
  const yA = area.y;
  const yB = area.y + area.h;
  const startSouth = Math.abs(base.y - yA) <= Math.abs(base.y - yB);

  const strips = surveyStrips(area, count);
  const vehicles: VehiclePlan[] = [];
  // passOf[v][sub] is the leg index of the pass over sub-strip `sub` (counted from the strip's west edge).
  const passOf: number[][] = [];

  strips.forEach((strip, id) => {
    const passes = Math.max(1, Math.ceil(strip.w / config.swathM));
    const spacing = strip.w / passes;
    const containsBase = base.x >= strip.x && base.x <= strip.x + strip.w;
    const eastward = containsBase || base.x < strip.x;
    const legs: SurveyLeg[] = [];
    const subLeg: number[] = new Array<number>(passes);
    let t = 0;
    let km = 0;
    let surveyKm = 0;
    let pos: Point = base;
    const drive = (kind: LegKind, to: Point, mPerH: number): void => {
      const lengthM = Math.hypot(to.x - pos.x, to.y - pos.y);
      const lengthKm = lengthM / UNITS.mPerKm;
      const t1 = t + lengthM / mPerH;
      legs.push({
        kind,
        x0: pos.x,
        y0: pos.y,
        x1: to.x,
        y1: to.y,
        t0H: t,
        t1H: t1,
        km0: km,
        lengthKm,
        surveyKm0: surveyKm,
      });
      t = t1;
      km += lengthKm;
      if (kind !== 'transit') surveyKm += lengthKm;
      pos = to;
    };

    for (let j = 0; j < passes; j++) {
      const sub = eastward ? j : passes - 1 - j;
      const x = strip.x + ((2 * sub + 1) * spacing) / 2;
      const north = j % 2 === 0 ? startSouth : !startSouth;
      const from = north ? yA : yB;
      const to = north ? yB : yA;
      drive(j === 0 ? 'transit' : 'shift', { x, y: from }, j === 0 ? transitMPerH : passMPerH);
      subLeg[sub] = legs.length;
      drive('pass', { x, y: to }, passMPerH);
    }
    drive('transit', base, transitMPerH);

    passOf.push(subLeg);
    vehicles.push({
      id,
      strip,
      passes,
      passSpacingM: spacing,
      eastward,
      legs,
      driveH: t,
      driveKm: km,
      surveyKm,
    });
  });

  // Hour each ground cell is surveyed: when the pass over its sub-strip reaches the cell's center.
  const cellCols = Math.max(1, Math.ceil(area.w / config.cellM));
  const cellRows = Math.max(1, Math.ceil(area.h / config.cellM));
  const cellSurveyedH = new Float32Array(cellCols * cellRows);
  const center = (origin: number, extent: number, i: number): number =>
    (origin + i * config.cellM + Math.min(origin + (i + 1) * config.cellM, origin + extent)) / 2;
  const colPass: PassRef[] = [];
  for (let c = 0; c < cellCols; c++) {
    const x = center(area.x, area.w, c);
    const vehicle = Math.min(count - 1, Math.max(0, Math.floor((x - area.x) / (area.w / count))));
    const plan = vehicles[vehicle];
    const sub = Math.min(
      plan.passes - 1,
      Math.max(0, Math.floor((x - plan.strip.x) / plan.passSpacingM)),
    );
    colPass.push({ vehicle, leg: passOf[vehicle][sub] });
  }
  for (let r = 0; r < cellRows; r++) {
    const y = center(area.y, area.h, r);
    for (let c = 0; c < cellCols; c++) {
      const { vehicle, leg } = colPass[c];
      const pass = vehicles[vehicle].legs[leg];
      cellSurveyedH[r * cellCols + c] = pass.t0H + Math.abs(y - pass.y0) / passMPerH;
    }
  }
  const sortedCellH = Float32Array.from(cellSurveyedH).sort();

  return {
    area,
    base,
    config,
    vehicles,
    cellCols,
    cellRows,
    cellSurveyedH,
    sortedCellH,
    finishH: Math.max(...vehicles.map((v) => v.driveH)),
    vehicleHours: vehicles.reduce((sum, v) => sum + v.driveH, 0),
  };
}

/** Index of the leg a 4x4 drives at `tH` (clamped to the first and the last leg). */
function legIndexAt(legs: SurveyLeg[], tH: number): number {
  let lo = 0;
  let hi = legs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (legs[mid].t0H <= tH) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Position and progress of one 4x4 at `tH` hours after Send. */
export function vehicleAt(vehicle: VehiclePlan, tH: number): VehicleState {
  const { legs } = vehicle;
  const first = legs[0];
  const last = legs[legs.length - 1];
  if (tH <= 0 || tH >= vehicle.driveH) {
    const done = tH >= vehicle.driveH && tH > 0;
    const leg = done ? last : first;
    return {
      x: done ? last.x1 : first.x0,
      y: done ? last.y1 : first.y0,
      kind: 'base',
      heading: Math.atan2(leg.y1 - leg.y0, leg.x1 - leg.x0),
      km: done ? vehicle.driveKm : 0,
      stripProgress: done ? 1 : 0,
      timeLeftH: done ? 0 : vehicle.driveH,
      done,
    };
  }
  const leg = legs[legIndexAt(legs, tH)];
  const span = leg.t1H - leg.t0H;
  const f = span > 0 ? Math.min(1, (tH - leg.t0H) / span) : 1;
  const surveyed = leg.surveyKm0 + (leg.kind === 'transit' ? 0 : f * leg.lengthKm);
  return {
    x: lerp(leg.x0, leg.x1, f),
    y: lerp(leg.y0, leg.y1, f),
    kind: leg.kind,
    heading: Math.atan2(leg.y1 - leg.y0, leg.x1 - leg.x0),
    km: leg.km0 + f * leg.lengthKm,
    stripProgress: vehicle.surveyKm > 0 ? surveyed / vehicle.surveyKm : 1,
    timeLeftH: vehicle.driveH - tH,
    done: false,
  };
}

/** Share of the ground cells surveyed at `tH`, 0 to 1. */
export function surveyedFraction(plan: SurveyPlan, tH: number): number {
  return upperBound(plan.sortedCellH, tH) / plan.sortedCellH.length;
}

/**
 * Ground one 4x4 has surveyed at `tH`, as one rectangle per pass started (the current pass is partial).
 * Each rectangle spans the pass's sub-strip, so the rectangles of all 4x4s never overlap.
 */
export function surveyedRects(vehicle: VehiclePlan, tH: number): Rect[] {
  const rects: Rect[] = [];
  const half = vehicle.passSpacingM / 2;
  for (const leg of vehicle.legs) {
    if (leg.kind !== 'pass' || leg.t0H >= tH) continue;
    const f = Math.min(1, (tH - leg.t0H) / (leg.t1H - leg.t0H));
    const yEnd = lerp(leg.y0, leg.y1, f);
    rects.push({
      x: leg.x0 - half,
      y: Math.min(leg.y0, yEnd),
      w: vehicle.passSpacingM,
      h: Math.abs(yEnd - leg.y0),
    });
  }
  return rects;
}
