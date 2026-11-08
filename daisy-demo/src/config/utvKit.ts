// The survey UTV's kit and what one costs, all in (D84). Every price is a public list or retail price with its
// source and the date it was read; a part with no public price is null and the demo shows no figure for it.

export interface KitPart {
  id: string;
  label: string;
  /** What is priced, for the line under the label. */
  detail: string;
  /** Units per UTV. */
  count: number;
  /** Price of one unit in USD, or null when no source gives one. */
  unitUsd: number | null;
  source: string;
}

/** Grades of lidar the UTV could carry, front and back, with what a pair costs (D84). */
export interface LidarGrade {
  id: 'robotics' | 'slam' | 'mobileMapping';
  label: string;
  example: string;
  /** Price of one unit, or the low and high of a range, in USD. */
  lowUsd: number;
  highUsd: number;
  /** Units for front and back: two scanners, or one mobile mapping system that covers both. */
  count: number;
  verdict: string;
  source: string;
}

export const LIDAR_GRADES: LidarGrade[] = [
  {
    id: 'robotics',
    label: 'Robotics grade',
    example: 'Hesai XT32 or Ouster OS1, 32 channels',
    lowUsd: 4500,
    highUsd: 4500,
    count: 2,
    verdict: 'Built for autonomy; with RTK and the drone overhead it maps the ground to a few cm.',
    source:
      'us-lidar.com, "Best LiDAR Sensors for Robotics: 2026 Buying Guide" (XT32 at $4,500), read Nov 2026',
  },
  {
    id: 'slam',
    label: 'Survey-grade SLAM scanner',
    example: 'Stonex X120GO with its vehicle mount',
    lowUsd: 32000 + 5750,
    highUsd: 32000 + 5750,
    count: 2,
    verdict:
      'Survey accuracy on its own, but made for walking; a vehicle mount turns it to the road.',
    source:
      'NavAids (navaids.com.au, Stonex X120GO: $32,000 and the vehicle mount $5,750, ex GST), read Nov 2026',
  },
  {
    id: 'mobileMapping',
    label: 'Mobile mapping system',
    example: 'Trimble MX9 or Leica Pegasus TRK class',
    lowUsd: 400_000,
    highUsd: 1_200_000,
    count: 1,
    verdict: 'Design-grade road surveys at highway speed; far beyond what a site survey needs.',
    source:
      'Swyvl, "3D Mapping Cost Guide: What You\'ll Pay in 2026" ($400k to $1.2M a rig), read Nov 2026',
  },
];

/**
 * Why robotics-grade lidar is enough for the site survey (D111), each point with its source and the date it
 * was read: the positions come from RTK GNSS, the lidar only models flat ground and finds obstacles.
 */
export const ROBOTICS_GRADE_ENOUGH: { point: string; source: string }[] = [
  {
    point: 'RTK GNSS places every pile and unit, to 7 mm + 1 ppm on the move',
    source:
      'Emlid store, Reach M2 specs: kinematic 7 mm + 1 ppm horizontal, 14 mm + 1 ppm vertical, read Nov 2026',
  },
  {
    point:
      "the lidar only models the ground and finds obstacles, where the drone's L2, rated to 4 cm vertical and 5 cm horizontal, covers a flat desert site",
    source:
      'DJI Enterprise, Zenmuse L2 specs: 5 cm horizontal and 4 cm vertical at 150 m, read Nov 2026',
  },
  {
    point: "Exowatt's own GO2 surveys with a navigation-class lidar",
    source:
      "Exowatt's challenge video (a GO2-class quadruped); Unitree, GO2 with its 4D LiDAR L1 (unitree.com/go2), read Nov 2026",
  },
  {
    point: 'survey-grade rigs are built for design-grade highway mapping',
    source:
      'TxDOT, "Mobile Lidar Specifications and Project Workflow for Design-Grade Mapping" (txdot.gov), read Nov 2026',
  },
];

/** The lidar grade the kit is priced with. */
export const KIT_LIDAR: LidarGrade['id'] = 'robotics';

/** One survey UTV, all in (D84). The Starlink Mini, its mount and service come from pricing.json (`survey`). */
export const UTV_KIT: KitPart[] = [
  {
    id: 'utv',
    label: 'UTV',
    detail: 'Polaris Ranger XP 1000, with destination',
    count: 1,
    unitUsd: 21_499 + 1_095,
    source:
      'polaris.com, 2026 Ranger XP 1000: from $21,499 US MSRP plus $1,095 destination, read Nov 2026',
  },
  {
    id: 'lidar',
    label: 'Lidar, front and back',
    detail: '2 × robotics grade',
    count: 2,
    unitUsd: 4500,
    source: LIDAR_GRADES[0].source,
  },
  {
    id: 'rtk',
    label: 'RTK GNSS receiver',
    detail: 'Emlid Reach M2 with its antenna',
    count: 1,
    unitUsd: 1023,
    source: 'Emlid store, Reach M2 with GNSS antenna, $1,023, read Nov 2026',
  },
  {
    id: 'compute',
    label: 'Rugged compute',
    detail: 'Connect Tech Rudi-NX, Jetson Orin NX',
    count: 1,
    unitUsd: 3258,
    source: 'WDL Systems, Connect Tech Rudi-NX with Jetson Orin NX, from $3,258, read Nov 2026',
  },
  {
    id: 'drone',
    label: 'Drone with lidar',
    detail: 'DJI Matrice 350 RTK and Zenmuse L2',
    count: 1,
    unitUsd: 12_559 + 12_430,
    source:
      'Drones Made Easy, Matrice 350 RTK combo up to $12,559; Rock Robotic, Zenmuse L2 $12,430; read Nov 2026',
  },
  {
    id: 'integration',
    label: 'Integration and calibration',
    detail: 'mounts, wiring, lidar-to-GNSS calibration',
    count: 1,
    unitUsd: null,
    source: 'no public price',
  },
];

/** The captain's all-in figure for one survey UTV, which the kit is checked against (D84). */
export const CAPTAIN_ESTIMATE_USD = 50_000;
