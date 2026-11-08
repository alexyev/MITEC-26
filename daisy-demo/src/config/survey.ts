// 4x4 survey (spec 8.4). The swath and the speeds are sourced (D80); the hourly 4x4 cost lives in pricing.json
// (`survey`). Each 4x4 drives RTK GNSS ground passes with a mapping drone following it, so the passes are as
// far apart as the drone's mapping lines, and the 4x4's ground pace sets the survey time.
import type { SurveyConfig } from '../engine/survey';

export const SURVEY: SurveyConfig = {
  /** Largest 4x4 fleet the stepper allows. */
  maxVehicles: 8,
  /** 4x4s when the tab opens and after Restart. */
  defaultVehicles: 3,
  /**
   * Distance between survey passes, in meters (D80); passes are at most this far apart.
   * Ground only: OptiSurface's RTK field-survey guide (optisurface.uservoice.com, article 235495, read Nov 2026)
   * asks for 15 m on fields with relief, 15-30 m on flat ground, and "do not exceed 50 m".
   * With the drone: Propeller's Zenmuse L2 lidar planning guide (help.propelleraero.com, article
   * 19384915723031, read Nov 2026) flies at most 60 m above ground with 50% side overlap; the L2's 70 degree
   * swath (DJI Zenmuse L2 FAQ) is then 84 m wide, so its mapping lines are 42 m apart.
   * 40 m keeps under both: the drone maps the ground between the 4x4's RTK passes.
   */
  swathM: 40,
  /**
   * Speed on a survey pass and on the short shift to the next pass (D80). Sources range from 7 to 15 km/h:
   * an 80-acre ATV grid at 50 ft spacing in about 3 h, so about 7 km/h with turns (RPLS.com forum, "Topographic
   * survey with ATV", read Nov 2026), and 15 km/h, one RTK point every 5 m at 1 s (OptiSurface, above).
   * A mapping drone flies faster than either (DJI tests the L2 at 15 m/s), so the 4x4 sets the pace.
   */
  surveySpeedKmh: 12,
  /**
   * Speed between the base and a strip, and around the base pad (D80): 15 mph, the UTV limit on a
   * utility-scale solar build ("Rules of the Road", Cobra-Barrett Solar Project, form.jotform.com
   * 242763923454058, read Nov 2026; 10 mph near active work, which a pre-construction site has none of).
   */
  transitSpeedKmh: 24,
  /** Side of a ground cell for the surveyed-ground model, in meters. */
  cellM: 10,
  /**
   * Hours of survey work shown per second of playback at 1x: half an hour of work plays in 1 s, so the
   * default fleet's survey plays in about 11 s (D82).
   */
  playbackHoursPerS: 0.5,
  /** A strip section narrower than this joins its neighbor; a base this close to a strip edge is on it (D60). */
  minSectionM: 1,
};

/** Survey walkthrough (spec 8.5): step lengths in seconds; the Survey step lasts the survey time. */
export const SURVEY_WALK = {
  siteS: 4,
  pathsS: 3,
  doneS: 4,
};

/**
 * The close-up of the Survey step (D82): the map zooms in on one 4x4 halfway down a pass, slows the clock so
 * its drone and the link between them read at a glance, and zooms back out to where the view was.
 */
export const SURVEY_CLOSE_UP = {
  /** The 4x4 the camera follows (0-based: 4x4 #1). */
  vehicle: 0,
  /** The close-up shows the pass this 4x4 drives at this share of its drive time. */
  atShare: 0.3,
  /** Zoom of the close-up, in CSS pixels per meter: passes 40 m apart are 72 px apart. */
  pxPerM: 1.8,
  /** How fast the 4x4 crosses the screen in the close-up at 1x, in CSS pixels per second. */
  screenSpeedPxS: 48,
  /** Seconds to zoom in (and the clock to slow down), to hold the close-up, and to zoom back out. */
  rampS: 1.6,
  holdS: 5,
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
  /** ...and at least this far behind on the ground, so its link reads when the map is zoomed in (D82). */
  droneTrailM: 18,
  /** Labels of the 4x4 and its drone in the close-up (D82): this far right of each mark. */
  closeUpLabelGapPx: 12,
  droneArmPx: 3.5,
  droneRotorRadiusPx: 2.25,
  droneRotorWidthPx: 1.25,
  droneBodyRadiusPx: 1.5,
  droneHaloPx: 1.5,
  droneLinkWidthPx: 1.25,
  /** Ring around the hovered 4x4 or drone. */
  hoverRingGapPx: 3.5,
  hoverRingWidthPx: 1.5,
  /** 4x4s at the base park in a row this far outside the pad's gate (D81), this far apart. */
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
