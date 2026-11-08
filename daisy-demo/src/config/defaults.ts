// Default values for the whole demo (spec sections 3, 4, 5, 6, 7, 8, 9). All values are placeholders
// until the team confirms them (spec section 14). No magic numbers outside src/config/.
import type { BuildConfig, SiteConfig } from '../engine/types';

/** Site and layout (spec 3.1). */
export const SITE: SiteConfig = {
  areaAcres: 2000,
  aspect: 2.0,
  targetUnits: 23_000,
  unitWidthM: 12.2,
  unitDepthM: 2.44,
  unitGapM: 2.0,
  unitsPerLane: 25,
  lanesPerBlock: 20,
  roadWidthM: 10,
  edgeMarginM: 20,
  /** Lanes run north-south, so every P3 unit stands with its long axis north-south (D33). */
  laneAxis: 'NS',
  minRowClearanceM: 1.0,
  acreM2: 4046.8564224,
  /** The base pad at the center: 10 lane rows by one block length (25 units) with no units (D34). */
  basePadLanes: 10,
  basePadUnits: 25,
};

/** Allowed relative deviation of the generated unit count from the target (spec T1.1: within 2%). */
export const SITE_COUNT_TOLERANCE = 0.02;

/** Unit height is an assumption (spec 3.1). */
export const UNIT_HEIGHT_M = 2.9;

/** Build schedule (spec 3.4). */
export const BUILD: BuildConfig = {
  order: 'centerOut',
  unitsPerDay: 200,
  placeToCommissionDays: 9,
  frontWorkZoneM: 300,
};

/** Corner module and antenna model (spec 4.3). */
export const MODULE = {
  corner: 'NE',
  offsetM: 0.5,
  heightM: 3.2,
  beams: ['+lane', '-lane', '+col', '-col'] as ('+lane' | '-lane' | '+col' | '-col')[],
  beamHalfWidthDeg: 30,
  offAxisRangeFactor: 0.12,
  obstructionFactor: 0.8,
  obstructionMaxUnits: 3,
};

export type BasePresetId = 'west1' | 'westEast2' | 'corners4' | 'center';

/** Bases (spec 4.3, 6.4). */
export const BASE = {
  rangeFactor: 1.5,
  maxBases: 6,
  /** Base preset used wherever a default base is chosen: one base at the site center (decision D5). */
  defaultPreset: 'center' as BasePresetId,
  presets: {
    west1: [{ fx: 0, fy: 0.5 }],
    westEast2: [
      { fx: 0, fy: 0.5 },
      { fx: 1, fy: 0.5 },
    ],
    corners4: [
      { fx: 0, fy: 0 },
      { fx: 1, fy: 0 },
      { fx: 0, fy: 1 },
      { fx: 1, fy: 1 },
    ],
    center: [{ fx: 0.5, fy: 0.5 }],
  },
};

/** Placement (spec 6.1). */
export const PLACEMENT = {
  unitEveryN: 'auto' as number | 'auto',
  laneEveryM: 'auto' as number | 'auto',
  spacingFactor: 0.85,
  densityBalance: 1.0,
  densityBalanceMin: 0.25,
  alignAcrossBlocks: true,
  autoTune: { spacingMin: 0.4, spacingMax: 1.0, balanceMin: 0.25, balanceMax: 1.0, topDesigns: 3 },
};

/** Resilience (spec 6.3). */
export const RESILIENCE = {
  failurePctMax: 50,
  failurePctStep: 2,
  trials: 20,
  sampledModules: 100,
  maxPaths: 4,
  tolerance95MinPct: 10,
  autoTuneServedPct: 99,
  autoTunePathsPct: 99,
  autoTuneMinPaths: 2,
};

/** Capacity and traffic (spec 6.3). */
export const TRAFFIC = {
  telemetryBytes: 64,
  telemetryIntervalS: 10,
  bitsPerByte: 8,
  assets: 37,
  assetBps: 650,
  rtkBps: 1500,
  maxUtilization: 0.6,
  warningUtilization: 0.4,
};

/** Build-edge model (spec 7). */
export const EDGE = {
  denserEdgeDepthM: 150,
  tempRelaySpacingFactor: 0.8,
  sampleGridM: 25,
  coverageTargetPct: 95,
};

/** Routing model of the pre-set scenario (spec 8.2). */
export const ROUTING = {
  helloIntervalS: 1.0,
  missedHellosToDown: 3,
  localRepair: true,
  updateFloodPerHopS: 0.02,
  bufferPackets: true,
  bufferMaxPackets: 500,
  retransmitTimeoutS: 0.5,
};

/** Reference scale for rough comparisons (assumption). */
export const SCALE = {
  mwhPerAcre: 1,
  kwhPerUnit: 25,
};

/** Seeded RNG (spec 1). */
export const RNG = { seed: 20261107 };

/** Constants of the mulberry32 generator used by src/engine/rng.ts. */
export const MULBERRY32 = {
  increment: 0x6d2b79f5,
  shiftA: 15,
  shiftB: 7,
  orMask: 61,
  shiftC: 14,
  range: 4_294_967_296,
};

/** Performance targets in milliseconds (spec 9). */
export const PERF_TARGETS_MS = {
  siteGeneration: 500,
  computeLargeRange: 200,
  computeBle: 700,
  computeSmallRange: 2500,
  randomFailureCurve: 3000,
  autoTune: 10_000,
  scenarioEvents: 300,
};

/**
 * Shell, player and layout (spec 6.2, 6.6, 7). Px values mirror the layout tokens in src/ui/tokens.css;
 * map fits use `mapFitPaddingPx` so targets land in the gap between the panels.
 */
export const UI = {
  /** Brand chip at the top left and the browser tab title (index.html), by the captain's request. */
  brand: 'Exowatt: Daisy Does It',
  /** Credit at the bottom center of the map and the home screen (spec 6.2, D130): the site's bare domain, in a new tab. */
  credit: { label: 'alexanderyevchenko.com', url: 'https://alexanderyevchenko.com' },
  /** Network cost card: where "?" explains the radio technology, and the proof that mesh runs autonomous mines. */
  costCardLinks: {
    haLowUrl: 'https://en.wikipedia.org/wiki/IEEE_802.11ah',
    haLowHelp: 'What is HaLow?',
    provenUrl: 'https://rajant.com/markets/mining/',
    provenLabel: 'Proven technology',
    provenDetail: 'self-healing mesh already runs autonomous mining fleets (Rajant)',
  },
  /** Floating layout in CSS px (spec 6.2): screen margin, top row, panel width, player width. */
  layout: { marginPx: 16, gapPx: 12, topRowPx: 48, panelWidthPx: 320, playerMaxWidthPx: 560 },
  /** Map fit padding in CSS px: clears the top row, both 320 px docks and the player bar with its credit. */
  mapFitPaddingPx: { top: 92, right: 360, bottom: 184, left: 360 },
  /** Lucide icons in buttons: size in CSS px and stroke width. */
  icon: { sizePx: 16, strokeWidth: 1.75 },
  /** Hover card (spec 6.6): offset from the pointer and the minimum distance to the map edge. */
  hoverCard: { offsetPx: 14, edgePx: 8 },
  player: {
    /** Step back goes to the start of the current step when more than this far into it, else to the previous step. */
    stepBackGraceS: 1,
    /** Longest frame step of the clock, so a background tab does not jump ahead on return. */
    maxFrameS: 0.1,
    /**
     * Playback speeds of the player bar, shared by both tabs: 1 is the designed pace of the walkthrough,
     * the others multiply the clock, so step durations and every motion on the map scale together (D52, D82).
     */
    speeds: [0.25, 0.5, 1, 2, 4],
    /** The designed pace, where both tabs open. */
    normalSpeed: 1,
  },
};

/** Map view (spec 10.3, T1.3). Colors live in src/ui/theme.css. */
export const MAP = {
  /** Units are drawn at least this many CSS pixels across, and as outlines from this size up (D35). */
  unitMinPx: 1,
  unitOutlineFromPx: 4,
  /** Zoom limits: the minimum is a fraction of the fit scale; the maximum is in CSS pixels per meter. */
  minZoomOfFit: 0.6,
  maxPxPerM: 40,
  /** Zoom factor per 100 px of wheel delta, and per click on a zoom button. */
  wheelZoomPer100Px: 1.25,
  buttonZoom: 1.6,
  /** Target length of the scale bar in CSS pixels. */
  scaleBarTargetPx: 120,
  /** Hatch spacing of the zone overlays in CSS pixels, and the dash pattern of the fronts. */
  hatchSpacingPx: 7,
  frontDashPx: [6, 5],
  /** Half size of the base marker, its dark halo and its corner radius, in CSS pixels. */
  baseMarkerPx: 5,
  baseHaloPx: 4,
  baseCornerPx: 1.5,
  /** Corner radius of the base pad (D34), its edge width and its hatch spacing (D81), in CSS pixels. */
  basePadCornerPx: 3,
  basePadEdgePx: 1.25,
  basePadHatchPx: 5,
};
