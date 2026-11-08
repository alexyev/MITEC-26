// Camera poses of the 3D view (D125): a pose orbits a target point, so the flight from the map to the module
// interpolates a target, a distance and two angles. Pure math, no three.js, so tests can check it directly.
//
// Scene frame: x east, y up, z south (world meters x east, y north become (x, h, -y)), as in three.js.
import { SCENE3D } from '../../config/scene3d';
import type { Viewport } from '../map/viewport';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** A camera around `target`: `distance` away, `elevation` above the horizon, `azimuth` from the south. */
export interface Pose {
  target: Vec3;
  distance: number;
  /** Radians: pi/2 looks straight down. */
  elevation: number;
  /** Radians: 0 puts the camera south of the target looking north; positive turns it toward the east. */
  azimuth: number;
}

const DEG = Math.PI / 180;

/** A point of the site (meters east, north, up) in the scene frame. */
export function toScene(x: number, y: number, h = 0): Vec3 {
  return { x, y: h, z: -y };
}

/** Tangent of half the vertical field of view. */
export function halfFovTan(fovDeg: number): number {
  return Math.tan((fovDeg * DEG) / 2);
}

/**
 * The pose that shows the ground exactly as the 2D map's viewport does: straight down over the viewport's
 * center, north up, high enough that a meter on the ground is `scale` CSS pixels on a canvas of the same height.
 */
export function poseFromViewport(v: Viewport, fovDeg: number): Pose {
  return {
    target: toScene(v.cx, v.cy),
    distance: v.height / (2 * v.scale * halfFovTan(fovDeg)),
    elevation: Math.PI / 2,
    azimuth: 0,
  };
}

/** Camera position of a pose. */
export function poseEye(p: Pose): Vec3 {
  const c = Math.cos(p.elevation);
  return {
    x: p.target.x + p.distance * c * Math.sin(p.azimuth),
    y: p.target.y + p.distance * Math.sin(p.elevation),
    z: p.target.z + p.distance * c * Math.cos(p.azimuth),
  };
}

/**
 * Camera rotation of a pose as yaw-pitch Euler angles (three.js order 'YXZ'): no roll, and well defined
 * straight down, where screen up is the yawed forward direction (north at azimuth 0).
 */
export function poseRotation(p: Pose): { x: number; y: number; z: number } {
  return { x: -p.elevation, y: p.azimuth, z: 0 };
}

/** The pose of a camera at `eye` looking at `target` (the inverse of poseEye). */
export function poseLookingAt(eye: Vec3, target: Vec3): Pose {
  const dx = eye.x - target.x;
  const dy = eye.y - target.y;
  const dz = eye.z - target.z;
  const distance = Math.hypot(dx, dy, dz);
  return {
    target: { ...target },
    distance,
    elevation: Math.asin(Math.max(-1, Math.min(1, dy / Math.max(distance, 1e-9)))),
    azimuth: Math.atan2(dx, dz),
  };
}

/** The landing pose around the module's antenna point. */
export function landingPose(antenna: Vec3): Pose {
  const e = SCENE3D.camera.end;
  return {
    target: { ...antenna },
    distance: e.distanceM,
    elevation: e.elevationDeg * DEG,
    azimuth: e.azimuthDeg * DEG,
  };
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Ease in and out (cubic), for the flight's progress. */
export function easeInOut(u: number): number {
  const x = clamp01(u);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/** The shortest signed turn from angle `a` to angle `b`. */
function turn(a: number, b: number): number {
  const d = (((b - a) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI);
  return d - Math.PI;
}

/**
 * The pose `s` of the way (0 to 1, already eased) from `from` to `to`. The distance eases geometrically, so
 * the descent feels even; the tilt and the turn start late, so the camera first comes down over the map and
 * then swings round to the side. The target moves so that `to.target` slides on a straight screen line from
 * where `from` shows it to the middle of the screen (exact while looking straight down): it never leaves the
 * screen. Running `s` from 1 to 0 flies back the same way.
 */
export function flyPose(from: Pose, to: Pose, s: number): Pose {
  const m = SCENE3D.motion;
  const x = clamp01(s);
  const distance = from.distance * Math.pow(to.distance / from.distance, x);
  const glide = (1 - x) * (distance / from.distance);
  const tilt = smoothstep(m.tiltFrom, 1, x);
  const spin = smoothstep(m.turnFrom, 1, x);
  return {
    target: {
      x: to.target.x + (from.target.x - to.target.x) * glide,
      y: to.target.y + (from.target.y - to.target.y) * glide,
      z: to.target.z + (from.target.z - to.target.z) * glide,
    },
    distance,
    elevation: from.elevation + (to.elevation - from.elevation) * tilt,
    azimuth: from.azimuth + turn(from.azimuth, to.azimuth) * spin,
  };
}

/** Where a scene point lands on a canvas of `width` x `height` CSS pixels, for a camera at `pose`. */
export function projectPoint(
  pose: Pose,
  fovDeg: number,
  width: number,
  height: number,
  p: Vec3,
): { sx: number; sy: number; depth: number } {
  const eye = poseEye(pose);
  // Camera basis from the yaw-pitch rotation: right, up and forward (the camera looks down -forward).
  const ca = Math.cos(pose.azimuth);
  const sa = Math.sin(pose.azimuth);
  const ce = Math.cos(pose.elevation);
  const se = Math.sin(pose.elevation);
  const right = { x: ca, y: 0, z: -sa };
  const up = { x: -sa * se, y: ce, z: -ca * se };
  const back = { x: sa * ce, y: se, z: ca * ce };
  const d = { x: p.x - eye.x, y: p.y - eye.y, z: p.z - eye.z };
  const cx = d.x * right.x + d.y * right.y + d.z * right.z;
  const cy = d.x * up.x + d.y * up.y + d.z * up.z;
  const depth = -(d.x * back.x + d.y * back.y + d.z * back.z);
  const k = height / 2 / halfFovTan(fovDeg);
  return { sx: width / 2 + (cx / depth) * k, sy: height / 2 - (cy / depth) * k, depth };
}
