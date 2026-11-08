import { describe, expect, it } from 'vitest';
import { GO2, GO2_KIT, GO2_MAX_FLEET, GO2_SURVEY, GO2_TOP_SURVEY } from '../src/config/go2';
import { SITE } from '../src/config/defaults';
import { SURVEY } from '../src/config/survey';
import { PRICING } from '../src/engine/pricing';
import { unitGridRect } from '../src/engine/site';
import { planSurvey, surveySchedule } from '../src/engine/survey';
import {
  acresPerHour,
  compareSurveyors,
  surveyedAcres,
  surveyorResult,
} from '../src/engine/surveyCompare';
import { getSiteModel } from '../src/state/model';
import { formatTimes } from '../src/ui/survey/format';
import { compareRows, whyText, whyUtv } from '../src/ui/survey/whyUtv';

// D110: one survey UTV against one Unitree GO2, both planned on the generated site by the survey engine.
const { site } = getSiteModel();
const ground = { area: unitGridRect(site), base: site.base, pad: site.basePad };
const why = whyUtv(PRICING.pricing);
const { comparison: c } = why;

describe('the GO2 in the survey engine', () => {
  it('derives its config from its sourced facts', () => {
    expect(GO2_SURVEY.swathM).toBe(2 * GO2.lidarDarkRangeM);
    expect(GO2_SURVEY.surveySpeedKmh).toBeCloseTo(GO2.surveyMS * 3.6, 9);
    expect(GO2_SURVEY.transitSpeedKmh).toBeCloseTo(GO2.topWalkMS * 3.6, 9);
    expect(GO2_SURVEY.fuelRangeKm).toBeCloseTo(GO2.batteryH * GO2.surveyMS * 3.6, 9);
    expect(GO2_SURVEY.refuelMin).toBe(GO2.swapMin);
    // The field day is the UTV's.
    expect(GO2_SURVEY.shiftH).toBe(SURVEY.shiftH);
    expect(GO2_SURVEY.baseSetupH).toBe(SURVEY.baseSetupH);
    for (const p of GO2_KIT) expect(p.source.length).toBeGreaterThan(0);
  });

  it('flies no drone, so it never stops for a drone swap, and swaps its battery every 2 h of walking', () => {
    const plan = planSurvey(ground.area, ground.base, 1, GO2_SURVEY, ground.pad);
    const dog = plan.vehicles[0];
    expect(dog.swaps).toBe(0);
    expect(dog.work.swapsH).toBe(0);
    // A swap comes after the leg that empties the pack, and none on the way home.
    const packs = Math.floor(dog.driveKm / GO2_SURVEY.fuelRangeKm);
    expect(dog.refuels).toBeGreaterThanOrEqual(packs - 1);
    expect(dog.refuels).toBeLessThanOrEqual(packs);
    expect(dog.legs.filter((l) => l.kind === 'stop').every((l) => l.stop === 'refuel')).toBe(true);
  });
});

describe('UTV against GO2 (D110)', () => {
  it('surveys the area off the base pad', () => {
    const { area, pad } = ground;
    const expected = (area.w * area.h - pad!.w * pad!.h) / SITE.acreM2;
    expect(surveyedAcres(ground)).toBeCloseTo(expected, 6);
    expect(c.acres).toBeCloseTo(expected, 6);
  });

  it('puts one UTV at 6.4 times the acres an hour of one GO2', () => {
    expect(c.utv.acresPerH).toBeCloseTo(159, 0);
    expect(c.dog.acresPerH).toBeCloseTo(24.7, 1);
    expect(c.speedUp).toBeCloseTo(c.utv.acresPerH / c.dog.acresPerH, 9);
    expect(formatTimes(c.speedUp)).toBe('6.4×');
    // Even at its top walking speed the dog stays well behind.
    expect(why.dogTopAcresPerH).toBeCloseTo(acresPerHour(ground, GO2_TOP_SURVEY), 9);
    expect(why.topSpeedUp).toBeGreaterThan(3);
  });

  it('takes 1 field day with 3 UTVs and 3 with 3 GO2s', () => {
    expect(c.utv.fleet).toBe(SURVEY.defaultVehicles);
    expect(c.utv.days).toBe(1);
    expect(c.dog.days).toBe(3);
    expect(c.targetDays).toBe(1);
  });

  it('sizes each fleet to the fewest units that finish in the target field days', () => {
    for (const [spec, r] of [
      [{ config: SURVEY, kitUsd: why.utvKitUsd }, c.utv],
      [{ config: GO2_SURVEY, kitUsd: why.dogKitUsd }, c.dog],
    ] as const) {
      const days = (n: number) =>
        surveySchedule(planSurvey(ground.area, ground.base, n, spec.config, ground.pad)).days;
      expect(days(r.matchFleet)).toBeLessThanOrEqual(c.targetDays);
      if (r.matchFleet > 1) expect(days(r.matchFleet - 1)).toBeGreaterThan(c.targetDays);
      expect(r.matchKitUsd).toBe(r.matchFleet * spec.kitUsd);
      expect(r.kitPerAcreUsd).toBeCloseTo(r.matchKitUsd / c.acres, 9);
      expect(r.kitPerAcrePerHUsd).toBeCloseTo(spec.kitUsd / r.acresPerH, 9);
    }
    expect(c.utv.matchFleet).toBe(2);
    expect(c.dog.matchFleet).toBe(8);
    expect(c.dog.matchRefuels).toBeGreaterThan(0);
  });

  it('gives the dog the cheaper kit and one-day fleet, and the UTV the cheaper capacity', () => {
    expect(why.dogKitUsd).toBe(11_190 + 800 + 1_023);
    expect(why.dogKitUsd).toBeLessThan(why.utvKitUsd);
    expect(c.dog.matchKitUsd).toBeLessThan(c.utv.matchKitUsd);
    expect(c.utv.kitPerAcrePerHUsd).toBeLessThan(c.dog.kitPerAcrePerHUsd);
    expect(why.priceRatio).toBeLessThan(c.speedUp);
  });

  it('stops at the largest fleet tried when none finishes in time', () => {
    const r = surveyorResult(ground, { config: GO2_SURVEY, kitUsd: 1 }, 1, 0, 3);
    expect(r.matchFleet).toBe(3);
  });

  it('states every figure from the comparison', () => {
    const t = whyText(why);
    expect(t.speedUp).toBe('6.4×');
    expect(t.faster).toContain('3 UTVs survey the site in 1 field day; 3 GO2s take 3 field days');
    expect(t.cost).toContain('4.7×');
    expect(t.dogEdge).toContain('8 GO2s cost $104k');
    expect(t.dogEdge).toContain('$123k for 2 UTVs');
    const rows = compareRows(why);
    expect(rows.find((r) => r.label === 'Its own link')).toMatchObject({
      utv: 'Starlink Mini',
      favors: 'utv',
    });
    expect(GO2_MAX_FLEET).toBeGreaterThan(c.dog.matchFleet);
    const compared = compareSurveyors(
      ground,
      { config: SURVEY, kitUsd: why.utvKitUsd },
      { config: GO2_SURVEY, kitUsd: why.dogKitUsd },
      SURVEY.defaultVehicles,
      GO2_MAX_FLEET,
    );
    expect(compared.speedUp).toBe(c.speedUp);
  });
});
