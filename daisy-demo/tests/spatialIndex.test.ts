import { describe, expect, it } from 'vitest';
import { createRng } from '../src/engine/rng';
import { buildSpatialIndex } from '../src/engine/spatialIndex';

function bruteForce(points: Float32Array, x: number, y: number, r: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < points.length / 2; i++) {
    const dx = points[2 * i] - x;
    const dy = points[2 * i + 1] - y;
    if (dx * dx + dy * dy <= r * r) out.push(i);
  }
  return out;
}

describe('spatialIndex', () => {
  it('radius query equals brute force on 10,000 points', () => {
    const rng = createRng(2026);
    const n = 10_000;
    const points = new Float32Array(2 * n);
    for (let i = 0; i < n; i++) {
      points[2 * i] = rng.range(0, 4000);
      points[2 * i + 1] = rng.range(0, 2000);
    }
    const index = buildSpatialIndex(points, 150);
    expect(index.count).toBe(n);
    for (let q = 0; q < 200; q++) {
      const x = rng.range(-100, 4100);
      const y = rng.range(-100, 2100);
      const r = rng.range(1, 600);
      const got = index.queryRadius(x, y, r).sort((a, b) => a - b);
      expect(got).toEqual(bruteForce(points, x, y, r));
    }
  });

  it('handles an empty set and a single point', () => {
    expect(buildSpatialIndex(new Float32Array(0), 10).queryRadius(0, 0, 100)).toEqual([]);
    const one = buildSpatialIndex(new Float32Array([5, 5]), 10);
    expect(one.queryRadius(5, 5, 0)).toEqual([0]);
    expect(one.queryRadius(50, 50, 1)).toEqual([]);
  });
});
