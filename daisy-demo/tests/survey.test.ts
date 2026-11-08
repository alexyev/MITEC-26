import { describe, expect, it } from 'vitest';
import { SURVEY } from '../src/config/survey';
import { generateSite, unitGridRect } from '../src/engine/site';
import {
  planSurvey,
  surveyedFraction,
  surveyedRects,
  surveyStrips,
  vehicleAt,
} from '../src/engine/survey';

const site = generateSite();
const area = unitGridRect(site);
const base = { x: site.widthM / 2, y: site.heightM / 2 };
const plans = new Map(
  Array.from({ length: SURVEY.maxVehicles }, (_, i) => [i + 1, planSurvey(area, base, i + 1)]),
);
const plan = (n: number) => plans.get(n)!;

describe('survey area', () => {
  it('is the unit grid of the full site, about 3,640 m x 1,972 m', () => {
    expect(area.w).toBeCloseTo(3638, 0);
    expect(area.h).toBeCloseTo(1971.7, 0);
    expect(area.x).toBeGreaterThan(0);
    expect(area.y).toBeGreaterThan(0);
  });
});

describe('surveyStrips', () => {
  for (let n = 1; n <= SURVEY.maxVehicles; n++) {
    it(`tiles the area with ${n} equal strips, with no gap and no overlap`, () => {
      const strips = surveyStrips(area, n);
      expect(strips.length).toBe(n);
      expect(strips[0].x).toBe(area.x);
      expect(strips[n - 1].x + strips[n - 1].w).toBeCloseTo(area.x + area.w, 9);
      for (let i = 0; i < n; i++) {
        expect(strips[i].w).toBeCloseTo(area.w / n, 9);
        expect(strips[i].y).toBe(area.y);
        expect(strips[i].h).toBe(area.h);
        if (i + 1 < n) expect(strips[i].x + strips[i].w).toBeCloseTo(strips[i + 1].x, 9);
      }
    });
  }
});

describe('planSurvey', () => {
  it('surveys every ground cell by the end, and none before Send', () => {
    for (const p of plans.values()) {
      expect(p.cellSurveyedH.length).toBe(p.cellCols * p.cellRows);
      expect(p.cellCols).toBe(Math.ceil(area.w / SURVEY.cellM));
      for (const h of p.cellSurveyedH) {
        expect(Number.isFinite(h)).toBe(true);
        expect(h).toBeGreaterThan(0);
        expect(h).toBeLessThanOrEqual(p.finishH);
      }
      expect(surveyedFraction(p, 0)).toBe(0);
      expect(surveyedFraction(p, p.finishH)).toBe(1);
    }
  });

  it('lets the time to finish fall as the 4x4 count rises', () => {
    for (let n = 2; n <= SURVEY.maxVehicles; n++) {
      expect(plan(n).finishH).toBeLessThan(plan(n - 1).finishH);
    }
  });

  it('matches the expected times of spec 8.4 within 10%', () => {
    for (const [n, hours] of [
      [1, 45],
      [3, 15],
      [6, 8],
    ]) {
      expect(Math.abs(plan(n).finishH - hours) / hours).toBeLessThan(0.1);
    }
  });

  it('keeps the 4x4-hours, and so the cost, within about 5% across fleet sizes', () => {
    const hours = [1, 3, 6].map((n) => plan(n).vehicleHours);
    expect(Math.max(...hours) / Math.min(...hours)).toBeLessThan(1.05);
    const p = plan(3);
    expect(p.vehicleHours).toBeCloseTo(
      p.vehicles.reduce((s, v) => s + v.driveH, 0),
      9,
    );
  });

  it('drives each strip in passes at most one swath apart, inside the strip', () => {
    for (const p of plans.values()) {
      for (const v of p.vehicles) {
        expect(v.passSpacingM).toBeLessThanOrEqual(SURVEY.swathM);
        const passes = v.legs.filter((l) => l.kind === 'pass');
        expect(passes.length).toBe(v.passes);
        for (const leg of passes) {
          expect(leg.x0).toBe(leg.x1);
          expect(leg.x0 - v.passSpacingM / 2).toBeGreaterThanOrEqual(v.strip.x - 1e-6);
          expect(leg.x0 + v.passSpacingM / 2).toBeLessThanOrEqual(v.strip.x + v.strip.w + 1e-6);
          expect(Math.abs(leg.y1 - leg.y0)).toBeCloseTo(area.h, 6);
        }
        // Passes go back and forth and step one spacing at a time.
        for (let k = 1; k < passes.length; k++) {
          expect(Math.sign(passes[k].y1 - passes[k].y0)).toBe(
            -Math.sign(passes[k - 1].y1 - passes[k - 1].y0),
          );
          expect(Math.abs(passes[k].x0 - passes[k - 1].x0)).toBeCloseTo(v.passSpacingM, 6);
        }
      }
    }
  });

  it('starts each 4x4 at the strip edge nearest the base, and the base strip at its west edge', () => {
    for (const p of plans.values()) {
      for (const v of p.vehicles) {
        const firstPass = v.legs.find((l) => l.kind === 'pass')!;
        const containsBase = base.x >= v.strip.x && base.x <= v.strip.x + v.strip.w;
        const west = firstPass.x0 < v.strip.x + v.passSpacingM;
        const east = firstPass.x0 > v.strip.x + v.strip.w - v.passSpacingM;
        if (containsBase || base.x < v.strip.x) expect(west).toBe(true);
        else expect(east).toBe(true);
      }
    }
  });

  it('starts and ends every 4x4 at the base, with continuous legs at the stated speeds', () => {
    for (const p of plans.values()) {
      for (const v of p.vehicles) {
        expect(v.legs[0]).toMatchObject({ kind: 'transit', x0: base.x, y0: base.y });
        expect(v.legs[v.legs.length - 1]).toMatchObject({
          kind: 'transit',
          x1: base.x,
          y1: base.y,
        });
        for (let k = 0; k < v.legs.length; k++) {
          const leg = v.legs[k];
          const kmh = leg.kind === 'transit' ? SURVEY.transitSpeedKmh : SURVEY.surveySpeedKmh;
          expect(leg.t1H - leg.t0H).toBeCloseTo(leg.lengthKm / kmh, 9);
          if (k > 0) {
            const prev = v.legs[k - 1];
            expect([leg.x0, leg.y0, leg.t0H]).toEqual([prev.x1, prev.y1, prev.t1H]);
            expect(leg.km0).toBeCloseTo(prev.km0 + prev.lengthKm, 9);
          }
        }
        expect(v.driveH).toBe(v.legs[v.legs.length - 1].t1H);
      }
      expect(p.finishH).toBe(Math.max(...p.vehicles.map((v) => v.driveH)));
    }
  });

  it('surveys a cell while the pass over it drives by', () => {
    const p = plan(3);
    const passes = p.vehicles.flatMap((v) => v.legs.filter((l) => l.kind === 'pass'));
    for (let id = 0; id < p.cellSurveyedH.length; id += 997) {
      const h = p.cellSurveyedH[id];
      const inPass = passes.some((l) => h >= l.t0H - 1e-6 && h <= l.t1H + 1e-6);
      expect(inPass).toBe(true);
    }
  });

  it('refuses an empty fleet', () => {
    expect(() => planSurvey(area, base, 0)).toThrow();
  });
});

describe('vehicleAt', () => {
  const v = plan(3).vehicles[1];

  it('is at the base before Send and after the return', () => {
    expect(vehicleAt(v, 0)).toMatchObject({
      x: base.x,
      y: base.y,
      kind: 'base',
      done: false,
      km: 0,
    });
    const end = vehicleAt(v, v.driveH + 1);
    expect(end).toMatchObject({ kind: 'base', done: true, stripProgress: 1, timeLeftH: 0 });
    expect(end.x).toBeCloseTo(base.x, 6);
    expect(end.y).toBeCloseTo(base.y, 6);
    expect(end.km).toBeCloseTo(v.driveKm, 9);
  });

  it('moves along the legs with growing distance and progress', () => {
    let prev = vehicleAt(v, 0);
    for (let t = 0.05; t < v.driveH; t += 0.05) {
      const s = vehicleAt(v, t);
      expect(s.km).toBeGreaterThanOrEqual(prev.km - 1e-9);
      expect(s.stripProgress).toBeGreaterThanOrEqual(prev.stripProgress - 1e-9);
      expect(s.timeLeftH).toBeCloseTo(v.driveH - t, 9);
      // Speed between samples never exceeds the transit speed.
      const stepKm = Math.hypot(s.x - prev.x, s.y - prev.y) / 1000;
      expect(stepKm).toBeLessThanOrEqual(SURVEY.transitSpeedKmh * 0.05 + 1e-6);
      prev = s;
    }
  });
});

describe('surveyedFraction and surveyedRects', () => {
  it('grow with time and agree with each other', () => {
    const p = plan(3);
    let prev = 0;
    for (const f of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const t = f * p.finishH;
      const share = surveyedFraction(p, t);
      expect(share).toBeGreaterThanOrEqual(prev);
      prev = share;
      const rectArea = p.vehicles
        .flatMap((v) => surveyedRects(v, t))
        .reduce((s, r) => s + r.w * r.h, 0);
      expect(Math.abs(rectArea / (area.w * area.h) - share)).toBeLessThan(0.01);
    }
  });

  it('covers the whole area with non-overlapping rectangles at the end', () => {
    const p = plan(4);
    const rects = p.vehicles.flatMap((v) => surveyedRects(v, p.finishH));
    const total = rects.reduce((s, r) => s + r.w * r.h, 0);
    expect(total / (area.w * area.h)).toBeCloseTo(1, 6);
    const sorted = [...rects].sort((a, b) => a.x - b.x);
    for (let k = 1; k < sorted.length; k++) {
      expect(sorted[k].x).toBeGreaterThanOrEqual(sorted[k - 1].x + sorted[k - 1].w - 1e-6);
    }
  });
});
