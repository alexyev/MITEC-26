// Shared engine contract: site and schedule types, pricing types, and the Params / Result interfaces of spec section 9.
// Pure types only (plus the Zone enum); all agents import from here so every module agrees on one data shape.

// ---------------------------------------------------------------------------
// Pricing (shape of src/config/pricing.json, spec section 5.1)
// ---------------------------------------------------------------------------

export type PresetId = 'ble' | 'lora' | 'halow' | 'mesh5';

export interface PriceTier {
  minQty: number;
  unitPrice: number;
}

export interface RangePricePoint {
  rangeM: number;
  unitPrice: number;
}

export interface PresetPricing {
  rangeRefM: number;
  tiers: PriceTier[];
  rangeScaling: { mode: 'power'; exponent: number };
  rangePricePoints: RangePricePoint[];
}

export interface PricingConfig {
  verified: boolean;
  currency: string;
  presets: Record<PresetId, PresetPricing>;
  perModule: {
    cornerBracketAndCable: number;
    antennaSet: number;
    installLabor: number;
    batteryBridge: number;
  };
  base: { unitPrice: number; powerW: number };
  tempFrontRelay: { unitPrice: number; powerW: number; reusable: boolean };
  sparesPct: number;
  contingencyPct: number;
  tierMode: 'allUnits' | 'incremental';
}

// ---------------------------------------------------------------------------
// Site (spec section 3.1 - 3.3)
// ---------------------------------------------------------------------------

export type LaneAxis = 'EW' | 'NS';

/** Axis-aligned rectangle in site meters. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Parameters of the layout generator. All values come from `DEFAULTS` (src/config/defaults.ts).
 * Units: meters unless the name says otherwise.
 */
export interface SiteConfig {
  areaAcres: number;
  aspect: number;
  targetUnits: number;
  unitWidthM: number; // along the lane axis
  unitDepthM: number; // across the lane axis
  unitGapM: number;
  unitsPerLane: number;
  lanesPerBlock: number;
  roadWidthM: number;
  edgeMarginM: number;
  laneAxis: LaneAxis;
  minRowClearanceM: number; // pitch must be at least depth + this value
  acreM2: number;
}

/**
 * Generated site. Unit ids are row-major: `id = row * cols + col`, where `row` is the lane row
 * across the whole site and `col` is the unit column across the whole site (both in the lane frame).
 * World frame: x grows east, y grows north. With `laneAxis = 'EW'` lanes run along x.
 */
export interface Site {
  laneAxis: LaneAxis;
  widthM: number;
  heightM: number;
  targetUnits: number;
  /** Actual number of units. */
  count: number;
  /** Interleaved unit centers: x0, y0, x1, y1, ... (stride 2), world meters. */
  centers: Float32Array;
  /** Block id = blockRow * blockCols + blockCol (lane frame). */
  unitBlock: Int32Array;
  /** Global lane id: a lane is one row of one block; id = row * blockCols + blockCol. */
  unitLane: Int32Array;
  /** Index of the unit inside its lane, 0 .. unitsPerLane - 1, counted along the lane axis. */
  unitPosInLane: Int16Array;
  /** Lane row across the whole site, 0 .. rows - 1. */
  unitRow: Int32Array;
  /** Unit column across the whole site, 0 .. cols - 1 (the "column" of spec 3.2). */
  unitCol: Int32Array;
  blockCols: number;
  blockRows: number;
  /** Total lane rows and total unit columns. */
  rows: number;
  cols: number;
  /** Number of lanes (lane segments) = rows * blockCols. */
  laneCount: number;
  unitsPerLane: number;
  /** Center-to-center distance of units along a lane (width + gap). */
  unitPitchM: number;
  /** Solved center-to-center distance between neighbouring lanes inside a block. */
  rowPitchM: number;
  blockWidthM: number;
  roadWidthM: number;
  /** Lane end points (world meters), indexed by global lane id. */
  laneX0: Float32Array;
  laneY0: Float32Array;
  laneX1: Float32Array;
  laneY1: Float32Array;
  /**
   * Corridor between lane `row` and the next lane row (or the road center when the next lane is in
   * the next block). One entry per lane row. For `laneAxis = 'EW'` this is a world y value;
   * for `'NS'` the lane corridors are vertical lines and the entry is a world x value.
   */
  laneCorridorY: Float32Array;
  /**
   * Gap after unit column `col` toward +lane axis (the gap between two units in a lane, or the road
   * center after the last unit of a block). One entry per unit column. For `'EW'` this is a world x
   * value; for `'NS'` a world y value.
   */
  columnCorridorX: Float32Array;
  roads: Rect[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Schedule (spec section 3.4)
// ---------------------------------------------------------------------------

export type BuildOrder =
  'centerOut' | 'westToEast' | 'southToNorth' | 'fromBase' | 'blockSerpentine';

/**
 * What the scalar front coordinate measures for a build order. 'centerX' is the east-west distance
 * from the site's center line (the same value on the west and the east face).
 */
export type FrontKind = 'centerX' | 'x' | 'y' | 'radial' | 'path';

export interface BuildConfig {
  order: BuildOrder;
  unitsPerDay: number;
  placeToCommissionDays: number;
  frontWorkZoneM: number;
}

/** Zone of a unit on a given day (spec section 7.1). */
export enum Zone {
  Planned,
  WorkZone,
  EdgeZone,
  Commissioned,
}

export interface Schedule {
  order: BuildOrder;
  frontKind: FrontKind;
  unitsPerDay: number;
  placeToCommissionDays: number;
  frontWorkZoneM: number;
  /** Day (1-based) on which unit i is placed. */
  placedDay: Int32Array;
  /** Day on which unit i is commissioned = placedDay + placeToCommissionDays. */
  commissionDay: Int32Array;
  /** World x of the north-south center line that 'centerOut' advances away from (center of the unit grid). */
  centerX: number;
  /**
   * Front coordinate of every unit in meters: east-west distance from `centerX` for 'centerOut', x for
   * 'westToEast', y for 'southToNorth', distance to the origin for 'fromBase', distance along the build
   * path for 'blockSerpentine'.
   */
  frontKey: Float64Array;
  /** Unit ids in build order. */
  buildOrderIds: Int32Array;
  /** Last day on which a unit is placed. */
  buildDays: number;
  /** First day on which every unit is commissioned. */
  lastDay: number;
}

/** Build and commission fronts for one day. Coordinates are in `frontKind` meters. */
export interface Fronts {
  day: number;
  kind: FrontKind;
  placedCount: number;
  commissionedCount: number;
  /** placedCount - commissionedCount: units that are placed but have no power. */
  edgeZoneCount: number;
  /** Front coordinate of the last placed unit (the start edge of the build before any unit is placed). */
  buildFront: number;
  /** Front coordinate of the last commissioned unit. */
  commissionFront: number;
  /** buildFront + frontWorkZoneM. */
  workZoneEnd: number;
}

/** Fronts of one face of a 'centerOut' build, as world x in meters. */
export interface FaceZones {
  /** x of the outermost commissioned unit on this face (the inner edge of the edge zone). */
  commissionFrontX: number;
  /** x of the outermost placed unit on this face (the outer edge of the edge zone). */
  buildFrontX: number;
  /** End of the work zone: `frontWorkZoneM` beyond the build front, away from the center. */
  workZoneEndX: number;
}

/** Zones of a 'centerOut' build: the west face moves toward -x and the east face toward +x. */
export interface BuildZones {
  west: FaceZones;
  east: FaceZones;
}

// ---------------------------------------------------------------------------
// Engine interface (spec section 9, as written)
// ---------------------------------------------------------------------------

export interface Params {
  presetId: 'ble' | 'lora' | 'halow' | 'mesh5';
  rangeM: number;
  placement: {
    unitEveryN: number | 'auto';
    laneEveryM: number | 'auto';
    spacingFactor: number;
    densityBalance: number;
    alignAcrossBlocks: boolean;
  };
  module: { beams: ('+lane' | '-lane' | '+col' | '-col')[]; laneBeamsOnly: boolean }; // laneBeamsOnly = debug toggle
  edge: {
    batteryBridge: boolean;
    batteryBridgeReusable: boolean;
    tempFrontRelays: boolean;
    denserEdge: boolean;
  };
  buildDay: number;
  buildOrder: string;
  bases: { id: string; x: number; y: number; failed: boolean }[];
  failedModuleUnitIds: number[];
  pricing: PricingConfig; // from pricing.json or the editor
}

export interface Result {
  modules: {
    unitId: Int32Array;
    x: Float32Array;
    y: Float32Array;
    kind: Uint8Array /*0 grid,1 denserEdge,2 tempRelay*/;
    active: Uint8Array;
    powered: Uint8Array /*0 none,1 P3,2 battery*/;
    connected: Uint8Array;
    hops: Int16Array;
    critical: Uint8Array;
    failed: Uint8Array;
  };
  links: {
    a: Int32Array;
    b: Int32Array;
    type: Uint8Array /*0 lane,1 column,2 offAxis,3 base*/;
    loadBps: Float32Array;
    bottleneck: Uint8Array;
  };
  unitsServed: Uint8Array;
  /** Both faces of the center-out build (decision D8; replaces the single west-to-east fronts of spec 9). */
  zones: BuildZones;
  kpis: {
    modules: number;
    denserEdgeModules: number;
    tempRelays: number;
    laneLinks: number;
    columnLinks: number;
    densityPct: number;
    modulesPerAcre: number;
    equippedLanesPct: number;
    servedPct: number;
    meanHops: number;
    maxHops: number;
    latencyMaxS: number;
    n1Pass: boolean;
    criticalModules: number;
    worstFailure: { unitId: number; unitsCut: number } | null;
    tolerance95: number | null;
    pathsDist: number[];
    minPaths: number;
    score: 'A' | 'B' | 'C';
    capexUsd: number;
    capexBreakdown: Record<string, number>;
    tierUsed: Record<string, string>;
    powerW: number;
    perAcreUsd: number;
    perMwUsd: number;
    pctOfP3Hw: number;
    bottleneckUtil: number;
    capacityStatus: 'OK' | 'WARNING' | 'OVERLOADED';
    workZoneCoveragePct: number;
    edgeN1Pass: boolean;
    edgeMaxHops: number;
    edgeCostUsd: number;
    currentCut: number;
    currentFailed: number;
  };
  warnings: string[];
}
