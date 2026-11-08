import { describe, expect, it } from 'vitest';
import { BUILD } from '../src/config/defaults';
import { buildSchedule, faceZonesAt, frontsAt, zonesAt } from '../src/engine/schedule';
import { generateSite } from '../src/engine/site';
import type { BuildOrder } from '../src/engine/types';
import { Zone } from '../src/engine/types';

const site = generateSite();
const ORDERS: BuildOrder[] = [
  'centerOut',
  'westToEast',
  'southToNorth',
  'fromBase',
  'blockSerpentine',
];

describe('buildSchedule', () => {
  for (const order of ORDERS) {
    describe(order, () => {
      const schedule = buildSchedule(site, { ...BUILD, order });

      it('places unitsPerDay units per day and takes 115 days', () => {
        const perDay = new Map<number, number>();
        for (let i = 0; i < site.count; i++) {
          perDay.set(schedule.placedDay[i], (perDay.get(schedule.placedDay[i]) ?? 0) + 1);
        }
        expect(schedule.buildDays).toBe(Math.ceil(site.count / BUILD.unitsPerDay));
        expect(schedule.buildDays).toBe(115);
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
        const day = 60;
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

  describe('centerOut (default)', () => {
    const s = buildSchedule(site);
    const ux = (i: number) => site.centers[2 * i];
    // Unit columns are the distinct unit x values; mirrored columns form the pairs the build advances by.
    const xs = [...new Set(Array.from({ length: site.count }, (_, i) => ux(i)))].sort(
      (a, b) => a - b,
    );
    const perX = new Map<number, number>();
    for (let i = 0; i < site.count; i++) perX.set(ux(i), (perX.get(ux(i)) ?? 0) + 1);
    /** Units in each column pair, from the center out. */
    const pairSizes: number[] = [];
    for (let k = Math.floor(xs.length / 2) - 1; k >= 0; k--) {
      pairSizes.push(perX.get(xs[k])! + perX.get(xs[xs.length - 1 - k])!);
    }
    const pairEnds = pairSizes.reduce<number[]>((acc, n) => [...acc, (acc.at(-1) ?? 0) + n], []);

    it('is the default order and starts at the center line of the site', () => {
      expect(BUILD.order).toBe('centerOut');
      expect(s.frontKind).toBe('centerX');
      // The block grid is centered in the site (D3); its trailing 2 m gap puts the unit centers 1 m west.
      expect(Math.abs(s.centerX - site.widthM / 2)).toBeLessThanOrEqual(1.01);
      // The first units built are the two innermost unit columns, one on each side of the center line.
      const innermost = Math.abs(xs[xs.length / 2] - s.centerX);
      for (let rank = 0; rank < pairSizes[0]; rank++) {
        expect(Math.abs(ux(s.buildOrderIds[rank]) - s.centerX)).toBeCloseTo(innermost, 3);
      }
      // Day 1 splits evenly between the west and the east face.
      let west = 0;
      let east = 0;
      for (let i = 0; i < site.count; i++) {
        if (s.placedDay[i] !== 1) continue;
        if (ux(i) < s.centerX) west++;
        else east++;
      }
      expect(west).toBe(BUILD.unitsPerDay / 2);
      expect(east).toBe(BUILD.unitsPerDay / 2);
    });

    it('moves both faces outward symmetrically as the day advances', () => {
      let prev = faceZonesAt(s, 0);
      for (let day = 1; day <= s.lastDay; day += 5) {
        const z = faceZonesAt(s, day);
        const c = s.centerX;
        expect(z.west.buildFrontX).toBeLessThanOrEqual(prev.west.buildFrontX);
        expect(z.east.buildFrontX).toBeGreaterThanOrEqual(prev.east.buildFrontX);
        expect(c - z.west.buildFrontX).toBeCloseTo(z.east.buildFrontX - c, 6);
        expect(c - z.west.commissionFrontX).toBeCloseTo(z.east.commissionFrontX - c, 6);
        // Order on each face from the center outward: commission front, build front, work-zone end.
        expect(z.west.commissionFrontX).toBeGreaterThanOrEqual(z.west.buildFrontX);
        expect(z.west.buildFrontX - z.west.workZoneEndX).toBeCloseTo(BUILD.frontWorkZoneM, 6);
        expect(z.east.commissionFrontX).toBeLessThanOrEqual(z.east.buildFrontX);
        expect(z.east.workZoneEndX - z.east.buildFrontX).toBeCloseTo(BUILD.frontWorkZoneM, 6);
        prev = z;
      }
      const end = faceZonesAt(s, s.buildDays);
      expect(end.west.buildFrontX).toBeLessThan(site.widthM * 0.1);
      expect(end.east.buildFrontX).toBeGreaterThan(site.widthM * 0.9);
    });

    it('places exactly the units within the build front on both faces', () => {
      const day = 60;
      const z = faceZonesAt(s, day);
      for (let i = 0; i < site.count; i += 37) {
        const x = ux(i);
        const inside = x >= z.west.buildFrontX - 1e-3 && x <= z.east.buildFrontX + 1e-3;
        if (s.placedDay[i] <= day) expect(inside).toBe(true);
        const strictlyInside = x > z.west.buildFrontX + 1e-3 && x < z.east.buildFrontX - 1e-3;
        if (strictlyInside) expect(s.placedDay[i]).toBeLessThanOrEqual(day);
      }
    });

    it('advances column pair by column pair: each face is a straight north-south front', () => {
      // After k full column pairs, exactly the units of the k innermost columns on each face are placed.
      for (const pairs of [3, 10, 40]) {
        const inner = new Set(xs.slice(xs.length / 2 - pairs, xs.length / 2 + pairs));
        const placed = new Set(Array.from(s.buildOrderIds.subarray(0, pairEnds[pairs - 1])));
        for (let i = 0; i < site.count; i++) expect(placed.has(i)).toBe(inner.has(ux(i)));
      }
      // Within a day the build alternates west and east, so the faces never differ by more than one unit.
      for (let day = 1; day <= s.buildDays; day += 11) {
        let west = 0;
        let east = 0;
        for (let i = 0; i < site.count; i++) {
          if (s.placedDay[i] > day) continue;
          if (ux(i) < s.centerX) west++;
          else east++;
        }
        expect(Math.abs(west - east)).toBeLessThanOrEqual(1);
      }
    });

    it('has an edge zone on each face of about half of placeToCommissionDays x unitsPerDay', () => {
      const half = (BUILD.placeToCommissionDays * BUILD.unitsPerDay) / 2;
      for (const day of [20, 60, 100]) {
        const zones = zonesAt(s, day);
        let west = 0;
        let east = 0;
        for (let i = 0; i < site.count; i++) {
          if (zones[i] !== Zone.EdgeZone) continue;
          if (ux(i) < s.centerX) west++;
          else east++;
        }
        expect(Math.abs(west - half)).toBeLessThanOrEqual(1);
        expect(Math.abs(east - half)).toBeLessThanOrEqual(1);
      }
    });

    it('flags a commission front that runs through a partly commissioned column pair', () => {
      const ends = new Set(pairEnds);
      let partial = 0;
      for (let day = BUILD.placeToCommissionDays + 1; day < s.buildDays; day++) {
        const f = frontsAt(s, day);
        expect(f.commissionFrontPartial).toBe(!ends.has(f.commissionedCount));
        if (f.commissionFrontPartial) partial++;
      }
      expect(partial).toBeGreaterThan(0);
      expect(frontsAt(s, 0).commissionFrontPartial).toBe(false);
      expect(frontsAt(s, s.lastDay).commissionFrontPartial).toBe(false);
    });

    it('refuses face zones for single-front orders', () => {
      expect(() =>
        faceZonesAt(buildSchedule(site, { ...BUILD, order: 'westToEast' }), 1),
      ).toThrow();
    });
  });

  it('fromBase defaults to an origin at the site center: the first unit is the nearest to it', () => {
    const s = buildSchedule(site, { ...BUILD, order: 'fromBase' });
    const d = (i: number) =>
      Math.hypot(site.centers[2 * i] - site.widthM / 2, site.centers[2 * i + 1] - site.heightM / 2);
    let nearest = Infinity;
    for (let i = 0; i < site.count; i++) nearest = Math.min(nearest, d(i));
    expect(d(s.buildOrderIds[0])).toBeCloseTo(nearest, 3);
  });

  it('westToEast fronts are x coordinates that sweep the width of the site', () => {
    const s = buildSchedule(site, { ...BUILD, order: 'westToEast' });
    const early = frontsAt(s, 5);
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
    expect(frontsAt(s, 5).buildFront).toBeLessThan(site.heightM / 10);
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
    // The first block is completed before any other block starts.
    const first = blockOf(0);
    let firstBlockSize = 0;
    for (let i = 0; i < site.count; i++) if (site.unitBlock[i] === first) firstBlockSize++;
    expect(firstBlockSize).toBeGreaterThan(site.unitsPerLane);
    for (let r = 0; r < firstBlockSize; r++) expect(blockOf(r)).toBe(first);
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
