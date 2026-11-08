// 4x4 survey planning (spec 8.2, D31, D60): one strip per 4x4, back-and-forth north-south passes that stop
// at the base pad, a time model per leg, and the hour each ground cell is surveyed, as pure functions.
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
  /** A strip section narrower than this joins its neighbor, and the base this close to a strip edge is on it. */
  minSectionM: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * A leg is a straight drive: between the base pad and the strip, or between the parts of a strip around the
 * pad ('transit'), a survey pass, or the shift to the next pass.
 */
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
  /** Passes only: the column of the strip the pass records (0 at the strip's west edge) and its width in m. */
  column?: number;
  widthM?: number;
}

export interface VehiclePlan {
  /** 0-based; the UI names it "4x4 #(id + 1)". */
  id: number;
  strip: Rect;
  /** Number of pass legs; a column beside the base pad has two, one on each side of the pad. */
  passes: number;
  /** Widest pass spacing in the strip, at most `swathM`. */
  passSpacingM: number;
  /** True when the 4x4 starts at the strip's west edge and works toward the east. */
  eastward: boolean;
  /** The base: where the 4x4 parks before Send and after its return. */
  home: Point;
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
  /** The base pad, which no 4x4 drives over and which is not surveyed (D60); null when the site has none. */
  pad: Rect | null;
  config: SurveyConfig;
  vehicles: VehiclePlan[];
  /** Ground cells of `cellM`, row-major from the south-west corner: id = row * cellCols + col. */
  cellCols: number;
  cellRows: number;
  /** Hour after Send at which each cell is surveyed; NaN for a cell on the base pad. */
  cellSurveyedH: Float32Array;
  /** The hours of the cells off the pad, sorted, so the surveyed share at any hour is one binary search. */
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

/** A run of equal pass columns across a strip, west to east; a pad section lies beside the base pad. */
interface Section {
  x0: number;
  x1: number;
  pad: boolean;
}

/** One pass column of a strip, with the legs that survey it (a pad column has one leg on each side). */
interface Column {
  x0: number;
  x1: number;
  pad: boolean;
  full: number;
  south: number;
  north: number;
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
 * True when the segment from `a` to `b` passes through the inside of `rect`. A segment that runs along an
 * edge of the rectangle or touches a corner stays outside.
 */
export function crossesRect(a: Point, b: Point, rect: Rect): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const den = [-dx, dx, -dy, dy];
  const num = [a.x - rect.x, rect.x + rect.w - a.x, a.y - rect.y, rect.y + rect.h - a.y];
  let t0 = 0;
  let t1 = 1;
  for (let i = 0; i < den.length; i++) {
    if (den[i] === 0) {
      if (num[i] <= 0) return false;
      continue;
    }
    const t = num[i] / den[i];
    if (den[i] < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
  }
  if (t1 <= t0) return false;
  const mx = a.x + dx * ((t0 + t1) / 2);
  const my = a.y + dy * ((t0 + t1) / 2);
  return mx > rect.x && mx < rect.x + rect.w && my > rect.y && my < rect.y + rect.h;
}

/**
 * The shortest way from `a` to `b` that does not cross `rect`: `b` itself, or one or two corners of `rect`
 * and then `b`. Without `a` itself.
 */
export function routeAround(a: Point, b: Point, rect: Rect | null): Point[] {
  if (!rect || !crossesRect(a, b, rect)) return [b];
  const nodes: Point[] = [
    a,
    b,
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x + rect.w, y: rect.y + rect.h },
    { x: rect.x, y: rect.y + rect.h },
  ];
  const dist = nodes.map(() => Infinity);
  const prev = nodes.map(() => -1);
  const done = nodes.map(() => false);
  dist[0] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < nodes.length; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || u === 1 || dist[u] === Infinity) break;
    done[u] = true;
    for (let v = 0; v < nodes.length; v++) {
      if (done[v] || crossesRect(nodes[u], nodes[v], rect)) continue;
      const d = dist[u] + Math.hypot(nodes[v].x - nodes[u].x, nodes[v].y - nodes[u].y);
      if (d < dist[v]) {
        dist[v] = d;
        prev[v] = u;
      }
    }
  }
  const path: Point[] = [];
  for (let v = 1; v > 0; v = prev[v]) path.unshift(nodes[v]);
  return path;
}

/** Where the line from `from` (on the pad) toward `to` leaves the pad; `from` when there is no pad. */
function padEdgeToward(from: Point, to: Point, pad: Rect | null): Point {
  if (!pad) return from;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  let t = Infinity;
  if (dx > 0) t = Math.min(t, (pad.x + pad.w - from.x) / dx);
  if (dx < 0) t = Math.min(t, (pad.x - from.x) / dx);
  if (dy > 0) t = Math.min(t, (pad.y + pad.h - from.y) / dy);
  if (dy < 0) t = Math.min(t, (pad.y - from.y) / dy);
  if (!(t < 1)) return from;
  return { x: from.x + dx * t, y: from.y + dy * t };
}

/** The sections of a strip, west to east: one, or the parts beside, and west and east of, the pad. */
function stripSections(strip: Rect, pad: Rect | null, minM: number): Section[] {
  const end = strip.x + strip.w;
  const whole: Section[] = [{ x0: strip.x, x1: end, pad: false }];
  if (!pad) return whole;
  let a = Math.max(strip.x, pad.x);
  let b = Math.min(end, pad.x + pad.w);
  if (b - a < minM) return whole;
  if (a - strip.x < minM) a = strip.x;
  if (end - b < minM) b = end;
  const sections: Section[] = [];
  if (a > strip.x) sections.push({ x0: strip.x, x1: a, pad: false });
  sections.push({ x0: a, x1: b, pad: true });
  if (b < end) sections.push({ x0: b, x1: end, pad: false });
  return sections;
}

/**
 * Plans the survey of `area` by `count` 4x4s that start and end at `base` on its `pad` (spec 8.2, D31, D60).
 * Each section of a strip gets `ceil(width / swathM)` evenly spaced columns, so the spacing is at most
 * `swathM`; columns beside the pad are split at its edges, so a pass stops at the pad instead of crossing it.
 * A 4x4 sweeps its strip from the edge nearest the base, surveying the side of the pad it reaches first, and
 * sweeps the other side on its way back. It leaves and enters the pad where the line to the base meets it.
 */
export function planSurvey(
  area: Rect,
  base: Point,
  count: number,
  config: SurveyConfig = SURVEY,
  pad: Rect | null = null,
): SurveyPlan {
  if (!Number.isInteger(count) || count < 1)
    throw new Error(`4x4 count must be at least 1: ${count}`);
  const passMPerH = config.surveySpeedKmh * UNITS.mPerKm;
  const transitMPerH = config.transitSpeedKmh * UNITS.mPerKm;
  const minM = config.minSectionM;
  const yA = area.y;
  const yB = area.y + area.h;
  const startSouth = Math.abs(base.y - yA) <= Math.abs(base.y - yB);
  const columnsFor = (width: number, parity: number | null): number => {
    const n = Math.max(1, Math.ceil(width / config.swathM));
    return parity === null || n % 2 === parity ? n : n + 1;
  };

  const strips = surveyStrips(area, count);
  const vehicles: VehiclePlan[] = [];
  const columnsOf: Column[][] = [];

  strips.forEach((strip, id) => {
    const end = strip.x + strip.w;
    const baseInside = base.x > strip.x + minM && base.x < end - minM;
    const eastward = baseInside || base.x <= strip.x + minM;
    const sections = stripSections(strip, pad, minM);
    const ordered = eastward ? sections : [...sections].reverse();
    const padAt = ordered.findIndex((s) => s.pad);

    // Columns in the order the 4x4 reaches them. A pad section has an even number, so its first side ends
    // where it began; the last section after the pad has an odd number, so the 4x4 ends on the pad's far side.
    const sweep: Column[] = [];
    const runs: Column[][] = [];
    ordered.forEach((s, k) => {
      const even = 0;
      const odd = 1;
      const parity = s.pad
        ? even
        : padAt >= 0 && k === ordered.length - 1 && k > padAt
          ? odd
          : null;
      const n = columnsFor(s.x1 - s.x0, parity);
      const w = (s.x1 - s.x0) / n;
      const run: Column[] = [];
      for (let j = 0; j < n; j++) {
        const i = eastward ? j : n - 1 - j;
        run.push({
          x0: s.x0 + i * w,
          x1: s.x0 + (i + 1) * w,
          pad: s.pad,
          full: -1,
          south: -1,
          north: -1,
        });
      }
      runs.push(run);
      sweep.push(...run);
    });
    const columns = [...sweep].sort((a, b) => a.x0 - b.x0);

    const legs: SurveyLeg[] = [];
    let t = 0;
    let km = 0;
    let surveyKm = 0;
    let pos: Point | null = null;
    const drive = (kind: LegKind, to: Point, pass?: Column): number => {
      const from: Point = pos ?? padEdgeToward(base, to, pad);
      const lengthM = Math.hypot(to.x - from.x, to.y - from.y);
      const lengthKm = lengthM / UNITS.mPerKm;
      const t1 = t + lengthM / (kind === 'transit' ? transitMPerH : passMPerH);
      const leg: SurveyLeg = {
        kind,
        x0: from.x,
        y0: from.y,
        x1: to.x,
        y1: to.y,
        t0H: t,
        t1H: t1,
        km0: km,
        lengthKm,
        surveyKm0: surveyKm,
      };
      if (pass) {
        leg.column = columns.indexOf(pass);
        leg.widthM = pass.x1 - pass.x0;
      }
      legs.push(leg);
      t = t1;
      km += lengthKm;
      if (kind !== 'transit') surveyKm += lengthKm;
      pos = to;
      return legs.length - 1;
    };
    /** Drives to `to` around the pad: a shift when the way is clear, transit legs when it is not. */
    const reach = (kind: LegKind, to: Point): void => {
      if (pos === null) {
        drive('transit', to);
        return;
      }
      const way = routeAround(pos, to, pad);
      for (const p of way) drive(way.length > 1 ? 'transit' : kind, p);
    };

    let south = startSouth;
    let padSouth = startSouth;
    for (const run of runs) {
      run.forEach((col, j) => {
        const x = (col.x0 + col.x1) / 2;
        if (!col.pad) {
          reach('shift', { x, y: south ? yA : yB });
          col.full = drive('pass', { x, y: south ? yB : yA }, col);
          south = !south;
          return;
        }
        if (j === 0) padSouth = south;
        const outer = south ? yA : yB;
        const inner = south ? pad!.y : pad!.y + pad!.h;
        const outward = j % 2 === 1;
        reach('shift', { x, y: outward ? inner : outer });
        const leg = drive('pass', { x, y: outward ? outer : inner }, col);
        if (south) col.south = leg;
        else col.north = leg;
      });
    }

    // The far side of the pad, swept back toward the start.
    const padRun = padAt >= 0 ? runs[padAt] : [];
    const back = [...padRun].reverse();
    const farSouth = !padSouth;
    back.forEach((col, j) => {
      const x = (col.x0 + col.x1) / 2;
      const outer = farSouth ? yA : yB;
      const inner = farSouth ? pad!.y : pad!.y + pad!.h;
      const outward = j % 2 === 1;
      reach(j === 0 ? 'transit' : 'shift', { x, y: outward ? inner : outer });
      const leg = drive('pass', { x, y: outward ? outer : inner }, col);
      if (farSouth) col.south = leg;
      else col.north = leg;
    });

    const last: Point = pos!;
    drive('transit', padEdgeToward(base, last, pad));

    columnsOf.push(columns);
    vehicles.push({
      id,
      strip,
      passes: legs.filter((l) => l.kind === 'pass').length,
      passSpacingM: Math.max(...columns.map((c) => c.x1 - c.x0)),
      eastward,
      home: base,
      legs,
      driveH: t,
      driveKm: km,
      surveyKm,
    });
  });

  // Hour each ground cell is surveyed: when the pass over its column reaches the cell's center.
  const cellCols = Math.max(1, Math.ceil(area.w / config.cellM));
  const cellRows = Math.max(1, Math.ceil(area.h / config.cellM));
  const cellSurveyedH = new Float32Array(cellCols * cellRows);
  const center = (origin: number, extent: number, i: number): number =>
    (origin + i * config.cellM + Math.min(origin + (i + 1) * config.cellM, origin + extent)) / 2;
  const colRef: { vehicle: number; column: Column }[] = [];
  for (let c = 0; c < cellCols; c++) {
    const x = center(area.x, area.w, c);
    const vehicle = Math.min(count - 1, Math.max(0, Math.floor((x - area.x) / (area.w / count))));
    const columns = columnsOf[vehicle];
    const column = columns.find((k) => x < k.x1) ?? columns[columns.length - 1];
    colRef.push({ vehicle, column });
  }
  for (let r = 0; r < cellRows; r++) {
    const y = center(area.y, area.h, r);
    for (let c = 0; c < cellCols; c++) {
      const { vehicle, column } = colRef[c];
      let leg = column.full;
      if (column.pad) leg = y < pad!.y ? column.south : y > pad!.y + pad!.h ? column.north : -1;
      const pass = leg >= 0 ? vehicles[vehicle].legs[leg] : null;
      cellSurveyedH[r * cellCols + c] = pass
        ? pass.t0H + Math.abs(y - pass.y0) / passMPerH
        : Number.NaN;
    }
  }
  const sortedCellH = cellSurveyedH.filter((h) => !Number.isNaN(h)).sort();

  return {
    area,
    base,
    pad,
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

/** Position and progress of one 4x4 at `tH` hours after Send; at the base it is at `home`. */
export function vehicleAt(vehicle: VehiclePlan, tH: number): VehicleState {
  const { legs } = vehicle;
  const first = legs[0];
  const last = legs[legs.length - 1];
  if (tH <= 0 || tH >= vehicle.driveH) {
    const done = tH >= vehicle.driveH && tH > 0;
    const leg = done ? last : first;
    return {
      x: vehicle.home.x,
      y: vehicle.home.y,
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

/**
 * The drone of a 4x4 (D61): it flies with its 4x4 whenever the 4x4 is out on the site, and rides docked on
 * it at the base. Its only link is the 4x4, whose Starlink carries its data, so it is online when the 4x4 is.
 */
export function droneFlying(state: VehicleState): boolean {
  return state.kind !== 'base';
}

/**
 * The point `distM` behind a driving 4x4 along the path it has driven, where its drone follows it; never
 * further back than where the 4x4 left the base pad.
 */
export function trailPoint(vehicle: VehiclePlan, tH: number, distM: number): Point {
  const now = vehicleAt(vehicle, tH);
  if (now.kind === 'base') return { x: now.x, y: now.y };
  let i = legIndexAt(vehicle.legs, tH);
  let x = now.x;
  let y = now.y;
  let left = distM;
  for (;;) {
    const leg = vehicle.legs[i];
    const d = Math.hypot(x - leg.x0, y - leg.y0);
    if (d >= left) {
      const f = d > 0 ? left / d : 0;
      return { x: lerp(x, leg.x0, f), y: lerp(y, leg.y0, f) };
    }
    left -= d;
    x = leg.x0;
    y = leg.y0;
    if (i === 0) return { x, y };
    i--;
  }
}

/** Share of the ground cells off the pad surveyed at `tH`, 0 to 1. */
export function surveyedFraction(plan: SurveyPlan, tH: number): number {
  return upperBound(plan.sortedCellH, tH) / plan.sortedCellH.length;
}

/**
 * Ground one 4x4 has surveyed at `tH`, as one rectangle per pass started (the current pass is partial).
 * Each rectangle spans the pass's column, so the rectangles of all 4x4s never overlap.
 */
export function surveyedRects(vehicle: VehiclePlan, tH: number): Rect[] {
  const rects: Rect[] = [];
  for (const leg of vehicle.legs) {
    if (leg.kind !== 'pass' || leg.t0H >= tH) continue;
    const width = leg.widthM ?? vehicle.passSpacingM;
    const f = Math.min(1, (tH - leg.t0H) / (leg.t1H - leg.t0H));
    const yEnd = lerp(leg.y0, leg.y1, f);
    rects.push({
      x: leg.x0 - width / 2,
      y: Math.min(leg.y0, yEnd),
      w: width,
      h: Math.abs(yEnd - leg.y0),
    });
  }
  return rects;
}
