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
  /** Ring around the hovered 4x4. */
  hoverRingGapPx: 3.5,
  hoverRingWidthPx: 1.5,
  /** 4x4s at the base park in a row this far below the base marker, this far apart. */
  parkedBelowPx: 16,
  parkedGapPx: 13,
  /** Pointer distance within which a 4x4 or the base shows its hover card (spec 6.8). */
  hitRadiusPx: 12,
};
