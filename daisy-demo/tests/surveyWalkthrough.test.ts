import { describe, expect, it } from 'vitest';
import { SURVEY, SURVEY_CLOSE_UP, SURVEY_WALK } from '../src/config/survey';
import { vehicleAt } from '../src/engine/survey';
import { getSurveyPlan } from '../src/state/survey';
import { formatHours, formatPace, formatSharePct, formatUsd, sig3 } from '../src/ui/survey/format';
import {
  stepStarts,
  surveyClock,
  surveySteps,
  walkthroughFrame,
  yourTurnFrame,
} from '../src/ui/survey/walkthrough';

const plan = getSurveyPlan(SURVEY.defaultVehicles);
const steps = surveySteps(plan);
const starts = stepStarts(steps);

describe('survey walkthrough', () => {
  it('has the five steps of spec 8.5, ending in an open "Your turn"', () => {
    expect(steps.map((s) => s.id)).toEqual(['site', 'paths', 'survey', 'done', 'yourTurn']);
    expect(steps.map((s) => s.durationS)).toEqual([
      SURVEY_WALK.siteS,
      SURVEY_WALK.pathsS,
      surveyClock(plan).durationS,
      SURVEY_WALK.doneS,
      Infinity,
    ]);
    for (const s of steps) expect(s.caption.length).toBeLessThanOrEqual(90);
  });

  it('puts the numbers of the run in the Done caption', () => {
    expect(steps[3].caption).toBe(
      'Done in 5.4 h with 3 4x4s. More 4x4s finish sooner in about the same 4x4-hours.',
    );
    expect(surveySteps(getSurveyPlan(1))[3].caption).toContain('with 1 4x4.');
  });

  it('shows the right state at the start of every step (seeking)', () => {
    const at = (i: number) => walkthroughFrame(steps, plan, starts[i]);
    const still = { closeUp: null, rateHPerS: SURVEY.playbackHoursPerS };
    expect(at(0)).toEqual({ step: 'site', showPaths: false, hours: 0, ...still });
    expect(at(1)).toEqual({ step: 'paths', showPaths: true, hours: 0, ...still });
    expect(at(2)).toEqual({ step: 'survey', showPaths: true, hours: 0, ...still });
    expect(at(3)).toEqual({ step: 'done', showPaths: true, hours: plan.finishH, ...still });
    expect(at(4).step).toBe('yourTurn');
  });

  it('plays the survey at the playback rate and never runs past the finish', () => {
    const early = walkthroughFrame(steps, plan, starts[2] + 1);
    expect(early.hours).toBeCloseTo(SURVEY.playbackHoursPerS, 9);
    expect(early.closeUp).toBeNull();
    let prev = -1;
    for (let t = 0; t < starts[4]; t += 0.25) {
      const f = walkthroughFrame(steps, plan, t);
      expect(f.hours).toBeGreaterThanOrEqual(prev);
      expect(f.hours).toBeLessThanOrEqual(plan.finishH);
      prev = f.hours;
    }
    // Stepping back gives the same state as playing forward to that time.
    expect(walkthroughFrame(steps, plan, starts[2] + 7)).toEqual(
      walkthroughFrame(steps, plan, starts[2] + 7),
    );
  });

  it('zooms in on 4x4 #1 halfway down a pass, slows down, and zooms back out (D82)', () => {
    const clock = surveyClock(plan);
    const c = SURVEY_CLOSE_UP;
    const v = plan.vehicles[c.vehicle];
    const dt = 1 / 120;
    const fast = SURVEY.playbackHoursPerS;
    let prevH = 0;
    let maxBlend = 0;
    let held = 0;
    let first = -1;
    let last = -1;
    for (let s = 0; s <= clock.durationS; s += dt) {
      const h = clock.hoursAt(s);
      // Continuous and never faster than the playback rate: no jump when the close-up starts or ends.
      expect(h - prevH).toBeGreaterThanOrEqual(-1e-12);
      expect(h - prevH).toBeLessThanOrEqual(fast * dt + 1e-9);
      prevH = h;
      const close = clock.closeUpAt(s);
      if (!close) continue;
      if (first < 0) first = s;
      last = s;
      maxBlend = Math.max(maxBlend, close.blend);
      expect(close.vehicle).toBe(c.vehicle);
      expect(close.pxPerM).toBe(c.pxPerM);
      if (close.blend === 1) {
        held += dt;
        // Fully zoomed in, 4x4 #1 stays near the center and drives a pass at the close-up's screen speed.
        const at = vehicleAt(v, h);
        // On a southbound pass, so it drives into the close-up from the top of the map.
        expect(at.kind).toBe('pass');
        expect(at.heading).toBeCloseTo(-Math.PI / 2, 9);
        const offPx = Math.hypot(at.x - close.target.x, at.y - close.target.y) * c.pxPerM;
        expect(offPx).toBeLessThanOrEqual((c.screenSpeedPxS * c.holdS) / 2 + 1e-6);
      }
    }
    expect(maxBlend).toBe(1);
    expect(held).toBeCloseTo(c.holdS, 1);
    expect(last - first).toBeCloseTo(2 * c.rampS + c.holdS, 1);
    expect(clock.hoursAt(clock.durationS)).toBeCloseTo(plan.finishH, 9);
    // The close-up adds its own seconds to the step, at a pace near real time.
    expect(clock.durationS).toBeGreaterThan(plan.finishH / fast + c.holdS);
    expect(formatPace(clock.closeUpHPerS)).toBe('8 s');
  });

  it('marks the close-up in the frame and plays "Your turn" runs without one', () => {
    const clock = surveyClock(plan);
    let s = 0;
    while (!clock.closeUpAt(s)) s += 0.05;
    const f = walkthroughFrame(steps, plan, starts[2] + s + SURVEY_CLOSE_UP.rampS);
    expect(f.closeUp?.blend).toBe(1);
    expect(f.rateHPerS).toBe(clock.closeUpHPerS);
    expect(yourTurnFrame(plan, 'running', 1).closeUp).toBeNull();
  });

  it('shows the result, the new plan, or the run in "Your turn"', () => {
    expect(yourTurnFrame(plan, 'result', 0).hours).toBe(plan.finishH);
    expect(yourTurnFrame(plan, 'planned', 99).hours).toBe(0);
    expect(yourTurnFrame(plan, 'running', 2).hours).toBeCloseTo(2 * SURVEY.playbackHoursPerS, 9);
    expect(yourTurnFrame(plan, 'running', 1e6).hours).toBe(plan.finishH);
  });

  it('caches one plan per fleet size', () => {
    expect(getSurveyPlan(3)).toBe(plan);
    expect(getSurveyPlan(4).vehicles.length).toBe(4);
  });
});

describe('survey formats', () => {
  it('keeps at most 3 significant digits', () => {
    expect(sig3(74_616)).toBe('74,600');
    expect(formatUsd(74_616)).toBe('$74.6k');
    expect(formatUsd(6_898.5)).toBe('$6.9k');
    expect(formatUsd(1_040_204)).toBe('$1.04M');
    expect(formatUsd(150)).toBe('$150');
    expect(formatHours(15.34)).toBe('15.3');
    expect(formatHours(-1)).toBe('0.0');
    expect(formatPace(2)).toBe('2 h');
    expect(formatPace(0.5)).toBe('30 min');
    expect(formatPace(0.125)).toBe('7.5 min');
    expect(formatPace(11 / 3600)).toBe('11 s');
  });

  it('rounds the surveyed share down so 100% means done', () => {
    expect(formatSharePct(0.29)).toBe('29');
    expect(formatSharePct(0.9999)).toBe('99');
    expect(formatSharePct(1)).toBe('100');
  });
});
