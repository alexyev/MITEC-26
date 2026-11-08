import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TERRAIN } from '../src/config/terrain';
import { hexChannels, mipLevel } from '../src/ui/map/backdrop';
import {
  createNoise,
  detailLayer,
  macroLayer,
  scrubLayer,
  type TerrainLayer,
  type TerrainPalette,
  type Texels,
} from '../src/ui/map/terrain';

// D101: the desert backdrop is seeded and deterministic, tiles with no seam at any mip level, and stays quiet
// and dark under the story colors.

const CSS = readFileSync(join(__dirname, '..', 'src', 'ui', 'tokens.css'), 'utf8');
const token = (name: string) => {
  const m = CSS.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`no token ${name}`);
  return m[1].trim();
};
const ground = (name: string) => hexChannels(token(`c-ground-${name}`));
const PALETTE: TerrainPalette = {
  gravel: ground('gravel'),
  sand: ground('sand'),
  wash: ground('wash'),
  light: ground('light'),
  shadow: ground('shadow'),
  scrub: ground('scrub'),
  pebbleLight: ground('pebble-light'),
  pebbleDark: ground('pebble-dark'),
};

/** Small layers of the same design, so the tests run in milliseconds. */
const SMALL = {
  macro: { ...TERRAIN.macro, layer: { periodM: 2560, px: 128, mips: 2 } },
  detail: { ...TERRAIN.detail, layer: { periodM: 1280, px: 256, mips: 2 }, streams: 6 },
  scrub: { ...TERRAIN.scrub, layer: { periodM: 64, px: 256, mips: 3 } },
};

const lin = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
/** Relative luminance (WCAG) of 0-255 channels. */
const luminance = (r: number, g: number, b: number) =>
  0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** Alpha-weighted luminance of texel (x, y), wrapped. */
function value(t: Texels, size: number, x: number, y: number): number {
  const i = ((((y % size) + size) % size) * size + (((x % size) + size) % size)) * 4;
  return luminance(t[i], t[i + 1], t[i + 2]) * (t[i + 3] / 255);
}

/**
 * Mean difference across the wrap seam (last column to the first, last row to the first) over the mean
 * difference between neighbors inside the tile: about 1 for a tile with no seam.
 */
function seamRatio(t: Texels, size: number): number {
  let seam = 0;
  let inside = 0;
  for (let k = 0; k < size; k++) {
    seam += Math.abs(value(t, size, size - 1, k) - value(t, size, 0, k));
    seam += Math.abs(value(t, size, k, size - 1) - value(t, size, k, 0));
    const mid = size >> 1;
    inside += Math.abs(value(t, size, mid - 1, k) - value(t, size, mid, k));
    inside += Math.abs(value(t, size, k, mid - 1) - value(t, size, k, mid));
  }
  return seam / Math.max(inside, 1e-12);
}

const layers = (): Record<'macro' | 'detail' | 'scrub', TerrainLayer> => ({
  macro: macroLayer(PALETTE, TERRAIN.seed, SMALL.macro),
  detail: detailLayer(PALETTE, TERRAIN.seed, SMALL.detail),
  scrub: scrubLayer(PALETTE, TERRAIN.seed, SMALL.scrub),
});

describe('terrain noise (D101)', () => {
  it('repeats with its period, so the layers tile', () => {
    const noise = createNoise();
    for (const [x, y] of [
      [0.3, 0.7],
      [4.9, 2.2],
      [11.5, 0.05],
    ]) {
      expect(noise.at(x + 12, y, 12, 5)).toBeCloseTo(noise.at(x, y, 12, 5), 12);
      expect(noise.at(x, y + 7, 12, 5, 7)).toBeCloseTo(noise.at(x, y, 12, 5, 7), 12);
    }
    expect(noise.fbm(1.3, 2.6, 3, 5, 0.5, 9)).toBeCloseTo(noise.fbm(0.3, 0.6, 3, 5, 0.5, 9), 12);
  });
});

describe('terrain layers (D101)', () => {
  const a = layers();

  it('are the same for the same seed and differ for another', () => {
    const b = layers();
    for (const name of ['macro', 'detail', 'scrub'] as const) {
      expect(b[name].levels[0]).toEqual(a[name].levels[0]);
    }
    expect(macroLayer(PALETTE, TERRAIN.seed + 1, SMALL.macro).levels[0]).not.toEqual(
      a.macro.levels[0],
    );
  });

  it('tile with no seam at every mip level', () => {
    for (const name of ['macro', 'detail', 'scrub'] as const) {
      const l = a[name];
      expect(l.levels).toHaveLength(SMALL[name].layer.mips + 1);
      l.levels.forEach((t, k) => {
        const size = l.size >> k;
        expect(t.length).toBe(size * size * 4);
        expect(seamRatio(t, size), `${name} level ${k}`).toBeLessThan(1.6);
      });
    }
  });

  it('keep the macro layer opaque, the detail layer a partial overlay and the scrub sparse', () => {
    const alpha = (t: Texels) => {
      let sum = 0;
      for (let i = 3; i < t.length; i += 4) sum += t[i];
      return sum / (t.length / 4) / 255;
    };
    expect(alpha(a.macro.levels[0])).toBe(1);
    expect(alpha(a.detail.levels[0])).toBeLessThan(0.5);
    expect(alpha(a.scrub.levels[0])).toBeLessThan(0.3);
    // A mip level keeps the coverage of the level above it.
    expect(alpha(a.scrub.levels[1])).toBeCloseTo(alpha(a.scrub.levels[0]), 2);
  });
});

describe('a quiet desert under the story colors (D100, D101)', () => {
  const full = macroLayer(PALETTE);
  const lums: number[] = [];
  for (let i = 0; i < full.levels[0].length; i += 4) {
    const t = full.levels[0];
    lums.push(luminance(t[i], t[i + 1], t[i + 2]));
  }
  lums.sort((x, y) => x - y);
  const at = (q: number) => lums[Math.floor(q * (lums.length - 1))];

  it('stays dark and low in contrast', () => {
    expect(at(0.99)).toBeLessThan(0.05);
    expect(contrast(at(0.01), at(0.99))).toBeLessThan(2);
  });

  it('keeps every story color at least 3:1 from the lightest ground, and every unit state 2:1', () => {
    for (const t of ['signal', 'data', 'fail', 'work', 'unit', 'base']) {
      const [r, g, b] = hexChannels(token(`c-${t}`));
      expect(contrast(luminance(r, g, b), at(0.99)), t).toBeGreaterThanOrEqual(3);
    }
    for (const t of ['unit-placed', 'unit-commissioned']) {
      const [r, g, b] = hexChannels(token(`c-${t}`));
      expect(contrast(luminance(r, g, b), at(0.99)), t).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('backdrop helpers (D101)', () => {
  it('reads hex tokens as channels', () => {
    expect(hexChannels('#1a1612')).toEqual([26, 22, 18]);
    expect(hexChannels(' #FFFFFF ')).toEqual([255, 255, 255]);
    expect(() => hexChannels('transparent')).toThrow();
  });

  it('draws each layer from a mip level whose texels cover at least the minimum on screen', () => {
    const layer = { periodM: 512, size: 2048, levels: [] };
    // At the survey's fit (0.15 px per meter) a 0.25 m texel is 0.04 px: the coarsest level that is
    // allowed, 2^5 times the size.
    expect(mipLevel(layer, 0.15, 6)).toBe(5);
    // Up close (6 px per meter) the full level.
    expect(mipLevel(layer, 6, 6)).toBe(0);
    for (const s of [0.4, 0.8, 1.6, 3.2]) {
      const k = mipLevel(layer, s, 6);
      expect((layer.periodM / layer.size) * 2 ** k * s).toBeGreaterThanOrEqual(TERRAIN.minTexelPx);
    }
  });
});
