import { describe, expect, it } from 'vitest';
import { UI } from '../src/config/defaults';
import {
  cameraViewport,
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

describe('cameraViewport (D82)', () => {
  const from = fitViewport(4000, 2000, 1440, 900, UI.mapFitPaddingPx);
  const target = { x: 1000, y: 1500 };
  const focus = { sx: 720, sy: 400 };
  const cam = (blend: number) => cameraViewport(from, { target, pxPerM: 1.8, blend }, focus);

  it('is the start view at blend 0 and centers the target at the close zoom at blend 1', () => {
    expect(cam(0)).toEqual({
      ...from,
      cx: expect.closeTo(from.cx, 9),
      cy: expect.closeTo(from.cy, 9),
    });
    const close = cam(1);
    expect(close.scale).toBeCloseTo(1.8, 9);
    const s = worldToScreen(close, target.x, target.y);
    expect(s.sx).toBeCloseTo(focus.sx, 9);
    expect(s.sy).toBeCloseTo(focus.sy, 9);
  });

  it('starts from the camera it takes over from, and lands the same either way (D141)', () => {
    const before = { target: { x: 3000, y: 500 }, pxPerM: 1.2, blend: 0.6 };
    const next = (blend: number) =>
      cameraViewport(from, { target, pxPerM: 1.8, blend, from: before }, focus);
    const start = next(0);
    const shown = cameraViewport(from, before, focus);
    expect(start.scale).toBeCloseTo(shown.scale, 9);
    expect(start.cx).toBeCloseTo(shown.cx, 9);
    expect(start.cy).toBeCloseTo(shown.cy, 9);
    expect(next(1).cx).toBeCloseTo(cam(1).cx, 9);
    expect(next(1).cy).toBeCloseTo(cam(1).cy, 9);
    expect(next(1).scale).toBeCloseTo(cam(1).scale, 9);
  });

  it('zooms geometrically and slides the target on a straight screen line', () => {
    const start = worldToScreen(from, target.x, target.y);
    let prev = from.scale;
    for (const f of [0.25, 0.5, 0.75]) {
      const v = cam(f);
      expect(v.scale).toBeCloseTo(from.scale * Math.pow(1.8 / from.scale, f), 9);
      expect(v.scale).toBeGreaterThan(prev);
      prev = v.scale;
      const s = worldToScreen(v, target.x, target.y);
      expect(s.sx).toBeCloseTo(start.sx + (focus.sx - start.sx) * f, 6);
      expect(s.sy).toBeCloseTo(start.sy + (focus.sy - start.sy) * f, 6);
    }
  });
});
