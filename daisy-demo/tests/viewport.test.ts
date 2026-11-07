import { describe, expect, it } from 'vitest';
import {
  fitViewport,
  panBy,
  scaleBar,
  screenToWorld,
  worldToScreen,
  zoomAt,
} from '../src/ui/map/viewport';

const pad = { top: 64, right: 24, bottom: 96, left: 24 };

describe('map viewport', () => {
  it('fits the site inside the padded canvas, north up', () => {
    const v = fitViewport(4000, 2000, 1400, 800, pad);
    const sw = worldToScreen(v, 0, 0);
    const ne = worldToScreen(v, 4000, 2000);
    expect(sw.sx).toBeGreaterThanOrEqual(pad.left - 1e-6);
    expect(ne.sx).toBeLessThanOrEqual(1400 - pad.right + 1e-6);
    expect(ne.sy).toBeGreaterThanOrEqual(pad.top - 1e-6);
    expect(sw.sy).toBeLessThanOrEqual(800 - pad.bottom + 1e-6);
    expect(ne.sy).toBeLessThan(sw.sy);
    // One side touches the padding (the limiting dimension).
    const touchesX =
      Math.abs(sw.sx - pad.left) < 1e-6 && Math.abs(ne.sx - (1400 - pad.right)) < 1e-6;
    const touchesY =
      Math.abs(ne.sy - pad.top) < 1e-6 && Math.abs(sw.sy - (800 - pad.bottom)) < 1e-6;
    expect(touchesX || touchesY).toBe(true);
  });

  it('round-trips between world and screen', () => {
    const v = { cx: 1234, cy: 567, scale: 0.8, width: 1000, height: 600 };
    const { sx, sy } = worldToScreen(v, 1500, 400);
    const w = screenToWorld(v, sx, sy);
    expect(w.x).toBeCloseTo(1500, 9);
    expect(w.y).toBeCloseTo(400, 9);
  });

  it('keeps the point under the cursor fixed while zooming, within the limits', () => {
    const v = { cx: 2000, cy: 1000, scale: 0.4, width: 1000, height: 600 };
    const before = screenToWorld(v, 250, 120);
    const z = zoomAt(v, 250, 120, 3, 0.1, 10);
    const after = screenToWorld(z, 250, 120);
    expect(z.scale).toBeCloseTo(1.2, 9);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
    expect(zoomAt(v, 0, 0, 1000, 0.1, 10).scale).toBe(10);
    expect(zoomAt(v, 0, 0, 1e-6, 0.1, 10).scale).toBe(0.1);
  });

  it('pans with the pointer: dragging right moves the map right', () => {
    const v = { cx: 2000, cy: 1000, scale: 0.5, width: 1000, height: 600 };
    const p = panBy(v, 100, 50);
    const a = worldToScreen(v, 1800, 900);
    const b = worldToScreen(p, 1800, 900);
    expect(b.sx - a.sx).toBeCloseTo(100, 9);
    expect(b.sy - a.sy).toBeCloseTo(50, 9);
  });

  it('picks a round scale bar no longer than the target', () => {
    for (const scale of [0.05, 0.3, 0.35, 1, 3.7, 40]) {
      const bar = scaleBar(scale, 120);
      expect(bar.px).toBeLessThanOrEqual(120 + 1e-9);
      expect(bar.px).toBeGreaterThan(120 / 2.5);
      const mantissa = bar.meters / Math.pow(10, Math.floor(Math.log10(bar.meters)));
      expect([1, 2, 5]).toContain(Math.round(mantissa));
    }
    expect(scaleBar(0.3, 120).label).toBe('200 m');
    expect(scaleBar(0.05, 120).label).toBe('2 km');
  });
});
