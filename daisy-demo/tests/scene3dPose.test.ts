import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { UNIT_HEIGHT_M } from '../src/config/defaults';
import { SCENE3D } from '../src/config/scene3d';
import { PLAY_MODEL } from '../src/state/build';
import { fitWithCoverage } from '../src/ui/build/BuildMap';
import { worldToScreen } from '../src/ui/map/viewport';
import { antennaOffset } from '../src/ui/scene3d/geometry';
import {
  easeInOut,
  flyPose,
  landingPose,
  poseEye,
  poseFromViewport,
  poseRotation,
  projectPoint,
  toScene,
  type Pose,
  type Vec3,
} from '../src/ui/scene3d/pose';
import { featuredRadio } from '../src/ui/scene3d/featured';

// D125: the 3D view starts on the pose that shows the site exactly as the Build map does, and flies from there
// down to the side of the featured radio's corner module, keeping the module on screen.

const FOV = SCENE3D.camera.fovDeg;
const SIZES = [
  [1280, 720],
  [1440, 900],
  [900, 640],
] as const;
const radio = PLAY_MODEL.radios[featuredRadio(PLAY_MODEL)];
const antenna: Vec3 = antennaOffset().add(new Vector3(radio.x, 0, -radio.y));

/** Points of the site: the section's corners, the featured radio and the base. */
const POINTS = [
  [0, 0],
  [PLAY_MODEL.widthM, 0],
  [0, PLAY_MODEL.heightM],
  [PLAY_MODEL.widthM, PLAY_MODEL.heightM],
  [radio.x, radio.y],
  [PLAY_MODEL.base.x, PLAY_MODEL.base.y],
];

/** The same projection through a three.js camera at the pose. */
function threeProject(pose: Pose, w: number, h: number, p: Vec3) {
  const camera = new PerspectiveCamera(FOV, w / h, 0.01, 1e6);
  const eye = poseEye(pose);
  const rot = poseRotation(pose);
  camera.position.set(eye.x, eye.y, eye.z);
  camera.rotation.set(rot.x, rot.y, rot.z, 'YXZ');
  camera.updateMatrixWorld();
  const v = new Vector3(p.x, p.y, p.z).project(camera);
  return { sx: ((v.x + 1) / 2) * w, sy: ((1 - v.y) / 2) * h };
}

describe('the 3D view starts where the map is (D125)', () => {
  it('puts every point of the ground on the pixel the map draws it at', () => {
    for (const [w, h] of SIZES) {
      const v = fitWithCoverage(PLAY_MODEL, w, h);
      const pose = poseFromViewport(v, FOV);
      expect(pose.elevation).toBe(Math.PI / 2);
      for (const [x, y] of POINTS) {
        const map = worldToScreen(v, x, y);
        const p = projectPoint(pose, FOV, w, h, toScene(x, y));
        expect(p.sx).toBeCloseTo(map.sx, 6);
        expect(p.sy).toBeCloseTo(map.sy, 6);
      }
    }
  });

  it('is high enough that the units barely lean: a roof lands within 2 px of its footprint', () => {
    for (const [w, h] of SIZES) {
      const v = fitWithCoverage(PLAY_MODEL, w, h);
      const pose = poseFromViewport(v, FOV);
      for (const [x, y] of POINTS) {
        const ground = projectPoint(pose, FOV, w, h, toScene(x, y));
        const roof = projectPoint(pose, FOV, w, h, toScene(x, y, UNIT_HEIGHT_M));
        expect(Math.hypot(roof.sx - ground.sx, roof.sy - ground.sy)).toBeLessThan(2);
      }
    }
  });

  it('agrees with a three.js camera placed by the pose, from the start, mid-flight and landed', () => {
    const [w, h] = SIZES[1];
    const from = poseFromViewport(fitWithCoverage(PLAY_MODEL, w, h), FOV);
    const to = landingPose(antenna);
    for (const s of [0, 0.3, 0.6, 0.9, 1]) {
      const pose = flyPose(from, to, s);
      for (const p of [
        antenna,
        toScene(radio.x - 30, radio.y + 40),
        toScene(radio.x, radio.y, 1),
      ]) {
        const ours = projectPoint(pose, FOV, w, h, p);
        if (ours.depth <= 0) continue;
        const theirs = threeProject(pose, w, h, p);
        expect(ours.sx).toBeCloseTo(theirs.sx, 4);
        expect(ours.sy).toBeCloseTo(theirs.sy, 4);
      }
    }
  });
});

describe('the flight (D125)', () => {
  const [w, h] = SIZES[1];
  const from = poseFromViewport(fitWithCoverage(PLAY_MODEL, w, h), FOV);
  const to = landingPose(antenna);

  it('starts on the map pose and lands on the landing pose', () => {
    expect(flyPose(from, to, 0)).toEqual(from);
    const end = flyPose(from, to, 1);
    expect(end.distance).toBeCloseTo(to.distance, 9);
    expect(end.elevation).toBeCloseTo(to.elevation, 9);
    expect(end.azimuth).toBeCloseTo(to.azimuth, 9);
    expect(end.target.x).toBeCloseTo(to.target.x, 9);
    expect(end.target.z).toBeCloseTo(to.target.z, 9);
  });

  it('slides the module on a straight line to the middle of the screen while it comes down', () => {
    const start = projectPoint(from, FOV, w, h, antenna);
    let last = Infinity;
    for (let s = 0; s <= SCENE3D.motion.turnFrom; s += 0.01) {
      const p = projectPoint(flyPose(from, to, s), FOV, w, h, antenna);
      // On the segment from where the map shows it to the middle, and always closer to the middle.
      const cross = (p.sx - w / 2) * (start.sy - h / 2) - (p.sy - h / 2) * (start.sx - w / 2);
      expect(Math.abs(cross)).toBeLessThan(1e-3 * w * h);
      const toMiddle = Math.hypot(p.sx - w / 2, p.sy - h / 2);
      expect(toMiddle).toBeLessThanOrEqual(last + 1e-9);
      last = toMiddle;
    }
  });

  it('keeps the module on screen the whole way', () => {
    for (let s = 0; s <= 1.0001; s += 0.01) {
      const p = projectPoint(flyPose(from, to, s), FOV, w, h, antenna);
      expect(p.depth).toBeGreaterThan(0);
      expect(p.sx).toBeGreaterThanOrEqual(0);
      expect(p.sx).toBeLessThanOrEqual(w);
      expect(p.sy).toBeGreaterThanOrEqual(0);
      expect(p.sy).toBeLessThanOrEqual(h);
    }
  });

  it('never goes below a standing eye height', () => {
    for (let s = 0; s <= 1.0001; s += 0.01) {
      expect(poseEye(flyPose(from, to, s)).y).toBeGreaterThan(SCENE3D.camera.orbit.minEyeM);
    }
  });

  it('eases in and out', () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 9);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(-1)).toBe(0);
    expect(easeInOut(2)).toBe(1);
  });
});

describe('the landing (D125)', () => {
  const eye = poseEye(landingPose(antenna));
  const site = { x: eye.x, y: -eye.z };

  it('stands beside the lane, a little above the units, with a clear view of the module', () => {
    expect(eye.y).toBeGreaterThan(SCENE3D.camera.orbit.minEyeM);
    expect(eye.y).toBeLessThan(8);
    const roof = SCENE3D.unit.pileCapM + UNIT_HEIGHT_M;
    const hw = PLAY_MODEL.unitSizeXM / 2;
    const hl = PLAY_MODEL.unitSizeYM / 2;
    // The line of sight from the eye to the antennas passes through no unit.
    for (const u of PLAY_MODEL.units) {
      for (let k = 0; k <= 0.97; k += 0.01) {
        const x = site.x + (antenna.x - site.x) * k;
        const y = site.y + (-antenna.z - site.y) * k;
        const hAt = eye.y + (antenna.y - eye.y) * k;
        const inside = Math.abs(x - u.x) < hw && Math.abs(y - u.y) < hl && hAt < roof;
        expect(inside).toBe(false);
      }
    }
  });
});
