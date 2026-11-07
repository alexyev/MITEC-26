import { describe, expect, it } from 'vitest';
import { PERF_TARGETS_MS, SITE } from '../src/config/defaults';
import { generateSite } from '../src/engine/site';

describe('generateSite (default 2,000 acre site)', () => {
  const site = generateSite();

  it('count is within 2% of the target', () => {
    expect(Math.abs(site.count - SITE.targetUnits) / SITE.targetUnits).toBeLessThan(0.02);
    expect(site.centers.length).toBe(2 * site.count);
    expect(site.warnings).toEqual([]);
  });

  it('has the expected block, lane and pitch structure', () => {
    expect(site.blockCols).toBe(13);
    expect(site.cols).toBe(260);
    expect(site.rows).toBe(308);
    expect(site.rowPitchM).toBeGreaterThan(5.5);
    expect(site.rowPitchM).toBeLessThan(6.5);
    expect(site.widthM).toBeCloseTo(4023, -1);
    expect(site.heightM).toBeCloseTo(2012, -1);
  });

  it('gives every unit a valid lane id and position', () => {
    const laneCounts = new Int32Array(site.laneCount);
    for (let i = 0; i < site.count; i++) {
      const lane = site.unitLane[i];
      expect(lane).toBeGreaterThanOrEqual(0);
      expect(lane).toBeLessThan(site.laneCount);
      expect(site.unitPosInLane[i]).toBeGreaterThanOrEqual(0);
      expect(site.unitPosInLane[i]).toBeLessThan(site.unitsPerLane);
      laneCounts[lane]++;
    }
    for (let l = 0; l < site.laneCount; l++) expect(laneCounts[l]).toBe(site.unitsPerLane);
  });

  it('keeps unit x identical from lane to lane (straight column corridors)', () => {
    for (let c = 0; c < site.cols; c++) {
      const x0 = site.centers[2 * c];
      for (let r = 1; r < site.rows; r++) {
        expect(site.centers[2 * (r * site.cols + c)]).toBe(x0);
      }
    }
  });

  it('keeps units in a lane at a constant pitch inside a block and aligns blocks across roads', () => {
    // Row 0 and the last row (different block rows) share exactly the same x positions.
    const last = (site.rows - 1) * site.cols;
    for (let c = 0; c < site.cols; c++) {
      expect(site.centers[2 * (last + c)]).toBe(site.centers[2 * c]);
    }
    for (let c = 1; c < site.cols; c++) {
      if (c % site.unitsPerLane !== 0) {
        expect(site.centers[2 * c] - site.centers[2 * (c - 1)]).toBeCloseTo(site.unitPitchM, 3);
      }
    }
    // Block columns are separated by exactly one road width of extra space.
    const crossRoad =
      site.centers[2 * site.unitsPerLane] - site.centers[2 * (site.unitsPerLane - 1)];
    expect(crossRoad).toBeCloseTo(site.unitPitchM + site.roadWidthM, 3);
  });

  it('stores corridor coordinates between units and between lanes', () => {
    expect(site.columnCorridorX.length).toBe(site.cols);
    expect(site.laneCorridorY.length).toBe(site.rows);
    for (let c = 0; c + 1 < site.cols; c++) {
      expect(site.columnCorridorX[c]).toBeGreaterThan(site.centers[2 * c]);
      expect(site.columnCorridorX[c]).toBeLessThan(site.centers[2 * (c + 1)]);
    }
    for (let r = 0; r + 1 < site.rows; r++) {
      const y = site.centers[2 * (r * site.cols) + 1];
      const yNext = site.centers[2 * ((r + 1) * site.cols) + 1];
      expect(site.laneCorridorY[r]).toBeGreaterThan(y);
      expect(site.laneCorridorY[r]).toBeLessThan(yNext);
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

  it('generates 80,000 units in under the section 9 target', () => {
    const start = performance.now();
    generateSite();
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(PERF_TARGETS_MS.siteGeneration);
  });
});

describe('generateSite (other settings)', () => {
  it('supports north-south lanes by swapping axes', () => {
    const site = generateSite({ ...SITE, laneAxis: 'NS' });
    expect(Math.abs(site.count - SITE.targetUnits) / SITE.targetUnits).toBeLessThan(0.02);
    // Units in one lane share the same x and run along y.
    const id = 0;
    const next = 1;
    expect(site.centers[2 * id]).toBe(site.centers[2 * next]);
    expect(site.centers[2 * next + 1]).toBeGreaterThan(site.centers[2 * id + 1]);
  });

  it('warns and reduces the count when rows do not fit', () => {
    const site = generateSite({ ...SITE, targetUnits: 500_000 });
    expect(site.warnings.length).toBeGreaterThan(0);
    expect(site.count).toBeLessThan(500_000);
    expect(site.rowPitchM).toBeGreaterThanOrEqual(SITE.unitDepthM + SITE.minRowClearanceM);
  });

  it('handles a tiny site', () => {
    const site = generateSite({ ...SITE, areaAcres: 5, targetUnits: 100 });
    expect(site.count).toBeGreaterThan(0);
    expect(site.count % site.cols).toBe(0);
  });
});
