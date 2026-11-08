// Procedural geometry of the 3D view (D122, D123): a P3 unit (a 40 ft container on pile caps with its
// sun-tracking lens array), the corner module on its bracket arm, and the base's mast. Each is a set of parts
// merged by material, so every unit or module on the site is one instance of a few meshes.
import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SCENE3D } from '../../config/scene3d';

/** Materials of the parts: each becomes one instanced mesh. */
export type PartKey =
  'wall' | 'frame' | 'dark' | 'steel' | 'glass' | 'module' | 'enclosure' | 'led';

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
      // Rounded boxes come without an index; a material that mixes them with other parts merges unindexed.
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

/** A flat wall of `w` x `h`, its UVs in corrugation pitches across and up, so ridges repeat to scale. */
function wall(w: number, h: number): PlaneGeometry {
  const g = new PlaneGeometry(w, h);
  const uv = g.getAttribute('uv');
  const pitch = SCENE3D.unit.corrugationPitchM;
  for (let i = 0; i < uv.count; i++)
    uv.setXY(i, (uv.getX(i) * w) / pitch, (uv.getY(i) * h) / pitch);
  return g;
}

/**
 * One P3 unit around its ground center: long axis north-south (scene z, north is -z), the doors at the south
 * end, the roof at `roofY()`. `tilt` turns the lenses toward the sun about the north-south tracker axes
 * (radians, positive toward the east).
 */
export function p3Parts(tilt: number): Parts {
  const u = SCENE3D.unit;
  const lens = SCENE3D.lens;
  const W = u.widthM;
  const L = u.lengthM;
  const H = u.heightM;
  const base = u.pileCapM;
  const top = base + H;
  const parts = new Parts();

  // Corrugated walls and roof (one material, normal-mapped).
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
  parts.add('wall', wall(W, H).translate(0, base + H / 2, L / 2));
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

  // Doors at the south end: the seam between the leaves and the locking bars with their keepers.
  const doorZ = L / 2 + u.lockBarRadiusM + 0.004;
  parts.add('dark', box(u.doorSeamM, H - 2 * r, u.doorSeamM, 0, base + H / 2, L / 2 + 0.002));
  for (const s of [-1, 1]) {
    for (let k = 0; k < u.lockBarsPerLeaf; k++) {
      const x = s * (u.lockBarInsetM + k * (W / 2 - 2 * u.lockBarInsetM));
      parts.add(
        'dark',
        rod(new Vector3(x, base + r, doorZ), new Vector3(x, top - r, doorZ), u.lockBarRadiusM, 8),
      );
      for (const y of [base + r * 1.6, top - r * 1.6]) {
        parts.add('dark', box(0.07, 0.09, 0.05, x, y, doorZ - 0.01));
      }
    }
  }

  // Pile caps under the bottom rails.
  const pc = u.pileCapSizeM;
  for (const s of [-1, 1]) {
    for (let k = 0; k < u.pilesPerSide; k++) {
      const z = -L / 2 + pc / 2 + (k * (L - pc)) / (u.pilesPerSide - 1);
      parts.add('dark', box(pc, base + 0.06, pc, s * (W / 2 - pc / 2), (base - 0.06) / 2, z));
    }
  }

  // The lens array: per row a tracker tube on posts, and the tilted lenses on it.
  const rowW = W / lens.rows;
  const pivotY = top + lens.pivotM;
  const span = L - 2 * c;
  const pitch = span / lens.perRow;
  for (let row = 0; row < lens.rows; row++) {
    const x = -W / 2 + rowW * (row + 1 / 2);
    parts.add(
      'steel',
      rod(
        new Vector3(x, pivotY, -span / 2),
        new Vector3(x, pivotY, span / 2),
        lens.tubeRadiusM,
        12,
      ),
    );
    for (let k = 0; k < lens.postsPerRow; k++) {
      const z = -span / 2 + (k * span) / (lens.postsPerRow - 1);
      parts.add('steel', box(lens.postM, lens.pivotM, lens.postM, x, top + lens.pivotM / 2, z));
    }
    for (let k = 0; k < lens.perRow; k++) {
      const z = -span / 2 + pitch * (k + 1 / 2);
      const lift = lens.tubeRadiusM + lens.frameDepthM / 2;
      const frame = new BoxGeometry(lens.panelAcrossM, lens.frameDepthM, lens.panelAlongM)
        .translate(0, lift, 0)
        .rotateZ(-tilt)
        .translate(x, pivotY, z);
      const glass = new BoxGeometry(
        lens.panelAcrossM - 2 * lens.frameM,
        lens.glassM,
        lens.panelAlongM - 2 * lens.frameM,
      )
        .translate(0, lift + lens.frameDepthM / 2 + lens.glassM / 2 - 0.004, 0)
        .rotateZ(-tilt)
        .translate(x, pivotY, z);
      parts.add('steel', frame);
      parts.add('glass', glass);
    }
  }
  return parts;
}

/** Height of a unit's roof above the ground. */
export function roofY(): number {
  return SCENE3D.unit.pileCapM + SCENE3D.unit.heightM;
}

/** The module's head offset from the corner, out along the diagonal (east and north). */
export function moduleOffset(): number {
  return SCENE3D.module.armOutM / Math.SQRT2;
}

/** A radio head at (x, y, z): the enclosure, a radome facing each of the four ways, the cap and the light. */
/** A box with rounded edges of `r`, centered at (x, y, z). */
function rounded(w: number, h: number, d: number, r: number, x: number, y: number, z: number) {
  return new RoundedBoxGeometry(w, h, d, 2, r).translate(x, y, z);
}

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
