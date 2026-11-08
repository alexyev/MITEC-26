// Play model of the Build & failure tab (spec 9.1, 9.4, 9.5): the 9 x 5 radio grid on north-south lanes.
// All values are placeholders until the team confirms them (spec section 14). Routing timing is ROUTING in defaults.ts.

/** A radio cell on the play-model grid: column 0 is the west edge, row 0 the south edge. */
export interface CellRef {
  col: number;
  row: number;
}

/** Equipment marks drawn for a frontier phase. */
export type EquipmentGlyph = 'dozer' | 'pileRig' | 'trencher' | 'carrier' | 'crane' | 'crew';

/** One construction phase at the build frontier (D49). */
export interface FrontierPhase {
  id: 'grading' | 'foundations' | 'trenching' | 'placement' | 'connection';
  label: string;
  /** What is at work, for the hover card. */
  equipment: string;
  glyphs: EquipmentGlyph[];
}

export interface PlayConfig {
  /** Radio cells across (east-west) and down (north-south); one radio per cell. */
  cellCols: number;
  cellRows: number;
  /** Units along the lane (north-south) per cell, and lanes (east-west) per cell. */
  unitsPerCell: number;
  lanesPerCell: number;
  /** Lane pitch as on the full site; unit size and gap come from SITE. */
  rowPitchM: number;
  /** Two grid neighbors link when they are at most this far apart; the base links to any radio in range. */
  linkRangeM: number;
  /** Ground coverage radius of a connected radio and of the base. */
  coverageRadiusM: number;
  coverageTargetPct: number;
  /** Spacing of the coverage sample grid. */
  coverageSampleM: number;
  /** Playback time per build step. */
  buildStepS: number;
  /** Build steps from placing a unit to its radio switching on. */
  commissionLagSteps: number;
  /**
   * Construction phases at the frontier, outermost first: each takes one build step per lane, the
   * placement phase is the step a lane's units are placed, and connection lasts until the radio is on.
   * Illustrative, after the team's research of the challenge video; Exowatt has not published a method.
   */
  frontierPhases: FrontierPhase[];
  /** Each connected radio sends one packet per interval. */
  packetIntervalS: number;
  /** Playback time per hop ("Packets slowed for visibility"). */
  hopS: number;
  /** Spacing of the packets that leave a queue once the radio has a route again. */
  queueFlushIntervalS: number;
  /** A packet that has made this many hops is dropped, so a transient routing loop cannot run forever. */
  maxPacketHops: number;
  /**
   * The base pad at the center: this many lanes by this many units have no units (D46), like the full
   * site's pad (D34). Use a lane count with the parity of the lanes, so the pad is centered.
   */
  basePadLanes: number;
  basePadUnits: number;
  /**
   * The walkthrough's failure (spec 9.5): the watched source is the east-most radio of the middle row, and
   * the failed radio is the middle radio of its route. It fails this long after one of its hellos, so
   * the three missed hellos fall on the walkthrough's step boundaries.
   */
  failAfterHelloS: number;
  /** Maintenance ticket after the walkthrough's failure. */
  ticket: { swapTimeMin: number };
}

export const PLAY: PlayConfig = {
  // The full-site default design's module grid (networkCost on the v3 site, D33): 10 across the lanes
  // by 5 along them; tests/buildTab.test.ts keeps the two equal (D50).
  cellCols: 10,
  cellRows: 5,
  unitsPerCell: 4,
  lanesPerCell: 3,
  rowPitchM: 21.0,
  linkRangeM: 75,
  coverageRadiusM: 46,
  coverageTargetPct: 95,
  coverageSampleM: 2,
  buildStepS: 0.7,
  commissionLagSteps: 2,
  frontierPhases: [
    { id: 'grading', label: 'Grading', equipment: 'Dozer', glyphs: ['dozer'] },
    { id: 'foundations', label: 'Foundations', equipment: 'Pile rig', glyphs: ['pileRig'] },
    { id: 'trenching', label: 'Trenching', equipment: 'Trencher', glyphs: ['trencher'] },
    {
      id: 'placement',
      label: 'Placement',
      equipment: 'Carrier and crane',
      glyphs: ['carrier', 'crane'],
    },
    { id: 'connection', label: 'Connection', equipment: 'Crew', glyphs: ['crew'] },
  ],
  packetIntervalS: 1.0,
  hopS: 0.15,
  queueFlushIntervalS: 0.05,
  maxPacketHops: 64,
  basePadLanes: 2,
  basePadUnits: 4,
  failAfterHelloS: 0.05,
  ticket: { swapTimeMin: 15 },
};

/** Walkthrough of the Build & failure tab (spec 9.8): step durations in playback seconds. */
export const PLAY_WALK = {
  sectionS: 4,
  /** The build plays one step per `buildStepS`, then holds the finished build for this long. */
  buildHoldS: 0.7,
  coverageS: 4,
  /** Planned length of the data step; it stretches to the failed radio's next hello (D44). */
  dataS: 5,
  rerouteS: 3,
  recoveredS: 5,
  costS: 5,
};

/** Drawing of the play-model map in CSS pixels and seconds (colors come from tokens.css). */
export const PLAY_VIEW = {
  radioPx: 3.5,
  radioHaloPx: 1.5,
  hitRadiusPx: 12,
  hoverRingPx: 7,
  failCrossPx: 5,
  cutOffRingPx: 4.5,
  packetPx: 2.5,
  linkWidthPx: 1,
  routeWidthPx: 2.5,
  oldRouteWidthPx: 1.5,
  oldRouteDashPx: [4, 4],
  coverageEdgePx: 1,
  /** A radio's coverage circle scales in over this time when it comes online (spec 6.7). */
  radioFadeInS: 0.3,
  /** A failed radio flashes red once: a ring that grows to this radius and fades. */
  failFlashS: 0.6,
  failFlashPx: 18,
  /** The route update spreads as a ring from the failed radio (slowed for visibility). */
  updateRingS: 0.8,
  /** Missed-hello label stays this long after detection. */
  helloLabelHoldS: 1,
  labelGapPx: 8,
  badgePadPx: 6,
  badgeHeightPx: 18,
  /** Gap between a failed radio and its maintenance ticket below it. */
  ticketGapPx: 16,
  /** The base yard outline: inset from its cell, corner radius and alpha of the base color. */
  yardInsetM: 4,
  yardCornerPx: 4,
  yardAlpha: 0.35,
  /** Half size of the base marker; larger than on the full-site map, since the base has its own yard. */
  baseMarkerPx: 7,
  /** Frontier layers (D49): band tint, how far machines stay from the lane ends, the carrier's trail. */
  phaseBandAlpha: 0.08,
  equipmentMarginM: 12,
  equipmentTrailM: 18,
  /** Equipment marks: half size in CSS px (the glyphs are drawn on a grid of +-glyphHalfUnits), and the online dot. */
  equipmentPx: 5,
  glyphHalfUnits: 6,
  onlineDotPx: 2,
  /** Phase labels above the east face: row height, gap above the coverage, leader alpha. */
  phaseLabelRowPx: 14,
  phaseLabelGapPx: 6,
  phaseLeaderAlpha: 0.5,
};

/** Percentages in the readout: a share times 100, and the decimals of a small share of the P3 hardware. */
export const PERCENT = { scale: 100, shareDecimals: 2, coverageTenths: 10 };
