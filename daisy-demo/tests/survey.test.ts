import { describe, expect, it } from 'vitest';
import { SURVEY } from '../src/config/survey';
import { generateSite, unitGridRect } from '../src/engine/site';
import {
  crossesRect,
  droneFlying,
  planSurvey,
  routeAround,
  surveyedFraction,
  surveyedRects,
  surveySchedule,
  surveyStrips,
  trailPoint,
  vehicleAt,
} from '../src/engine/survey';
import type { Point, SurveyLeg, SurveyPlan } from '../src/engine/survey';
import type { Rect } from '../src/engine/types';

const site = generateSite();
const area = unitGridRect(site);
const base = site.base;
const pad = site.basePad!;
const plans = new Map(
  Array.from({ length: SURVEY.maxVehicles }, (_, i) => [
    i + 1,
    planSurvey(area, base, i + 1, SURVEY, pad),
  ]),
);
const plan = (n: number) => plans.get(n)!;
const EPS = 1e-6;
const groundM2 = area.w * area.h - pad.w * pad.h;

const strictlyInside = (p: Point, r: Rect, eps = EPS) =>
  p.x > r.x + eps && p.x < r.x + r.w - eps && p.y > r.y + eps && p.y < r.y + r.h - eps;
const onEdge = (p: Point, r: Rect) =>
  !strictlyInside(p, r) &&
  p.x >= r.x - EPS &&
  p.x <= r.x + r.w + EPS &&
  p.y >= r.y - EPS &&
  p.y <= r.y + r.h + EPS;
const start = (l: SurveyLeg): Point => ({ x: l.x0, y: l.y0 });
const end = (l: SurveyLeg): Point => ({ x: l.x1, y: l.y1 });
const cellCenterInPad = (p: SurveyPlan, id: number) => {
  const c = id % p.cellCols;
  const r = Math.floor(id / p.cellCols);
  const x = Math.min(
    area.x + (c + 0.5) * SURVEY.cellM,
    (area.x + c * SURVEY.cellM + area.x + area.w) / 2,
  );
  const y = Math.min(
    area.y + (r + 0.5) * SURVEY.cellM,
    (area.y + r * SURVEY.cellM + area.y + area.h) / 2,
  );
  return strictlyInside({ x, y }, pad, 0);
};

describe('survey area', () => {
  it('is the unit grid of the full site, about 3,983 m x 1,813 m (north-south lanes, D33)', () => {
    expect(area.w).toBeCloseTo(3983.4, 0);
    expect(area.h).toBeCloseTo(1813, 0);
    expect(area.x).toBeGreaterThan(0);
    expect(area.y).toBeGreaterThan(0);
  });

  it('holds the base pad at its center, about 215 m x 365 m (D34)', () => {
    expect(pad.w).toBeCloseTo(215, -1);
    expect(pad.h).toBeCloseTo(365, -1);
    expect(strictlyInside(base, pad)).toBe(true);
    expect(pad.x).toBeGreaterThan(area.x);
    expect(pad.x + pad.w).toBeLessThan(area.x + area.w);
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

describe('crossesRect and routeAround', () => {
  const r: Rect = { x: 0, y: 0, w: 10, h: 20 };

  it('tells a segment through a rectangle from one along its edge, at a corner or outside', () => {
    expect(crossesRect({ x: -5, y: 10 }, { x: 15, y: 10 }, r)).toBe(true);
    expect(crossesRect({ x: 5, y: 10 }, { x: 5, y: 40 }, r)).toBe(true);
    expect(crossesRect({ x: -5, y: 0 }, { x: 15, y: 0 }, r)).toBe(false);
    expect(crossesRect({ x: 0, y: -5 }, { x: 0, y: 25 }, r)).toBe(false);
    expect(crossesRect({ x: -5, y: -5 }, { x: 0, y: 0 }, r)).toBe(false);
    expect(crossesRect({ x: -5, y: 5 }, { x: 5, y: -5 }, r)).toBe(false);
    expect(crossesRect({ x: 20, y: 0 }, { x: 30, y: 30 }, r)).toBe(false);
  });

  it('goes straight when the way is clear and around the corners when it is not', () => {
    expect(routeAround({ x: -5, y: -5 }, { x: 15, y: -5 }, r)).toEqual([{ x: 15, y: -5 }]);
    expect(routeAround({ x: -5, y: 10 }, { x: 15, y: 10 }, null)).toEqual([{ x: 15, y: 10 }]);
    // Straight across the middle: around one long side, by its two corners (both sides are as short).
    const across = routeAround({ x: 5, y: -5 }, { x: 5, y: 25 }, r);
    expect(across).toHaveLength(3);
    expect(across[0].y).toBe(0);
    expect(across[1]).toEqual({ x: across[0].x, y: 20 });
    expect([0, 10]).toContain(across[0].x);
    let from = { x: 5, y: -5 };
    for (const p of across) {
      expect(crossesRect(from, p, r)).toBe(false);
      from = p;
    }
    const way = routeAround({ x: -5, y: 2 }, { x: 15, y: 2 }, r);
    expect(way).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 15, y: 2 },
    ]);
  });
});

describe('planSurvey', () => {
  it('never drives a UTV over the base pad, for every fleet size (D60)', () => {
    for (const p of plans.values()) {
      expect(p.pad).toBe(pad);
      for (const v of p.vehicles) {
        for (const leg of v.legs) {
          expect(crossesRect(start(leg), end(leg), pad)).toBe(false);
          // An independent check: sample the leg every metre.
          const steps = Math.ceil(leg.lengthKm * 1000);
          for (let k = 0; k <= steps; k++) {
            const f = steps > 0 ? k / steps : 0;
            const q = { x: leg.x0 + (leg.x1 - leg.x0) * f, y: leg.y0 + (leg.y1 - leg.y0) * f };
            expect(strictlyInside(q, pad)).toBe(false);
          }
        }
      }
    }
  });

  it('stops the passes beside the pad at its edge, so no surveyed ground lies on the pad', () => {
    for (const p of plans.values()) {
      for (const v of p.vehicles) {
        for (const r of surveyedRects(v, v.driveH)) {
          const overlapW = Math.min(r.x + r.w, pad.x + pad.w) - Math.max(r.x, pad.x);
          const overlapH = Math.min(r.y + r.h, pad.y + pad.h) - Math.max(r.y, pad.y);
          expect(overlapW <= EPS || overlapH <= EPS).toBe(true);
        }
      }
    }
  });

  it('surveys every ground cell off the pad by the end, none before Send, and none on the pad', () => {
    for (const p of plans.values()) {
      expect(p.cellSurveyedH.length).toBe(p.cellCols * p.cellRows);
      expect(p.cellCols).toBe(Math.ceil(area.w / SURVEY.cellM));
      let padCells = 0;
      p.cellSurveyedH.forEach((h, id) => {
        if (cellCenterInPad(p, id)) {
          padCells++;
          expect(Number.isNaN(h)).toBe(true);
          return;
        }
        expect(Number.isFinite(h)).toBe(true);
        expect(h).toBeGreaterThan(0);
        expect(h).toBeLessThanOrEqual(p.finishH);
      });
      expect(p.sortedCellH.length).toBe(p.cellSurveyedH.length - padCells);
      expect(Math.abs(padCells * SURVEY.cellM ** 2 - pad.w * pad.h) / (pad.w * pad.h)).toBeLessThan(
        0.05,
      );
      expect(surveyedFraction(p, 0)).toBe(0);
      expect(surveyedFraction(p, p.finishH)).toBe(1);
    }
  });

  it('leaves no gap around the pad: the surveyed ground is the whole area but the pad', () => {
    for (const p of plans.values()) {
      const rects = p.vehicles.flatMap((v) => surveyedRects(v, p.finishH));
      const total = rects.reduce((s, r) => s + r.w * r.h, 0);
      expect(total / groundM2).toBeCloseTo(1, 6);
      // No two rectangles overlap, so the total is the area they cover.
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i];
          const b = rects[j];
          const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
          const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
          expect(w <= EPS || h <= EPS).toBe(true);
        }
      }
    }
  });

  it('lets the time to finish fall as the UTV count rises', () => {
    for (let n = 2; n <= SURVEY.maxVehicles; n++) {
      expect(plan(n).finishH).toBeLessThan(plan(n - 1).finishH);
    }
  });

  it('takes the sourced times (D80, D83): 11.1 h, 3.7 h and 2.0 h on site for 1, 3 and 6 UTVs', () => {
    expect(SURVEY).toMatchObject({ swathM: 40, surveySpeedKmh: 20, transitSpeedKmh: 24 });
    for (const [n, hours, days] of [
      [1, 11.1, 2],
      [3, 3.7, 1],
      [6, 2.0, 1],
    ]) {
      expect(plan(n).finishH).toBeCloseTo(hours, 1);
      const s = surveySchedule(plan(n));
      expect(s.days).toBe(days);
      expect(s.totalH).toBeCloseTo(s.workH + days * SURVEY.baseSetupH, 9);
      // The days hold the work and a base setup each: fewer would not fit, more would be idle.
      expect(s.workH).toBeLessThanOrEqual(days * (SURVEY.shiftH - SURVEY.baseSetupH));
      expect(s.workH).toBeGreaterThan((days - 1) * (SURVEY.shiftH - SURVEY.baseSetupH));
    }
  });

  it('adds U-turns, drone battery swaps and refuels to the driving, and they add up (D83)', () => {
    const minPerH = 60;
    for (const p of plans.values()) {
      for (const v of p.vehicles) {
        const w = v.work;
        expect(w.drivingH + w.turnsH + w.swapsH + w.refuelsH).toBeCloseTo(v.driveH, 9);
        const stops = v.legs.filter((l) => l.kind === 'stop');
        expect(stops.filter((l) => l.stop === 'swap')).toHaveLength(v.swaps);
        expect(stops.filter((l) => l.stop === 'refuel')).toHaveLength(v.refuels);
        expect(w.swapsH).toBeCloseTo((v.swaps * SURVEY.droneSwapMin) / minPerH, 9);
        expect(w.refuelsH).toBeCloseTo((v.refuels * SURVEY.refuelMin) / minPerH, 9);
        // The drone never flies longer than a battery set plus one leg before it lands for new batteries,
        // except on the way home, where it lands at the base instead.
        let homeH = 0;
        for (let k = v.legs.length - 1; k >= 0 && v.legs[k].kind === 'transit'; k--)
          homeH += v.legs[k].t1H - v.legs[k].t0H;
        let flown = 0;
        let longestLeg = 0;
        for (const leg of v.legs) {
          if (leg.kind === 'stop') {
            flown = 0;
            continue;
          }
          flown += leg.t1H - leg.t0H;
          longestLeg = Math.max(longestLeg, leg.t1H - leg.t0H);
          expect(flown).toBeLessThanOrEqual(
            SURVEY.droneFlightMin / minPerH + longestLeg + homeH + 1e-9,
          );
        }
        // A UTV refuels about every tank, and never on its way home.
        const tanks = Math.floor(v.driveKm / SURVEY.fuelRangeKm);
        expect(v.refuels).toBeLessThanOrEqual(tanks);
        expect(v.legs[v.legs.length - 1].kind).toBe('transit');
      }
    }
    // One UTV drives the whole site, about 200 km, so it refuels once; three never do.
    expect(plan(1).vehicles[0].refuels).toBe(1);
    expect(plan(3).vehicles.every((v) => v.refuels === 0)).toBe(true);
    expect(plan(3).vehicles.every((v) => v.swaps >= 4)).toBe(true);
  });

  it('keeps the UTV-hours, and so the hourly cost, within about 6% across fleet sizes', () => {
    // More UTVs add only their drives out to and back from their strips, which are a small share at most.
    const hours = [1, 3, 6].map((n) => plan(n).vehicleHours);
    expect(Math.max(...hours) / Math.min(...hours)).toBeLessThan(1.06);
    const p = plan(3);
    expect(p.vehicleHours).toBeCloseTo(
      p.vehicles.reduce((s, v) => s + v.driveH, 0),
      9,
    );
  });

  it('drives each strip in north-south passes at most one swath wide that tile the strip', () => {
    for (const p of plans.values()) {
      for (const v of p.vehicles) {
        expect(v.passSpacingM).toBeLessThanOrEqual(SURVEY.swathM);
        const passes = v.legs.filter((l) => l.kind === 'pass');
        expect(passes.length).toBe(v.passes);
        const columns = new Map<number, { x0: number; x1: number; m: number }>();
        for (const leg of passes) {
          expect(leg.x0).toBe(leg.x1);
          expect(leg.widthM!).toBeLessThanOrEqual(SURVEY.swathM + EPS);
          const c = columns.get(leg.column!) ?? {
            x0: leg.x0 - leg.widthM! / 2,
            x1: leg.x0 + leg.widthM! / 2,
            m: 0,
          };
          c.m += Math.abs(leg.y1 - leg.y0);
          columns.set(leg.column!, c);
          // A pass runs the full height, or from an edge of the area to the pad.
          const ys = [leg.y0, leg.y1].sort((a, b) => a - b);
          const full = Math.abs(ys[0] - area.y) < EPS && Math.abs(ys[1] - area.y - area.h) < EPS;
          const south = Math.abs(ys[0] - area.y) < EPS && Math.abs(ys[1] - pad.y) < EPS;
          const north =
            Math.abs(ys[0] - pad.y - pad.h) < EPS && Math.abs(ys[1] - area.y - area.h) < EPS;
          expect(full || south || north).toBe(true);
          if (!full) expect(leg.x0 > pad.x && leg.x0 < pad.x + pad.w).toBe(true);
        }
        // The columns tile the strip west to east, and each is surveyed over its whole height but the pad.
        const sorted = [...columns.entries()].sort((a, b) => a[0] - b[0]).map(([, c]) => c);
        expect(sorted[0].x0).toBeCloseTo(v.strip.x, 6);
        expect(sorted[sorted.length - 1].x1).toBeCloseTo(v.strip.x + v.strip.w, 6);
        for (let k = 1; k < sorted.length; k++)
          expect(sorted[k].x0).toBeCloseTo(sorted[k - 1].x1, 6);
        for (const c of sorted) {
          const besidePad = (c.x0 + c.x1) / 2 > pad.x && (c.x0 + c.x1) / 2 < pad.x + pad.w;
          expect(c.m).toBeCloseTo(besidePad ? area.h - pad.h : area.h, 6);
        }
      }
    }
  });

  it('shifts between neighbouring passes along an edge of the area or of the pad', () => {
    for (const p of plans.values()) {
      for (const v of p.vehicles) {
        for (const leg of v.legs.filter((l) => l.kind === 'shift')) {
          expect(leg.y0).toBeCloseTo(leg.y1, 9);
          expect(Math.abs(leg.x1 - leg.x0)).toBeLessThanOrEqual(SURVEY.swathM + EPS);
          const y = leg.y0;
          const edges = [area.y, area.y + area.h, pad.y, pad.y + pad.h];
          expect(edges.some((e) => Math.abs(e - y) < EPS)).toBe(true);
        }
      }
    }
  });

  it('starts each UTV at the strip edge nearest the base, and the base strip at its west edge', () => {
    for (const p of plans.values()) {
      for (const v of p.vehicles) {
        const firstPass = v.legs.find((l) => l.kind === 'pass')!;
        const end = v.strip.x + v.strip.w;
        const baseInside = base.x > v.strip.x + EPS && base.x < end - EPS;
        const west = firstPass.x0 < v.strip.x + v.passSpacingM;
        const eastEdge = firstPass.x0 > end - v.passSpacingM;
        if (baseInside || base.x <= v.strip.x + SURVEY.minSectionM) expect(west).toBe(true);
        else expect(eastEdge).toBe(true);
        expect(v.eastward).toBe(west);
      }
    }
  });

  it('leaves from and returns to the gate on the pad edge (D81), with continuous legs', () => {
    for (const p of plans.values()) {
      // One gate for the fleet: the middle of the pad's south edge, below the base.
      expect(p.gate).toEqual({ x: base.x, y: pad.y });
      expect(onEdge(p.gate, pad)).toBe(true);
      for (const v of p.vehicles) {
        const first = v.legs[0];
        const last = v.legs[v.legs.length - 1];
        expect(first.kind).toBe('transit');
        expect(last.kind).toBe('transit');
        expect(v.home).toEqual(p.gate);
        expect(start(first)).toEqual(p.gate);
        expect(end(last)).toEqual(p.gate);
        for (let k = 0; k < v.legs.length; k++) {
          const leg = v.legs[k];
          if (leg.kind === 'stop') {
            expect(leg.lengthKm).toBe(0);
            expect([leg.x1, leg.y1]).toEqual([leg.x0, leg.y0]);
          } else if (leg.kind === 'shift') {
            // A U-turn: a half circle as wide as the shift, at the turn speed.
            const straightKm = Math.hypot(leg.x1 - leg.x0, leg.y1 - leg.y0) / 1000;
            expect(leg.lengthKm).toBeCloseTo((straightKm * Math.PI) / 2, 9);
            expect(leg.t1H - leg.t0H).toBeCloseTo(leg.lengthKm / SURVEY.turnSpeedKmh, 9);
          } else {
            const kmh = leg.kind === 'transit' ? SURVEY.transitSpeedKmh : SURVEY.surveySpeedKmh;
            expect(leg.t1H - leg.t0H).toBeCloseTo(leg.lengthKm / kmh, 9);
          }
          if (k > 0) {
            const prev = v.legs[k - 1];
            expect([leg.x0, leg.y0, leg.t0H]).toEqual([prev.x1, prev.y1, prev.t1H]);
            expect(leg.km0).toBeCloseTo(prev.km0 + prev.lengthKm, 9);
          }
        }
        expect(v.driveH).toBe(last.t1H);
      }
      expect(p.finishH).toBe(Math.max(...p.vehicles.map((v) => v.driveH)));
    }
  });

  it('surveys a cell while the pass over it drives by', () => {
    const p = plan(3);
    const passes = p.vehicles.flatMap((v) => v.legs.filter((l) => l.kind === 'pass'));
    for (let id = 0; id < p.cellSurveyedH.length; id += 997) {
      const h = p.cellSurveyedH[id];
      if (Number.isNaN(h)) continue;
      const inPass = passes.some((l) => h >= l.t0H - 1e-6 && h <= l.t1H + 1e-6);
      expect(inPass).toBe(true);
    }
  });

  it('plans the full area when the site has no pad', () => {
    const p = planSurvey(area, base, 3);
    expect(p.pad).toBeNull();
    expect(p.sortedCellH.length).toBe(p.cellSurveyedH.length);
    expect(p.vehicles[1].legs[0]).toMatchObject({ x0: base.x, y0: base.y });
    const total = p.vehicles
      .flatMap((v) => surveyedRects(v, p.finishH))
      .reduce((s, r) => s + r.w * r.h, 0);
    expect(total / (area.w * area.h)).toBeCloseTo(1, 6);
  });

  it('refuses an empty fleet', () => {
    expect(() => planSurvey(area, base, 0, SURVEY, pad)).toThrow();
  });
});

describe('vehicleAt', () => {
  const v = plan(3).vehicles[1];

  it('is at the gate, off the pad, before Send and after the return', () => {
    const gate = plan(3).gate;
    expect(vehicleAt(v, 0)).toMatchObject({
      x: gate.x,
      y: gate.y,
      kind: 'base',
      done: false,
      km: 0,
    });
    const end = vehicleAt(v, v.driveH + 1);
    expect(end).toMatchObject({ kind: 'base', done: true, stripProgress: 1, timeLeftH: 0 });
    expect(end.x).toBeCloseTo(gate.x, 6);
    expect(end.y).toBeCloseTo(gate.y, 6);
    expect(strictlyInside(end, pad)).toBe(false);
    expect(end.km).toBeCloseTo(v.driveKm, 9);
  });

  it('moves along the legs with growing distance and progress', () => {
    let prev = vehicleAt(v, Number.EPSILON);
    for (let t = 0.05; t < v.driveH; t += 0.05) {
      const s = vehicleAt(v, t);
      expect(s.km).toBeGreaterThanOrEqual(prev.km - 1e-9);
      expect(s.stripProgress).toBeGreaterThanOrEqual(prev.stripProgress - 1e-9);
      expect(s.timeLeftH).toBeCloseTo(v.driveH - t, 9);
      // Speed between samples never exceeds the transit speed.
      const stepKm = Math.hypot(s.x - prev.x, s.y - prev.y) / 1000;
      expect(stepKm).toBeLessThanOrEqual(SURVEY.transitSpeedKmh * 0.05 + 1e-6);
      expect(strictlyInside(s, pad)).toBe(false);
      prev = s;
    }
  });
});

describe('drones (D61)', () => {
  const v = plan(3).vehicles[1];

  it('fly while their UTV is out, and ride docked on it at the base and while it stops (D83)', () => {
    const pass = v.legs.filter((l) => l.kind === 'pass')[3];
    const stop = v.legs.find((l) => l.kind === 'stop')!;
    expect(droneFlying(vehicleAt(v, 0))).toBe(false);
    expect(droneFlying(vehicleAt(v, (pass.t0H + pass.t1H) / 2))).toBe(true);
    const stopped = vehicleAt(v, (stop.t0H + stop.t1H) / 2);
    expect(stopped).toMatchObject({ kind: 'stop', stop: 'swap', x: stop.x0, y: stop.y0 });
    expect(droneFlying(stopped)).toBe(false);
    expect(droneFlying(vehicleAt(v, v.driveH + 1))).toBe(false);
  });

  it('follow their UTV the given distance back along the path it drove', () => {
    const passes = v.legs.filter((l) => l.kind === 'pass');
    const pass = passes[Math.floor(passes.length / 2)];
    const t = (pass.t0H + pass.t1H) / 2;
    const now = vehicleAt(v, t);
    const behind = trailPoint(v, t, 100);
    expect(behind.x).toBeCloseTo(now.x, 9);
    expect(Math.hypot(behind.x - now.x, behind.y - now.y)).toBeCloseTo(100, 6);
    // Behind, not ahead: toward the start of the pass.
    expect(Math.abs(behind.y - pass.y0)).toBeLessThan(Math.abs(now.y - pass.y0));
    // Around a turn: the trail continues onto the previous pass, still on the driven path.
    const turn = trailPoint(v, pass.t0H + 1e-9, 50);
    const prevPass = passes[passes.indexOf(pass) - 1];
    expect(turn.x).toBeCloseTo(prevPass.x0, 6);
  });

  it('never trail back past the gate, and stay with their UTV at the base', () => {
    const first = v.legs[0];
    const gate = plan(3).gate;
    expect(trailPoint(v, first.t1H / 10, 1e6)).toEqual(gate);
    expect(trailPoint(v, 0, 50)).toEqual(gate);
  });

  it('never put a UTV or a drone on the built-up pad, at any time, for every fleet size (D81)', () => {
    const samples = 4000;
    for (const p of plans.values()) {
      for (const veh of p.vehicles) {
        for (let k = 0; k <= samples + 1; k++) {
          const t = (k / samples) * veh.driveH;
          expect(strictlyInside(vehicleAt(veh, t), pad)).toBe(false);
          for (const d of [5, 30, 120])
            expect(strictlyInside(trailPoint(veh, t, d), pad)).toBe(false);
        }
      }
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
      expect(Math.abs(rectArea / groundM2 - share)).toBeLessThan(0.01);
    }
  });
});
