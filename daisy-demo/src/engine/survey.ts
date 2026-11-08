// UTV survey planning (spec 8.2, D31, D60, D81): one strip per UTV, north-south passes around the built-up base
// pad, which no leg crosses, from and back to its gate; a time model per leg and the hour each cell is surveyed.
import { SURVEY } from '../config/survey';
import { UNITS } from '../config/units';
import type { Rect } from './types';

export interface SurveyConfig {
  maxVehicles: number;
  defaultVehicles: number;
  swathM: number;
  surveySpeedKmh: number;
  transitSpeedKmh: number;
  /** Speed through the U-turn at the end of a pass, a half circle as wide as the pass spacing (D83). */
  turnSpeedKmh: number;
  /** Minutes a drone flies on one set of batteries, and minutes to land on its UTV, swap and take off. */
  droneFlightMin: number;
  droneSwapMin: number;
  /** Km a UTV drives on a tank, and minutes to refuel it where it stands. */
  fuelRangeKm: number;
  refuelMin: number;
  /** Hours of a field day, and hours each day starts with setting up and checking the RTK base. */
  shiftH: number;
  baseSetupH: number;
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
 * pad ('transit'), a survey pass, or the U-turn to the next pass ('shift'); or a stop where the UTV stands
 * while its drone swaps batteries or the UTV refuels (D83).
 */
export type LegKind = 'transit' | 'pass' | 'shift' | 'stop';

/** Why a UTV stops (D83). */
export type StopReason = 'swap' | 'refuel';

/** Hours of one UTV's work by kind (D83): they add up to its drive time. */
export interface WorkBreakdown {
  /** Passes and the drives between the base and the strip. */
  drivingH: number;
  /** U-turns between passes. */
  turnsH: number;
  /** Drone battery swaps. */
  swapsH: number;
  refuelsH: number;
}

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
  /** Stops only: why the UTV stands. */
  stop?: StopReason;
}

export interface VehiclePlan {
  /** 0-based; the UI names it "UTV #(id + 1)". */
  id: number;
  strip: Rect;
  /** Number of pass legs; a column beside the base pad has two, one on each side of the pad. */
  passes: number;
  /** Widest pass spacing in the strip, at most `swathM`. */
  passSpacingM: number;
  /** True when the UTV starts at the strip's west edge and works toward the east. */
  eastward: boolean;
  /** The gate of the base pad (D81): where the UTV parks before Send and after its return. */
  home: Point;
  legs: SurveyLeg[];
  /** Hours from Send until this UTV is back at the base. */
  driveH: number;
  driveKm: number;
  /** Distance on passes and shifts, in km. */
  surveyKm: number;
  /** Hours of its work by kind; they add up to `driveH`. */
  work: WorkBreakdown;
  /** Its drone battery swaps and refuels. */
  swaps: number;
  refuels: number;
}

export interface SurveyPlan {
  area: Rect;
  base: Point;
  /** The base pad, which no UTV drives over and which is not surveyed (D60); null when the site has none. */
  pad: Rect | null;
  /**
   * Where the UTVs leave and re-enter the base (D81): the middle of the pad's edge on the side the survey
   * starts, so a UTV at the gate is never on the pad; the base itself when there is no pad.
   */
  gate: Point;
  config: SurveyConfig;
  vehicles: VehiclePlan[];
  /** Ground cells of `cellM`, row-major from the south-west corner: id = row * cellCols + col. */
  cellCols: number;
  cellRows: number;
  /** Hour after Send at which each cell is surveyed; NaN for a cell on the base pad. */
  cellSurveyedH: Float32Array;
  /** The hours of the cells off the pad, sorted, so the surveyed share at any hour is one binary search. */
  sortedCellH: Float32Array;
  /** Hours until the last UTV is back at the base (spec 8.2, step 5). */
  finishH: number;
  /** Sum of every UTV's drive time (spec 10.4). */
  vehicleHours: number;
}

/** Where a UTV is at an hour, and what its hover card shows. */
export interface VehicleState {
  x: number;
  y: number;
  /** 'base' before Send and after the UTV is back. */
  kind: LegKind | 'base';
  /** Why it stands, on a stop. */
  stop?: StopReason;
  /** Heading in radians (0 = east, counter-clockwise), from the current or the last leg. */
  heading: number;
  km: number;
  /** Share of this UTV's survey distance done, 0 to 1. */
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

/**
 * The gate of the base pad (D81): the middle of its south edge when the survey starts at the south edge of
 * the area, else of its north edge, below or above the base; the base itself when there is no pad.
 */
export function padGate(base: Point, pad: Rect | null, south: boolean): Point {
  if (!pad) return base;
  return {
    x: Math.min(pad.x + pad.w, Math.max(pad.x, base.x)),
    y: south ? pad.y : pad.y + pad.h,
  };
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
 * Plans the survey of `area` by `count` UTVs from `base` on its `pad` (spec 8.2, D31, D60, D81).
 * Each section of a strip gets `ceil(width / swathM)` evenly spaced columns, so the spacing is at most
 * `swathM`; columns beside the pad are split at its edges, so a pass stops at the pad instead of crossing it.
 * A UTV sweeps its strip from the edge nearest the base, surveying the side of the pad it reaches first, and
 * sweeps the other side on its way back. It starts and ends at the pad's gate, and drives around the pad.
 */
export function planSurvey(
  area: Rect,
  base: Point,
  count: number,
  config: SurveyConfig = SURVEY,
  pad: Rect | null = null,
): SurveyPlan {
  if (!Number.isInteger(count) || count < 1)
    throw new Error(`UTV count must be at least 1: ${count}`);
  const passMPerH = config.surveySpeedKmh * UNITS.mPerKm;
  const transitMPerH = config.transitSpeedKmh * UNITS.mPerKm;
  const turnMPerH = config.turnSpeedKmh * UNITS.mPerKm;
  // A U-turn between passes is a half circle whose diameter is the shift: pi / 2 times its straight length.
  const turnPathPerM = Math.PI / 2;
  const flightH = config.droneFlightMin / UNITS.minPerH;
  const swapH = config.droneSwapMin / UNITS.minPerH;
  const refuelH = config.refuelMin / UNITS.minPerH;
  const minM = config.minSectionM;
  const yA = area.y;
  const yB = area.y + area.h;
  const startSouth = Math.abs(base.y - yA) <= Math.abs(base.y - yB);
  const gate = padGate(base, pad, startSouth);
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

    // Columns in the order the UTV reaches them. A pad section has an even number, so its first side ends
    // where it began; the last section after the pad has an odd number, so the UTV ends on the pad's far side.
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
    let pos: Point = gate;
    const work: WorkBreakdown = { drivingH: 0, turnsH: 0, swapsH: 0, refuelsH: 0 };
    let swaps = 0;
    let refuels = 0;
    // Flight time of the drone's batteries and km on the UTV's tank since the last swap or refuel.
    let flownH = 0;
    let tankKm = 0;
    let returning = false;
    const stopFor = (reason: StopReason, hours: number): void => {
      legs.push({
        kind: 'stop',
        stop: reason,
        x0: pos.x,
        y0: pos.y,
        x1: pos.x,
        y1: pos.y,
        t0H: t,
        t1H: t + hours,
        km0: km,
        lengthKm: 0,
        surveyKm0: surveyKm,
      });
      t += hours;
    };
    /** After a leg: refuel when the tank is due, swapping the drone's batteries meanwhile, else swap if due. */
    const service = (): void => {
      if (returning) return;
      if (tankKm >= config.fuelRangeKm) {
        stopFor('refuel', refuelH);
        work.refuelsH += refuelH;
        refuels++;
        tankKm = 0;
        flownH = 0;
      } else if (flownH >= flightH) {
        stopFor('swap', swapH);
        work.swapsH += swapH;
        swaps++;
        flownH = 0;
      }
    };
    const drive = (kind: LegKind, to: Point, pass?: Column): number => {
      const from = pos;
      const lengthM = Math.hypot(to.x - from.x, to.y - from.y);
      const pathM = kind === 'shift' ? lengthM * turnPathPerM : lengthM;
      const lengthKm = pathM / UNITS.mPerKm;
      const mPerH = kind === 'transit' ? transitMPerH : kind === 'shift' ? turnMPerH : passMPerH;
      const t1 = t + pathM / mPerH;
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
      if (kind === 'shift') work.turnsH += t1 - t;
      else work.drivingH += t1 - t;
      flownH += t1 - t;
      tankKm += lengthKm;
      t = t1;
      km += lengthKm;
      if (kind !== 'transit') surveyKm += lengthKm;
      pos = to;
      const index = legs.length - 1;
      service();
      return index;
    };
    /**
     * Drives to `to` around the pad: a shift when the way is clear, transit legs when it is not, and always
     * transit on the way out of the gate.
     */
    const reach = (kind: LegKind, to: Point): void => {
      const way = routeAround(pos, to, pad);
      const out = legs.length === 0;
      for (const p of way) drive(way.length > 1 || out ? 'transit' : kind, p);
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

    returning = true;
    reach('transit', gate);

    columnsOf.push(columns);
    vehicles.push({
      id,
      strip,
      passes: legs.filter((l) => l.kind === 'pass').length,
      passSpacingM: Math.max(...columns.map((c) => c.x1 - c.x0)),
      eastward,
      home: gate,
      legs,
      driveH: t,
      driveKm: km,
      surveyKm,
      work,
      swaps,
      refuels,
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
    gate,
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

/** Index of the leg a UTV drives at `tH` (clamped to the first and the last leg). */
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

/** Position and progress of one UTV at `tH` hours after Send; at the base it is at `home`, the pad's gate. */
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
    ...(leg.stop ? { stop: leg.stop } : {}),
    heading: Math.atan2(leg.y1 - leg.y0, leg.x1 - leg.x0),
    km: leg.km0 + f * leg.lengthKm,
    stripProgress: vehicle.surveyKm > 0 ? surveyed / vehicle.surveyKm : 1,
    timeLeftH: vehicle.driveH - tH,
    done: false,
  };
}

/**
 * The drone of a UTV (D61): it flies with its UTV whenever the UTV is out on the site, and rides docked on
 * it at the base and while the UTV stops for a battery swap or fuel (D83). Its only link is the UTV, whose
 * Starlink carries its data, so it is online when the UTV is.
 */
export function droneFlying(state: VehicleState): boolean {
  return state.kind !== 'base' && state.kind !== 'stop';
}

/** A survey in field days (D83): the fleet's work, and the RTK base set up at the start of every day. */
export interface SurveySchedule {
  /** Hours on site, Send to the last UTV back: the plan's finish. */
  workH: number;
  days: number;
  /** Base setup over all days. */
  setupH: number;
  /** Work and setup together. */
  totalH: number;
  /** The UTV that finishes last, whose work breakdown the readout shows. */
  critical: VehiclePlan;
}

export function surveySchedule(plan: SurveyPlan): SurveySchedule {
  const { shiftH, baseSetupH } = plan.config;
  const workH = plan.finishH;
  const days = Math.max(1, Math.ceil(workH / (shiftH - baseSetupH)));
  const setupH = days * baseSetupH;
  const critical = plan.vehicles.reduce((a, v) => (v.driveH > a.driveH ? v : a));
  return { workH, days, setupH, totalH: workH + setupH, critical };
}

/**
 * The point `distM` behind a driving UTV along the path it has driven, where its drone follows it; never
 * further back than the pad's gate, where the UTV set out.
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
 * Ground one UTV has surveyed at `tH`, as one rectangle per pass started (the current pass is partial).
 * Each rectangle spans the pass's column, so the rectangles of all UTVs never overlap.
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
