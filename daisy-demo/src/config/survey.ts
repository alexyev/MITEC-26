// UTV survey (spec 8.4). Method, swath, speeds and overheads are sourced (D80, D83); the hourly UTV cost lives
// in pricing.json (`survey`). Each UTV carries a mobile lidar scanner with RTK GNSS and Starlink, and a lidar
// drone follows it, scanning the same strip from above; the UTV's pace, its turns and stops set the time.
import type { SurveyConfig } from '../engine/survey';

export const SURVEY: SurveyConfig = {
  /** Largest UTV fleet the stepper allows. */
  maxVehicles: 8,
  /** UTVs when the tab opens and after Restart. */
  defaultVehicles: 3,
  /**
   * Distance between survey passes, in meters (D80, D83); passes are at most this far apart.
   * The UTV's mobile lidar: TxDOT's mobile lidar specification (txdot.gov, "Mobile Lidar Specifications and
   * Project Workflow for Design-Grade Mapping", read Nov 2026) cautions against ground models more than 50 ft
   * (15 m) past the pavement edge, about 20 m from the vehicle, so a pass covers 40 m.
   * The drone above: Propeller's Zenmuse L2 lidar guide (help.propelleraero.com, article 19384915723031,
   * read Nov 2026) flies at most 60 m above ground with 50% side overlap; the L2's 70 degree swath (DJI
   * Zenmuse L2 FAQ) is then 84 m wide, lines 42 m apart, so 40 m passes keep every point seen twice.
   * Without lidar, RTK ground passes would be 15-30 m apart (OptiSurface field survey guide, article 235495).
   */
  swathM: 40,
  /**
   * Speed on a survey pass (D83). Mobile lidar is built for road speed (TxDOT specifies its density at
   * 60 mph; YellowScan's Fly & Drive drives at 50 km/h typically), so the site sets the pace: 20 km/h, under
   * the 15 mph (24 km/h) UTV limit below, to keep the scanner steady on unpaved ground. The drone keeps up:
   * Propeller flies the L2 at up to 9 m/s (32 km/h). RTK point logging alone runs at about 15 km/h
   * (OptiSurface) and was the previous model (12 km/h).
   */
  surveySpeedKmh: 20,
  /**
   * Speed between the base and a strip, and around the base pad (D80): 15 mph, the UTV limit on a
   * utility-scale solar build ("Rules of the Road", Cobra-Barrett Solar Project, form.jotform.com
   * 242763923454058, read Nov 2026; 10 mph near active work, which a pre-construction site has none of).
   */
  transitSpeedKmh: 24,
  /**
   * Speed through the U-turn at the end of a pass (D83), a half circle 40 m across, so 63 m: a team
   * estimate, half the pass speed, as no source gives UTV turn times (tractor studies time whole headlands).
   */
  turnSpeedKmh: 10,
  /**
   * Drone flight per battery set (D83): DJI rates the Matrice 350 RTK at 55 min with no payload at 8 m/s
   * (enterprise.dji.com Matrice 350 RTK specs, read Nov 2026); with the L2 and a landing reserve, 35 min.
   */
  droneFlightMin: 35,
  /**
   * A battery swap (D83): the drone lands on its UTV, which stops; the TB65 batteries hot-swap without
   * powering down (DJI), so 3 min with the landing and take-off (team estimate).
   */
  droneSwapMin: 3,
  /**
   * Km on a tank (D83): a Polaris Ranger XP 1000 carries 11.5 gal (43.5 L, Polaris owner's manual and specs);
   * owners report about 130 miles (210 km) a tank at slow speeds (RangerXD forum, read Nov 2026). 180 km
   * keeps a reserve. Refueling from cans on the UTV where it stands: 15 min (team estimate).
   */
  fuelRangeKm: 180,
  refuelMin: 15,
  /**
   * A field day (D83): 10 hours, the shift solar builders post for site crews (Flintco: "10 hours a day,
   * possibly 6 days a week"; others 10-12 h, read Nov 2026). Each day starts with the RTK base set up and
   * checked on a known point: about 30 min (Trimble, "The value proposition of going baseless": "20 to 30
   * minutes into your day", read Nov 2026).
   */
  shiftH: 10,
  baseSetupH: 0.5,
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
 * The close-up of the Survey step (D82): the map zooms in on one UTV halfway down a pass, slows the clock so
 * its drone and the link between them read at a glance, and zooms back out to where the view was.
 */
export const SURVEY_CLOSE_UP = {
  /** The UTV the camera follows (0-based: UTV #1). */
  vehicle: 0,
  /** The close-up shows the pass this UTV drives at this share of its drive time. */
  atShare: 0.3,
  /** Zoom of the close-up, in CSS pixels per meter: passes 40 m apart are 72 px apart. */
  pxPerM: 1.8,
  /** How fast the UTV crosses the screen in the close-up at 1x, in CSS pixels per second. */
  screenSpeedPxS: 48,
  /** Seconds to zoom in (and the clock to slow down), to hold the close-up, and to zoom back out. */
  rampS: 1.6,
  holdS: 5,
};

/**
 * Following a UTV (D140-D143): the viewer zooms in on one UTV, and the camera stays on it as it drives, with its
 * drone behind it on its link and Starlink above it.
 */
export const SURVEY_FOLLOW = {
  /** Zoom while following, in CSS pixels per meter: passes 40 m apart are 96 px apart, the drone 43 px behind. */
  pxPerM: 2.4,
  /**
   * How fast the ground passes under the UTV on a survey pass at 1x, in CSS pixels per second (D142): 25 m/s,
   * about 4.5 times real time, so 1 s plays about 4.5 s of work.
   */
  screenSpeedPxS: 60,
  /** Seconds of wall time to ease in and back out, and to switch to another UTV (D141). */
  easeS: 1.2,
  switchS: 1,
  /**
   * The Starlink satellite of the link view (D143): this far left of the followed UTV (the labels are on its
   * right, so the beam never crosses them), and this far below the top of the area between the panels.
   */
  satelliteDxPx: -150,
  satelliteTopPx: 30,
  /** The satellite mark: its body, and the solar wing on each side. */
  satelliteBodyPx: 4,
  satelliteWingPx: { w: 9, h: 5, gap: 2 },
  /** The uplink beam: dashed, its dashes moving up one dash period every `pulseWorkS` of work. */
  beamDashPx: [3, 4],
  beamWidthPx: 1.25,
  /** Data pulses on the drone's link, one each way: each crosses the link in this many seconds of work. */
  pulseWorkS: 5,
  pulseRadiusPx: 2.25,
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
  /** A UTV: a violet dot on a dark halo, with a blue online dot on its upper right. */
  vehicleRadiusPx: 4.5,
  vehicleHaloPx: 2,
  onlineDotRadiusPx: 2.25,
  onlineDotOffsetPx: 5,
  /**
   * A drone (D61): a small four-rotor mark that follows its UTV this far behind along the path it drove,
   * on a short blue link to the UTV, whose Starlink carries its data.
   */
  droneTrailPx: 20,
  /** ...and at least this far behind on the ground, so its link reads when the map is zoomed in (D82). */
  droneTrailM: 18,
  /** Labels of the UTV and its drone in the close-up (D82): this far right of each mark. */
  closeUpLabelGapPx: 12,
  droneArmPx: 3.5,
  droneRotorRadiusPx: 2.25,
  droneRotorWidthPx: 1.25,
  droneBodyRadiusPx: 1.5,
  droneHaloPx: 1.5,
  droneLinkWidthPx: 1.25,
  /** Ring around the hovered UTV or drone. */
  hoverRingGapPx: 3.5,
  hoverRingWidthPx: 1.5,
  /** UTVs at the base park in a row this far outside the pad's gate (D81), this far apart. */
  parkedBelowPx: 16,
  parkedGapPx: 13,
  /** Pointer distance within which a UTV or the base shows its hover card (spec 6.8). */
  hitRadiusPx: 12,
};

/**
 * Survey approaches of the Alternatives comparison (D62, D63), each with a one-line trade-off. None of the
 * research files prices them, so only our approach shows a cost (its Starlink, from the cost workbook).
 */
export const SURVEY_ALTERNATIVES: { id: string; label: string; verdict: string }[] = [
  {
    id: 'ours',
    label: 'UTVs with lidar and drones · Starlink on each',
    verdict:
      'Lidar on the ground and from the air on one strip; every UTV online anywhere on site.',
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
