// Procedural textures of the 3D view (D122, D151, D152): the corrugated walls, the Fresnel lens grooves and
// sheen, the EXOWATT wordmark and the sand grain, made in code so the scene needs no image files.
import {
  CanvasTexture,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three';
import { createRng } from '../../engine/rng';
import { BRAND_LAYOUT } from './geometry';

const BYTE = 255;

/** A tangent-space normal (nx, ny, 1), normalized, written as RGBA bytes at `i`. */
function putNormal(data: Uint8Array, i: number, nx: number, ny: number): void {
  const len = Math.hypot(nx, ny, 1);
  data[i] = Math.round(((nx / len) * 0.5 + 0.5) * BYTE);
  data[i + 1] = Math.round(((ny / len) * 0.5 + 0.5) * BYTE);
  data[i + 2] = Math.round(((1 / len) * 0.5 + 0.5) * BYTE);
  data[i + 3] = BYTE;
}

function mipmapped(tex: DataTexture): DataTexture {
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/**
 * One ridge of a container's trapezoidal corrugation across the texture's width: flat crest, sloped flank,
 * flat trough, sloped flank. Repeated along the wall by its UVs in ridge pitches.
 */
export function corrugationNormalMap(strength: number): DataTexture {
  const w = 128;
  const h = 4;
  // Height profile over one pitch (0..1): crest 0-0.3, flank to 0.5, trough to 0.8, flank back to 1.
  const FLANK_SLOPE = 1 / 0.2;
  const height = (u: number) => {
    if (u < 0.3) return 1;
    if (u < 0.5) return 1 - (u - 0.3) / 0.2;
    if (u < 0.8) return 0;
    return (u - 0.8) / 0.2;
  };
  const data = new Uint8Array(w * h * 4);
  for (let x = 0; x < w; x++) {
    // Central difference of the profile, smoothed over a few texels so the flanks read as bends.
    let slope = 0;
    const taps = 5;
    for (let k = -taps; k <= taps; k++) {
      const u0 = ((((x + k - 0.5) / w) % 1) + 1) % 1;
      const u1 = ((((x + k + 0.5) / w) % 1) + 1) % 1;
      slope += (height(u1) - height(u0)) * w;
    }
    // Normalized so a flank's full slope tilts the normal by `strength` (about 42 degrees at 0.9).
    slope /= (2 * taps + 1) * FLANK_SLOPE;
    for (let y = 0; y < h; y++) putNormal(data, (y * w + x) * 4, -slope * strength, 0);
  }
  return mipmapped(new DataTexture(data, w, h, RGBAFormat, UnsignedByteType));
}

/**
 * A circular Fresnel lens: concentric sawtooth grooves whose slope grows toward the rim, so the light
 * catches ring by ring. Normal map over the lens face (UV 0..1).
 */
export function fresnelNormalMap(rings: number, px: number): DataTexture {
  const data = new Uint8Array(px * px * 4);
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      const u = (x + 0.5) / px - 0.5;
      const v = (y + 0.5) / px - 0.5;
      const r = Math.hypot(u, v) * 2;
      // Groove facets: the facet angle grows with the radius; a short riser at each ring's edge.
      const f = (r * rings) % 1;
      const facet = r * 0.9 * (f < 0.88 ? 1 : -6);
      const nx = r > 1e-6 ? (u / (r / 2)) * facet : 0;
      const ny = r > 1e-6 ? (v / (r / 2)) * facet : 0;
      putNormal(data, (y * px + x) * 4, nx, ny);
    }
  }
  return mipmapped(new DataTexture(data, px, px, RGBAFormat, UnsignedByteType));
}

/**
 * The light a Fresnel pane catches (D152): faint radial streaks from its center, as the grooves of a real
 * lens throw the light, over a clear base; a coverage map (opacity) for one pane (UV 0..1), repeated per pane.
 * `base` is the clear acrylic's opacity, `streak` the streaks' strongest.
 */
export function fresnelSheenMap(
  px: number,
  base: number,
  streak: number,
  seed: number,
): DataTexture {
  const rng = createRng(seed);
  const bins = 160;
  const rays = Array.from({ length: bins }, () => Math.pow(rng.next(), 5));
  const ray = (a: number) => {
    const x = ((a / (Math.PI * 2)) * bins + bins) % bins;
    const i = Math.floor(x);
    const f = x - i;
    const s = f * f * (3 - 2 * f);
    return rays[i] + (rays[(i + 1) % bins] - rays[i]) * s;
  };
  const data = new Uint8Array(px * px * 4);
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      const u = (x + 0.5) / px - 0.5;
      const v = (y + 0.5) / px - 0.5;
      const r = Math.min(1, Math.hypot(u, v) * 2);
      // Streaks fade out toward the pane's edge and stay off its very center, where the grooves are flat.
      const reach = Math.sin(Math.PI * Math.pow(r, 0.7)) * (1 - 0.35 * r);
      const glow = Math.exp(-r * r * 18) * 0.5;
      const a = base + (streak - base) * Math.min(1, ray(Math.atan2(v, u)) * reach * 1.6 + glow);
      const l = Math.round(Math.min(1, a) * BYTE);
      const i = (y * px + x) * 4;
      data[i] = l;
      data[i + 1] = l;
      data[i + 2] = l;
      data[i + 3] = BYTE;
    }
  }
  return mipmapped(new DataTexture(data, px, px, RGBAFormat, UnsignedByteType));
}

/** A stroke between two points of a letter, its ends cut level, as a filled quad. */
function slant(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width: number,
): void {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const hw = (width / 2) * (len / Math.abs(y1 - y0));
  ctx.beginPath();
  ctx.moveTo(x0 - hw, y0);
  ctx.lineTo(x0 + hw, y0);
  ctx.lineTo(x1 + hw, y1);
  ctx.lineTo(x1 - hw, y1);
  ctx.closePath();
  ctx.fill();
}

/**
 * The EXOWATT lockup from the reference (D151): the ring mark (three slightly irregular concentric rings, as if
 * drawn by hand) and the wordmark in a geometric sans, all drawn with one stroke weight. White on black as a
 * coverage map, so it filters and mipmaps cleanly; the material's color paints it. Layout in `BRAND_LAYOUT`.
 */
export function brandTexture(widthPx: number): CanvasTexture {
  const b = BRAND_LAYOUT;
  const C = widthPx / b.widthCaps;
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = Math.ceil(b.heightCaps * C);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('The 3D view could not draw its wordmark.');
  // Coverage, not color: black is bare wall, white is paint (the paint's color is --c-scene-mark).
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'white';
  ctx.strokeStyle = 'white';
  const sw = b.strokeCaps * C;
  const cy = canvas.height / 2;

  // The ring mark: three rings, the inner ones nudged up and left, each a little out of round.
  const mx = (b.marginCaps + b.markCaps / 2) * C;
  const rings = [
    { r: 1.21, dx: 0, dy: 0, wobble: [0.018, 0.012], phase: 0.4 },
    { r: 0.83, dx: -0.04, dy: -0.07, wobble: [0.022, 0.014], phase: 2.1 },
    { r: 0.46, dx: -0.07, dy: -0.12, wobble: [0.03, 0.016], phase: 4.3 },
  ];
  ctx.lineWidth = sw;
  for (const ring of rings) {
    ctx.beginPath();
    const steps = 180;
    for (let k = 0; k <= steps; k++) {
      const a = (k / steps) * Math.PI * 2;
      const r =
        ring.r *
        C *
        (1 +
          ring.wobble[0] * Math.sin(2 * a + ring.phase) +
          ring.wobble[1] * Math.sin(3 * a + ring.phase * 1.7));
      const x = mx + ring.dx * C + r * Math.cos(a);
      const y = cy + ring.dy * C + r * Math.sin(a);
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  // The wordmark, letter by letter, between the cap line and the baseline.
  const top = cy - C / 2;
  const bottom = cy + C / 2;
  const mid = cy;
  let x = (b.marginCaps + b.markCaps + b.gapCaps) * C;
  for (const [letter, wCaps] of b.letters) {
    const w = wCaps * C;
    const hs = sw / 2;
    switch (letter) {
      case 'E':
        ctx.fillRect(x, top, sw, C);
        ctx.fillRect(x, top, w, sw);
        ctx.fillRect(x, mid - hs, w * 0.92, sw);
        ctx.fillRect(x, bottom - sw, w, sw);
        break;
      case 'X':
        slant(ctx, x + hs * 1.2, top, x + w - hs * 1.2, bottom, sw);
        slant(ctx, x + w - hs * 1.2, top, x + hs * 1.2, bottom, sw);
        break;
      case 'O': {
        const r = w / 2;
        ctx.lineWidth = sw;
        ctx.beginPath();
        ctx.arc(x + r, cy, r - hs, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'W': {
        const q = (w - sw * 1.2) / 4;
        const x0 = x + hs * 1.2;
        slant(ctx, x0, top, x0 + q, bottom, sw);
        slant(ctx, x0 + 2 * q, top, x0 + q, bottom, sw);
        slant(ctx, x0 + 2 * q, top, x0 + 3 * q, bottom, sw);
        slant(ctx, x0 + 4 * q, top, x0 + 3 * q, bottom, sw);
        break;
      }
      case 'A': {
        const apex = x + w / 2;
        slant(ctx, apex, top, x + hs * 1.2, bottom, sw);
        slant(ctx, apex, top, x + w - hs * 1.2, bottom, sw);
        const barY = top + C * 0.66;
        const inset = (w / 2) * (1 - 0.66) + hs * 0.4;
        ctx.fillRect(x + inset, barY - hs, w - 2 * inset, sw);
        break;
      }
      case 'T':
        ctx.fillRect(x, top, w, sw);
        ctx.fillRect(x + w / 2 - hs, top, sw, C);
        break;
    }
    x += w + b.letterGapCaps * C;
  }

  const tex = new CanvasTexture(canvas);
  tex.generateMipmaps = true;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  return tex;
}

/** Smooth value noise on a `cells` x `cells` lattice that wraps, sampled at (u, v) in 0..1. */
function wrappingNoise(cells: number, seed: number): (u: number, v: number) => number {
  const rng = createRng(seed);
  const lattice = Array.from({ length: cells * cells }, () => rng.next());
  const at = (i: number, j: number) =>
    lattice[(((j % cells) + cells) % cells) * cells + (((i % cells) + cells) % cells)];
  const fade = (t: number) => t * t * (3 - 2 * t);
  return (u, v) => {
    const x = u * cells;
    const y = v * cells;
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fx = fade(x - i);
    const fy = fade(y - j);
    const a = at(i, j) + (at(i + 1, j) - at(i, j)) * fx;
    const b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * fx;
    return a + (b - a) * fy;
  };
}

/**
 * Sand grain: a light, tileable luminance texture around white, multiplied into the ground's color.
 * `amount` is the depth of the grain.
 */
export function grainTexture(px: number, amount: number, seed: number): DataTexture {
  const rng = createRng(seed);
  const coarse = wrappingNoise(8, seed + 1);
  const fine = wrappingNoise(32, seed + 2);
  const data = new Uint8Array(px * px * 4);
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      const u = x / px;
      const v = y / px;
      const n = 0.45 * coarse(u, v) + 0.35 * fine(u, v) + 0.2 * rng.next();
      const l = Math.round((1 - amount + amount * n) * BYTE);
      const i = (y * px + x) * 4;
      data[i] = l;
      data[i + 1] = l;
      data[i + 2] = l;
      data[i + 3] = BYTE;
    }
  }
  const tex = mipmapped(new DataTexture(data, px, px, RGBAFormat, UnsignedByteType));
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/** A smooth noise function of the plane, for the desert's large-scale tone (meters, any range). */
export function toneNoise(cellM: number, seed: number): (x: number, y: number) => number {
  const period = 64;
  const noise = wrappingNoise(period, seed);
  const noise2 = wrappingNoise(period, seed + 11);
  return (x, y) => {
    const u = x / (cellM * period);
    const v = y / (cellM * period);
    return 0.65 * noise(u, v) + 0.35 * noise2(u * 3.1, v * 3.1);
  };
}
