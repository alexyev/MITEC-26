import {
  BufferGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  Ray,
  Raycaster,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { describe, expect, it } from 'vitest';
import { SCENE3D } from '../src/config/scene3d';
import { PLAY_MODEL } from '../src/state/build';
import {
  antennaOffset,
  brandSizeM,
  finCorners,
  lensCenter,
  lensCorners,
  p3BodyParts,
  portholeCenter,
  roofY,
  trackerFrame,
  trackerLayout,
  trackerParts,
  type TrackerFrame,
} from '../src/ui/scene3d/geometry';
import { featuredRadio } from '../src/ui/scene3d/featured';
import { landingPose, poseEye } from '../src/ui/scene3d/pose';
import { sunDirection } from '../src/ui/scene3d/world';

// D150 to D153: the P3 from the captain's reference. Each unit's tracker aims its lens at the sun with the
// lens's axis through the unit's porthole, stands clear of its container and of the corner module, and none of
// them, nor any unit, hides the module from the landing view.

const u = SCENE3D.unit;
const t = SCENE3D.tracker;
const DEG = Math.PI / 180;
const sun = sunDirection();
const layout = trackerLayout(sun);
const live = trackerFrame(layout, layout.sunElevation);
const stowed = trackerFrame(layout, t.stowElevationDeg * DEG);

/** Points over a quad given by its corners, `n` x `n` of them, edges included. */
function overQuad(c: Vector3[], n = 12): Vector3[] {
  const out: Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      const a = c[0].clone().lerp(c[1], i / n);
      const b = c[3].clone().lerp(c[2], i / n);
      out.push(a.lerp(b, j / n));
    }
  }
  return out;
}

/** The container with its roof railing, as a box, unit-local, grown by `m`. */
function inContainer(p: Vector3, m: number): boolean {
  const top = roofY() + u.railing.heightM;
  return (
    Math.abs(p.x) < u.widthM / 2 + u.railProudM + m &&
    Math.abs(p.z) < u.lengthM / 2 + u.railProudM + m &&
    p.y < top + m
  );
}

describe('the receiver porthole and the sun (D150, D152)', () => {
  it('sits high on the east wall, which faces the sun', () => {
    const p = portholeCenter();
    expect(p.x).toBeGreaterThan(u.widthM / 2);
    expect(p.y).toBeGreaterThan(roofY() - 1);
    expect(p.z).toBeLessThan(0);
    // The east wall's normal is +x: the sun stands well in front of it, not grazing.
    expect(sun.x).toBeGreaterThan(0.5);
    expect(sun.y).toBeGreaterThan(0);
  });

  it('is above the end of the wordmark, as in the reference', () => {
    const p = portholeCenter();
    const { wM, hM } = brandSizeM();
    const markTop = u.branding.centerAtM + hM / 2;
    // The wordmark's north end is under the porthole's plate, and the plate clears the wordmark's text.
    expect(Math.abs(-wM / 2 - p.z)).toBeLessThan(u.porthole.plateM[0]);
    const capTop = u.branding.centerAtM + (u.branding.capShare * u.heightM) / 2;
    expect(p.y - u.porthole.plateM[1] / 2).toBeGreaterThan(capTop);
    expect(markTop).toBeLessThan(roofY());
  });
});

describe('the tracker (D152)', () => {
  it('turns its live lens to face the sun, with the axis through the porthole at the focal length', () => {
    expect(live.normal.distanceTo(sun)).toBeLessThan(1e-9);
    const toLens = lensCenter(live).sub(layout.porthole);
    expect(toLens.length()).toBeCloseTo(t.focalM, 9);
    expect(toLens.normalize().distanceTo(sun)).toBeLessThan(1e-9);
  });

  it('keeps a level axle square to the sun, so the lens tilts only in elevation', () => {
    expect(layout.axle.y).toBe(0);
    expect(Math.abs(layout.axle.dot(sun))).toBeLessThan(1e-9);
    expect(stowed.normal.y).toBeCloseTo(1, 9);
  });

  it('stands its pole on the ground east of the wall, clear of the fin and lens', () => {
    expect(layout.head.x - u.widthM / 2).toBeGreaterThan(2);
    expect(layout.head.y).toBeGreaterThan(roofY());
    expect(layout.head.y).toBeLessThan(roofY() + 1.5);
  });

  for (const [name, f] of [
    ['live', live],
    ['stowed', stowed],
  ] as [string, TrackerFrame][]) {
    it(`clears its container and the railing with the lens and the fin, ${name}`, () => {
      for (const p of [...overQuad(lensCorners(f)), ...overQuad(finCorners(f))]) {
        expect(inContainer(p, 0.15)).toBe(false);
        expect(p.y).toBeGreaterThan(0.5);
      }
    });

    it(`keeps well away from the corner module, ${name}`, () => {
      // The module's antennas, unit-local: off the north-east corner.
      const antenna = antennaOffset().add(new Vector3(u.widthM / 2, 0, -u.lengthM / 2));
      const parts = [...overQuad(lensCorners(f)), ...overQuad(finCorners(f)), layout.head];
      for (const p of parts) expect(p.distanceTo(antenna)).toBeGreaterThan(2);
      // Everything of the tracker stays south of the unit's north end.
      for (const p of parts) expect(p.z).toBeGreaterThan(-u.lengthM / 2 + 1);
    });
  }
});

describe('the landing view of the module (D125, D153)', () => {
  // Every unit's container and live tracker as one mesh, raycast unit by unit from the landing eye.
  const geoms = [
    ...p3BodyParts().merged().values(),
    ...trackerParts(layout, layout.sunElevation).merged().values(),
  ];
  const plain = geoms.map((g) => {
    const p = new BufferGeometry();
    p.setAttribute('position', g.getAttribute('position'));
    if (g.index) p.setIndex(g.index);
    return p.index ? p.toNonIndexed() : p;
  });
  const unit = new Mesh(
    mergeGeometries(plain, false)!,
    new MeshBasicMaterial({ side: DoubleSide }),
  );
  unit.geometry.computeBoundingSphere();
  const radio = PLAY_MODEL.radios[featuredRadio(PLAY_MODEL)];
  const antenna = antennaOffset().add(new Vector3(radio.x, 0, -radio.y));
  const eye = poseEye(landingPose(antenna));
  const from = new Vector3(eye.x, eye.y, eye.z);

  it('sees the module past every unit and every tracker', () => {
    const along = new Vector3().subVectors(antenna, from);
    const reach = along.length() * 0.97;
    const dir = along.normalize();
    const raycaster = new Raycaster();
    const radius = unit.geometry.boundingSphere!.radius;
    let checked = 0;
    for (const p of PLAY_MODEL.units) {
      const at = new Vector3(p.x, 0, -p.y);
      // Only units whose bounding sphere comes near the line of sight.
      if (new Ray(from, dir).distanceToPoint(at) > radius + 1) continue;
      checked++;
      raycaster.set(from.clone().sub(at), dir);
      raycaster.far = reach;
      expect(raycaster.intersectObject(unit, false)).toEqual([]);
    }
    expect(checked).toBeGreaterThan(0);
  });
});
