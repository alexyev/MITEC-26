import { describe, expect, it } from 'vitest';
import { UI } from '../src/config/defaults';
import { SURVEY, SURVEY_CLOSE_UP, SURVEY_FOLLOW } from '../src/config/survey';
import { vehicleAt } from '../src/engine/survey';
import { getSurveyPlan } from '../src/state/survey';
import { cameraViewport, fitViewport } from '../src/ui/map/viewport';
import type { Camera } from '../src/ui/map/viewport';
import {
  exitFollow,
  followBlend,
  followCamera,
  followHoursPerS,
  followPoint,
  followSettled,
  followTimeScale,
  pulsePhase,
  startFollow,
} from '../src/ui/survey/follow';
import type { Follow } from '../src/ui/survey/follow';
import { vehicleMarkers } from '../src/ui/survey/surveyLayers';
import { surveyClock } from '../src/ui/survey/walkthrough';

// D140-D143: following a UTV up close, its camera, its clock and its links.

const plan = getSurveyPlan(SURVEY.defaultVehicles);
const W = 1280;
const H = 720;
const pad = UI.mapFitPaddingPx;
const home = fitViewport(4000, 2600, W, H, pad);
const focus = { sx: (pad.left + W - pad.right) / 2, sy: (pad.top + H - pad.bottom) / 2 };
const following = (vehicle: number, from?: Camera): Follow => ({
  vehicle,
  dir: 'in',
  atMs: 0,
  durS: SURVEY_FOLLOW.easeS,
  fromBlend: 0,
  from,
});
const view = (camera: Camera) => cameraViewport(home, camera, focus);

describe('follow camera (D140)', () => {
  it('looks at the UTV wherever it drives, for every UTV', () => {
    for (const v of plan.vehicles) {
      for (let i = 1; i < 40; i++) {
        const hours = (plan.finishH * i) / 40;
        const s = vehicleAt(v, hours);
        if (s.kind === 'base') continue;
        expect(followPoint(plan, v.id, hours)).toEqual({ x: s.x, y: s.y });
      }
    }
  });

  it('keeps the followed UTV centered between the panels across time, at the follow zoom', () => {
    for (let i = 0; i <= 60; i++) {
      const hours = (plan.finishH * i) / 60;
      const v = view(followCamera(plan, following(1), hours, 1));
      expect(v.scale).toBeCloseTo(SURVEY_FOLLOW.pxPerM, 9);
      // Where the map draws UTV #2, parked or driving, is the focus.
      const marker = vehicleMarkers(plan, hours, v)[1];
      expect(marker.sx).toBeCloseTo(focus.sx, 6);
      expect(marker.sy).toBeCloseTo(focus.sy, 6);
    }
  });

  it('gives the view back exactly as it was at the end of the ease out', () => {
    const out = exitFollow(following(0), 5000, false);
    expect(followBlend(out, 5000, false)).toBeCloseTo(1, 9);
    const end = 5000 + SURVEY_FOLLOW.easeS * 1000;
    expect(followBlend(out, end, false)).toBe(0);
    expect(followSettled(out, end, false)).toBe(true);
    const back = view(followCamera(plan, out, 1.3, followBlend(out, end, false)));
    expect(back.scale).toBeCloseTo(home.scale, 9);
    expect(back.cx).toBeCloseTo(home.cx, 6);
    expect(back.cy).toBeCloseTo(home.cy, 6);
  });

  it('eases in smoothly on wall time, and cuts with reduced motion', () => {
    const f = following(0);
    let prev = -1;
    for (let ms = 0; ms <= SURVEY_FOLLOW.easeS * 1000; ms += 100) {
      const b = followBlend(f, ms, false);
      expect(b).toBeGreaterThanOrEqual(prev);
      prev = b;
    }
    expect(followBlend(f, 0, false)).toBe(0);
    expect(followBlend(f, SURVEY_FOLLOW.easeS * 1000, false)).toBe(1);
    expect(followBlend(f, 0, true)).toBe(1);
    expect(followBlend(exitFollow(f, 0, true), 0, true)).toBe(0);
  });

  it('takes over from the walkthrough close-up without a jump (D141)', () => {
    // Partway into the close-up's zoom.
    const clock = surveyClock(plan);
    let at = 0;
    while (!clock.closeUpAt(at) || clock.closeUpAt(at)!.blend < 0.5) at += 0.01;
    const c = clock.closeUpAt(at)!;
    const close: Camera = { target: c.target, pxPerM: c.pxPerM, blend: c.blend };
    const f = startFollow(null, 2, 0, close, false);
    const hours = 1.2;
    const start = view(followCamera(plan, f, hours, followBlend(f, 0, false)));
    const before = view(close);
    expect(start.scale).toBeCloseTo(before.scale, 9);
    expect(start.cx).toBeCloseTo(before.cx, 6);
    expect(start.cy).toBeCloseTo(before.cy, 6);
    expect(SURVEY_CLOSE_UP.vehicle).not.toBe(2);
  });

  it('switches to another UTV from the view on screen, and keeps an ease in going for the same one', () => {
    const hours = 1.2;
    const one = following(0);
    const onScreen = followCamera(plan, one, hours, 1);
    const two = startFollow(one, 1, 4000, onScreen, false);
    expect(two).toMatchObject({ vehicle: 1, dir: 'in', durS: SURVEY_FOLLOW.switchS, fromBlend: 0 });
    const start = view(followCamera(plan, two, hours, 0));
    const before = view(onScreen);
    expect(start.cx).toBeCloseTo(before.cx, 6);
    expect(start.cy).toBeCloseTo(before.cy, 6);
    expect(startFollow(two, 1, 4500, null, false)).toBe(two);
    // Back in on the same UTV during the ease out: from where the ease out has got to.
    const out = exitFollow(two, 9000, false);
    const again = startFollow(out, 1, 9300, null, false);
    expect(again.dir).toBe('in');
    expect(again.fromBlend).toBeCloseTo(followBlend(out, 9300, false), 9);
  });
});

describe('follow clock (D142)', () => {
  const slow = followHoursPerS(plan);

  it('plays the ground under the UTV at the follow screen speed', () => {
    const mPerS = slow * SURVEY.surveySpeedKmh * 1000;
    expect(mPerS * SURVEY_FOLLOW.pxPerM).toBeCloseTo(SURVEY_FOLLOW.screenSpeedPxS, 9);
  });

  it('slows the work to the follow pace up close, eased with the zoom, and never speeds it up', () => {
    const fast = SURVEY.playbackHoursPerS;
    expect(fast * followTimeScale(fast, slow, 1)).toBeCloseTo(slow, 12);
    expect(followTimeScale(fast, slow, 0)).toBe(1);
    const half = followTimeScale(fast, slow, 0.5);
    expect(half).toBeLessThan(1);
    expect(half).toBeGreaterThan(followTimeScale(fast, slow, 1));
    // Slower than the follow pace already (the close-up's hold), or standing still: unchanged.
    expect(followTimeScale(slow / 2, slow, 1)).toBe(1);
    expect(followTimeScale(0, slow, 1)).toBe(1);
  });

  it("knows how fast the walkthrough's hours pass at every moment: the slope of its clock", () => {
    const clock = surveyClock(plan);
    const ds = 1e-4;
    for (let s = 0.05; s < clock.durationS - 0.05; s += clock.durationS / 97) {
      const slope = (clock.hoursAt(s + ds) - clock.hoursAt(s - ds)) / (2 * ds);
      expect(clock.rateAt(s)).toBeCloseTo(slope, 4);
    }
    expect(clock.rateAt(-1)).toBe(0);
    expect(clock.rateAt(clock.durationS + 1)).toBe(0);
  });

  it('moves the link pulses with the survey hour, so they stop when the clock does', () => {
    for (const h of [0, 0.001, 0.5, 1.234, plan.finishH]) {
      const p = pulsePhase(h);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(1);
      expect(pulsePhase(h)).toBe(p);
    }
    const step = SURVEY_FOLLOW.pulseWorkS / 3600 / 4;
    expect(pulsePhase(0.5 + step) - pulsePhase(0.5)).toBeCloseTo(0.25, 6);
  });
});
