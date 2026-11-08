import { describe, expect, it } from 'vitest';
import { UI } from '../src/config/defaults';
import { SURVEY_VIEW } from '../src/config/survey';
import { getSurveyPlan } from '../src/state/survey';
import { droneMarkers, hitTest, vehicleMarkers } from '../src/ui/survey/surveyLayers';
import { fitViewport, worldToScreen } from '../src/ui/map/viewport';
import { getSiteModel } from '../src/state/model';

const { site } = getSiteModel();
const view = fitViewport(site.widthM, site.heightM, 1440, 900, UI.mapFitPaddingPx);
const plan = getSurveyPlan(3);
const base = worldToScreen(view, plan.base.x, plan.base.y);

describe('vehicleMarkers', () => {
  it('parks the fleet in a row under the base before Send and after the return', () => {
    for (const hours of [0, plan.finishH + 1]) {
      const markers = vehicleMarkers(plan, hours, view);
      expect(markers.map((m) => m.sy)).toEqual(
        markers.map(() => base.sy + SURVEY_VIEW.parkedBelowPx),
      );
      const xs = markers.map((m) => m.sx);
      expect(xs[1] - xs[0]).toBeCloseTo(SURVEY_VIEW.parkedGapPx, 6);
      expect((xs[0] + xs[2]) / 2).toBeCloseTo(base.sx, 6);
    }
  });

  it('puts a driving 4x4 at its position on the map', () => {
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

  it('finds the 4x4 under the pointer within the hit radius', () => {
    const m = markers[2];
    expect(hitTest(plan, markers, view, m.sx + 5, m.sy - 5)).toEqual({ kind: 'vehicle', id: 2 });
    expect(hitTest(plan, markers, view, m.sx + SURVEY_VIEW.hitRadiusPx + 1, m.sy)).not.toEqual({
      kind: 'vehicle',
      id: 2,
    });
  });

  it('finds the base when no 4x4 is closer, and nothing on empty ground', () => {
    expect(hitTest(plan, markers, view, base.sx, base.sy)).toEqual({ kind: 'base' });
    expect(hitTest(plan, markers, view, 2, 2)).toBeNull();
  });

  it('prefers a parked 4x4 over the base it is parked under', () => {
    const parked = vehicleMarkers(plan, 0, view);
    expect(hitTest(plan, parked, view, parked[1].sx, parked[1].sy)).toEqual({
      kind: 'vehicle',
      id: 1,
    });
  });
});

describe('droneMarkers (D61)', () => {
  it('shows no drone while the fleet is parked: each rides docked on its 4x4', () => {
    for (const hours of [0, plan.finishH + 1]) {
      expect(droneMarkers(plan, vehicleMarkers(plan, hours, view), hours, view)).toEqual([]);
    }
  });

  it('puts each flying drone the trail distance behind its 4x4 on screen', () => {
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

  it('lets the pointer find a drone, as well as its 4x4', () => {
    const hours = plan.finishH / 3;
    const vehicles = vehicleMarkers(plan, hours, view);
    const drones = droneMarkers(plan, vehicles, hours, view);
    const d = drones[1];
    expect(hitTest(plan, vehicles, view, d.sx, d.sy, drones)).toEqual({ kind: 'drone', id: 1 });
    const m = vehicles[1];
    expect(hitTest(plan, vehicles, view, m.sx, m.sy, drones)).toEqual({ kind: 'vehicle', id: 1 });
  });
});
