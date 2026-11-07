// Build schedule (spec 3.4): placed and commissioned day per unit, build and commission fronts, zones per day.
// Every build order maps units to a scalar front coordinate in meters, so a front is one number per day.
import { BUILD } from '../config/defaults';
import type { BuildConfig, BuildOrder, FrontKind, Fronts, Schedule, Site } from './types';
import { Zone } from './types';

export interface ScheduleOptions {
  /** Origin for the 'fromBase' order in world meters. Default: middle of the west edge. */
  origin?: { x: number; y: number };
}

const FRONT_KIND: Record<BuildOrder, FrontKind> = {
  westToEast: 'x',
  southToNorth: 'y',
  fromBase: 'radial',
  blockSerpentine: 'path',
};

/** Front coordinate (primary sort key) and tie-break (secondary key) of every unit for an order. */
function frontKeys(
  site: Site,
  order: BuildOrder,
  origin: { x: number; y: number },
): { key: Float64Array; tie: Float64Array } {
  const key = new Float64Array(site.count);
  const tie = new Float64Array(site.count);
  const blockStride = site.blockWidthM + site.roadWidthM;
  for (let i = 0; i < site.count; i++) {
    const x = site.centers[2 * i];
    const y = site.centers[2 * i + 1];
    switch (order) {
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
  const origin = options.origin ?? { x: 0, y: site.heightM / 2 };
  const { key, tie } = frontKeys(site, build.order, origin);

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
