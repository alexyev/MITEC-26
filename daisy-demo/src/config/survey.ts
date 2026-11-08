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
