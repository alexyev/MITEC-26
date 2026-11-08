// Play model of the Build & failure tab (spec 9.1, 9.4, 9.5): the 9 x 5 radio grid on a 540-unit section.
// All values are placeholders until the team confirms them (spec section 14). Routing timing is ROUTING in defaults.ts.

/** A radio cell on the play-model grid: column 0 is the west edge, row 0 the south edge. */
export interface CellRef {
  col: number;
  row: number;
}

export interface PlayConfig {
  /** Radio cells across (east-west) and down (north-south); one radio per cell. */
  cellCols: number;
  cellRows: number;
  /** Units along the lane per cell, and lanes per cell. */
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
  /** Each connected radio sends one packet per interval. */
  packetIntervalS: number;
  /** Playback time per hop ("Packets slowed for visibility"). */
  hopS: number;
  /** Spacing of the packets that leave a queue once the radio has a route again. */
  queueFlushIntervalS: number;
  /** A packet that has made this many hops is dropped, so a transient routing loop cannot run forever. */
  maxPacketHops: number;
  /** Cell whose center holds the base (Starlink backhaul). */
  baseCell: CellRef;
  /** The walkthrough's failure (spec 9.5). */
  preset: {
    /** The watched source: the east-most radio of the middle row. */
    watchedCell: CellRef;
    /** The radio that fails, in the middle of the watched route. */
    failedCell: CellRef;
    /**
     * The failure happens this long after one of the failed radio's hellos, so the three missed hellos
     * fall on the walkthrough's step boundaries.
     */
    failAfterHelloS: number;
  };
  /** Maintenance ticket after the walkthrough's failure. */
  ticket: { swapTimeMin: number };
}

export const PLAY: PlayConfig = {
  cellCols: 9,
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
  packetIntervalS: 1.0,
  hopS: 0.15,
  queueFlushIntervalS: 0.05,
  maxPacketHops: 64,
  baseCell: { col: 4, row: 2 },
  preset: {
    watchedCell: { col: 8, row: 2 },
    failedCell: { col: 6, row: 2 },
    failAfterHelloS: 0.05,
  },
  ticket: { swapTimeMin: 15 },
};
