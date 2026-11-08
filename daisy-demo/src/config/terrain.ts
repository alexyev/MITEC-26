// The desert backdrop under both maps (D101): procedural, seeded terrain in three world-anchored layers that
// tile seamlessly, so the ground runs on past the site in every direction. Colors live in src/ui/tokens.css
// (`--c-ground-*`); these are the shapes, scales and strengths. All values are a designed look, not survey data.

/** One terrain layer: a square texture of `px` texels that repeats every `periodM` meters on the ground. */
export interface TerrainLayerConfig {
  periodM: number;
  px: number;
  /** Mip levels after the full one, each half the size, so a zoomed-out view never shimmers. */
  mips: number;
}

export const TERRAIN = {
  seed: 20261108,
  /**
   * Where each tab's map stands in the desert (meters added to its world coordinates): the tabs show different
   * ground of the same desert. The Build & failure section sits beside a dry wash.
   */
  origin: { survey: { x: 3100, y: 1700 }, build: { x: 11630, y: 7410 } },

  /** Relief, tone and the major washes: the ground's large shapes (texel 20 m). */
  macro: {
    layer: { periodM: 20_480, px: 1024, mips: 2 } as TerrainLayerConfig,
    /** Lattice cells of the relief's first octave across the tile, octaves, and each octave's gain. */
    reliefCells: 3,
    reliefOctaves: 4,
    reliefGain: 0.45,
    /** Ridged hills where `hillCells` noise rises above `hills.from`: sharp crests over the rolling relief. */
    hillCells: 4,
    hills: { from: 0.08, to: 0.32, weight: 0.4 },
    ridgeCells: 7,
    ridgeOctaves: 5,
    /** Domain warp of the relief and the washes: cells, octaves and strength in tile units. */
    warpCells: 3,
    warpOctaves: 3,
    warpTile: 0.03,
    /**
     * Major washes, running northeast to southwest: zero lines of a sheared noise with `washCells` cells across
     * the flow and `washCellsAcross` along it, `washWidth` wide in noise units, with a pale bed of strength
     * `bed`.
     */
    washCells: 6,
    washCellsAcross: 2,
    washOctaves: 2,
    washWidth: 0.008,
    bed: 0.5,
    /** Patches of paler sand against darker gravel: cells, octaves, the softness of their edge, their share. */
    toneCells: 5,
    toneOctaves: 4,
    toneEdge: 0.16,
    tone: 0.38,
    /** Hillshade: height exaggeration in texels per unit of relief, and the light's share of the color. */
    reliefScale: 150,
    shade: 0.5,
  },

  /**
   * The drainage network, fine relief and wind ripples: what the ground shows from a few hundred meters up to
   * the whole site (texel 5 m).
   */
  detail: {
    layer: { periodM: 10_240, px: 2048, mips: 4 } as TerrainLayerConfig,
    reliefCells: 12,
    reliefOctaves: 4,
    reliefScale: 26,
    /**
     * Small washes, traced down a meandering flow toward the southwest: `streams` streams spread across the
     * tile, each `lengthM` long, widening from `widthM.from` to `widthM.to`; tributaries join every
     * `branchEveryM` at `branchAngleDeg`, `branchLengthM` long. The flow turns by up to `meanderDeg` with a noise
     * of `meanderCells`; a bed is pale, and a fringe of scrub `fringe` times as wide runs along it.
     */
    streams: 26,
    lengthM: { min: 2600, max: 5200 },
    widthM: { from: 3, to: 11 },
    branchEveryM: { min: 260, max: 620 },
    branchLengthM: { min: 300, max: 1100 },
    branchAngleDeg: 42,
    branchWidth: 0.55,
    meanderDeg: 38,
    meanderCells: 9,
    stepM: 2.5,
    fringe: 2.4,
    bedAlpha: 0.38,
    fringeAlpha: 0.2,
    /**
     * Wind ripples (dune fields): whole wave cycles across the tile along x and y, so they tile (about 37 m
     * apart, crests running north-northwest), their sinuosity, and the patches where they show.
     */
    rippleWave: { x: 92, y: 272 },
    rippleSinuosity: 5.5,
    rippleWarpCells: 14,
    ripplePatchCells: 5,
    ripplePatch: { from: 0.12, to: 0.32 },
    rippleDepth: 0.012,
    /** Strength of the light and shadow of the relief and the ripples (alpha at full slope). */
    strength: 0.55,
  },

  /** Scrub, pebbles and grain: the ground up close (texel 0.25 m). */
  scrub: {
    layer: { periodM: 512, px: 2048, mips: 5 } as TerrainLayerConfig,
    /** Bushes on a jittered grid: cell size, radius range in meters, and the clustering noise. */
    cellM: 7,
    radiusM: { min: 0.45, max: 1.3 },
    densityCells: 5,
    density: { from: -0.15, to: 0.35, max: 0.75 },
    /** A bush's shadow falls this far to the southeast, in radii, at this alpha. */
    shadowOffset: 0.55,
    shadowAlpha: 0.35,
    bushAlpha: 0.6,
    /** Pebbles: count per 100 m² of ground, radius in meters, alpha. */
    pebblesPer100M2: 9,
    pebbleRadiusM: { min: 0.08, max: 0.22 },
    pebbleAlpha: 0.35,
  },

  /**
   * Zoom fade of the scrub layer, in CSS pixels per meter: below `from` a bush is smaller than a pixel. The
   * macro and detail layers show at every zoom, through their mip levels.
   */
  fade: { scrub: { from: 0.3, to: 1.1 } },
  /**
   * A layer is drawn from the mip level whose texels are at least this many device pixels across, so a
   * zoomed-out view is filtered rather than sparkling.
   */
  minTexelPx: 0.75,
  /** The light comes from the northwest (screen top left), this high over the horizon. */
  light: { azimuthDeg: 315, altitudeDeg: 38 },
  /** The terrain fades in over this long once it is ready (none under reduced motion). */
  fadeInMs: 700,
  /** Vignette: from this share of the half-diagonal out to the corners it darkens to `--c-map-vignette`. */
  vignette: { from: 0.45, to: 1.0 },
};

/** Integer hash of the terrain noise (a murmur-style finalizer): odd multipliers and shifts. */
export const TERRAIN_HASH = {
  mulX: 0x27d4eb2d,
  mulY: 0x165667b1,
  mulSeed: 0x9e3779b9,
  mixA: 0x85ebca6b,
  mixB: 0xc2b2ae35,
  shiftA: 16,
  shiftB: 13,
  shiftC: 16,
  /** Gradient directions of the noise. */
  gradients: 256,
};
