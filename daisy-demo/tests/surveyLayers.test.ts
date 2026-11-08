import { describe, expect, it } from 'vitest';
import { UI } from '../src/config/defaults';
import { SURVEY_VIEW } from '../src/config/survey';
import { getSurveyPlan } from '../src/state/survey';
import { hitTest, vehicleMarkers } from '../src/ui/survey/surveyLayers';
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
