// Seeded pseudo-random number generator (mulberry32) so every run of the demo is deterministic.
// Constants come from src/config/defaults.ts (MULBERRY32); no other numeric literals live here.
import { MULBERRY32 } from '../config/defaults';

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [0, n). */
  int(n: number): number;
  /** Uniform float in [min, max). */
  range(min: number, max: number): number;
  /** Standard normal sample (Box-Muller). */
  normal(): number;
  /** Fisher-Yates shuffle in place; returns the same array. */
  shuffle<T>(items: T[]): T[];
}

export function createRng(seed: number): Rng {
  const c = MULBERRY32;
  let state = seed | 0;

  function next(): number {
    state = (state + c.increment) | 0;
    let t = Math.imul(state ^ (state >>> c.shiftA), 1 | state);
    t = (t + Math.imul(t ^ (t >>> c.shiftB), c.orMask | t)) ^ t;
    return ((t ^ (t >>> c.shiftC)) >>> 0) / c.range;
  }

  function int(n: number): number {
    return Math.floor(next() * n);
  }

  function range(min: number, max: number): number {
    return min + next() * (max - min);
  }

  function normal(): number {
    const u1 = 1 - next(); // (0, 1], avoids log(0)
    const u2 = next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  function shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = int(i + 1);
      const tmp = items[i];
      items[i] = items[j];
      items[j] = tmp;
    }
    return items;
  }

  return { next, int, range, normal, shuffle };
}
