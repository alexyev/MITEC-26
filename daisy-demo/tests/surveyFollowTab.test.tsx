// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAP, UI } from '../src/config/defaults';
import { SURVEY, SURVEY_FOLLOW, SURVEY_VIEW } from '../src/config/survey';
import { getSiteModel } from '../src/state/model';
import { getSurveyPlan, useSurveyStore } from '../src/state/survey';
import { fitViewport } from '../src/ui/map/viewport';
import { usePlaybackSpeed } from '../src/ui/player/speed';
import { SurveyTab } from '../src/ui/survey/SurveyTab';
import { vehicleMarkers } from '../src/ui/survey/surveyLayers';

// D140-D142 in the running tab: follow from the panel and from the map, the camera on the UTV, Escape and a
// pan handing the view back, and the speed control while following.

const W = 1280;
const H = 720;
const pad = UI.mapFitPaddingPx;
const FOCUS = { sx: (pad.left + W - pad.right) / 2, sy: (pad.top + H - pad.bottom) / 2 };

/** Every fillText and roundRect of the map's last draw, from a stand-in 2D context. */
let texts: { text: string; x: number; y: number }[] = [];
let rects: number[][] = [];
function fakeContext(): CanvasRenderingContext2D {
  const target: Record<string | symbol, unknown> = {
    fillText: (text: string, x: number, y: number) => texts.push({ text, x, y }),
    roundRect: (...args: number[]) => rects.push(args),
    createPattern: () => null,
    // Each draw of the map starts by clearing it.
    clearRect: () => {
      texts = [];
      rects = [];
    },
  };
  return new Proxy(target, {
    get: (t, k) => (k in t ? t[k] : () => undefined),
    set: (t, k, v) => {
      t[k] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

let frames: FrameRequestCallback[] = [];
let now = 0;
/** Run animation frames for `ms` of wall time, in 16 ms frames. */
function run(ms: number) {
  for (let left = ms; left > 0; left -= 16) {
    now += Math.min(16, left);
    const due = frames;
    frames = [];
    act(() => due.forEach((cb) => cb(now)));
  }
}

let reduced = false;

beforeEach(() => {
  frames = [];
  now = 0;
  reduced = false;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  // jsdom has no Path2D; the unit layer only needs one to exist.
  vi.stubGlobal('Path2D', function Path2D() {
    return new Proxy({}, { get: () => () => undefined });
  });
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private cb: () => void) {}
      observe() {
        this.cb();
      }
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduced && query.includes('reduce'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(W);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(H);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => fakeContext() as never,
  );
  HTMLCanvasElement.prototype.setPointerCapture = () => {};
  HTMLCanvasElement.prototype.hasPointerCapture = () => false;
  HTMLCanvasElement.prototype.releasePointerCapture = () => {};
  useSurveyStore.getState().reset();
});

afterEach(() => {
  act(() => usePlaybackSpeed.getState().setSpeed(1));
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const canvas = () => document.querySelector('canvas.map-canvas') as HTMLCanvasElement;
const followed = () =>
  screen
    .queryAllByRole('radio', { checked: true })
    .map((r) => r.getAttribute('aria-label'))
    .find((l) => l?.startsWith('UTV'));
/**
 * Where the map drew the followed UTV: its label sits `closeUpLabelGapPx` right of it, or that far below it
 * while it is parked by the gate.
 */
function utvOnScreen(n: number, parked = false) {
  const gap = SURVEY_VIEW.closeUpLabelGapPx;
  const label = texts.find((t) => t.text === `UTV #${n} · Starlink`);
  if (!label) return null;
  return parked ? { sx: label.x, sy: label.y - gap } : { sx: label.x - gap, sy: label.y };
}
/** Where the map drew the base marker. */
function baseOnScreen() {
  const r = MAP.baseMarkerPx;
  const rect = rects.find((a) => a[2] === 2 * r && a[3] === 2 * r);
  return rect ? { sx: rect[0] + r, sy: rect[1] + r } : null;
}
function press(x: number, y: number, moveTo?: { x: number; y: number }) {
  const c = canvas();
  const at = { clientX: x, clientY: y, button: 0, bubbles: true };
  act(() => {
    c.dispatchEvent(new MouseEvent('pointerdown', at));
    if (moveTo) {
      c.dispatchEvent(
        new MouseEvent('pointermove', { ...at, clientX: moveTo.x, clientY: moveTo.y }),
      );
    }
    c.dispatchEvent(
      new MouseEvent('pointerup', {
        ...at,
        ...(moveTo && { clientX: moveTo.x, clientY: moveTo.y }),
      }),
    );
  });
}

const surveyStep = () =>
  within(screen.getByRole('region', { name: 'Steps, in order' })).getByRole('button', {
    name: /Survey/,
  });

function renderTab() {
  render(<SurveyTab />);
  run(32);
}

describe('following a UTV in the Survey tab (D140)', () => {
  it('starts from the panel, eases in, and keeps the UTV centered while it drives', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: /Follow a UTV/ }));
    expect(followed()).toBe('UTV #1');
    expect(screen.getByRole('button', { name: /Back to site/ })).toBeTruthy();
    // Over the survey, at the follow zoom, UTV #1 stays on the focus between the panels.
    fireEvent.click(surveyStep());
    run(SURVEY_FOLLOW.easeS * 1000 + 100);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    const seen: string[] = [];
    for (let i = 0; i < 6; i++) {
      run(500);
      const p = utvOnScreen(1);
      expect(p).not.toBeNull();
      expect(p!.sx).toBeCloseTo(FOCUS.sx, 6);
      expect(p!.sy).toBeCloseTo(FOCUS.sy, 6);
      seen.push(screen.getByText(/^Driving|^Surveying/).textContent ?? '');
    }
    expect(screen.getByText(/^Up close: 1 s plays 4\.5 s of work$/)).toBeTruthy();
    // The chain reads Starlink, then the UTV, then its drone.
    const chain = screen.getByRole('list', { name: 'How Drone #1 stays online' });
    expect(chain.textContent).toMatch(/Starlink.*UTV #1.*Drone #1/);
  });

  it('starts from a click on a UTV on the map, and switches with another click', () => {
    renderTab();
    const plan = getSurveyPlan(SURVEY.defaultVehicles);
    const model = getSiteModel();
    const fit = fitViewport(model.site.widthM, model.site.heightM, W, H, pad);
    const parked = vehicleMarkers(plan, 0, fit);
    press(parked[2].sx, parked[2].sy);
    expect(followed()).toBe('UTV #3');
    run(SURVEY_FOLLOW.easeS * 1000 + 100);
    const p = utvOnScreen(3, true)!;
    expect(p.sx).toBeCloseTo(FOCUS.sx, 6);
    expect(p.sy).toBeCloseTo(FOCUS.sy, 6);
    // UTV #2 parks one gap to the left, at the follow zoom: a click on it switches.
    press(FOCUS.sx - SURVEY_VIEW.parkedGapPx, FOCUS.sy);
    expect(followed()).toBe('UTV #2');
    // A click on empty ground does nothing.
    press(FOCUS.sx + 200, FOCUS.sy + 100);
    expect(followed()).toBe('UTV #2');
  });

  it('gives the view back as it was on Escape, and keeps it where the viewer pans it', () => {
    renderTab();
    const before = baseOnScreen()!;
    fireEvent.click(screen.getByRole('button', { name: /Follow a UTV/ }));
    run(SURVEY_FOLLOW.easeS * 1000 + 100);
    expect(baseOnScreen()!.sy).not.toBeCloseTo(before.sy, 0);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    run(SURVEY_FOLLOW.easeS * 1000 + 100);
    expect(screen.getByRole('button', { name: /Follow a UTV/ })).toBeTruthy();
    const after = baseOnScreen()!;
    expect(after.sx).toBeCloseTo(before.sx, 6);
    expect(after.sy).toBeCloseTo(before.sy, 6);

    // Following again, a pan ends the follow at once and leaves the map where the viewer dragged it.
    fireEvent.click(screen.getByRole('button', { name: /Follow a UTV/ }));
    run(SURVEY_FOLLOW.easeS * 1000 + 100);
    const close = baseOnScreen()!;
    press(600, 300, { x: 640, y: 330 });
    run(32);
    expect(screen.getByRole('button', { name: /Follow a UTV/ })).toBeTruthy();
    const panned = baseOnScreen()!;
    expect(panned.sx).toBeCloseTo(close.sx + 40, 6);
    expect(panned.sy).toBeCloseTo(close.sy + 30, 6);
  });

  it('keeps the speed control working up close', () => {
    renderTab();
    fireEvent.click(surveyStep());
    fireEvent.click(screen.getByRole('button', { name: /Follow a UTV/ }));
    run(SURVEY_FOLLOW.easeS * 1000 + 100);
    expect(screen.getByText('Up close: 1 s plays 4.5 s of work')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: '4× · faster' }));
    expect(screen.getByText('Up close: 1 s plays 18 s of work')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: '0.25× · slower' }));
    expect(screen.getByText('Up close: 1 s plays 1.1 s of work')).toBeTruthy();
  });

  it('cuts in and out with reduced motion', () => {
    reduced = true;
    renderTab();
    const before = baseOnScreen()!;
    fireEvent.click(screen.getByRole('button', { name: /Follow a UTV/ }));
    run(32);
    expect(utvOnScreen(1, true)!.sx).toBeCloseTo(FOCUS.sx, 6);
    fireEvent.click(screen.getByRole('button', { name: /Back to site/ }));
    run(32);
    expect(baseOnScreen()!.sx).toBeCloseTo(before.sx, 6);
    expect(baseOnScreen()!.sy).toBeCloseTo(before.sy, 6);
  });
});
