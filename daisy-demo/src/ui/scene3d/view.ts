// The 3D view's renderer and camera (D125): renders on demand, flies the camera between poses, and once it
// has landed hands the camera to orbit controls around the module. Every rendered frame reports where the
// label anchors are on screen, so the labels follow the scene without a React render per frame.
import { NeutralToneMapping, PCFShadowMap, PerspectiveCamera, Vector3, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SCENE3D } from '../../config/scene3d';
import {
  easeInOut,
  flyPose,
  poseEye,
  poseLookingAt,
  poseRotation,
  type Pose,
  type Vec3,
} from './pose';
import { buildWorld, type World, type WorldInput } from './world';

/** A label anchor on screen, in CSS pixels of the canvas. */
export interface ScreenPoint {
  sx: number;
  sy: number;
  visible: boolean;
}

export interface FramePoints {
  module: ScreenPoint;
  beams: ScreenPoint[];
}

/** A screen rectangle the beam labels keep clear of (the card), in CSS pixels of the canvas. */
export interface ScreenRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const DEG = Math.PI / 180;
/** Near plane as a share of the camera's distance to its target: keeps depth precise from high up. */
const NEAR_PER_DISTANCE = 0.02;
const NEAR_MIN_M = 0.05;

export class CornerView {
  private readonly renderer: WebGLRenderer;
  private readonly camera: PerspectiveCamera;
  private readonly world: World;
  private readonly controls: OrbitControls;
  private pose: Pose;
  private flight: {
    from: Pose;
    to: Pose;
    start: number;
    ms: number;
    reverse: boolean;
    done: () => void;
  } | null = null;
  private raf = 0;
  private width = 1;
  private height = 1;
  private readonly anchor = new Vector3();
  private readonly along = new Vector3();
  private avoid: ScreenRect | null = null;
  private callout = { w: 0, h: 0 };

  constructor(
    canvas: HTMLCanvasElement,
    input: WorldInput,
    private readonly onFrame: (points: FramePoints) => void,
  ) {
    const r = SCENE3D.render;
    const renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, r.maxPixelRatio));
    renderer.toneMapping = NeutralToneMapping;
    renderer.toneMappingExposure = r.exposure;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;
    this.renderer = renderer;

    const c = SCENE3D.camera;
    this.camera = new PerspectiveCamera(c.fovDeg, 1, c.nearM, c.farM);
    this.camera.rotation.order = 'YXZ';
    this.world = buildWorld(renderer, input);

    const o = c.orbit;
    const controls = new OrbitControls(this.camera, canvas);
    controls.enabled = false;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = o.damping;
    controls.rotateSpeed = o.rotateSpeed;
    controls.zoomSpeed = o.zoomSpeed;
    controls.minDistance = o.minDistanceM;
    controls.maxDistance = o.maxDistanceM;
    controls.minPolarAngle = Math.PI / 2 - o.maxElevationDeg * DEG;
    controls.maxPolarAngle = Math.PI / 2 - o.minElevationDeg * DEG;
    controls.target.copy(this.world.antenna);
    controls.addEventListener('change', this.request);
    this.controls = controls;

    this.pose = poseLookingAt({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 });
  }

  /** The focus module's antenna point, where the camera lands. */
  get antenna(): Vec3 {
    return this.world.antenna;
  }

  /** Compile every material before the first frame, so the crossfade does not stutter. */
  compile(): Promise<void> {
    return this.renderer.compileAsync(this.world.scene, this.camera).then(() => undefined);
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.request();
  }

  setPose(p: Pose): void {
    this.pose = p;
    const eye = poseEye(p);
    const rot = poseRotation(p);
    this.camera.position.set(eye.x, eye.y, eye.z);
    this.camera.rotation.set(rot.x, rot.y, rot.z, 'YXZ');
    this.place();
    this.request();
  }

  /** The camera's pose now: mid-flight, or wherever the viewer has orbited to. */
  currentPose(): Pose {
    return this.pose;
  }

  /**
   * Fly from `from` to `to` over `ms`, eased; `reverse` runs the same path backward (from `to` to `from`),
   * so the way back retraces the way in. Resolves when the camera arrives.
   */
  fly(from: Pose, to: Pose, ms: number, reverse = false): Promise<void> {
    this.controls.enabled = false;
    this.flight?.done();
    return new Promise((done) => {
      this.flight = { from, to, start: performance.now(), ms, reverse, done };
      this.request();
    });
  }

  /** Hand the camera to the viewer: orbit the module from where the flight landed. */
  land(): void {
    this.controls.target.copy(this.world.antenna);
    this.controls.enabled = true;
    this.controls.update();
    this.request();
  }

  /** Keep the beam labels clear of this rectangle (the card over the view). */
  setLabelAvoid(rect: ScreenRect | null): void {
    this.avoid = rect;
    this.request();
  }

  /** The module callout's box size, so the beam labels keep clear of it too. */
  setCalloutSize(w: number, h: number): void {
    this.callout = { w, h };
  }

  /** Stop orbiting (on the way back). */
  release(): void {
    this.controls.enabled = false;
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.flight?.done();
    this.flight = null;
    this.controls.removeEventListener('change', this.request);
    this.controls.dispose();
    this.world.dispose();
    this.renderer.dispose();
  }

  private readonly request = () => {
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  };

  private readonly frame = (now: number) => {
    this.raf = 0;
    let again = false;
    const f = this.flight;
    if (f) {
      const u = Math.min(1, Math.max(0, (now - f.start) / Math.max(1, f.ms)));
      const s = easeInOut(u);
      this.setPose(flyPose(f.from, f.to, f.reverse ? 1 - s : s));
      if (u >= 1) {
        this.flight = null;
        f.done();
      } else again = true;
    } else if (this.controls.enabled) {
      again = this.controls.update();
      this.keepAboveGround();
      this.pose = poseLookingAt(this.camera.position, this.controls.target);
      this.place();
    }
    this.renderer.render(this.world.scene, this.camera);
    this.onFrame(this.points());
    if (again) this.request();
  };

  /** The camera stays at least an eye height above the ground while orbiting. */
  private keepAboveGround(): void {
    const minEye = SCENE3D.camera.orbit.minEyeM;
    if (this.camera.position.y >= minEye) return;
    const p = poseLookingAt(this.camera.position, this.controls.target);
    const sin = (minEye - p.target.y) / p.distance;
    const eye = poseEye({ ...p, elevation: Math.asin(Math.max(-1, Math.min(1, sin))) });
    this.camera.position.set(eye.x, eye.y, eye.z);
    this.camera.lookAt(this.controls.target);
  }

  /** Near plane, sky and shadow box for the camera where it is now. */
  private place(): void {
    const near = Math.max(NEAR_MIN_M, this.pose.distance * NEAR_PER_DISTANCE);
    if (Math.abs(near - this.camera.near) > 1e-6) {
      this.camera.near = near;
      this.camera.updateProjectionMatrix();
    }
    this.camera.updateMatrixWorld();
    const t = this.pose.target;
    this.world.follow(this.camera.position, new Vector3(t.x, t.y, t.z), this.pose.distance);
  }

  private points(): FramePoints {
    const toScreen = (v: Vec3): ScreenPoint => {
      this.anchor.set(v.x, v.y, v.z).project(this.camera);
      const { x, y, z } = this.anchor;
      return {
        sx: ((x + 1) / 2) * this.width,
        sy: ((1 - y) / 2) * this.height,
        visible: z > -1 && z < 1 && Math.abs(x) <= 1.05 && Math.abs(y) <= 1.05,
      };
    };
    const b = SCENE3D.beam;
    const m = b.labelMarginPx;
    const module = toScreen(this.world.moduleTop);
    const c = SCENE3D.callout;
    const avoid: ScreenRect[] = this.avoid ? [this.avoid] : [];
    if (module.visible) {
      avoid.push({
        left: module.sx + c.dxPx,
        right: module.sx + c.dxPx + this.callout.w,
        top: module.sy - c.dyPx - this.callout.h,
        bottom: module.sy - c.dyPx,
      });
    }
    const fits = (p: ScreenPoint) => {
      const left = p.sx - b.labelBoxPx.w / 2;
      const right = p.sx + b.labelBoxPx.w / 2;
      const top = p.sy - b.labelBoxPx.h;
      if (!p.visible || left < m || right > this.width - m) return false;
      if (top < m || p.sy > this.height - m) return false;
      return avoid.every((a) => right < a.left || left > a.right || p.sy < a.top || top > a.bottom);
    };
    // Each beam's label at the farthest distance along it where the label fits, else hidden.
    const beams = this.world.beams.map((ray) => {
      for (const d of b.labelAtM) {
        const p = toScreen(this.along.copy(ray.origin).addScaledVector(ray.dir, d));
        if (fits(p)) return p;
      }
      return { sx: 0, sy: 0, visible: false };
    });
    return { module, beams };
  }
}
