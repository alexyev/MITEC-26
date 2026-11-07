import { describe, expect, it } from 'vitest';
import { createRng } from '../src/engine/rng';

describe('rng', () => {
  it('is deterministic for a seed and differs between seeds', () => {
    const a = createRng(42);
    const b = createRng(42);
    const c = createRng(43);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    const seqC = Array.from({ length: 20 }, () => c.next());
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
  });

  it('stays in [0, 1) with a roughly uniform mean', () => {
    const rng = createRng(7);
    let sum = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    expect(sum / n).toBeGreaterThan(0.49);
    expect(sum / n).toBeLessThan(0.51);
  });

  it('int, range and shuffle respect their bounds', () => {
    const rng = createRng(1);
    for (let i = 0; i < 1000; i++) {
      const k = rng.int(5);
      expect(Number.isInteger(k) && k >= 0 && k < 5).toBe(true);
      const r = rng.range(10, 20);
      expect(r >= 10 && r < 20).toBe(true);
    }
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = createRng(3).shuffle([...arr]);
    expect([...shuffled].sort((x, y) => x - y)).toEqual(arr);
  });

  it('normal has mean near 0 and deviation near 1', () => {
    const rng = createRng(11);
    const n = 20000;
    let s = 0;
    let s2 = 0;
    for (let i = 0; i < n; i++) {
      const v = rng.normal();
      s += v;
      s2 += v * v;
    }
    expect(Math.abs(s / n)).toBeLessThan(0.05);
    expect(Math.abs(s2 / n - 1)).toBeLessThan(0.05);
  });
});
