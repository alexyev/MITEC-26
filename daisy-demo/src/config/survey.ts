// 4x4 survey (spec section 8.4). All values are placeholders until the team confirms the survey method,
// the swath and the speeds (spec section 14). The hourly 4x4 cost lives in pricing.json (`survey`).
import type { SurveyConfig } from '../engine/survey';

export const SURVEY: SurveyConfig = {
  /** Largest 4x4 fleet the stepper allows. */
  maxVehicles: 8,
  /** 4x4s when the tab opens and after Restart. */
  defaultVehicles: 3,
  /** Width of ground one survey pass records, in meters; passes are at most this far apart. */
  swathM: 20,
  /** Speed on a survey pass and on the short shift to the next pass. */
  surveySpeedKmh: 8,
  /** Speed on the legs between the base and a strip. */
  transitSpeedKmh: 20,
  /** Side of a ground cell for the surveyed-ground model, in meters. */
  cellM: 10,
  /** Hours of survey work shown per second of playback (1 hour of work plays in 1 s). */
  playbackHoursPerS: 1,
  /** A strip section narrower than this joins its neighbor; a base this close to a strip edge is on it (D60). */
  minSectionM: 1,
};

/** Survey walkthrough (spec 8.5): step lengths in seconds; the Survey step lasts the survey time. */
export const SURVEY_WALK = {
  siteS: 4,
  pathsS: 3,
  doneS: 4,
};

/** Survey map (spec 5, 6.6): sizes in CSS pixels. Colors come from tokens.css; zoom and fit from MAP and UI. */
export const SURVEY_VIEW = {
  /** Planned paths: dashed, and at least this far apart on screen (closer passes are thinned out). */
  pathWidthPx: 1,
  pathDashPx: [3, 3],
  minPassGapPx: 8,
  /** Strip boundaries in the neutral border color, and the strip labels above the site. */
  stripLineWidthPx: 1,
  stripLabelGapPx: 8,
  /** A 4x4: an amber dot on a dark halo, with a blue online dot on its upper right. */
  vehicleRadiusPx: 4.5,
  vehicleHaloPx: 2,
  onlineDotRadiusPx: 2.25,
  onlineDotOffsetPx: 5,
  /**
   * A drone (D61): a small four-rotor mark that follows its 4x4 this far behind along the path it drove,
   * on a short blue link to the 4x4, whose Starlink carries its data.
   */
  droneTrailPx: 20,
  droneArmPx: 3.5,
  droneRotorRadiusPx: 2.25,
  droneRotorWidthPx: 1.25,
  droneBodyRadiusPx: 1.5,
  droneHaloPx: 1.5,
  droneLinkWidthPx: 1.25,
  /** Ring around the hovered 4x4 or drone. */
  hoverRingGapPx: 3.5,
  hoverRingWidthPx: 1.5,
  /** 4x4s at the base park in a row this far below the base marker, this far apart. */
  parkedBelowPx: 16,
  parkedGapPx: 13,
  /** Pointer distance within which a 4x4 or the base shows its hover card (spec 6.8). */
  hitRadiusPx: 12,
};

/**
 * Survey approaches of the Alternatives comparison (D62, D63), each with a one-line trade-off. None of the
 * research files prices them, so only our approach shows a cost (its Starlink, from the cost workbook).
 */
export const SURVEY_ALTERNATIVES: { id: string; label: string; verdict: string }[] = [
  {
    id: 'ours',
    label: '4x4s with drones · Starlink on each',
    verdict: 'Ground and air capture on one strip; every 4x4 and drone online anywhere on site.',
  },
  {
    id: 'gpsCrew',
    label: 'Survey crew with GPS rovers',
    verdict: 'Proven and simple, but slow on foot, and RTK rovers need a correction link on site.',
  },
  {
    id: 'droneOnly',
    label: 'Drones only, with ground control',
    verdict: 'Fast aerial capture, but a crew still sets the ground control, and no ground pass.',
  },
  {
    id: 'contractor',
    label: 'Aerial survey contractor',
    verdict: 'No fleet to buy or run, but the schedule is theirs and the data comes back later.',
  },
  {
    id: 'quadruped',
    label: 'Quadruped robot (GO2)',
    verdict: "In Exowatt's challenge video; it shows NO LINK once it is away from the site base.",
  },
];

/** Where the comparison's facts come from, for its footnote. */
export const SURVEY_ALTERNATIVES_SOURCES = {
  workbook: "the team's cost workbook (Alternatives sheet: Starlink kit, mounting and plan)",
  brief: "Exowatt's challenge brief and video",
  research: "the team's off-grid connectivity research",
};
