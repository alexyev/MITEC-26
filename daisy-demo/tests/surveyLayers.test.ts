import { describe, expect, it, vi } from 'vitest';
import { UI } from '../src/config/defaults';
import { SURVEY, SURVEY_VIEW } from '../src/config/survey';
import { crossesRect } from '../src/engine/survey';
import { getSurveyPlan } from '../src/state/survey';
import {
  droneMarkers,
  drawPaths,
  drawStrips,
  hitTest,
  vehicleMarkers,
} from '../src/ui/survey/surveyLayers';

// Tests run without a DOM: the layers' CSS lookups return nothing.
vi.mock('../src/ui/kit/tokens', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/ui/kit/tokens')>()),
  cssVar: () => '',
  canvasFont: () => '',
}));
import { fitViewport, worldToScreen, zoomAt } from '../src/ui/map/viewport';
import type { Viewport } from '../src/ui/map/viewport';
import { getSiteModel } from '../src/state/model';

const { site } = getSiteModel();
const view = fitViewport(site.widthM, site.heightM, 1440, 900, UI.mapFitPaddingPx);
const plan = getSurveyPlan(3);
const base = worldToScreen(view, plan.base.x, plan.base.y);
const gate = worldToScreen(view, plan.gate.x, plan.gate.y);
const pad = plan.pad!;

/** Views at both checked sizes, fitted and zoomed in on the base pad. */
const VIEWS: Viewport[] = [
  [1280, 720],
  [1440, 900],
].flatMap(([w, h]) => {
  const fit = fitViewport(site.widthM, site.heightM, w, h, UI.mapFitPaddingPx);
  const b = worldToScreen(fit, plan.base.x, plan.base.y);
  return [1, 4, 16, 60].map((z) => zoomAt(fit, b.sx, b.sy, z, 0, Infinity));
});

/** The pad on screen, and whether a screen point is strictly inside it. */
function padOnScreen(v: Viewport) {
  const a = worldToScreen(v, pad.x, pad.y + pad.h);
  const b = worldToScreen(v, pad.x + pad.w, pad.y);
  const eps = 1e-6;
  const rect = { x: a.sx, y: a.sy, w: b.sx - a.sx, h: b.sy - a.sy };
  const inside = (x: number, y: number) =>
    x > a.sx + eps && x < b.sx - eps && y > a.sy + eps && y < b.sy - eps;
  return { rect, inside };
}

describe('vehicleMarkers', () => {
  it('parks the fleet in a row outside the pad gate before Send and after the return (D81)', () => {
    for (const hours of [0, plan.finishH + 1]) {
      const markers = vehicleMarkers(plan, hours, view);
      expect(markers.map((m) => m.sy)).toEqual(
        markers.map(() => gate.sy + SURVEY_VIEW.parkedBelowPx),
      );
      const xs = markers.map((m) => m.sx);
      expect(xs[1] - xs[0]).toBeCloseTo(SURVEY_VIEW.parkedGapPx, 6);
      expect((xs[0] + xs[2]) / 2).toBeCloseTo(gate.sx, 6);
    }
  });

  it('never draws a parked UTV, halo included, on the pad, at any zoom and fleet size', () => {
    const reach = SURVEY_VIEW.vehicleRadiusPx + SURVEY_VIEW.vehicleHaloPx;
    for (const v of VIEWS) {
      const { inside } = padOnScreen(v);
      for (let n = 1; n <= SURVEY.maxVehicles; n++) {
        for (const m of vehicleMarkers(getSurveyPlan(n), 0, v)) {
          expect(inside(m.sx, m.sy - reach)).toBe(false);
          expect(inside(m.sx, m.sy)).toBe(false);
        }
      }
    }
  });

  it('puts a driving UTV at its position on the map', () => {
    const hours = plan.finishH / 2;
    for (const m of vehicleMarkers(plan, hours, view)) {
      const p = worldToScreen(view, m.state.x, m.state.y);
      expect(m.state.kind).not.toBe('base');
      expect([m.sx, m.sy]).toEqual([p.sx, p.sy]);
    }
  });
});

describe('hitTest', () => {
  const markers = vehicleMarkers(plan, plan.finishH / 3, view);

  it('finds the UTV under the pointer within the hit radius', () => {
    const m = markers[2];
    expect(hitTest(plan, markers, view, m.sx + 5, m.sy - 5)).toEqual({ kind: 'vehicle', id: 2 });
    expect(hitTest(plan, markers, view, m.sx + SURVEY_VIEW.hitRadiusPx + 1, m.sy)).not.toEqual({
      kind: 'vehicle',
      id: 2,
    });
  });

  it('finds the base when no UTV is closer, and nothing on empty ground', () => {
    expect(hitTest(plan, markers, view, base.sx, base.sy)).toEqual({ kind: 'base' });
    expect(hitTest(plan, markers, view, 2, 2)).toBeNull();
  });

  it('prefers a parked UTV over the base it is parked under', () => {
    const parked = vehicleMarkers(plan, 0, view);
    expect(hitTest(plan, parked, view, parked[1].sx, parked[1].sy)).toEqual({
      kind: 'vehicle',
      id: 1,
    });
  });
});

describe('droneMarkers (D61)', () => {
  it('shows no drone while the fleet is parked: each rides docked on its UTV', () => {
    for (const hours of [0, plan.finishH + 1]) {
      expect(droneMarkers(plan, vehicleMarkers(plan, hours, view), hours, view)).toEqual([]);
    }
  });

  it('puts each flying drone the trail distance behind its UTV on screen', () => {
    const v = plan.vehicles[0];
    const passes = v.legs.filter((l) => l.kind === 'pass');
    const pass = passes[Math.floor(passes.length / 2)];
    const hours = (pass.t0H + pass.t1H) / 2;
    const vehicles = vehicleMarkers(plan, hours, view);
    const drones = droneMarkers(plan, vehicles, hours, view);
    expect(drones.map((d) => d.id)).toEqual(vehicles.map((m) => m.id));
    const d = drones[0];
    const m = vehicles[0];
    expect(Math.hypot(d.sx - m.sx, d.sy - m.sy)).toBeCloseTo(SURVEY_VIEW.droneTrailPx, 6);
    expect(d.sx).toBeCloseTo(m.sx, 6);
  });

  it('lets the pointer find a drone, as well as its UTV', () => {
    const hours = plan.finishH / 3;
    const vehicles = vehicleMarkers(plan, hours, view);
    const drones = droneMarkers(plan, vehicles, hours, view);
    const d = drones[1];
    expect(hitTest(plan, vehicles, view, d.sx, d.sy, drones)).toEqual({ kind: 'drone', id: 1 });
    const m = vehicles[1];
    expect(hitTest(plan, vehicles, view, m.sx, m.sy, drones)).toEqual({ kind: 'vehicle', id: 1 });
  });
});

describe('drawPaths (D60)', () => {
  /** The segments a draw call strokes, in screen px, from a recording stand-in for the canvas. */
  function recorded(draw: (ctx: CanvasRenderingContext2D) => void) {
    const segs: [number, number, number, number][] = [];
    let at: [number, number] = [0, 0];
    const ctx = {
      setLineDash: () => {},
      beginPath: () => {},
      stroke: () => {},
      fillText: () => {},
      moveTo: (x: number, y: number) => (at = [x, y]),
      lineTo: (x: number, y: number) => {
        segs.push([at[0], at[1], x, y]);
        at = [x, y];
      },
    } as unknown as CanvasRenderingContext2D;
    draw(ctx);
    return segs;
  }
  const strokedSegments = (hours: number, p = plan, v = view) =>
    recorded((ctx) => drawPaths(ctx, v, p, hours, readColorTokensStub));
  const readColorTokensStub = { workPath: '#000' } as unknown as Parameters<typeof drawPaths>[4];
  const a = worldToScreen(view, pad.x, pad.y + pad.h);
  const b = worldToScreen(view, pad.x + pad.w, pad.y);
  const inside = (x: number, y: number) =>
    x > a.sx + 1e-6 && x < b.sx - 1e-6 && y > a.sy + 1e-6 && y < b.sy - 1e-6;

  it('draws no planned path, UTV or drone on the pad, for every fleet size and zoom (D81)', () => {
    for (const v of VIEWS) {
      const { rect, inside } = padOnScreen(v);
      for (let n = 1; n <= SURVEY.maxVehicles; n++) {
        const p = getSurveyPlan(n);
        for (let k = 0; k <= 24; k++) {
          const hours = (k / 24) * p.finishH;
          const crossing = strokedSegments(hours, p, v).filter(([x0, y0, x1, y1]) =>
            crossesRect({ x: x0, y: y0 }, { x: x1, y: y1 }, rect),
          );
          expect(crossing).toEqual([]);
          const strips = recorded((ctx) => drawStrips(ctx, v, p));
          expect(strips.length).toBeGreaterThanOrEqual(n - 1);
          for (const [x0, y0, x1, y1] of strips)
            expect(crossesRect({ x: x0, y: y0 }, { x: x1, y: y1 }, rect)).toBe(false);
          const vehicles = vehicleMarkers(p, hours, v);
          for (const m of vehicles) expect(inside(m.sx, m.sy)).toBe(false);
          for (const d of droneMarkers(p, vehicles, hours, v))
            expect(inside(d.sx, d.sy)).toBe(false);
        }
      }
    }
  });

  it('draws no planned path across the base pad, before Send or during the run', () => {
    for (const hours of [0, plan.finishH / 4, plan.finishH / 2, plan.finishH * 0.9]) {
      const segs = strokedSegments(hours);
      expect(segs.length).toBeGreaterThan(0);
      for (const [x0, y0, x1, y1] of segs) {
        for (let k = 0; k <= 20; k++) {
          const f = k / 20;
          expect(inside(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f)).toBe(false);
        }
      }
    }
  });
});
