// Procedural textures of the 3D view (D122): the corrugated walls, the Fresnel lens grooves and the sand
// grain, made in code so the scene needs no image files.
import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three';
import { createRng } from '../../engine/rng';

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
 * The same grooves as faint light and dark rings, multiplied into the lens color, so the lenses read as
 * Fresnel lenses from any angle and not as solar panels.
 */
export function fresnelRingMap(rings: number, px: number, depth: number): DataTexture {
  const data = new Uint8Array(px * px * 4);
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      const r = Math.hypot((x + 0.5) / px - 0.5, (y + 0.5) / px - 0.5) * 2;
      const f = (r * rings) % 1;
      const l = Math.round((1 - depth * (0.5 + 0.5 * Math.cos(f * Math.PI * 2))) * BYTE);
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
