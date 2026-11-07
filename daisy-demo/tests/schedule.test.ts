import { describe, expect, it } from 'vitest';
import { BUILD } from '../src/config/defaults';
import { buildSchedule, frontsAt, zonesAt } from '../src/engine/schedule';
import { generateSite } from '../src/engine/site';
import type { BuildOrder } from '../src/engine/types';
import { Zone } from '../src/engine/types';

const site = generateSite();
const ORDERS: BuildOrder[] = ['westToEast', 'southToNorth', 'fromBase', 'blockSerpentine'];

describe('buildSchedule', () => {
  for (const order of ORDERS) {
    describe(order, () => {
      const schedule = buildSchedule(site, { ...BUILD, order });

      it('places unitsPerDay units per day and takes about 400 days', () => {
        const perDay = new Map<number, number>();
        for (let i = 0; i < site.count; i++) {
          perDay.set(schedule.placedDay[i], (perDay.get(schedule.placedDay[i]) ?? 0) + 1);
        }
        expect(schedule.buildDays).toBe(Math.ceil(site.count / BUILD.unitsPerDay));
        expect(schedule.buildDays).toBeGreaterThanOrEqual(395);
        expect(schedule.buildDays).toBeLessThanOrEqual(405);
        for (let d = 1; d < schedule.buildDays; d++) expect(perDay.get(d)).toBe(BUILD.unitsPerDay);
        expect(schedule.lastDay).toBe(schedule.buildDays + BUILD.placeToCommissionDays);
      });

      it('commissions every unit placeToCommissionDays after placing it', () => {
        for (let i = 0; i < site.count; i += 97) {
          expect(schedule.commissionDay[i] - schedule.placedDay[i]).toBe(
            BUILD.placeToCommissionDays,
          );
        }
      });

      it('moves both fronts forward and keeps the edge zone near placeToCommissionDays x unitsPerDay', () => {
        let prevBuild = -Infinity;
        let prevCommission = -Infinity;
        for (let day = 1; day <= schedule.lastDay; day += 7) {
          const f = frontsAt(schedule, day);
          expect(f.buildFront).toBeGreaterThanOrEqual(prevBuild);
          expect(f.commissionFront).toBeGreaterThanOrEqual(prevCommission);
          expect(f.commissionFront).toBeLessThanOrEqual(f.buildFront);
          expect(f.workZoneEnd - f.buildFront).toBeCloseTo(BUILD.frontWorkZoneM, 6);
          prevBuild = f.buildFront;
          prevCommission = f.commissionFront;
        }
        const mid = frontsAt(schedule, 100);
        expect(mid.edgeZoneCount).toBe(BUILD.placeToCommissionDays * BUILD.unitsPerDay);
        expect(mid.placedCount).toBe(100 * BUILD.unitsPerDay);
      });

      it('has every unit commissioned on the last day and none placed on day 0', () => {
        expect(frontsAt(schedule, schedule.lastDay).commissionedCount).toBe(site.count);
        expect(frontsAt(schedule, 0).placedCount).toBe(0);
        const zonesEnd = zonesAt(schedule, schedule.lastDay);
        expect(zonesEnd.every((z) => z === Zone.Commissioned)).toBe(true);
      });

      it('classifies zones consistently with the fronts', () => {
        const day = 150;
        const zones = zonesAt(schedule, day);
        const f = frontsAt(schedule, day);
        const counts = { planned: 0, work: 0, edge: 0, done: 0 };
        for (let i = 0; i < site.count; i++) {
          const z = zones[i];
          if (z === Zone.Commissioned) counts.done++;
          else if (z === Zone.EdgeZone) counts.edge++;
          else if (z === Zone.WorkZone) {
            counts.work++;
            expect(schedule.frontKey[i]).toBeGreaterThanOrEqual(f.buildFront);
            expect(schedule.frontKey[i]).toBeLessThanOrEqual(f.workZoneEnd);
          } else counts.planned++;
        }
        expect(counts.done).toBe(f.commissionedCount);
        expect(counts.edge).toBe(f.edgeZoneCount);
        expect(counts.work).toBeGreaterThan(0);
        expect(counts.planned).toBeGreaterThan(0);
      });
    });
  }

  it('westToEast fronts are x coordinates that sweep the width of the site', () => {
    const s = buildSchedule(site, { ...BUILD, order: 'westToEast' });
    const early = frontsAt(s, 10);
    const late = frontsAt(s, s.buildDays);
    expect(s.frontKind).toBe('x');
    expect(early.buildFront).toBeLessThan(site.widthM / 10);
    expect(late.buildFront).toBeGreaterThan(site.widthM * 0.9);
    // Placed units are exactly those left of (or on) the build front.
    for (let i = 0; i < site.count; i += 53) {
      if (s.placedDay[i] <= 100)
        expect(site.centers[2 * i]).toBeLessThanOrEqual(frontsAt(s, 100).buildFront);
    }
  });

  it('southToNorth fronts are y coordinates', () => {
    const s = buildSchedule(site, { ...BUILD, order: 'southToNorth' });
    expect(s.frontKind).toBe('y');
    expect(frontsAt(s, 10).buildFront).toBeLessThan(site.heightM / 10);
    expect(frontsAt(s, s.buildDays).buildFront).toBeGreaterThan(site.heightM * 0.9);
  });

  it('fromBase builds outward in distance from the base', () => {
    const origin = { x: 0, y: site.heightM / 2 };
    const s = buildSchedule(site, { ...BUILD, order: 'fromBase' }, { origin });
    expect(s.frontKind).toBe('radial');
    const f = frontsAt(s, 100);
    for (let i = 0; i < site.count; i += 41) {
      const d = Math.hypot(site.centers[2 * i] - origin.x, site.centers[2 * i + 1] - origin.y);
      if (s.placedDay[i] <= 100) expect(d).toBeLessThanOrEqual(f.buildFront + 1e-3);
      else expect(d).toBeGreaterThanOrEqual(f.buildFront - 1e-3);
    }
  });

  it('blockSerpentine finishes a block before the next and reverses on alternate block rows', () => {
    const s = buildSchedule(site, { ...BUILD, order: 'blockSerpentine' });
    expect(s.frontKind).toBe('path');
    const blockOf = (rank: number) => site.unitBlock[s.buildOrderIds[rank]];
    // The first block (400 units = 2 days) is completed before any other block starts.
    const first = blockOf(0);
    for (let r = 0; r < site.unitsPerLane * 20; r++) expect(blockOf(r)).toBe(first);
    // On the first block row the build moves toward +x; on the second block row toward -x.
    const lastOfRow0 = site.blockCols - 1;
    const rankOfBlock = (b: number) => {
      for (let r = 0; r < site.count; r++) if (blockOf(r) === b) return r;
      return -1;
    };
    expect(rankOfBlock(1)).toBeGreaterThan(rankOfBlock(0));
    expect(rankOfBlock(lastOfRow0)).toBeGreaterThan(rankOfBlock(1));
    expect(rankOfBlock(site.blockCols + lastOfRow0)).toBeLessThan(rankOfBlock(site.blockCols));
  });
});
