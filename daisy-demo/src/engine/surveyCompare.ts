// Survey UTV versus robot dog (D110): the same survey engine plans the site for each surveyor's config, so
// acres per hour, field days, the fleet each needs and its kit cost per acre all come from code.
import { SITE } from '../config/defaults';
import { planSurvey, surveySchedule } from './survey';
import type { Point, SurveyConfig, SurveyPlan } from './survey';
import type { Rect } from './types';

/** Where the survey runs: the area, the base and its pad, as `planSurvey` takes them. */
export interface SurveyGround {
  area: Rect;
  base: Point;
  pad: Rect | null;
}

/** A surveyor: how it moves and scans (a survey config), and what one costs, all in. */
export interface SurveyorSpec {
  config: SurveyConfig;
  kitUsd: number;
}

export interface SurveyorResult {
  /** Acres one unit surveys per hour on site, alone on the whole site, with every overhead of its plan. */
  acresPerH: number;
  /** The fleet of the comparison, its hours on site and its field days. */
  fleet: number;
  workH: number;
  days: number;
  /** The smallest fleet that finishes in the target's field days, its hours on site, and its kit. */
  matchFleet: number;
  matchWorkH: number;
  matchKitUsd: number;
  /** Stops the matching fleet makes for fuel, or for a robot dog's battery swaps, which take their place. */
  matchRefuels: number;
  /** The matching fleet's kit per acre surveyed, if it is bought for this one site. */
  kitPerAcreUsd: number;
  /** One unit's kit, per acre-per-hour it surveys: what each acre an hour of capacity costs. */
  kitPerAcrePerHUsd: number;
}

export interface SurveyComparison {
  /** Acres surveyed: the area without the base pad. */
  acres: number;
  /** Field days the UTV fleet takes, which the robot dog fleet is sized to match. */
  targetDays: number;
  utv: SurveyorResult;
  dog: SurveyorResult;
  /** How many times the acres per hour of one UTV are those of one robot dog. */
  speedUp: number;
}

/** Acres of the area off the base pad. */
export function surveyedAcres(ground: SurveyGround): number {
  const { area, pad } = ground;
  const padM2 = pad
    ? Math.max(0, Math.min(area.x + area.w, pad.x + pad.w) - Math.max(area.x, pad.x)) *
      Math.max(0, Math.min(area.y + area.h, pad.y + pad.h) - Math.max(area.y, pad.y))
    : 0;
  return (area.w * area.h - padM2) / SITE.acreM2;
}

function plan(ground: SurveyGround, count: number, config: SurveyConfig): SurveyPlan {
  return planSurvey(ground.area, ground.base, count, config, ground.pad);
}

/** Acres one unit with `config` surveys per hour on site, alone on the whole site. */
export function acresPerHour(ground: SurveyGround, config: SurveyConfig): number {
  return surveyedAcres(ground) / plan(ground, 1, config).finishH;
}

/**
 * One surveyor on the ground: one unit's rate, the `fleet`'s survey in field days, and the smallest fleet up
 * to `maxFleet` that finishes within `targetDays` (or the largest tried when none does).
 */
export function surveyorResult(
  ground: SurveyGround,
  spec: SurveyorSpec,
  fleet: number,
  targetDays: number,
  maxFleet: number,
): SurveyorResult {
  const acres = surveyedAcres(ground);
  const acresPerH = acresPerHour(ground, spec.config);
  const own = surveySchedule(plan(ground, fleet, spec.config));
  let matchFleet = 1;
  let matchPlan = plan(ground, matchFleet, spec.config);
  let match = surveySchedule(matchPlan);
  while (match.days > targetDays && matchFleet < maxFleet) {
    matchFleet++;
    matchPlan = plan(ground, matchFleet, spec.config);
    match = surveySchedule(matchPlan);
  }
  const matchKitUsd = matchFleet * spec.kitUsd;
  return {
    acresPerH,
    fleet,
    workH: own.workH,
    days: own.days,
    matchFleet,
    matchWorkH: match.workH,
    matchKitUsd,
    matchRefuels: matchPlan.vehicles.reduce((sum, v) => sum + v.refuels, 0),
    kitPerAcreUsd: matchKitUsd / acres,
    kitPerAcrePerHUsd: spec.kitUsd / acresPerH,
  };
}

/**
 * The UTV and the robot dog on the same ground (D110): each with `fleet` units, then the dog fleet sized to
 * finish in the UTV fleet's field days.
 */
export function compareSurveyors(
  ground: SurveyGround,
  utv: SurveyorSpec,
  dog: SurveyorSpec,
  fleet: number,
  maxFleet: number,
): SurveyComparison {
  const targetDays = surveySchedule(plan(ground, fleet, utv.config)).days;
  const u = surveyorResult(ground, utv, fleet, targetDays, maxFleet);
  const d = surveyorResult(ground, dog, fleet, targetDays, maxFleet);
  return {
    acres: surveyedAcres(ground),
    targetDays,
    utv: u,
    dog: d,
    speedUp: u.acresPerH / d.acresPerH,
  };
}
