// Procedural geometry of the 3D view (D122, D123, D150 to D152): a P3 unit (a 40 ft container on pile caps with
// its doors, roof railing, receiver porthole, vents and branding), its sun tracker (a white pole, a yoke, an axle
// that carries the Fresnel lens on an arm and the corrugated fin), the corner module on its bracket arm, and the
// base's mast. Each is a set of parts merged by material, so every unit or module on the site is one instance of
// a few meshes.
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SCENE3D } from '../../config/scene3d';

/** Materials of the parts: each becomes one instanced mesh. */
export type PartKey =
  | 'wall'
  | 'frame'
  | 'dark'
  | 'steel'
  | 'window'
  | 'mark'
  | 'tracker'
  | 'lens'
  | 'module'
  | 'enclosure'
  | 'led';

/** Parts by material, merged into one geometry per material. */
export class Parts {
  private byKey = new Map<PartKey, BufferGeometry[]>();

  add(key: PartKey, geometry: BufferGeometry): void {
    const list = this.byKey.get(key) ?? [];
    list.push(geometry);
    this.byKey.set(key, list);
  }

  merged(): Map<PartKey, BufferGeometry> {
    const out = new Map<PartKey, BufferGeometry>();
    for (const [key, list] of this.byKey) {
      // Rounded boxes and extrusions come without an index; a material that mixes them with other parts merges
      // unindexed.
      const mixed = list.some((g) => g.index === null) && list.some((g) => g.index !== null);
      const parts = mixed ? list.map((g) => (g.index ? g.toNonIndexed() : g)) : list;
      const g = mergeGeometries(parts, false);
      for (const part of new Set([...list, ...parts])) part.dispose();
      if (!g) throw new Error(`The 3D view's ${key} parts could not be merged.`);
      out.set(key, g);
    }
    return out;
  }
}

/** A box of size (w, h, d) centered at (x, y, z), turned `rotY` radians about the vertical. */
function box(w: number, h: number, d: number, x: number, y: number, z: number, rotY = 0) {
  const g = new BoxGeometry(w, h, d);
  if (rotY) g.rotateY(rotY);
  return g.translate(x, y, z);
}

const UP = new Vector3(0, 1, 0);

/** A round bar of radius `r` from `a` to `b`. */
function rod(a: Vector3, b: Vector3, r: number, segments = 10): BufferGeometry {
  const dir = new Vector3().subVectors(b, a);
  const g = new CylinderGeometry(r, r, dir.length(), segments, 1);
  g.applyQuaternion(new Quaternion().setFromUnitVectors(UP, dir.normalize()));
  return g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
}

/** A square bar of side `s` from `a` to `b`, turned so one face looks along `face`. */
function beam(a: Vector3, b: Vector3, s: number, face: Vector3): BufferGeometry {
  const along = new Vector3().subVectors(b, a);
  const y = along.clone().normalize();
  const z = face.clone().addScaledVector(y, -face.dot(y)).normalize();
  const x = new Vector3().crossVectors(y, z);
  const g = new BoxGeometry(s, along.length(), s);
  g.applyMatrix4(new Matrix4().makeBasis(x, y, z));
  return g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
}

/**
 * A flat wall of `w` x `h`, its UVs in corrugation pitches across and up, so ridges repeat to scale; `across`
 * turns the ridges to run across the wall (the door leaves).
 */
function wall(w: number, h: number, across = false): PlaneGeometry {
  const g = new PlaneGeometry(w, h);
  const uv = g.getAttribute('uv');
  const pitch = SCENE3D.unit.corrugationPitchM;
  for (let i = 0; i < uv.count; i++) {
    const u = (uv.getX(i) * w) / pitch;
    const v = (uv.getY(i) * h) / pitch;
    if (across) uv.setXY(i, v, u);
    else uv.setXY(i, u, v);
  }
  return g;
}

/** Height of a unit's roof above the ground. */
export function roofY(): number {
  return SCENE3D.unit.pileCapM + SCENE3D.unit.heightM;
}

/** The unit-local z of a point `m` along the unit from its north end. */
function fromNorth(m: number): number {
  return -SCENE3D.unit.lengthM / 2 + m;
}

/**
 * The wordmark's size on a wall: the lockup's width and height in meters, from its cap height and the
 * proportions of the drawing (`BRAND_LAYOUT`).
 */
export function brandSizeM(): { wM: number; hM: number } {
  const cap = SCENE3D.unit.branding.capShare * SCENE3D.unit.heightM;
  return { wM: BRAND_LAYOUT.widthCaps * cap, hM: BRAND_LAYOUT.heightCaps * cap };
}

/**
 * The branding lockup drawn on a canvas (textures.ts), in cap heights: the ring mark, a gap, then EXOWATT, with
 * a margin all round. The reference's proportions: the mark about 2.7 caps across, the word about 8 caps wide.
 */
export const BRAND_LAYOUT = {
  marginCaps: 0.15,
  markCaps: 2.7,
  gapCaps: 1.0,
  /** Letter widths and the space between letters, in caps; the O is a circle a little over the cap height. */
  letters: [
    ['E', 0.64],
    ['X', 0.8],
    ['O', 1.08],
    ['W', 1.36],
    ['A', 0.94],
    ['T', 0.74],
    ['T', 0.74],
  ] as const,
  letterGapCaps: 0.3,
  strokeCaps: 0.16,
  get wordCaps(): number {
    return (
      this.letters.reduce((s, [, w]) => s + w, 0) + this.letterGapCaps * (this.letters.length - 1)
    );
  },
  get widthCaps(): number {
    return 2 * this.marginCaps + this.markCaps + this.gapCaps + this.wordCaps;
  },
  get heightCaps(): number {
    return 2 * this.marginCaps + this.markCaps;
  },
};

/**
 * A decal of the branding lockup on a long wall, centered `zc` along the unit: its UVs in corrugation pitches
 * as the wall's own (so the paint follows the ridges), and a second set (uv1) over the lockup's drawing.
 */
function brandDecal(side: 1 | -1, zc: number): BufferGeometry {
  const u = SCENE3D.unit;
  const { wM, hM } = brandSizeM();
  const g = new PlaneGeometry(wM, hM);
  const uv = g.getAttribute('uv');
  const pos = g.getAttribute('position');
  const pitch = u.corrugationPitchM;
  const corr = new Float32Array(uv.count * 2);
  for (let i = 0; i < uv.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i) + u.branding.centerAtM;
    // East wall: its UVs run north from the south end; west wall: south from the north end (see p3BodyParts).
    const along = side === 1 ? u.lengthM / 2 - zc + x : u.lengthM / 2 + zc + x;
    corr[i * 2] = along / pitch;
    corr[i * 2 + 1] = (y - u.pileCapM) / pitch;
  }
  g.setAttribute('uv1', new BufferAttribute(new Float32Array(uv.array), 2));
  g.setAttribute('uv', new BufferAttribute(corr, 2));
  g.rotateY((side * Math.PI) / 2);
  return g.translate(side * (u.widthM / 2 + 0.002), u.branding.centerAtM, zc);
}

/** The receiver porthole's window center on the east wall, unit-local: the point its lens focuses on. */
export function portholeCenter(): Vector3 {
  const u = SCENE3D.unit;
  const ph = u.porthole;
  return new Vector3(u.widthM / 2 + 0.035, roofY() - ph.belowRoofM, fromNorth(ph.fromNorthEndM));
}

/**
 * One P3 unit's container around its ground center: long axis north-south (scene z, north is -z), the doors at
 * the south end, the receiver porthole high on the east wall a third of the way from the north end, the roof at
 * `roofY()`.
 */
export function p3BodyParts(): Parts {
  const u = SCENE3D.unit;
  const W = u.widthM;
  const L = u.lengthM;
  const H = u.heightM;
  const base = u.pileCapM;
  const top = base + H;
  const parts = new Parts();

  // Corrugated walls and roof (one material, normal-mapped); the door leaves are ribbed across.
  parts.add(
    'wall',
    wall(L, H)
      .rotateY(Math.PI / 2)
      .translate(W / 2, base + H / 2, 0),
  );
  parts.add(
    'wall',
    wall(L, H)
      .rotateY(-Math.PI / 2)
      .translate(-W / 2, base + H / 2, 0),
  );
  parts.add(
    'wall',
    wall(W, H)
      .rotateY(Math.PI)
      .translate(0, base + H / 2, -L / 2),
  );
  parts.add('wall', wall(W, H, true).translate(0, base + H / 2, L / 2));
  parts.add(
    'wall',
    wall(L, W)
      .rotateX(-Math.PI / 2)
      .rotateY(Math.PI / 2)
      .translate(0, top, 0),
  );

  // Frame: corner posts, top and bottom rails proud of the walls, corner castings.
  const p = u.postM;
  const r = u.railM;
  const pr = u.railProudM;
  const xo = W / 2 - p / 2 + pr;
  const zo = L / 2 - p / 2 + pr;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) parts.add('frame', box(p, H, p, sx * xo, base + H / 2, sz * zo));
  }
  for (const y of [base + r / 2, top - r / 2]) {
    for (const s of [-1, 1]) {
      parts.add('frame', box(r, r, L - 2 * p, s * (W / 2 - r / 2 + pr), y, 0));
      parts.add('frame', box(W - 2 * p, r, r, 0, y, s * (L / 2 - r / 2 + pr)));
    }
  }
  const c = u.castingM;
  const cp = pr + u.castingProudM;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      for (const y of [base + c / 2, top - c / 2]) {
        parts.add('frame', box(c, c, c, sx * (W / 2 - c / 2 + cp), y, sz * (L / 2 - c / 2 + cp)));
      }
    }
  }

  // Doors at the south end: the seam between the leaves, the painted locking bars with their keepers and
  // handles, and the hinges on the outer edges.
  const doorZ = L / 2 + u.lockBarRadiusM + 0.004;
  parts.add('dark', box(u.doorSeamM, H - 2 * r, u.doorSeamM, 0, base + H / 2, L / 2 + 0.002));
  for (const s of [-1, 1]) {
    for (let k = 0; k < u.lockBarsPerLeaf; k++) {
      const x = s * (u.lockBarInsetM + k * (W / 2 - 2 * u.lockBarInsetM));
      parts.add(
        'frame',
        rod(new Vector3(x, base + r, doorZ), new Vector3(x, top - r, doorZ), u.lockBarRadiusM, 8),
      );
      for (const y of [base + r * 1.6, top - r * 1.6]) {
        parts.add('frame', box(0.07, 0.09, 0.05, x, y, doorZ - 0.01));
      }
      // The handle lies across the leaf toward the seam, in its retainer.
      const hx = x - s * 0.13;
      parts.add('frame', box(0.26, 0.035, 0.03, hx, u.handleHeightM, doorZ + 0.02));
      parts.add('dark', box(0.05, 0.07, 0.03, x - s * 0.24, u.handleHeightM, doorZ + 0.005));
    }
    for (let k = 0; k < u.hingesPerLeaf; k++) {
      const y = base + r + 0.25 + (k * (H - 2 * r - 0.5)) / (u.hingesPerLeaf - 1);
      parts.add('frame', box(0.08, 0.12, 0.05, s * (W / 2 - p + pr), y, L / 2 + 0.035));
    }
  }

  // A railing around the roof: posts and a top rail, inset from the edges.
  const rl = u.railing;
  const rx = W / 2 - rl.insetM;
  const rz = L / 2 - rl.insetM;
  const railY = top + rl.heightM - rl.barM / 2;
  const postsAlong = (len: number) => Math.max(1, Math.ceil(len / rl.maxSpacingM));
  const nz = postsAlong(2 * rz);
  const nx = postsAlong(2 * rx);
  for (const s of [-1, 1]) {
    for (let k = 0; k <= nz; k++) {
      parts.add(
        'frame',
        box(rl.barM, rl.heightM, rl.barM, s * rx, top + rl.heightM / 2, -rz + (k * 2 * rz) / nz),
      );
    }
    for (let k = 1; k < nx; k++) {
      parts.add(
        'frame',
        box(rl.barM, rl.heightM, rl.barM, -rx + (k * 2 * rx) / nx, top + rl.heightM / 2, s * rz),
      );
    }
    parts.add('frame', box(rl.barM, rl.barM, 2 * rz + rl.barM, s * rx, railY, 0));
    parts.add('frame', box(2 * rx - rl.barM, rl.barM, rl.barM, 0, railY, s * rz));
  }

  // The receiver porthole: a steel plate on the wall, a ring round the window, a hinge on its south side, a
  // latch on its north side and a bolt at each corner of the plate.
  const ph = u.porthole;
  const focus = portholeCenter();
  const face = W / 2;
  const [pw, phh] = ph.plateM;
  parts.add('steel', box(0.03, phh, pw, face + 0.015, focus.y, focus.z));
  parts.add(
    'steel',
    new TorusGeometry(ph.ringRadiusM, ph.ringTubeM, 8, 28)
      .rotateY(Math.PI / 2)
      .translate(face + 0.03 + ph.ringTubeM * 0.5, focus.y, focus.z),
  );
  parts.add(
    'window',
    new CylinderGeometry(ph.windowRadiusM, ph.windowRadiusM, 0.012, 28)
      .rotateZ(Math.PI / 2)
      .translate(face + 0.035, focus.y, focus.z),
  );
  parts.add('steel', box(0.07, 0.18, 0.07, face + 0.065, focus.y, focus.z + ph.ringRadiusM + 0.04));
  parts.add(
    'steel',
    box(0.05, 0.08, 0.05, face + 0.055, focus.y, focus.z - ph.ringRadiusM - 0.045),
  );
  for (const dy of [-1, 1]) {
    for (const dz of [-1, 1]) {
      parts.add(
        'steel',
        new CylinderGeometry(0.018, 0.018, 0.02, 8)
          .rotateZ(Math.PI / 2)
          .translate(face + 0.035, focus.y + dy * (phh / 2 - 0.05), focus.z + dz * (pw / 2 - 0.05)),
      );
    }
  }

  // Louvered vents: a frame proud of the wall, a dark opening and slats angled down.
  for (const v of u.vents) {
    const z = fromNorth(v.fromNorthEndM);
    const y = v.atM;
    const b = 0.035;
    const d = 0.03;
    parts.add('frame', box(d, b, v.wM, face + d / 2, y + v.hM / 2 - b / 2, z));
    parts.add('frame', box(d, b, v.wM, face + d / 2, y - v.hM / 2 + b / 2, z));
    parts.add('frame', box(d, v.hM - 2 * b, b, face + d / 2, y, z + v.wM / 2 - b / 2));
    parts.add('frame', box(d, v.hM - 2 * b, b, face + d / 2, y, z - v.wM / 2 + b / 2));
    parts.add('dark', box(0.006, v.hM - 2 * b, v.wM - 2 * b, face + 0.004, y, z));
    const n = u.ventSlats;
    const step = (v.hM - 2 * b) / n;
    for (let k = 0; k < n; k++) {
      const sy = y - v.hM / 2 + b + step * (k + 0.5);
      parts.add(
        'frame',
        new BoxGeometry(0.035, 0.01, v.wM - 2 * b).rotateZ(-0.6).translate(face + 0.016, sy, z),
      );
    }
  }
  // The access hatch: a panel with a dark seam round it and two handles.
  const hatch = u.hatch;
  const hz = fromNorth(hatch.fromNorthEndM);
  parts.add('dark', box(0.004, hatch.hM + 0.02, hatch.wM + 0.02, face + 0.002, hatch.atM, hz));
  parts.add('frame', box(0.02, hatch.hM, hatch.wM, face + 0.01, hatch.atM, hz));
  for (const s of [-1, 1]) {
    parts.add('dark', box(0.03, 0.09, 0.022, face + 0.035, hatch.atM, hz + s * 0.06));
  }

  // The wordmark on both long walls, centered.
  parts.add('mark', brandDecal(1, 0));
  parts.add('mark', brandDecal(-1, 0));

  // Pile caps under the bottom rails.
  const pc = u.pileCapSizeM;
  for (const s of [-1, 1]) {
    for (let k = 0; k < u.pilesPerSide; k++) {
      const z = -L / 2 + pc / 2 + (k * (L - pc)) / (u.pilesPerSide - 1);
      parts.add('dark', box(pc, base + 0.06, pc, s * (W / 2 - pc / 2), (base - 0.06) / 2, z));
    }
  }
  return parts;
}

/** The tracker's tilting frame: the axle's center, the axle, up the lens's face, and the lens's normal. */
export interface TrackerFrame {
  origin: Vector3;
  axle: Vector3;
  up: Vector3;
  normal: Vector3;
}

/**
 * Where a unit's tracker stands (D152), unit-local, for a sun direction: its live lens faces the sun with its
 * center `focalM` from the porthole along the sun's direction, so the lens's axis runs through the porthole.
 * The axle is level and square to the sun's azimuth; the head follows from the lens's place on its arm.
 */
export interface TrackerLayout {
  porthole: Vector3;
  /** The axle's center. */
  head: Vector3;
  /** Level, toward the sun's azimuth. */
  toSun: Vector3;
  /** The axle: level, square to `toSun`; the lens hangs off its west end. */
  axle: Vector3;
  /** The sun's elevation, radians: the live lens's tilt. */
  sunElevation: number;
}

export function trackerLayout(sun: Vector3): TrackerLayout {
  const t = SCENE3D.tracker;
  const s = sun.clone().normalize();
  if (s.x <= 0 || s.y <= 0) throw new Error('The trackers need the sun above the east walls.');
  const toSun = new Vector3(s.x, 0, s.z).normalize();
  const axle = new Vector3().crossVectors(UP, toSun);
  const porthole = portholeCenter();
  const layout = { porthole, head: new Vector3(), toSun, axle, sunElevation: Math.asin(s.y) };
  const f = trackerFrame(layout, layout.sunElevation);
  const lens = porthole.clone().addScaledVector(s, t.focalM);
  layout.head
    .copy(lens)
    .addScaledVector(f.axle, t.lensAlongM)
    .addScaledVector(f.up, -t.lensUpM)
    .addScaledVector(f.normal, -t.lensOutM);
  return layout;
}

/** The tilting frame of a tracker at lens elevation `elevation` (radians above level; pi/2 lies flat). */
export function trackerFrame(layout: TrackerLayout, elevation: number): TrackerFrame {
  const c = Math.cos(elevation);
  const s = Math.sin(elevation);
  return {
    origin: layout.head.clone(),
    axle: layout.axle.clone(),
    up: layout.toSun.clone().multiplyScalar(-s).addScaledVector(UP, c),
    normal: layout.toSun.clone().multiplyScalar(c).addScaledVector(UP, s),
  };
}

/** The lens's outer size, frame included. */
export function lensSizeM(): number {
  const t = SCENE3D.tracker;
  return t.panes * t.paneM + (t.panes - 1) * t.mullionM + 2 * t.frameM;
}

/** The lens's center for a tracker frame. */
export function lensCenter(f: TrackerFrame): Vector3 {
  const t = SCENE3D.tracker;
  return f.origin
    .clone()
    .addScaledVector(f.axle, -t.lensAlongM)
    .addScaledVector(f.up, t.lensUpM)
    .addScaledVector(f.normal, t.lensOutM);
}

/** The lens's four outer corners for a tracker frame. */
export function lensCorners(f: TrackerFrame): Vector3[] {
  const c = lensCenter(f);
  const h = lensSizeM() / 2;
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([a, b]) =>
    c
      .clone()
      .addScaledVector(f.axle, a * h)
      .addScaledVector(f.up, b * h),
  );
}

/** The fin's four corners for a tracker frame. */
export function finCorners(f: TrackerFrame): Vector3[] {
  const fin = SCENE3D.tracker.fin;
  const c = f.origin
    .clone()
    .addScaledVector(f.axle, fin.alongM)
    .addScaledVector(f.normal, -fin.offsetM);
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([a, b]) =>
    c
      .clone()
      .addScaledVector(f.axle, (a * fin.wM) / 2)
      .addScaledVector(f.up, (b * fin.lM) / 2),
  );
}

/**
 * A corrugated panel `w` wide and `l` long in the x-y plane, its ribs running along y and standing out
 * toward -z: a thin plate folded into trapezoidal ribs, swept along y, its faces flat-shaded.
 */
function corrugatedPanel(
  w: number,
  l: number,
  ribs: number,
  depth: number,
  thick: number,
): BufferGeometry {
  const pitch = w / ribs;
  const flank = pitch * 0.14;
  const crest = pitch * 0.34;
  const trough = (pitch - crest - 2 * flank) / 2;
  // The profile across the panel: its back (the ribs' side, -z) and its front, `thick` toward +z.
  const wave: [number, number][] = [];
  for (let k = 0; k < ribs; k++) {
    const x0 = -w / 2 + k * pitch;
    wave.push([x0, 0], [x0 + trough, 0], [x0 + trough + flank, -depth]);
    wave.push([x0 + trough + flank + crest, -depth], [x0 + pitch - trough, 0]);
  }
  wave.push([w / 2, 0]);
  const y0 = -l / 2;
  const y1 = l / 2;
  const pos: number[] = [];
  const quad = (...q: [number, number, number][]) => {
    for (const i of [0, 1, 2, 0, 2, 3]) pos.push(...q[i]);
  };
  for (let i = 0; i + 1 < wave.length; i++) {
    const [xa, za] = wave[i];
    const [xb, zb] = wave[i + 1];
    // Front (+z) and back (-z) faces, and the profile's strip at each end.
    quad([xa, y0, za + thick], [xb, y0, zb + thick], [xb, y1, zb + thick], [xa, y1, za + thick]);
    quad([xa, y0, za], [xa, y1, za], [xb, y1, zb], [xb, y0, zb]);
    quad([xa, y0, za], [xb, y0, zb], [xb, y0, zb + thick], [xa, y0, za + thick]);
    quad([xa, y1, za], [xa, y1, za + thick], [xb, y1, zb + thick], [xb, y1, zb]);
  }
  // The two long edges.
  const [xs, zs] = wave[0];
  const [xe, ze] = wave[wave.length - 1];
  quad([xs, y0, zs], [xs, y0, zs + thick], [xs, y1, zs + thick], [xs, y1, zs]);
  quad([xe, y0, ze], [xe, y1, ze], [xe, y1, ze + thick], [xe, y0, ze + thick]);
  const flat = new BufferGeometry();
  flat.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  flat.setAttribute('uv', new BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  // Unindexed, each face gets its own normal; then indexed, as the tracker's other parts are.
  flat.computeVertexNormals();
  const g = mergeVertices(flat);
  flat.dispose();
  return g;
}

/**
 * One unit's tracker, unit-local, with its lens at `elevation` (the sun's to track it, or the stow angle): the
 * base plate and pole, the yoke that turns the axle, the axle with its drum and collars, the corrugated fin on
 * the axle's east half, the arm and sub-frame on its west end, and the framed lens of square Fresnel panes.
 */
export function trackerParts(layout: TrackerLayout, elevation: number): Parts {
  const t = SCENE3D.tracker;
  const parts = new Parts();
  const head = layout.head;

  // The pole on its base plate, with a flange and four gussets.
  const yokeY = head.y - t.yokeBelowM;
  parts.add(
    'tracker',
    new CylinderGeometry(t.plateRadiusM, t.plateRadiusM, t.plateM, 24).translate(
      head.x,
      t.plateM / 2,
      head.z,
    ),
  );
  parts.add(
    'tracker',
    new CylinderGeometry(0.17, 0.17, 0.1, 16).translate(head.x, t.plateM + 0.05, head.z),
  );
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2 + Math.PI / 4;
    parts.add(
      'tracker',
      new BoxGeometry(0.02, 0.2, 0.13)
        .translate(0, t.plateM + 0.1, t.poleRadiusM + 0.065)
        .rotateY(a)
        .translate(head.x, 0, head.z),
    );
  }
  parts.add(
    'tracker',
    rod(
      new Vector3(head.x, t.plateM, head.z),
      new Vector3(head.x, yokeY, head.z),
      t.poleRadiusM,
      16,
    ),
  );

  // The yoke: a turntable on the pole and two cheeks up to the axle, square to it.
  const yoke = new Matrix4().makeBasis(layout.axle, UP, layout.toSun).setPosition(head);
  const inYoke = (g: BufferGeometry) => g.applyMatrix4(yoke);
  parts.add(
    'tracker',
    inYoke(new CylinderGeometry(0.17, 0.17, 0.12, 16).translate(0, -t.yokeBelowM + 0.06, 0)),
  );
  for (const s of [-1, 1]) {
    parts.add('tracker', inYoke(box(0.045, t.yokeBelowM, 0.3, s * 0.235, -t.yokeBelowM / 2, 0)));
  }

  // Everything that tilts, built in the tilting frame: x along the axle, y up the lens's face, z its normal.
  const f = trackerFrame(layout, elevation);
  const tilt = new Matrix4().makeBasis(f.axle, f.up, f.normal).setPosition(head);
  const add = (key: PartKey, g: BufferGeometry) => parts.add(key, g.applyMatrix4(tilt));
  const v = (x: number, y: number, z: number) => new Vector3(x, y, z);
  const Z = v(0, 0, 1);

  // The axle, its drum at the head, collars by the cheeks and a flange at each end.
  const ar = t.axleRadiusM;
  const ah = t.axleHalfM;
  add('tracker', rod(v(-ah, 0, 0), v(ah, 0, 0), ar, 16));
  add('tracker', rod(v(-0.15, 0, 0), v(0.15, 0, 0), 0.17, 16));
  for (const x of [-0.3, 0.3])
    add('tracker', rod(v(x - 0.03, 0, 0), v(x + 0.03, 0, 0), ar + 0.03, 16));
  add('tracker', rod(v(-ah - 0.04, 0, 0), v(-ah + 0.03, 0, 0), ar + 0.035, 16));
  add('tracker', rod(v(ah - 0.03, 0, 0), v(ah + 0.03, 0, 0), ar + 0.02, 16));

  // The fin on the axle's east half, on two clamps, and a slim mast along its outer edge.
  const fin = t.fin;
  add(
    'tracker',
    corrugatedPanel(fin.wM, fin.lM, fin.ribs, fin.depthM, fin.thickM).translate(
      fin.alongM,
      0,
      -fin.offsetM,
    ),
  );
  for (const x of [fin.alongM - fin.wM * 0.28, fin.alongM + fin.wM * 0.28]) {
    add('tracker', box(0.07, 0.16, fin.offsetM, x, 0, -fin.offsetM / 2));
  }
  add(
    'tracker',
    rod(
      v(fin.alongM + fin.wM / 2 + 0.05, -0.5, -0.1),
      v(fin.alongM + fin.wM / 2 + 0.05, fin.lM / 2 + 0.45, -0.1),
      0.02,
      8,
    ),
  );

  // The lens: a white frame with mullions between the panes, and the panes as one sheet whose texture repeats
  // per pane.
  const S = lensSizeM();
  const lx = -t.lensAlongM;
  const ly = t.lensUpM;
  const lz = t.lensOutM;
  const fm = t.frameM;
  const fd = t.frameDepthM;
  add('tracker', box(S, fm, fd, lx, ly + S / 2 - fm / 2, lz));
  add('tracker', box(S, fm, fd, lx, ly - S / 2 + fm / 2, lz));
  add('tracker', box(fm, S - 2 * fm, fd, lx + S / 2 - fm / 2, ly, lz));
  add('tracker', box(fm, S - 2 * fm, fd, lx - S / 2 + fm / 2, ly, lz));
  const inner = S - 2 * fm;
  const period = inner / t.panes;
  for (let k = 1; k < t.panes; k++) {
    const o = -inner / 2 + k * period;
    add('tracker', box(t.mullionM, inner, fd * 0.8, lx + o, ly, lz));
    add('tracker', box(inner, t.mullionM, fd * 0.8, lx, ly + o, lz));
  }
  const sheet = new PlaneGeometry(inner, inner);
  const uv = sheet.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * t.panes, uv.getY(i) * t.panes);
  add('lens', sheet.translate(lx, ly, lz));

  // The sub-frame behind the lens, its corner on the axle's west end, and the arm that holds it there.
  const sf = S * t.subFrameShare;
  const sz = lz - fd / 2 - t.subFrameBackM;
  const bm = t.beamM;
  const near = lx + sf / 2;
  const far = lx - sf / 2;
  const low = ly - sf / 2;
  const high = ly + sf / 2;
  const corners = [v(near, low, sz), v(far, low, sz), v(far, high, sz), v(near, high, sz)];
  for (let k = 0; k < 4; k++) add('tracker', beam(corners[k], corners[(k + 1) % 4], bm, Z));
  add('tracker', beam(corners[0], corners[2], bm * 0.85, Z));
  for (const p of corners) add('tracker', beam(p, v(p.x, p.y, lz - fd / 2), bm * 0.7, v(1, 0, 0)));
  const root = v(-ah + 0.02, 0, 0);
  add('tracker', beam(root, corners[0], bm * 1.15, Z));
  add('tracker', beam(root, corners[3], bm, Z));
  // The elevation actuator: a cylinder from the drum out along the axle's side to the sub-frame's far corner.
  const act0 = v(-0.12, -0.2, 0.02);
  const act1 = v(far + 0.1, low + 0.05, sz);
  const mid = act0.clone().lerp(act1, 0.55);
  add('tracker', rod(act0, mid, 0.04, 10));
  add('tracker', rod(mid, act1, 0.02, 8));
  return parts;
}

/** The module's head offset from the corner, out along the diagonal (east and north). */
export function moduleOffset(): number {
  return SCENE3D.module.armOutM / Math.SQRT2;
}

/** A box with rounded edges of `r`, centered at (x, y, z). */
function rounded(w: number, h: number, d: number, r: number, x: number, y: number, z: number) {
  return new RoundedBoxGeometry(w, h, d, 2, r).translate(x, y, z);
}

/** A radio head at (x, y, z): the enclosure, a radome facing each of the four ways, the cap and the light. */
function radioHead(parts: Parts, x: number, y: number, z: number): void {
  const m = SCENE3D.module;
  const h = m.headM;
  const r = m.roundM;
  parts.add('enclosure', box(h, m.headHeightM, h, x, y, z));
  // A flat-panel antenna radome on each face: east, west, north, south.
  const out = h / 2 + m.radomeDM / 2;
  const [w, rh, d] = [m.radomeWM, m.radomeHM, m.radomeDM];
  parts.add('module', rounded(d, rh, w, r, x + out, y, z));
  parts.add('module', rounded(d, rh, w, r, x - out, y, z));
  parts.add('module', rounded(w, rh, d, r, x, y, z - out));
  parts.add('module', rounded(w, rh, d, r, x, y, z + out));
  const capW = h + 2 * m.radomeDM + 0.02;
  const capY = y + m.headHeightM / 2 + m.capM / 2;
  parts.add('module', rounded(capW, m.capM, capW, r, x, capY, z));
  const led = new SphereGeometry(m.ledRadiusM, 12, 8).translate(
    x + h / 2 - m.ledRadiusM,
    capY + m.capM / 2 + m.ledRadiusM * 0.3,
    z + h / 2 - m.ledRadiusM,
  );
  parts.add('led', led);
}

/**
 * The corner module around the unit's north-east corner at the ground (the radio's map position): the
 * bracket arm off the top corner casting, the riser, the head at the antenna height, the battery on the
 * corner post and its cable.
 */
export function moduleParts(): Parts {
  const m = SCENE3D.module;
  const u = SCENE3D.unit;
  const parts = new Parts();
  const roof = roofY();
  const o = moduleOffset();
  const armY = roof - m.armM / 2 - 0.02;
  const inset = u.castingM / 2;
  const armLen = (o + inset) * Math.SQRT2;
  // The arm runs from inside the casting out along the diagonal (east and north: +x, -z).
  parts.add(
    'steel',
    box(m.armM, m.armM, armLen, (o - inset) / 2, armY, -(o - inset) / 2, (3 * Math.PI) / 4),
  );
  // A clamp plate bolted over the casting's two outer faces.
  const face = u.railProudM + u.castingProudM + 0.006;
  parts.add('steel', box(0.012, 0.16, 0.24, face, roof - 0.1, 0.06));
  parts.add('steel', box(0.24, 0.16, 0.012, -0.06, roof - 0.1, -face));
  const headBottom = m.antennaHeightM - m.headHeightM / 2;
  parts.add(
    'steel',
    rod(new Vector3(o, armY, -o), new Vector3(o, headBottom + 0.01, -o), m.armM * 0.55, 12),
  );
  radioHead(parts, o, m.antennaHeightM, -o);
  // The battery on the corner post's east face, south of the corner, and its cable up to the arm.
  const b = m.battery;
  const bx = u.railProudM + b.dM / 2 + 0.004;
  const by = roof - b.topBelowRoofM - b.hM / 2;
  const bz = 0.12 + b.wM / 2;
  parts.add('enclosure', box(b.dM, b.hM, b.wM, bx, by, bz));
  // Its cable runs up the post, round the corner and out under the arm to the riser.
  const cable = m.cableRadiusM;
  const cy = armY - m.armM / 2 - cable;
  const run = [
    new Vector3(bx, by + b.hM / 2, bz),
    new Vector3(bx, cy, bz),
    new Vector3(bx, cy, 0),
    new Vector3(o, cy, -o),
    new Vector3(o, headBottom, -o),
  ];
  for (let i = 0; i + 1 < run.length; i++) parts.add('dark', rod(run[i], run[i + 1], cable, 6));
  return parts;
}

/** Where the module's antennas are, relative to the radio's corner at the ground. */
export function antennaOffset(): Vector3 {
  const o = moduleOffset();
  return new Vector3(o, SCENE3D.module.antennaHeightM, -o);
}

/** The base on its pad around its point: the equipment skid, the mast with its radio head, the Starlink dish. */
export function baseParts(): Parts {
  const b = SCENE3D.base;
  const m = SCENE3D.module;
  const parts = new Parts();
  const [sw, sh, sd] = b.skid;
  parts.add('enclosure', box(sw, sh, sd, -sw / 2 - 0.6, sh / 2, 0));
  parts.add('dark', box(0.7, 0.16, 0.7, 0, 0.08, 0));
  parts.add('steel', rod(new Vector3(0, 0, 0), new Vector3(0, b.mastM, 0), b.mastRadiusM, 14));
  radioHead(parts, 0, m.antennaHeightM, 0);
  const [dw, dd] = b.dishM;
  const dish = new BoxGeometry(dw, 0.035, dd).rotateX(-0.45).translate(0, b.mastM + 0.12, -0.04);
  parts.add('module', dish);
  // A cable from the skid up the mast.
  parts.add(
    'dark',
    rod(new Vector3(-0.6, sh * 0.8, 0), new Vector3(-0.08, sh * 0.8, 0), m.cableRadiusM * 1.4, 6),
  );
  return parts;
}
