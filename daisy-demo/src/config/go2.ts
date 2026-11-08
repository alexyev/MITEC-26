// The Unitree GO2 as a site surveyor, for "Why UTVs, not robot dogs" (D110). Each figure carries its source and
// the date it was read; a team estimate says so. The survey engine plans the site with `GO2_SURVEY` as it does
// with the UTV's `SURVEY`, so the comparison's numbers come from code.
import type { SurveyConfig } from '../engine/survey';
import { SURVEY } from './survey';
import type { KitPart } from './utvKit';
import { UTV_KIT } from './utvKit';

const KMH_PER_MS = 3.6;

/** The GO2's facts, as its maker and resellers state them. */
export const GO2 = {
  /**
   * The variant priced: the GO2 EDU, the one with the SDK for planned autonomous routes, the 15,000 mAh
   * battery and 4G (the Air and Pro run from the phone app). Exowatt's challenge video shows a GO2-class dog.
   */
  variant: 'GO2 EDU',
  /**
   * Walking speed: Unitree lists 0 to 2.5 m/s, and about 5 m/s running, "tested in lab" (unitree.com/go2,
   * read Nov 2026). On a survey the dog walks at a sustained 1.5 m/s (5.4 km/h), a team estimate: it holds
   * its lidar steady on loose desert ground for the whole battery, just under the 1.6 m/s top speed of Boston
   * Dynamics' Spot, the industrial quadruped (engineering.com, read Nov 2026).
   */
  topWalkMS: 2.5,
  labRunMS: 5,
  surveyMS: 1.5,
  /**
   * Battery: the EDU's 15,000 mAh, 432 Wh pack runs about 2 to 4 h (unitree.com/go2); reviews measure about
   * 2 to 2.5 h of continuous walking with a payload (robozaps.com GO2 review, read Nov 2026), so a survey
   * runs 2 h on a pack. The fast charger refills one in 0.8 to 1.5 h (unitree.com/go2).
   */
  batteryH: 2,
  batteryRatedH: [2, 4] as const,
  chargeH: [0.8, 1.5] as const,
  batteryWh: 432,
  /**
   * A battery swap in the field: 5 min (team estimate), with a spare carried out to the dog, which favors the
   * dog: walking back to the base to charge would cost more.
   */
  swapMin: 5,
  /**
   * Built-in lidar: the Unitree 4D LiDAR L1, 360 x 90 degrees, 0.05 m minimum range; the L1 PM reaches 20 m
   * on bright (90%) targets and 10 m on dark (10%) ones (Unitree L1 Quick Start Guide, oss-global-cdn
   * .unitree.com, read Nov 2026). Mounted on the dog's head, 0.3 m up, it sees the ground at a grazing angle,
   * where bare ground returns like a dark target: a ground model to 10 m each side, passes 20 m apart.
   */
  lidar: 'Unitree 4D LiDAR L1, 360° × 90°',
  lidarDarkRangeM: 10,
  lidarBrightRangeM: 20,
  /**
   * Links: Wi-Fi 6, Bluetooth 5.2 and 4G with an eSIM (unitree.com/go2; RobotShop GO2 EDU listing, read Nov
   * 2026), and a remote control rated past 30 m. No satellite link: on a new desert site with no cell
   * coverage and no site network, it has nothing to join.
   */
  links: 'Wi-Fi 6, Bluetooth, 4G',
};

/**
 * The GO2 in the survey engine (D110): passes as far apart as its lidar sees the ground on both sides, at its
 * sustained survey speed; it turns at that speed and transits at its top walking speed. No drone, so no drone
 * swaps; its battery takes the place of the UTV's tank, swapped where it stands. Shift and RTK base setup are
 * the UTV's, from the same field day.
 */
export const GO2_SURVEY: SurveyConfig = {
  ...SURVEY,
  swathM: 2 * GO2.lidarDarkRangeM,
  surveySpeedKmh: GO2.surveyMS * KMH_PER_MS,
  transitSpeedKmh: GO2.topWalkMS * KMH_PER_MS,
  turnSpeedKmh: GO2.surveyMS * KMH_PER_MS,
  droneFlightMin: Infinity,
  droneSwapMin: 0,
  fuelRangeKm: GO2.batteryH * GO2.surveyMS * KMH_PER_MS,
  refuelMin: GO2.swapMin,
};

/** The GO2, at its top walking speed the whole time: the dog's best case, for the comparison's footnote. */
export const GO2_TOP_SURVEY: SurveyConfig = {
  ...GO2_SURVEY,
  surveySpeedKmh: GO2.topWalkMS * KMH_PER_MS,
  turnSpeedKmh: GO2.topWalkMS * KMH_PER_MS,
  fuelRangeKm: GO2.batteryH * GO2.topWalkMS * KMH_PER_MS,
};

const RTK = UTV_KIT.find((p) => p.id === 'rtk')!;

/** One survey GO2, all in (D110): the dog, a spare pack for the swaps, and the UTV's RTK receiver. */
export const GO2_KIT: KitPart[] = [
  {
    id: 'go2',
    label: 'Robot dog',
    detail: 'Unitree GO2 EDU, with its L1 lidar and one 15,000 mAh pack',
    count: 1,
    unitUsd: 11_190,
    source:
      'roboticscenter.ai, "Unitree Price List 2026 (US)": GO2 EDU $11,190, reviewed Oct 2026; Global Drone HQ GO2 guide, from $11,190, Aug 2026',
  },
  {
    id: 'battery',
    label: 'Spare battery',
    detail: '15,000 mAh, 432 Wh',
    count: 1,
    unitUsd: 800,
    source: 'rcdrone.top, Unitree GO2 battery (15,000 mAh), $800 regular price, read Nov 2026',
  },
  { ...RTK, detail: 'Emlid Reach M2, as on the UTV' },
];

/** Largest dog fleet the comparison sizes. */
export const GO2_MAX_FLEET = 40;

/** Where the GO2's facts come from, for the comparison's sources (the kit's prices carry their own). */
export const GO2_SOURCES = [
  'Unitree, GO2 product page and spec table (unitree.com/go2): walking 0 to 2.5 m/s, about 5 m/s running in the lab, 15,000 mAh pack about 2 to 4 h, fast charge 0.8 to 1.5 h, Wi-Fi 6, Bluetooth and 4G with eSIM; read Nov 2026',
  'Unitree, 4D LiDAR L1 Quick Start Guide v1.0 (oss-global-cdn.unitree.com): 360 x 90 degrees, L1 PM 20 m at 90% and 10 m at 10% reflectivity; read Nov 2026',
  'Robozaps, Unitree GO2 review: about 2 to 2.5 h of continuous walking with a payload; read Nov 2026',
  'engineering.com on Boston Dynamics Spot: 1.6 m/s top walking speed; read Nov 2026',
];
