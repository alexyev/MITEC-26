import { describe, expect, it } from 'vitest';
import { PERF_TARGETS_MS, SITE } from '../src/config/defaults';
import { generateSite, unitGridRect } from '../src/engine/site';
import type { Site } from '../src/engine/types';

/** Lane-frame helpers: u runs along the lanes, v across them (world y and x for north-south lanes). */
function frame(site: Site) {
  const ew = site.laneAxis === 'EW';
  const u = (id: number) => site.centers[2 * id + (ew ? 0 : 1)];
  const v = (id: number) => site.centers[2 * id + (ew ? 1 : 0)];
  const byCell = new Map<number, number>();
  for (let i = 0; i < site.count; i++) byCell.set(site.unitRow[i] * site.cols + site.unitCol[i], i);
  /** Unit id at lane row r, unit column c, or undefined inside the base pad. */
  const at = (r: number, c: number) => byCell.get(r * site.cols + c);
  return { ew, u, v, at };
}

describe('generateSite (default 2,000 acre site)', () => {
  const site = generateSite();
  const { u, v, at } = frame(site);
  const rowV = (r: number) => v(at(r, 0)!);
  const colU = (c: number) => u(at(0, c)!);

  it('has exactly 23,000 units', () => {
    expect(SITE.targetUnits).toBe(23_000);
    expect(site.count).toBe(23_000);
    expect(site.centers.length).toBe(2 * site.count);
    expect(site.warnings).toEqual([]);
  });

  it('stands every unit with its long axis north-south (lanes run north-south, D33)', () => {
    expect(site.laneAxis).toBe('NS');
    // Units of one lane share x and follow each other along y.
    const a = at(0, 0)!;
    const b = at(0, 1)!;
    expect(site.centers[2 * a]).toBe(site.centers[2 * b]);
    expect(site.centers[2 * b + 1] - site.centers[2 * a + 1]).toBeCloseTo(site.unitPitchM, 3);
  });

  it('has the expected block, lane and pitch structure', () => {
    expect(site.blockCols).toBe(5);
    expect(site.cols).toBe(125);
    expect(site.rows).toBe(186);
    expect(site.blockRows).toBe(10);
    expect(site.rowPitchM).toBeGreaterThan(20);
    expect(site.rowPitchM).toBeLessThan(22);
    expect(site.widthM).toBeCloseTo(4023, -1);
    expect(site.heightM).toBeCloseTo(2012, -1);
  });

  it('spreads the lanes evenly over the block rows (18 or 19 lanes each)', () => {
    const lanesPerBlockRow = new Map<number, number>();
    for (let r = 0; r < site.rows; r++) {
      const blockRow = Math.floor(site.unitBlock[at(r, 0)!] / site.blockCols);
      lanesPerBlockRow.set(blockRow, (lanesPerBlockRow.get(blockRow) ?? 0) + 1);
    }
    expect([...lanesPerBlockRow.values()].every((n) => n === 18 || n === 19)).toBe(true);
    expect(lanesPerBlockRow.size).toBe(site.blockRows);
  });

  it('keeps one lane pitch everywhere and puts each block-row road inside a lane corridor', () => {
    for (let r = 1; r < site.rows; r++)
      expect(rowV(r) - rowV(r - 1)).toBeCloseTo(site.rowPitchM, 3);
    // Block-row roads run along the lanes: north-south, so taller than wide.
    const blockRowRoads = site.roads.filter((road) => road.h > road.w);
    expect(blockRowRoads.length).toBe(site.blockRows - 1);
    for (const road of blockRowRoads) {
      expect(road.w).toBe(SITE.roadWidthM);
      for (let r = 0; r < site.rows; r++) {
        const before = rowV(r) + SITE.unitDepthM / 2 <= road.x + 1e-3;
        const after = rowV(r) - SITE.unitDepthM / 2 >= road.x + road.w - 1e-3;
        expect(before || after).toBe(true);
      }
    }
  });

  it('gives every unit a valid lane id and position, and every lane its units outside the pad', () => {
    const laneCounts = new Int32Array(site.laneCount);
    for (let i = 0; i < site.count; i++) {
      const lane = site.unitLane[i];
      expect(lane).toBeGreaterThanOrEqual(0);
      expect(lane).toBeLessThan(site.laneCount);
      expect(site.unitPosInLane[i]).toBeGreaterThanOrEqual(0);
      expect(site.unitPosInLane[i]).toBeLessThan(site.unitsPerLane);
      laneCounts[lane]++;
    }
    const counts = new Set(laneCounts);
    // A lane through the pad is a whole block long, so it is empty; every other lane is full.
    expect(counts).toEqual(new Set([0, site.unitsPerLane]));
    const empty = laneCounts.filter((n) => n === 0).length;
    expect(empty * site.unitsPerLane).toBe(SITE.basePadLanes * SITE.basePadUnits);
  });

  it('keeps units on straight column corridors from lane to lane', () => {
    for (let c = 0; c < site.cols; c++) {
      const u0 = colU(c);
      for (let r = 1; r < site.rows; r++) {
        const id = at(r, c);
        if (id !== undefined) expect(u(id)).toBe(u0);
      }
    }
  });

  it('keeps units in a lane at a constant pitch inside a block and aligns blocks across roads', () => {
    for (let c = 1; c < site.cols; c++) {
      if (c % site.unitsPerLane !== 0) {
        expect(colU(c) - colU(c - 1)).toBeCloseTo(site.unitPitchM, 3);
      }
    }
    // Block columns are separated by exactly one road width of extra space.
    const crossRoad = colU(site.unitsPerLane) - colU(site.unitsPerLane - 1);
    expect(crossRoad).toBeCloseTo(site.unitPitchM + site.roadWidthM, 3);
  });

  it('stores corridor coordinates between units and between lanes', () => {
    expect(site.columnCorridorX.length).toBe(site.cols);
    expect(site.laneCorridorY.length).toBe(site.rows);
    for (let c = 0; c + 1 < site.cols; c++) {
      expect(site.columnCorridorX[c]).toBeGreaterThan(colU(c));
      expect(site.columnCorridorX[c]).toBeLessThan(colU(c + 1));
    }
    for (let r = 0; r + 1 < site.rows; r++) {
      expect(site.laneCorridorY[r]).toBeGreaterThan(rowV(r));
      expect(site.laneCorridorY[r]).toBeLessThan(rowV(r + 1));
    }
  });

  it('gives the base its own pad at the center, with no unit on or over it (D34)', () => {
    const pad = site.basePad!;
    expect(pad).not.toBeNull();
    expect(site.base.x).toBeCloseTo(pad.x + pad.w / 2, 6);
    expect(site.base.y).toBeCloseTo(pad.y + pad.h / 2, 6);
    // Centered in the unit grid, and larger than a block of units in both directions.
    const grid = unitGridRect(site);
    expect(Math.abs(site.base.x - (grid.x + grid.w / 2))).toBeLessThan(1);
    expect(Math.abs(site.base.y - (grid.y + grid.h / 2))).toBeLessThan(1);
    expect(pad.w).toBeGreaterThan(200);
    expect(pad.h).toBeGreaterThan(site.blockWidthM);
    // No unit footprint overlaps the pad (units are 2.44 m wide in x and 12.2 m long in y).
    const hw = SITE.unitDepthM / 2;
    const hh = SITE.unitWidthM / 2;
    for (let i = 0; i < site.count; i++) {
      const x = site.centers[2 * i];
      const y = site.centers[2 * i + 1];
      const overlaps =
        x + hw > pad.x && x - hw < pad.x + pad.w && y + hh > pad.y && y - hh < pad.y + pad.h;
      expect(overlaps).toBe(false);
    }
  });

  it('keeps every unit inside the site and creates roads between blocks', () => {
    for (let i = 0; i < site.count; i++) {
      expect(site.centers[2 * i]).toBeGreaterThan(0);
      expect(site.centers[2 * i]).toBeLessThan(site.widthM);
      expect(site.centers[2 * i + 1]).toBeGreaterThan(0);
      expect(site.centers[2 * i + 1]).toBeLessThan(site.heightM);
    }
    expect(site.roads.length).toBe(site.blockCols - 1 + site.blockRows - 1);
  });

  it('generates 23,000 units in under the section 9 target', () => {
    const start = performance.now();
    generateSite();
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(PERF_TARGETS_MS.siteGeneration);
  });
});

describe('generateSite (other settings)', () => {
  it('supports east-west lanes by swapping axes, also with exactly the target count', () => {
    const site = generateSite({ ...SITE, laneAxis: 'EW' });
    expect(site.count).toBe(SITE.targetUnits);
    const { at } = frame(site);
    const a = at(0, 0)!;
    const b = at(0, 1)!;
    expect(site.centers[2 * a + 1]).toBe(site.centers[2 * b + 1]);
    expect(site.centers[2 * b]).toBeGreaterThan(site.centers[2 * a]);
  });

  it('can leave out the base pad', () => {
    const site = generateSite({ ...SITE, basePadLanes: 0 });
    expect(site.basePad).toBeNull();
    expect(site.count).toBe(SITE.targetUnits);
    expect(site.rows * site.cols).toBe(site.count);
    expect(site.base).toEqual({ x: site.widthM / 2, y: site.heightM / 2 });
  });

  it('warns and reduces the count when rows do not fit', () => {
    const site = generateSite({ ...SITE, targetUnits: 500_000 });
    expect(site.warnings.length).toBeGreaterThan(0);
    expect(site.count).toBeLessThan(500_000);
    expect(site.rowPitchM).toBeGreaterThanOrEqual(SITE.unitDepthM + SITE.minRowClearanceM);
  });

  it('handles a tiny site without a pad', () => {
    const site = generateSite({ ...SITE, areaAcres: 5, targetUnits: 100 });
    expect(site.count).toBeGreaterThan(0);
    expect(site.basePad).toBeNull();
    expect(site.count % site.cols).toBe(0);
  });
});
