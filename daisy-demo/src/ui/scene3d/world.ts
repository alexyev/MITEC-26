// The 3D world of a radio's corner (D122 to D124): the play-model section as it stood on the map when the
// viewer flew down (the units placed by then, every built radio's corner module with its status light, the
// base), on desert ground under a morning sky, with the focus module's four beams. Colors come from tokens.
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  FogExp2,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NormalBlending,
  Object3D,
  PlaneGeometry,
  PMREMGenerator,
  Quaternion,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
  BackSide,
  type WebGLRenderer,
} from 'three';
import { SCENE3D } from '../../config/scene3d';
import { RadioBuild, type PlayModel } from '../../engine/playModel';
import { createRng } from '../../engine/rng';
import type { Scene as MapScene } from '../build/scene';
import { cssVar } from '../kit/tokens';
import { radioStatus, type CornerFacts } from './cornerFacts';
import { antennaOffset, baseParts, moduleParts, p3Parts, type PartKey } from './geometry';
import {
  corrugationNormalMap,
  fresnelNormalMap,
  fresnelRingMap,
  grainTexture,
  toneNoise,
} from './textures';

export interface ScenePalette {
  unit: Color;
  steel: Color;
  dark: Color;
  lens: Color;
  module: Color;
  ground: Color;
  graded: Color;
  pad: Color;
  scrub: Color;
  sky: Color;
  horizon: Color;
  sun: Color;
  shade: Color;
  signal: Color;
  work: Color;
  fail: Color;
}

/** The scene's colors from tokens.css, so the 3D view follows the palette. */
export function readScenePalette(): ScenePalette {
  const c = (name: string) => new Color(cssVar(name));
  return {
    unit: c('--c-scene-unit'),
    steel: c('--c-scene-steel'),
    dark: c('--c-scene-dark'),
    lens: c('--c-scene-lens'),
    module: c('--c-scene-module'),
    ground: c('--c-scene-ground'),
    graded: c('--c-scene-graded'),
    pad: c('--c-scene-pad'),
    scrub: c('--c-scene-scrub'),
    sky: c('--c-scene-sky'),
    horizon: c('--c-scene-horizon'),
    sun: c('--c-scene-sun'),
    shade: c('--c-scene-shade'),
    signal: c('--c-signal'),
    work: c('--c-work'),
    fail: c('--c-fail'),
  };
}

export interface WorldInput {
  model: PlayModel;
  scene: MapScene;
  radio: number;
  facts: CornerFacts;
}

/** A beam from the focus module's antennas: its direction in the scene. */
export interface BeamRay {
  key: CornerFacts['beams'][number]['key'];
  origin: Vector3;
  dir: Vector3;
}

export interface World {
  scene: Scene;
  /** The focus module's antennas, the point the camera lands on and orbits. */
  antenna: Vector3;
  /** Label anchors: above the module's head, and each beam's axis. */
  moduleTop: Vector3;
  beams: BeamRay[];
  /** Keep the sky around the camera and the sun's shadow box on what the camera sees. */
  follow(eye: Vector3, target: Vector3, distance: number): void;
  dispose(): void;
}

const DEG = Math.PI / 180;

/** Direction toward the sun in the scene frame (x east, y up, z south). */
export function sunDirection(): Vector3 {
  const a = SCENE3D.sun.azimuthDeg * DEG;
  const e = SCENE3D.sun.elevationDeg * DEG;
  return new Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
}

const SKY_VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 zenith;
  uniform vec3 horizon;
  uniform vec3 sunColor;
  uniform vec3 sunDir;
  uniform float glowPower;
  uniform float glowAmount;
  uniform float haze;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y, 0.0, 1.0);
    // A thin band of haze at the horizon, then sky blue: blue and sand mixed evenly would read grey.
    vec3 col = mix(horizon, zenith, 1.0 - exp(-h * haze));
    float s = max(dot(d, sunDir), 0.0);
    col += sunColor * glowAmount * pow(s, glowPower);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const BEAM_VERTEX = /* glsl */ `
  attribute vec2 beam;
  varying vec2 vBeam;
  void main() {
    vBeam = beam;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const BEAM_FRAGMENT = /* glsl */ `
  uniform vec3 color;
  uniform float alpha;
  uniform float core;
  uniform float fadeIn;
  uniform float fadeOut;
  uniform float lengthM;
  uniform float halfRad;
  uniform float lineM;
  uniform float lineAlpha;
  varying vec2 vBeam;
  void main() {
    // A soft wedge, most of it near the axis, and a crisp line on the axis a few centimeters wide.
    float across = vBeam.y / core;
    float offAxisM = vBeam.x * lengthM * sin(abs(vBeam.y) * halfRad);
    float line = exp(-0.5 * pow(offAxisM / lineM, 2.0));
    float a = alpha * exp(-0.5 * across * across) + lineAlpha * line;
    a *= smoothstep(0.0, fadeIn, vBeam.x) * (1.0 - smoothstep(1.0 - fadeOut, 1.0, vBeam.x));
    gl_FragColor = vec4(color, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function skyMaterial(p: ScenePalette, sun: Vector3): ShaderMaterial {
  const s = SCENE3D.world.sky;
  return new ShaderMaterial({
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    uniforms: {
      zenith: { value: p.sky },
      horizon: { value: p.horizon },
      sunColor: { value: p.sun },
      sunDir: { value: sun },
      glowPower: { value: s.sunGlowPower },
      glowAmount: { value: s.sunGlowAmount },
      haze: { value: s.haze },
    },
    side: BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
  });
}

/**
 * Darken a material toward the ground, as dust and shade do at the foot of a unit: `dark` at the ground,
 * none from `fadeM` up. Works on instanced meshes.
 */
function groundFade(material: MeshStandardMaterial, dark: number, fadeM: number): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.groundDark = { value: dark };
    shader.uniforms.groundFadeM = { value: fadeM };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vGroundH;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vGroundH = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).y;
        #else
          vGroundH = (modelMatrix * vec4(transformed, 1.0)).y;
        #endif`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying float vGroundH;\nuniform float groundDark;\nuniform float groundFadeM;',
      )
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\ndiffuseColor.rgb *= mix(groundDark, 1.0, smoothstep(0.0, groundFadeM, vGroundH));',
      );
  };
  material.customProgramCacheKey = () => `ground-fade-${dark}-${fadeM}`;
}

/** A flat fan along local +x: a grid in (distance, angle), its `beam` attribute (share along, share across). */
function beamGeometry(): BufferGeometry {
  const b = SCENE3D.beam;
  const half = b.halfWidthDeg * DEG;
  const rings = 24;
  const segs = b.segments;
  const pos: number[] = [];
  const attr: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const r = (i / rings) * b.lengthM;
    for (let j = 0; j <= segs; j++) {
      const k = (j / segs) * 2 - 1;
      const a = k * half;
      pos.push(r * Math.cos(a), 0, -r * Math.sin(a));
      attr.push(i / rings, k);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segs; j++) {
      const a = i * (segs + 1) + j;
      const c = a + segs + 1;
      index.push(a, c, a + 1, a + 1, c, c + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('beam', new BufferAttribute(new Float32Array(attr), 2));
  g.setIndex(index);
  return g;
}

/** A low range of hills on the horizon: a ring of quads, hazy at the foot and darker at the crest. */
function hillsGeometry(p: ScenePalette): BufferGeometry {
  const h = SCENE3D.world.hills;
  const rng = createRng(h.seed);
  const waves = Array.from({ length: 6 }, (_, i) => ({
    f: (i + 1) * (1.7 + rng.next()),
    phase: rng.next() * Math.PI * 2,
    amp: 1 / (i + 1.2),
  }));
  const norm = waves.reduce((s, w) => s + w.amp, 0);
  const crest = p.horizon.clone().lerp(p.sky, 0.32).multiplyScalar(0.94);
  const foot = p.horizon.clone();
  const pos: number[] = [];
  const col: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= h.segments; i++) {
    const a = (i / h.segments) * Math.PI * 2;
    let n = 0;
    for (const w of waves) n += w.amp * (0.5 + 0.5 * Math.sin(a * w.f + w.phase));
    const y = h.minM + (h.maxM - h.minM) * Math.pow(n / norm, 1.6);
    const x = Math.cos(a) * h.radiusM;
    const z = Math.sin(a) * h.radiusM;
    pos.push(x, -20, z, x, y, z);
    col.push(foot.r, foot.g, foot.b, crest.r, crest.g, crest.b);
    if (i < h.segments) {
      const k = i * 2;
      index.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.setIndex(index);
  return g;
}

export function buildWorld(renderer: WebGLRenderer, input: WorldInput): World {
  const { model, scene: map, radio, facts } = input;
  const p = readScenePalette();
  const cfg = SCENE3D;
  const scene = new Scene();
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => {
    disposables.push(x);
    return x;
  };
  scene.background = p.horizon.clone();
  scene.fog = new FogExp2(p.horizon, cfg.world.fogDensity);

  // Light: the sun with its shadow box, and the sky's fill.
  const sunDir = sunDirection();
  const sun = new DirectionalLight(p.sun, cfg.render.sunIntensity);
  sun.castShadow = true;
  sun.shadow.mapSize.set(cfg.render.shadowMapPx, cfg.render.shadowMapPx);
  sun.shadow.bias = cfg.render.shadowBias;
  sun.shadow.normalBias = cfg.render.shadowNormalBias;
  scene.add(sun, sun.target);
  scene.add(new HemisphereLight(p.shade, p.ground, cfg.render.skyIntensity));

  // The sky dome, and the same sky (over sand) as the environment the metal and the lenses reflect.
  const sky = new Mesh(
    keep(new SphereGeometry(cfg.world.sky.radiusM, 48, 24)),
    keep(skyMaterial(p, sunDir)),
  );
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  scene.add(sky);
  const envScene = new Scene();
  envScene.add(new Mesh(sky.geometry, sky.material));
  const floor = new Mesh(
    keep(new PlaneGeometry(400, 400).rotateX(-Math.PI / 2).translate(0, -2, 0)),
    keep(new MeshBasicMaterial({ color: p.ground })),
  );
  envScene.add(floor);
  const pmrem = new PMREMGenerator(renderer);
  const env = keep(pmrem.fromScene(envScene, 0.02).texture);
  pmrem.dispose();
  scene.environment = env;
  scene.environmentIntensity = cfg.render.envIntensity;

  // Materials.
  const corrugation = keep(corrugationNormalMap(cfg.unit.corrugationStrength));
  const fresnel = keep(fresnelNormalMap(cfg.lens.rings, cfg.lens.texturePx));
  const rings = keep(fresnelRingMap(cfg.lens.rings, cfg.lens.texturePx, cfg.lens.ringDepth));
  const enclosure = p.module.clone().lerp(p.dark, 0.32);
  const materials: Record<PartKey, Material> = {
    wall: new MeshStandardMaterial({
      color: p.unit,
      roughness: 0.6,
      metalness: 0.12,
      normalMap: corrugation,
      normalScale: new Vector2(1, 1),
    }),
    frame: new MeshStandardMaterial({ color: p.unit, roughness: 0.52, metalness: 0.12 }),
    dark: new MeshStandardMaterial({ color: p.dark, roughness: 0.7, metalness: 0.25 }),
    steel: new MeshStandardMaterial({ color: p.steel, roughness: 0.36, metalness: 0.8 }),
    glass: new MeshStandardMaterial({
      color: p.lens,
      map: rings,
      roughness: 0.1,
      metalness: 0.35,
      normalMap: fresnel,
      normalScale: new Vector2(0.55, 0.55),
    }),
    module: new MeshStandardMaterial({ color: p.module, roughness: 0.42, metalness: 0.02 }),
    enclosure: new MeshStandardMaterial({ color: enclosure, roughness: 0.5, metalness: 0.05 }),
    // White, so each instance's color is the light's own story color.
    led: new MeshBasicMaterial({ color: new Color(1, 1, 1), toneMapped: false }),
  };
  for (const m of Object.values(materials)) keep(m);
  for (const key of ['wall', 'frame'] as const) {
    groundFade(materials[key] as MeshStandardMaterial, cfg.unit.groundDark, cfg.unit.groundFadeM);
  }

  const matrix = new Matrix4();
  const instanced = (geoms: Map<PartKey, BufferGeometry>, at: Vector3[]) => {
    const meshes: InstancedMesh[] = [];
    for (const [key, g] of geoms) {
      keep(g);
      const mesh = new InstancedMesh(g, materials[key], Math.max(1, at.length));
      mesh.count = at.length;
      at.forEach((v, i) => mesh.setMatrixAt(i, matrix.makeTranslation(v.x, v.y, v.z)));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = key !== 'led';
      mesh.receiveShadow = key !== 'led';
      mesh.computeBoundingSphere();
      scene.add(mesh);
      meshes.push(mesh);
    }
    return meshes;
  };

  // The units placed by the time the viewer flew down, each with its lens array tilted toward the sun.
  const tilt = Math.atan2(sunDir.x, sunDir.y);
  const unitsAt = model.units
    .filter((u) => map.unitPlaced[u.id])
    .map((u) => new Vector3(u.x, 0, -u.y));
  instanced(p3Parts(tilt).merged(), unitsAt);

  // Every built radio's module, its light in the map's story colors.
  const built = model.radios.filter((r) => map.radioBuild[r.id] !== RadioBuild.None);
  const moduleMeshes = instanced(
    moduleParts().merged(),
    built.map((r) => new Vector3(r.x, 0, -r.y)),
  );
  const ledColor = (id: number) => {
    const s = radioStatus(map, id);
    return s === 'online' ? p.signal : s === 'waiting' ? p.work : p.fail;
  };
  const leds = moduleMeshes.find((m) => m.material === materials.led);
  built.forEach((r, i) => leds?.setColorAt(i, ledColor(r.id)));
  if (leds?.instanceColor) leds.instanceColor.needsUpdate = true;

  // The base on its pad.
  const b = model.base;
  const baseMeshes = instanced(baseParts().merged(), [new Vector3(b.x, 0, -b.y)]);
  baseMeshes.find((m) => m.material === materials.led)?.setColorAt(0, p.signal);

  // Ground: desert with a large-scale tone and sand grain; the graded site; the gravel pad.
  const w = cfg.world;
  const groundGeom = keep(
    new PlaneGeometry(w.groundSizeM, w.groundSizeM, w.groundSegments, w.groundSegments).rotateX(
      -Math.PI / 2,
    ),
  );
  const tone = toneNoise(w.groundToneCellM, cfg.world.scrub.seed);
  const gp = groundGeom.getAttribute('position');
  const colors = new Float32Array(gp.count * 3);
  const tmp = new Color();
  for (let i = 0; i < gp.count; i++) {
    const k = 1 + w.groundToneAmount * (tone(gp.getX(i), gp.getZ(i)) - 0.5) * 2;
    tmp.copy(p.ground).multiplyScalar(k);
    colors.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  groundGeom.setAttribute('color', new BufferAttribute(colors, 3));
  groundGeom.translate(model.widthM / 2, 0, -model.heightM / 2);
  const grain = keep(grainTexture(w.grainPx, w.grainAmount, cfg.world.scrub.seed));
  const groundGrain = keep(grain.clone());
  groundGrain.repeat.set(w.groundSizeM / w.grainTileM, w.groundSizeM / w.grainTileM);
  groundGrain.needsUpdate = true;
  const ground = new Mesh(
    groundGeom,
    keep(new MeshStandardMaterial({ vertexColors: true, map: groundGrain, roughness: 1 })),
  );
  ground.receiveShadow = true;
  scene.add(ground);

  const flat = (wM: number, hM: number, x: number, y: number, color: Color, offset: number) => {
    const tex = keep(grain.clone());
    tex.repeat.set(wM / w.grainTileM, hM / w.grainTileM);
    tex.needsUpdate = true;
    const mesh = new Mesh(
      keep(new PlaneGeometry(wM, hM).rotateX(-Math.PI / 2)),
      keep(
        new MeshStandardMaterial({
          color,
          map: tex,
          roughness: 1,
          polygonOffset: true,
          polygonOffsetFactor: -offset,
          polygonOffsetUnits: -offset * 4,
        }),
      ),
    );
    mesh.position.set(x, 0, -y);
    mesh.receiveShadow = true;
    scene.add(mesh);
  };
  const margin = w.siteMarginM;
  flat(
    model.widthM + 2 * margin,
    model.heightM + 2 * margin,
    model.widthM / 2,
    model.heightM / 2,
    p.graded,
    1,
  );
  const yard = b.yard;
  flat(yard.w, yard.h, yard.x + yard.w / 2, yard.y + yard.h / 2, p.pad, 2);

  // Scrub outside the graded site, denser near it.
  const s = w.scrub;
  const rng = createRng(s.seed);
  const scrubGeom = keep(new IcosahedronGeometry(1, 1));
  const scrubMat = keep(new MeshStandardMaterial({ color: new Color(1, 1, 1), roughness: 0.95 }));
  const scrub = new InstancedMesh(scrubGeom, scrubMat, s.count);
  const x0 = -margin - s.innerM;
  const x1 = model.widthM + margin + s.innerM;
  const y0 = -margin - s.innerM;
  const y1 = model.heightM + margin + s.innerM;
  const q = new Quaternion();
  const scale = new Vector3();
  const at = new Vector3();
  let placed = 0;
  for (let tries = 0; placed < s.count && tries < s.count * 40; tries++) {
    const x = x0 - s.outerM + rng.next() * (x1 - x0 + 2 * s.outerM);
    const y = y0 - s.outerM + rng.next() * (y1 - y0 + 2 * s.outerM);
    const dx = Math.max(x0 - x, 0, x - x1);
    const dy = Math.max(y0 - y, 0, y - y1);
    const d = Math.hypot(dx, dy);
    if (d === 0 || rng.next() > Math.exp(-d / (s.outerM / 4))) continue;
    const size = s.minM + (s.maxM - s.minM) * Math.pow(rng.next(), 2);
    scale.set(
      size * (0.9 + rng.next() * 0.4),
      size * (0.55 + rng.next() * 0.25),
      size * (0.9 + rng.next() * 0.4),
    );
    q.setFromAxisAngle(new Vector3(0, 1, 0), rng.next() * Math.PI * 2);
    at.set(x, scale.y * 0.55, -y);
    scrub.setMatrixAt(placed, matrix.compose(at, q, scale));
    scrub.setColorAt(placed, tmp.copy(p.scrub).multiplyScalar(0.78 + rng.next() * 0.4));
    placed++;
  }
  scrub.count = placed;
  scrub.instanceMatrix.needsUpdate = true;
  if (scrub.instanceColor) scrub.instanceColor.needsUpdate = true;
  scrub.castShadow = true;
  scrub.receiveShadow = true;
  scrub.computeBoundingSphere();
  scene.add(scrub);

  // Hills on the horizon, around the site.
  const hills = new Mesh(
    keep(hillsGeometry(p)),
    keep(new MeshBasicMaterial({ vertexColors: true, fog: false, side: DoubleSide })),
  );
  hills.position.set(model.widthM / 2, 0, -model.heightM / 2);
  scene.add(hills);

  // The focus module: its antennas and, while it is on, its four beams.
  const r = model.radios[radio];
  const antenna = antennaOffset().add(new Vector3(r.x, 0, -r.y));
  const moduleTop = antenna
    .clone()
    .add(new Vector3(0, cfg.module.headHeightM / 2 + cfg.module.capM + 0.04, 0));

  const beamRays: BeamRay[] = [];
  const beamsOn = facts.status === 'online' || facts.status === 'cutOff';
  const beamGeom = keep(beamGeometry());
  const beamMat = keep(
    new ShaderMaterial({
      vertexShader: BEAM_VERTEX,
      fragmentShader: BEAM_FRAGMENT,
      uniforms: {
        color: { value: p.signal },
        alpha: { value: cfg.beam.alpha },
        core: { value: cfg.beam.coreShare },
        fadeIn: { value: cfg.beam.fadeInShare },
        fadeOut: { value: cfg.beam.fadeOutShare },
        lengthM: { value: cfg.beam.lengthM },
        halfRad: { value: cfg.beam.halfWidthDeg * DEG },
        lineM: { value: cfg.beam.lineM },
        lineAlpha: { value: cfg.beam.lineAlpha },
      },
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending: NormalBlending,
    }),
  );
  for (const beam of facts.beams) {
    // Site (dx, dy) to the scene's x and z.
    const dir = new Vector3(beam.dx, 0, -beam.dy);
    if (beamsOn) {
      const wedge = new Mesh(beamGeom, beamMat);
      wedge.position.copy(antenna);
      wedge.rotation.y = Math.atan2(-dir.z, dir.x);
      wedge.renderOrder = 2;
      scene.add(wedge);
    }
    beamRays.push({ key: beam.key, origin: antenna.clone(), dir });
  }

  const shadowCam = sun.shadow.camera;
  const follow = (eye: Vector3, target: Vector3, distance: number) => {
    sky.position.copy(eye);
    const r = cfg.render;
    const half = Math.min(
      r.shadowHalfMaxM,
      Math.max(r.shadowHalfMinM, distance * r.shadowHalfPerDistance),
    );
    const reach = half * 2 + 50;
    sun.target.position.set(target.x, 0, target.z);
    sun.position.copy(sun.target.position).addScaledVector(sunDir, reach);
    shadowCam.left = -half;
    shadowCam.right = half;
    shadowCam.top = half;
    shadowCam.bottom = -half;
    shadowCam.near = 1;
    shadowCam.far = reach * 2;
    shadowCam.updateProjectionMatrix();
    sun.target.updateMatrixWorld();
  };

  return {
    scene,
    antenna,
    moduleTop,
    beams: beamRays,
    follow,
    dispose() {
      for (const d of disposables) d.dispose();
      scene.traverse((o: Object3D) => {
        if (o instanceof InstancedMesh) o.dispose();
      });
    },
  };
}
