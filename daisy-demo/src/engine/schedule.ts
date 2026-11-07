// Build schedule (spec 3.4): placed and commissioned day per unit, build and commission fronts, zones per day.
// Every build order maps units to a scalar front coordinate in meters, so a front is one number per day.
import { BUILD } from '../config/defaults';
import type {
  BuildConfig,
  BuildOrder,
  BuildZones,
  FrontKind,
  Fronts,
  Schedule,
  Site,
} from './types';
import { Zone } from './types';

export interface ScheduleOptions {
  /** Origin for the 'fromBase' order in world meters. Default: the site center (the default base, D5). */
  origin?: { x: number; y: number };
}

const FRONT_KIND: Record<BuildOrder, FrontKind> = {
  centerOut: 'centerX',
  westToEast: 'x',
  southToNorth: 'y',
  fromBase: 'radial',
  blockSerpentine: 'path',
};

/**
 * East-west distance of every unit from the center line of the unit grid (decision D5).
 * The distinct unit x values are paired from the outside in (first with last, second with second to
 * last, ...) and both members of a pair get half their distance, so mirrored columns have exactly the
 * same key and the west and east faces advance at the same pace.
 */
function centerDistances(site: Site): { distance: Float64Array; centerX: number } {
  const distance = new Float64Array(site.count);
  if (site.count === 0) return { distance, centerX: site.widthM / 2 };
  const xs = Array.from(new Set(Array.from({ length: site.count }, (_, i) => site.centers[2 * i])));
  xs.sort((a, b) => a - b);
  const last = xs.length - 1;
  const halfSpan = new Map<number, number>();
  xs.forEach((x, k) => halfSpan.set(x, Math.abs(xs[last - k] - x) / 2));
  for (let i = 0; i < site.count; i++) distance[i] = halfSpan.get(site.centers[2 * i]) ?? 0;
  return { distance, centerX: (xs[0] + xs[last]) / 2 };
}

/** Front coordinate (primary sort key) and tie-break (secondary key) of every unit for an order. */
function frontKeys(
  site: Site,
  order: BuildOrder,
  origin: { x: number; y: number },
  centerDistance: Float64Array,
): { key: Float64Array; tie: Float64Array } {
  const key = new Float64Array(site.count);
  const tie = new Float64Array(site.count);
  const blockStride = site.blockWidthM + site.roadWidthM;
  for (let i = 0; i < site.count; i++) {
    const x = site.centers[2 * i];
    const y = site.centers[2 * i + 1];
    switch (order) {
      case 'centerOut':
        // Mirrored units on the two faces tie on (distance, y); the final id tie-break puts the west
        // unit first, so the build alternates west, east in every lane row.
        key[i] = centerDistance[i];
        tie[i] = y;
        break;
      case 'westToEast':
        key[i] = x;
        tie[i] = y;
        break;
      case 'southToNorth':
        key[i] = y;
        tie[i] = x;
        break;
      case 'fromBase':
        key[i] = Math.hypot(x - origin.x, y - origin.y);
        tie[i] = Math.atan2(y - origin.y, x - origin.x);
        break;
      case 'blockSerpentine': {
        // Blocks are visited row by row, alternating direction on every block row (lane frame).
        const blockRow = Math.floor(site.unitBlock[i] / site.blockCols);
        const blockCol = site.unitBlock[i] % site.blockCols;
        const reversed = blockRow % 2 === 1;
        const ordinal =
          blockRow * site.blockCols + (reversed ? site.blockCols - 1 - blockCol : blockCol);
        const pos = site.unitPosInLane[i];
        const along = (reversed ? site.unitsPerLane - 1 - pos : pos) * site.unitPitchM;
        key[i] = ordinal * blockStride + along;
        tie[i] = site.unitRow[i];
        break;
      }
    }
  }
  return { key, tie };
}

export function buildSchedule(
  site: Site,
  build: BuildConfig = BUILD,
  options: ScheduleOptions = {},
): Schedule {
  const origin = options.origin ?? { x: site.widthM / 2, y: site.heightM / 2 };
  const { distance, centerX } = centerDistances(site);
  const { key, tie } = frontKeys(site, build.order, origin, distance);

  const ids = new Int32Array(site.count);
  for (let i = 0; i < site.count; i++) ids[i] = i;
  ids.sort((a, b) => key[a] - key[b] || tie[a] - tie[b] || a - b);

  const placedDay = new Int32Array(site.count);
  const commissionDay = new Int32Array(site.count);
  for (let rank = 0; rank < site.count; rank++) {
    const day = Math.floor(rank / build.unitsPerDay) + 1;
    placedDay[ids[rank]] = day;
    commissionDay[ids[rank]] = day + build.placeToCommissionDays;
  }
  const buildDays = Math.ceil(site.count / build.unitsPerDay);

  return {
    order: build.order,
    frontKind: FRONT_KIND[build.order],
    unitsPerDay: build.unitsPerDay,
    placeToCommissionDays: build.placeToCommissionDays,
    frontWorkZoneM: build.frontWorkZoneM,
    placedDay,
    commissionDay,
    centerX,
    frontKey: key,
    buildOrderIds: ids,
    buildDays,
    lastDay: buildDays + build.placeToCommissionDays,
  };
}

/** Build front, commission front and edge-zone size for a day (days are 1-based; day 0 = nothing built). */
export function frontsAt(schedule: Schedule, day: number): Fronts {
  const total = schedule.buildOrderIds.length;
  const placedCount = Math.min(total, Math.max(0, day * schedule.unitsPerDay));
  const commissionedCount = Math.min(
    total,
    Math.max(0, (day - schedule.placeToCommissionDays) * schedule.unitsPerDay),
  );
  // The key of the unit at a given build rank; before any unit exists the front sits at the first key.
  const keyAtCount = (count: number): number =>
    total === 0 ? 0 : schedule.frontKey[schedule.buildOrderIds[Math.max(0, count - 1)]];
  const buildFront = keyAtCount(placedCount);
  return {
    day,
    kind: schedule.frontKind,
    placedCount,
    commissionedCount,
    edgeZoneCount: placedCount - commissionedCount,
    buildFront,
    commissionFront: keyAtCount(commissionedCount),
    workZoneEnd: buildFront + schedule.frontWorkZoneM,
  };
}

/**
 * World x of the commission front, build front and work-zone end on the west and the east face for a
 * day (`Result.zones`, decision D8). Only the 'centerOut' order has two faces.
 */
export function faceZonesAt(schedule: Schedule, day: number): BuildZones {
  if (schedule.frontKind !== 'centerX') {
    throw new Error(`Face zones need the centerOut build order, not ${schedule.order}.`);
  }
  const f = frontsAt(schedule, day);
  const c = schedule.centerX;
  return {
    west: {
      commissionFrontX: c - f.commissionFront,
      buildFrontX: c - f.buildFront,
      workZoneEndX: c - f.workZoneEnd,
    },
    east: {
      commissionFrontX: c + f.commissionFront,
      buildFrontX: c + f.buildFront,
      workZoneEndX: c + f.workZoneEnd,
    },
  };
}

/** Zone of every unit on a day (spec 7.1). */
export function zonesAt(schedule: Schedule, day: number): Uint8Array {
  const n = schedule.placedDay.length;
  const zones = new Uint8Array(n);
  const fronts = frontsAt(schedule, day);
  for (let i = 0; i < n; i++) {
    if (schedule.commissionDay[i] <= day) zones[i] = Zone.Commissioned;
    else if (schedule.placedDay[i] <= day) zones[i] = Zone.EdgeZone;
    else if (schedule.frontKey[i] <= fronts.workZoneEnd) zones[i] = Zone.WorkZone;
    else zones[i] = Zone.Planned;
  }
  return zones;
}
