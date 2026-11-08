// The 3D view of a radio's corner (D120 to D126): the play-model section in 3D, the camera's flight from the
// Build map down to the side of a corner module and back, and the scene's look. Lengths in meters, angles in
// degrees, durations in ms. Colors live in src/ui/tokens.css (`--c-scene-*`); the beams use `--c-signal`.
import { MODULE, SITE, UNIT_HEIGHT_M } from './defaults';

export const SCENE3D = {
  /** A P3 unit (D122): the 40 ft footprint and height of SITE, and the details of a container's frame. */
  unit: {
    lengthM: SITE.unitWidthM,
    widthM: SITE.unitDepthM,
    heightM: UNIT_HEIGHT_M,
    /** It stands on pile caps (the foundations phase), this high and this wide, this many on each side. */
    pileCapM: 0.12,
    pileCapSizeM: 0.34,
    pilesPerSide: 4,
    /** Frame: corner posts, top and bottom rails standing proud of the walls, and corner castings. */
    postM: 0.16,
    railM: 0.12,
    railProudM: 0.03,
    castingM: 0.18,
    castingProudM: 0.012,
    /** Corrugated walls: ridge pitch and the normal map's strength. */
    corrugationPitchM: 0.28,
    corrugationStrength: 0.9,
    /** Dust and shade at the foot of the walls: the darkening at the ground, gone this high up. */
    groundDark: 0.72,
    groundFadeM: 1.1,
    /** Doors on the south end: two leaves, two locking bars on each. */
    lockBarsPerLeaf: 2,
    lockBarRadiusM: 0.024,
    lockBarInsetM: 0.32,
    doorSeamM: 0.012,
  },

  /**
   * The sun-tracking Fresnel lens array on the roof (D122), stylized: two rows of lenses along the unit, each
   * row on its own north-south tracker that tilts the lenses toward the sun.
   */
  lens: {
    rows: 2,
    perRow: 9,
    panelAcrossM: 1.06,
    panelAlongM: 1.22,
    /** The aluminium frame shows this far around the acrylic, and the slab thicknesses. */
    frameM: 0.035,
    glassM: 0.018,
    frameDepthM: 0.045,
    /** Tracker axis height above the roof, its tube radius, and the posts that carry it. */
    pivotM: 0.62,
    tubeRadiusM: 0.045,
    postsPerRow: 4,
    postM: 0.07,
    /** Concentric grooves drawn on each lens. */
    rings: 22,
    /** How much darker the rings' dark side is, 0 to 1. */
    ringDepth: 0.16,
    texturePx: 256,
  },

  /** The corner module (spec 4, D123): bolted to the north-east top corner, its arm sticking out diagonally. */
  module: {
    armOutM: MODULE.offsetM,
    antennaHeightM: MODULE.heightM,
    armM: 0.05,
    /** The head: a square enclosure with an antenna radome on each face, a cap and a status light. */
    headM: 0.15,
    headHeightM: 0.3,
    capM: 0.03,
    radomeWM: 0.15,
    radomeHM: 0.3,
    radomeDM: 0.04,
    /** Edge radius of the radomes and the cap. */
    roundM: 0.012,
    ledRadiusM: 0.016,
    /** The 30-day battery that bridges the time before the unit powers the module, on the corner post. */
    battery: { wM: 0.26, hM: 0.32, dM: 0.14, topBelowRoofM: 0.35 },
    cableRadiusM: 0.009,
  },

  /** The module's callout: its box sits this far right of and above the module, in CSS pixels. */
  callout: { dxPx: 29, dyPx: 34 },

  /** The base: an equipment skid, a mast with the base's own radio head, and the Starlink dish. */
  base: {
    skid: [2.2, 1.5, 1.2] as const,
    mastM: 5.2,
    mastRadiusM: 0.06,
    dishM: [0.58, 0.38] as const,
  },

  /** The four beams (D124): faint wedges at the antenna height, out to the neighbor radios. */
  beam: {
    lengthM: 66,
    halfWidthDeg: MODULE.beamHalfWidthDeg,
    /** Most of the drawn wedge sits in its middle: a gaussian across it, this share of the half width. */
    coreShare: 0.26,
    alpha: 0.16,
    /** The crisp line on each beam's axis: its width and strength. */
    lineM: 0.035,
    lineAlpha: 0.75,
    segments: 40,
    /** Fade in over the first meters and out toward the end, as shares of the length. */
    fadeInShare: 0.02,
    fadeOutShare: 0.55,
    /**
     * Where along a beam its label sits: the farthest of these distances at which the label fits on screen,
     * clear of the edges and the card.
     */
    labelAtM: [22, 17, 13, 10, 7.5, 5.5, 4],
    /** The size a beam label takes above its anchor, and the screen margin it keeps, in CSS pixels. */
    labelBoxPx: { w: 190, h: 52 },
    labelMarginPx: 20,
  },

  /** The sun: azimuth from north toward east, and elevation; a clear late morning. */
  sun: { azimuthDeg: 150, elevationDeg: 40 },

  camera: {
    fovDeg: 40,
    nearM: 0.1,
    farM: 14000,
    /**
     * Where the flight lands (D125), around the module: distance, azimuth (0 is from the south, positive
     * toward the east) and elevation. Standing in the lane corridor south-east of the module.
     */
    end: { distanceM: 12.5, azimuthDeg: 120, elevationDeg: 8 },
    /** Looking around once landed: drag to orbit the module, scroll to come closer or step back. */
    orbit: {
      minDistanceM: 2.6,
      maxDistanceM: 48,
      minElevationDeg: -10,
      maxElevationDeg: 62,
      /** The camera never goes below this eye height. */
      minEyeM: 1.4,
      damping: 0.09,
      rotateSpeed: 0.5,
      zoomSpeed: 0.7,
    },
  },

  motion: {
    /** The 2D map and the 3D view crossfade; mirrors `--dur-scene-fade` in tokens.css. */
    crossfadeMs: 420,
    flyInMs: 3600,
    flyOutMs: 2600,
    /** Shares of the flight: the tilt and the turn toward the side start late, so it first descends. */
    tiltFrom: 0.38,
    turnFrom: 0.3,
  },

  render: {
    maxPixelRatio: 2,
    shadowMapPx: 4096,
    /** The shadow box follows the camera: its half size is the camera distance times this, clamped. */
    shadowHalfPerDistance: 0.85,
    shadowHalfMinM: 95,
    shadowHalfMaxM: 560,
    shadowBias: -0.00025,
    shadowNormalBias: 0.02,
    exposure: 1.0,
    sunIntensity: 3.1,
    skyIntensity: 0.55,
    envIntensity: 0.9,
  },

  world: {
    groundSizeM: 12000,
    /** Large-scale tone of the desert: noise cells and their strength. */
    groundSegments: 240,
    groundToneCellM: 260,
    groundToneAmount: 0.08,
    /** Sand grain, tiled. */
    grainTileM: 7,
    grainPx: 256,
    grainAmount: 0.12,
    /** The graded site extends this far past the section, and the base pad's gravel. */
    siteMarginM: 14,
    /** Haze (exponential squared fog). */
    fogDensity: 0.00034,
    /** Scrub outside the graded site: count, the ring it fills, and its size range. */
    scrub: { count: 3200, innerM: 6, outerM: 1300, minM: 0.35, maxM: 1.5, seed: 31 },
    /** A low range of hills at the horizon: distance, height range, detail. */
    hills: { radiusM: 5200, minM: 60, maxM: 340, segments: 360, seed: 7 },
    /** The sky: how fast the haze at the horizon gives way to blue, and the glow around the sun. */
    sky: { radiusM: 9000, haze: 7, sunGlowPower: 9, sunGlowAmount: 0.22 },
  },
};
