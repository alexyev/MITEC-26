// The site and its build schedule, generated once on the main thread (the Web Worker engine comes in T2.5).
import { BUILD, SITE } from '../config/defaults';
import { buildSchedule } from '../engine/schedule';
import { generateSite } from '../engine/site';
import type { Schedule, Site } from '../engine/types';

export interface SiteModel {
  site: Site;
  schedule: Schedule;
  /** Unit footprint along world x and world y, in meters. */
  unitW: number;
  unitH: number;
  /** World extent of the unit grid (unit edges), in meters. */
  grid: { x0: number; y0: number; x1: number; y1: number };
}

let model: SiteModel | null = null;

export function getSiteModel(): SiteModel {
  if (model) return model;
  const site = generateSite(SITE);
  const schedule = buildSchedule(site, BUILD);
  const ew = site.laneAxis === 'EW';
  const unitW = ew ? SITE.unitWidthM : SITE.unitDepthM;
  const unitH = ew ? SITE.unitDepthM : SITE.unitWidthM;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < site.count; i++) {
    const x = site.centers[2 * i];
    const y = site.centers[2 * i + 1];
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  model = {
    site,
    schedule,
    unitW,
    unitH,
    grid: { x0: x0 - unitW / 2, y0: y0 - unitH / 2, x1: x1 + unitW / 2, y1: y1 + unitH / 2 },
  };
  return model;
}

/** Unit state on a day: 0 not placed, 1 placed (no power), 2 commissioned. */
export function unitStates(schedule: Schedule, day: number, out?: Uint8Array): Uint8Array {
  const n = schedule.placedDay.length;
  const states = out ?? new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    states[i] = schedule.commissionDay[i] <= day ? 2 : schedule.placedDay[i] <= day ? 1 : 0;
  }
  return states;
}
