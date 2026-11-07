// Default values for the whole demo (spec sections 3, 4, 5, 6, 7, 8, 9). All values are placeholders
// until the team confirms them (spec section 14). No magic numbers outside src/config/.
import type { BuildConfig, SiteConfig } from '../engine/types';

/** Site and layout (spec 3.1). */
export const SITE: SiteConfig = {
  areaAcres: 2000,
  aspect: 2.0,
  targetUnits: 80_000,
  unitWidthM: 12.2,
  unitDepthM: 2.44,
  unitGapM: 2.0,
  unitsPerLane: 20,
  lanesPerBlock: 20,
  roadWidthM: 10,
  edgeMarginM: 20,
  laneAxis: 'EW',
  minRowClearanceM: 1.0,
  acreM2: 4046.8564224,
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

/** UI behaviour (spec 9, 10). */
export const UI = {
  sliderDebounceMs: 100,
  layoutMinWidthPx: 1280,
  controlsWidthPx: 300,
  metricsWidthPx: 320,
  bottomHeightPx: 200,
  headerHeightPx: 48,
};
