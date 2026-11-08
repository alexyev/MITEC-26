// "Why UTVs, not robot dogs" (D110): the survey engine's comparison of one survey UTV and one Unitree GO2 on the
// generated site, with each kit's cost, as the rows and lines the sheet and the walkthrough show.
import { GO2, GO2_KIT, GO2_MAX_FLEET, GO2_SURVEY, GO2_TOP_SURVEY } from '../../config/go2';
import { SURVEY } from '../../config/survey';
import type { Pricing } from '../../engine/pricing';
import { unitGridRect } from '../../engine/site';
import { acresPerHour, compareSurveyors } from '../../engine/surveyCompare';
import type { SurveyComparison } from '../../engine/surveyCompare';
import { getSiteModel } from '../../state/model';
import { formatHours, formatInt, formatTimes, formatUsd, sig3 } from './format';
import { utvKitCost } from './utvKit';

export interface WhyUtv {
  comparison: SurveyComparison;
  utvKitUsd: number;
  dogKitUsd: number;
  /** How many times a GO2 kit the UTV kit costs. */
  priceRatio: number;
  /** Acres an hour of one GO2 at its top walking speed the whole time, and the UTV's speed-up over that. */
  dogTopAcresPerH: number;
  topSpeedUp: number;
}

let cached: { pricing: Pricing; why: WhyUtv } | null = null;

/** The comparison on the generated site; planned once per pricing file, since it plans the site many times. */
export function whyUtv(pricing: Pricing): WhyUtv {
  if (cached?.pricing === pricing) return cached.why;
  const { site } = getSiteModel();
  const ground = { area: unitGridRect(site), base: site.base, pad: site.basePad };
  const utvKitUsd = utvKitCost(pricing).totalUsd;
  const dogKitUsd = GO2_KIT.reduce((sum, p) => sum + (p.unitUsd ?? 0) * p.count, 0);
  const comparison = compareSurveyors(
    ground,
    { config: SURVEY, kitUsd: utvKitUsd },
    { config: GO2_SURVEY, kitUsd: dogKitUsd },
    SURVEY.defaultVehicles,
    GO2_MAX_FLEET,
  );
  const dogTopAcresPerH = acresPerHour(ground, GO2_TOP_SURVEY);
  const why: WhyUtv = {
    comparison,
    utvKitUsd,
    dogKitUsd,
    priceRatio: utvKitUsd / dogKitUsd,
    dogTopAcresPerH,
    topSpeedUp: comparison.utv.acresPerH / dogTopAcresPerH,
  };
  cached = { pricing, why };
  return why;
}

const days = (n: number) => (n === 1 ? '1 field day' : `${formatInt(n)} field days`);
const KMH_PER_MS = 3.6;

/** Which side a row favors, so the sheet can say so; 'none' for a fact that is not better or worse. */
export type Favors = 'utv' | 'dog' | 'none';

export interface CompareRow {
  label: string;
  utv: string;
  dog: string;
  favors: Favors;
}

/** The comparison table, top to bottom: how each surveys, then time, then money, then the link. */
export function compareRows(why: WhyUtv): CompareRow[] {
  const { comparison: c } = why;
  const { utv, dog } = c;
  const fleet = utv.fleet;
  const lower = (u: number, d: number): Favors => (u < d ? 'utv' : d < u ? 'dog' : 'none');
  const higher = (u: number, d: number): Favors => lower(d, u);
  return [
    {
      label: 'Survey speed',
      utv: `${formatInt(SURVEY.surveySpeedKmh)} km/h`,
      dog: `${sig3(GO2_SURVEY.surveySpeedKmh)} km/h`,
      favors: higher(SURVEY.surveySpeedKmh, GO2_SURVEY.surveySpeedKmh),
    },
    {
      label: 'Passes apart',
      utv: `${formatInt(SURVEY.swathM)} m`,
      dog: `${formatInt(GO2_SURVEY.swathM)} m`,
      favors: higher(SURVEY.swathM, GO2_SURVEY.swathM),
    },
    {
      label: 'Acres an hour, one unit',
      utv: sig3(utv.acresPerH),
      dog: sig3(dog.acresPerH),
      favors: higher(utv.acresPerH, dog.acresPerH),
    },
    {
      label: `${formatInt(fleet)} of each on the site`,
      utv: `${formatHours(utv.workH)} h · ${days(utv.days)}`,
      dog: `${formatHours(dog.workH)} h · ${days(dog.days)}`,
      favors: lower(utv.workH, dog.workH),
    },
    {
      label: `Fleet for ${days(c.targetDays)}`,
      utv: `${formatInt(utv.matchFleet)} UTVs`,
      dog: `${formatInt(dog.matchFleet)} GO2s`,
      favors: lower(utv.matchFleet, dog.matchFleet),
    },
    {
      label: 'Kit, one unit',
      utv: formatUsd(why.utvKitUsd),
      dog: formatUsd(why.dogKitUsd),
      favors: lower(why.utvKitUsd, why.dogKitUsd),
    },
    {
      label: `Kit, fleet for ${days(c.targetDays)}`,
      utv: formatUsd(utv.matchKitUsd),
      dog: formatUsd(dog.matchKitUsd),
      favors: lower(utv.matchKitUsd, dog.matchKitUsd),
    },
    {
      label: 'Kit per acre, bought for this site',
      utv: formatUsd(utv.kitPerAcreUsd),
      dog: formatUsd(dog.kitPerAcreUsd),
      favors: lower(utv.kitPerAcreUsd, dog.kitPerAcreUsd),
    },
    {
      label: 'Kit per acre an hour of capacity',
      utv: formatUsd(utv.kitPerAcrePerHUsd),
      dog: formatUsd(dog.kitPerAcrePerHUsd),
      favors: lower(utv.kitPerAcrePerHUsd, dog.kitPerAcrePerHUsd),
    },
    {
      label: 'Its own link',
      utv: 'Starlink Mini',
      dog: `None: ${GO2.links}`,
      favors: 'utv',
    },
  ];
}

/** The lead points and the cost lines, as the sheet says them. */
export function whyText(why: WhyUtv) {
  const { comparison: c, priceRatio } = why;
  const { utv, dog } = c;
  return {
    speedUp: formatTimes(c.speedUp),
    faster: `Acres surveyed an hour by one unit, turns and stops included. ${formatInt(utv.fleet)} UTVs survey the site in ${days(utv.days)}; ${formatInt(dog.fleet)} GO2s take ${days(dog.days)}.`,
    connected:
      'Each UTV carries its own Starlink Mini and is the link for its lidar drone, so the survey is online from day one, before any site network exists. The GO2 has no satellite link, and on a new desert site there is nothing for its Wi-Fi or 4G to join.',
    cost: `A UTV with its drone costs ${formatTimes(priceRatio)} a GO2 kit but surveys ${formatTimes(c.speedUp)} the acres an hour, so each acre an hour of capacity costs ${formatUsd(utv.kitPerAcrePerHUsd)} instead of ${formatUsd(dog.kitPerAcrePerHUsd)}.`,
    dogEdge: `The dog's edge: for ${days(c.targetDays)}, ${formatInt(dog.matchFleet)} GO2s cost ${formatUsd(dog.matchKitUsd)} up front against ${formatUsd(utv.matchKitUsd)} for ${formatInt(utv.matchFleet)} UTVs, but with no drone and no link, and ${formatInt(dog.matchRefuels)} battery swaps out on the site.`,
    assumptions: `The GO2 EDU walks at a sustained ${sig3(GO2.surveyMS)} m/s (${sig3(GO2.surveyMS * KMH_PER_MS)} km/h) with passes ${formatInt(GO2_SURVEY.swathM)} m apart, as its L1 lidar sees bare ground to ${formatInt(GO2.lidarDarkRangeM)} m, ${formatInt(GO2.batteryH)} h a pack and a ${formatInt(GO2.swapMin)} min swap where it stands. Even at its ${sig3(GO2.topWalkMS)} m/s top walking speed it surveys ${sig3(why.dogTopAcresPerH)} acres an hour, and a UTV is still ${formatTimes(why.topSpeedUp)} faster. Crew time is not priced.`,
  };
}
