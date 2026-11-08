// The desert backdrop's textures (D101): seeded, periodic gradient noise turned into three layers of ground
// that tile seamlessly (relief and washes, rills and ripples, scrub and pebbles), each with its mip levels.
// Pure functions of the config, the seed and the palette, so they run in a worker and in tests alike.
import { TERRAIN, TERRAIN_HASH, type TerrainLayerConfig } from '../../config/terrain';
import { createRng } from '../../engine/rng';

export type Rgb = readonly [number, number, number];

/** Ground colors from tokens.css (`--c-ground-*`), as 0-255 channels. */
export interface TerrainPalette {
  /** Dark gravel and pale sand: the two ends of the ground's tone. */
  gravel: Rgb;
  sand: Rgb;
  /** The bed of a dry wash: the palest ground. */
  wash: Rgb;
  /** What the detail layer adds on lit slopes and in shade. */
  light: Rgb;
  shadow: Rgb;
  /** Bushes, and pebbles light and dark. */
  scrub: Rgb;
  pebbleLight: Rgb;
  pebbleDark: Rgb;
}

/** A layer and its mip levels: level k is `size >> k` texels square, RGBA, not premultiplied. */
export interface TerrainLayer {
  periodM: number;
  size: number;
  levels: Texels[];
}

/** RGBA texels, not premultiplied. */
export type Texels = Uint8ClampedArray<ArrayBuffer>;

export type TerrainLayerName = 'macro' | 'detail' | 'scrub';

// ---------------------------------------------------------------------------
// Periodic gradient noise
// ---------------------------------------------------------------------------

export interface Noise {
  /**
   * Gradient noise at lattice point (x, y), repeating every `period` cells along x and `periodY` along y;
   * about -0.7 to 0.7.
   */
  at(x: number, y: number, period: number, seed: number, periodY?: number): number;
  /**
   * Fractal sum over the tile (u and v in tile units, 0 to 1): `cells` lattice cells across for the first
   * octave, twice as many for each next one, each `gain` times as strong; it repeats with the tile.
   */
  fbm(u: number, v: number, cells: number, octaves: number, gain: number, seed: number): number;
}

export function createNoise(): Noise {
  const H = TERRAIN_HASH;
  const n = H.gradients;
  const gx = new Float64Array(n);
  const gy = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    gx[k] = Math.cos((2 * Math.PI * k) / n);
    gy[k] = Math.sin((2 * Math.PI * k) / n);
  }
  const mask = n - 1;
  const hash = (ix: number, iy: number, seed: number): number => {
    let h = Math.imul(ix, H.mulX) ^ Math.imul(iy, H.mulY) ^ Math.imul(seed, H.mulSeed);
    h = Math.imul(h ^ (h >>> H.shiftA), H.mixA);
    h = Math.imul(h ^ (h >>> H.shiftB), H.mixB);
    return (h ^ (h >>> H.shiftC)) & mask;
  };
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

  const at = (x: number, y: number, period: number, seed: number, periodY = period): number => {
    const xf = Math.floor(x);
    const yf = Math.floor(y);
    const fx = x - xf;
    const fy = y - yf;
    const i0 = ((xf % period) + period) % period;
    const j0 = ((yf % periodY) + periodY) % periodY;
    const i1 = i0 + 1 === period ? 0 : i0 + 1;
    const j1 = j0 + 1 === periodY ? 0 : j0 + 1;
    const a = hash(i0, j0, seed);
    const b = hash(i1, j0, seed);
    const c = hash(i0, j1, seed);
    const d = hash(i1, j1, seed);
    const n00 = gx[a] * fx + gy[a] * fy;
    const n10 = gx[b] * (fx - 1) + gy[b] * fy;
    const n01 = gx[c] * fx + gy[c] * (fy - 1);
    const n11 = gx[d] * (fx - 1) + gy[d] * (fy - 1);
    const u = fade(fx);
    const top = n00 + (n10 - n00) * u;
    const bottom = n01 + (n11 - n01) * u;
    return top + (bottom - top) * fade(fy);
  };

  const fbm = (
    u: number,
    v: number,
    cells: number,
    octaves: number,
    gain: number,
    seed: number,
  ): number => {
    let sum = 0;
    let amp = 1;
    let norm = 0;
    let c = cells;
    for (let o = 0; o < octaves; o++) {
      sum += amp * at(u * c, v * c, c, seed + o);
      norm += amp;
      amp *= gain;
      c *= 2;
    }
    return sum / norm;
  };

  return { at, fbm };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Seeds of the independent noise fields, apart enough that their octaves never share a seed. */
const FIELD = {
  warpU: 0,
  warpV: 16,
  relief: 32,
  wash: 48,
  hill: 64,
  ridge: 72,
  tone: 80,
  rill: 96,
  ripple: 112,
};

/** The light direction as a unit vector in texture space (x east, y south, z up). */
function lightVector(): [number, number, number] {
  const az = (TERRAIN.light.azimuthDeg * Math.PI) / 180;
  const alt = (TERRAIN.light.altitudeDeg * Math.PI) / 180;
  return [Math.cos(alt) * Math.sin(az), -Math.cos(alt) * Math.cos(az), Math.sin(alt)];
}

/**
 * Hillshade of a periodic height field, relative to flat ground: 0 on the flat, above 0 on slopes that face
 * the light, below 0 on slopes that face away. Heights are in units of `scale` texels.
 */
export function hillshade(h: Float32Array, size: number, scale: number): Float32Array {
  const [lx, ly, lz] = lightVector();
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const up = ((y - 1 + size) % size) * size;
    const down = ((y + 1) % size) * size;
    const row = y * size;
    for (let x = 0; x < size; x++) {
      const left = (x - 1 + size) % size;
      const right = (x + 1) % size;
      const dx = ((h[row + right] - h[row + left]) / 2) * scale;
      const dy = ((h[down + x] - h[up + x]) / 2) * scale;
      const len = Math.hypot(dx, dy, 1);
      out[row + x] = (-dx * lx - dy * ly + lz) / len / lz - 1;
    }
  }
  return out;
}

/** Mip levels by a 2 x 2 box filter that wraps, so every level tiles too (alpha-weighted color). */
export function mipLevels(base: Texels, size: number, count: number): Texels[] {
  const levels = [base];
  let src = base;
  let s = size;
  for (let k = 0; k < count && s > 1; k++) {
    const half = s >> 1;
    const dst = new Uint8ClampedArray(half * half * 4);
    for (let y = 0; y < half; y++) {
      for (let x = 0; x < half; x++) {
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;
        for (const [ox, oy] of QUAD) {
          const i = ((2 * y + oy) * s + 2 * x + ox) * 4;
          const w = src[i + 3];
          r += src[i] * w;
          g += src[i + 1] * w;
          b += src[i + 2] * w;
          a += w;
        }
        const o = (y * half + x) * 4;
        if (a > 0) {
          dst[o] = r / a;
          dst[o + 1] = g / a;
          dst[o + 2] = b / a;
        }
        dst[o + 3] = a / QUAD.length;
      }
    }
    levels.push(dst);
    src = dst;
    s = half;
  }
  return levels;
}
const QUAD = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
] as const;

function layerOf(cfg: TerrainLayerConfig, base: Texels): TerrainLayer {
  return { periodM: cfg.periodM, size: cfg.px, levels: mipLevels(base, cfg.px, cfg.mips) };
}

// ---------------------------------------------------------------------------
// The layers
// ---------------------------------------------------------------------------

/**
 * Anisotropic fractal noise over the tile, sheared so its features run along the diagonal u + v = const
 * (northeast to southwest on the map): `along` cells along that diagonal's normal and `across` cells along v.
 * The shear has integer coefficients, so the field still repeats with the tile.
 */
function flowField(
  noise: Noise,
  u: number,
  v: number,
  along: number,
  across: number,
  octaves: number,
  seed: number,
): number {
  const a = u + v;
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let ca = along;
  let cb = across;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise.at(a * ca, v * cb, ca, seed + o, cb);
    norm += amp;
    amp *= 0.5;
    ca *= 2;
    cb *= 2;
  }
  return sum / norm;
}

/** 1 on the zero line of a field, falling to 0 at `width` from it: a channel. */
const channel = (field: number, width: number) =>
  1 - smoothstep(width * 0.35, width, Math.abs(field));

/**
 * The ground's large shapes (opaque): rolling relief with ridged hills in places, lit from the northwest,
 * patches of pale sand and darker gravel, and the major washes, running northeast to southwest with pale beds.
 */
export function macroLayer(
  palette: TerrainPalette,
  seed = TERRAIN.seed,
  m: typeof TERRAIN.macro = TERRAIN.macro,
): TerrainLayer {
  const size = m.layer.px;
  const noise = createNoise();
  const h = new Float32Array(size * size);
  const bed = new Float32Array(size * size);
  const tone = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const v = (y + 0.5) / size;
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;
      const wu =
        u + m.warpTile * noise.fbm(u, v, m.warpCells, m.warpOctaves, 0.5, seed + FIELD.warpU);
      const wv =
        v + m.warpTile * noise.fbm(u, v, m.warpCells, m.warpOctaves, 0.5, seed + FIELD.warpV);
      const relief = noise.fbm(
        wu,
        wv,
        m.reliefCells,
        m.reliefOctaves,
        m.reliefGain,
        seed + FIELD.relief,
      );
      const hills = smoothstep(
        m.hills.from,
        m.hills.to,
        noise.fbm(u, v, m.hillCells, 2, 0.5, seed + FIELD.hill),
      );
      let ridge = 0;
      if (hills > 0) {
        const r =
          1 -
          2 * Math.abs(noise.fbm(wu, wv, m.ridgeCells, m.ridgeOctaves, 0.5, seed + FIELD.ridge));
        ridge = hills * r * r;
      }
      const i = y * size + x;
      h[i] = relief + m.hills.weight * ridge;
      bed[i] = channel(
        flowField(noise, wu, wv, m.washCells, m.washCellsAcross, m.washOctaves, seed + FIELD.wash),
        m.washWidth,
      );
      tone[i] = noise.fbm(wu, wv, m.toneCells, m.toneOctaves, 0.5, seed + FIELD.tone);
    }
  }
  const shade = hillshade(h, size, m.reliefScale);
  const out = new Uint8ClampedArray(size * size * 4);
  const { gravel, sand, wash } = palette;
  for (let i = 0; i < size * size; i++) {
    const t = smoothstep(-m.toneEdge, m.toneEdge, tone[i]) * m.tone;
    const b = bed[i] * m.bed;
    const lightK = Math.max(0, 1 + m.shade * shade[i]);
    for (let c = 0; c < 3; c++) {
      const ground = mix(gravel[c], sand[c], t);
      out[i * 4 + c] = mix(ground, wash[c], b) * lightK;
    }
    out[i * 4 + 3] = 255;
  }
  return layerOf(m.layer, out);
}

/** Raise a coverage map to `a` over a soft disk of radius r texels at (cx, cy), wrapped around the tile. */
function stamp(
  cover: Float32Array,
  size: number,
  cx: number,
  cy: number,
  r: number,
  a: number,
): void {
  const reach = Math.ceil(r + 1);
  for (let y = Math.floor(cy - reach); y <= Math.ceil(cy + reach); y++) {
    for (let x = Math.floor(cx - reach); x <= Math.ceil(cx + reach); x++) {
      const k = a * (1 - smoothstep(r * 0.5, r + 0.5, Math.hypot(x + 0.5 - cx, y + 0.5 - cy)));
      if (k <= 0) continue;
      const i = (((y % size) + size) % size) * size + (((x % size) + size) % size);
      if (k > cover[i]) cover[i] = k;
    }
  }
}

/**
 * The small washes: streams traced down a meandering flow toward the southwest, widening as they go, with
 * tributaries that join them at an angle. Writes the beds and the wider fringes of scrub as coverage, 0 to 1.
 */
function traceWashes(
  noise: Noise,
  size: number,
  periodM: number,
  seed: number,
  beds: Float32Array,
  fringes: Float32Array,
  d: typeof TERRAIN.detail,
): void {
  const rng = createRng(seed + FIELD.rill);
  const texelM = periodM / size;
  const step = d.stepM / texelM;
  const base = Math.atan2(1, -1); // southwest: x west, y south
  const meander = (d.meanderDeg * Math.PI) / 180;
  const flowAt = (x: number, y: number) =>
    base + meander * 2 * noise.fbm(x / size, y / size, d.meanderCells, 2, 0.5, seed + FIELD.rill);
  /**
   * Trace a stream from (x, y) for `length` texels, its heading pulled toward the flow (against it when traced
   * upstream from a junction), and return the points it passed with their heading.
   */
  const trace = (
    x: number,
    y: number,
    heading: number,
    length: number,
    w0: number,
    w1: number,
    upstream: boolean,
  ): { x: number; y: number; h: number }[] => {
    const points: { x: number; y: number; h: number }[] = [];
    let h = heading;
    for (let t = 0; t < length; t += step) {
      const k = t / length;
      // A stream traced from its mouth upstream narrows; one traced downstream widens.
      const w = (upstream ? w1 + (w0 - w1) * k : w0 + (w1 - w0) * k) / texelM / 2;
      stamp(fringes, size, x, y, w * d.fringe, 1);
      stamp(beds, size, x, y, w, 1);
      points.push({ x, y, h });
      const flow = flowAt(x, y) + (upstream ? Math.PI : 0);
      h += Math.atan2(Math.sin(flow - h), Math.cos(flow - h)) * PULL + (rng.next() - 0.5) * JITTER;
      x += Math.cos(h) * step;
      y += Math.sin(h) * step;
    }
    return points;
  };
  for (let n = 0; n < d.streams; n++) {
    // Sources spread along the diagonal across the flow, jittered.
    const along = (n + rng.next()) / d.streams;
    const x = along * size;
    const y = along * size + rng.range(-0.5, 0.5) * size;
    const length = rng.range(d.lengthM.min, d.lengthM.max) / texelM;
    const path = trace(x, y, flowAt(x, y), length, d.widthM.from, d.widthM.to, false);
    // Tributaries branch off upstream on alternating sides.
    let side = rng.next() < 0.5 ? -1 : 1;
    let at = rng.range(d.branchEveryM.min, d.branchEveryM.max) / d.stepM;
    while (at < path.length) {
      const p = path[Math.floor(at)];
      const k = at / path.length;
      const width = (d.widthM.from + (d.widthM.to - d.widthM.from) * k) * d.branchWidth;
      const angle = p.h + Math.PI + side * ((d.branchAngleDeg * Math.PI) / 180);
      const branch = rng.range(d.branchLengthM.min, d.branchLengthM.max) / texelM;
      trace(p.x, p.y, angle, branch, d.widthM.from * d.branchWidth, width, true);
      side = -side;
      at += rng.range(d.branchEveryM.min, d.branchEveryM.max) / d.stepM;
    }
  }
}

/** How fast a stream turns toward the flow per step, and its random wobble per step, in radians. */
const PULL = 0.035;
const JITTER = 0.022;

/**
 * The drainage network, fine relief and wind ripples over the macro layer (transparent where nothing shows):
 * small braided washes with pale beds and a darker fringe of scrub, light and shade of the fine relief, and
 * ripple fields in patches.
 */
export function detailLayer(
  palette: TerrainPalette,
  seed = TERRAIN.seed,
  d: typeof TERRAIN.detail = TERRAIN.detail,
): TerrainLayer {
  const size = d.layer.px;
  const noise = createNoise();
  const h = new Float32Array(size * size);
  const beds = new Float32Array(size * size);
  const fringes = new Float32Array(size * size);
  const wave = d.rippleWave;
  for (let y = 0; y < size; y++) {
    const v = (y + 0.5) / size;
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;
      const relief = noise.fbm(u, v, d.reliefCells, d.reliefOctaves, 0.5, seed + FIELD.relief);
      // Ripples: an asymmetric wave (a gentle windward side, a steep lee) whose crests wander.
      const patch = smoothstep(
        d.ripplePatch.from,
        d.ripplePatch.to,
        noise.fbm(u, v, d.ripplePatchCells, 2, 0.5, seed + FIELD.ripple),
      );
      let ripple = 0;
      if (patch > 0) {
        const wander =
          d.rippleSinuosity * noise.fbm(u, v, d.rippleWarpCells, 2, 0.5, seed + FIELD.ripple + 8);
        const phase = wave.x * u + wave.y * v + wander / (2 * Math.PI);
        const p = phase - Math.floor(phase);
        ripple = patch * (p < 0.7 ? smoothstep(0, 0.7, p) : 1 - smoothstep(0.7, 1, p));
      }
      h[y * size + x] = relief + d.rippleDepth * ripple;
    }
  }
  traceWashes(noise, size, d.layer.periodM, seed, beds, fringes, d);
  const shade = hillshade(h, size, d.reliefScale);
  const out = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const s = shade[i];
    const o = i * 4;
    const color = s >= 0 ? palette.light : palette.shadow;
    out[o] = color[0];
    out[o + 1] = color[1];
    out[o + 2] = color[2];
    out[o + 3] = clamp01(Math.abs(s) * d.strength) * 255;
    const fringe = Math.max(0, fringes[i] - beds[i]);
    if (fringe > 0) over(out, o, palette.scrub, fringe * d.fringeAlpha);
    if (beds[i] > 0) over(out, o, palette.wash, beds[i] * d.bedAlpha);
  }
  return layerOf(d.layer, out);
}

/** Composite a straight-alpha color over a pixel of a straight-alpha buffer. */
function over(buf: Uint8ClampedArray, i: number, c: Rgb, a: number): void {
  const da = buf[i + 3] / 255;
  const oa = a + da * (1 - a);
  if (oa <= 0) return;
  for (let k = 0; k < 3; k++) buf[i + k] = (c[k] * a + buf[i + k] * da * (1 - a)) / oa;
  buf[i + 3] = oa * 255;
}

/** A soft disk of radius r texels centered on (cx, cy), wrapped around the tile's edges. */
function splat(
  buf: Uint8ClampedArray,
  size: number,
  cx: number,
  cy: number,
  r: number,
  c: Rgb,
  alpha: number,
): void {
  const reach = Math.ceil(r + 1);
  for (let y = Math.floor(cy - reach); y <= Math.ceil(cy + reach); y++) {
    for (let x = Math.floor(cx - reach); x <= Math.ceil(cx + reach); x++) {
      const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const a = alpha * (1 - smoothstep(r * 0.55, r + 0.5, dist));
      if (a <= 0) continue;
      const tx = ((x % size) + size) % size;
      const ty = ((y % size) + size) % size;
      over(buf, (ty * size + tx) * 4, c, a);
    }
  }
}

/** Scrub and pebbles over a transparent ground: bushes in loose clusters with their shadows, and grit. */
export function scrubLayer(
  palette: TerrainPalette,
  seed = TERRAIN.seed,
  s: typeof TERRAIN.scrub = TERRAIN.scrub,
): TerrainLayer {
  const size = s.layer.px;
  const texelM = s.layer.periodM / size;
  const noise = createNoise();
  const rng = createRng(seed);
  const buf = new Uint8ClampedArray(size * size * 4);
  // Pebbles first, so the bushes cover them.
  const pebbles = Math.round(((s.layer.periodM * s.layer.periodM) / 100) * s.pebblesPer100M2);
  for (let k = 0; k < pebbles; k++) {
    const r = rng.range(s.pebbleRadiusM.min, s.pebbleRadiusM.max) / texelM;
    const c = rng.next() < 0.5 ? palette.pebbleLight : palette.pebbleDark;
    splat(buf, size, rng.next() * size, rng.next() * size, r, c, s.pebbleAlpha * rng.range(0.5, 1));
  }
  const cells = Math.round(s.layer.periodM / s.cellM);
  const cellPx = size / cells;
  const bushes: { x: number; y: number; r: number }[] = [];
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      const density = noise.fbm((i + 0.5) / cells, (j + 0.5) / cells, s.densityCells, 2, 0.5, seed);
      const p = smoothstep(s.density.from, s.density.to, density) * s.density.max;
      const roll = rng.next();
      const x = (i + rng.next()) * cellPx;
      const y = (j + rng.next()) * cellPx;
      const r = rng.range(s.radiusM.min, s.radiusM.max) / texelM;
      if (roll < p) bushes.push({ x, y, r });
    }
  }
  for (const b of bushes) {
    const o = b.r * s.shadowOffset;
    splat(buf, size, b.x + o, b.y + o, b.r, palette.shadow, s.shadowAlpha);
  }
  for (const b of bushes) splat(buf, size, b.x, b.y, b.r, palette.scrub, s.bushAlpha);
  return layerOf(s.layer, buf);
}

export function terrainLayer(name: TerrainLayerName, palette: TerrainPalette): TerrainLayer {
  if (name === 'macro') return macroLayer(palette);
  if (name === 'detail') return detailLayer(palette);
  return scrubLayer(palette);
}
