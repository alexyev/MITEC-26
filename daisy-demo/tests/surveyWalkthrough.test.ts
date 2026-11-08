import { describe, expect, it } from 'vitest';
import { SURVEY, SURVEY_WALK } from '../src/config/survey';
import { getSurveyPlan } from '../src/state/survey';
import { formatHours, formatSharePct, formatUsd, sig3 } from '../src/ui/survey/format';
import {
  stepStarts,
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
      plan.finishH / SURVEY.playbackHoursPerS,
      SURVEY_WALK.doneS,
      Infinity,
    ]);
    for (const s of steps) expect(s.caption.length).toBeLessThanOrEqual(90);
  });

  it('puts the numbers of the run in the Done caption', () => {
    expect(steps[3].caption).toBe(
      `Done in ${Math.round(plan.finishH)} h with 3 4x4s. More 4x4s finish sooner in the same 4x4-hours.`,
    );
    expect(Math.round(plan.finishH)).toBe(15);
    expect(surveySteps(getSurveyPlan(1))[3].caption).toContain('with 1 4x4.');
  });

  it('shows the right state at the start of every step (seeking)', () => {
    const at = (i: number) => walkthroughFrame(steps, plan, starts[i]);
    expect(at(0)).toEqual({ step: 'site', showPaths: false, hours: 0 });
    expect(at(1)).toEqual({ step: 'paths', showPaths: true, hours: 0 });
    expect(at(2)).toEqual({ step: 'survey', showPaths: true, hours: 0 });
    expect(at(3)).toEqual({ step: 'done', showPaths: true, hours: plan.finishH });
    expect(at(4).step).toBe('yourTurn');
  });

  it('plays the survey at the playback rate and never runs past the finish', () => {
    const mid = walkthroughFrame(steps, plan, starts[2] + 5);
    expect(mid.hours).toBeCloseTo(5 * SURVEY.playbackHoursPerS, 9);
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
  });

  it('rounds the surveyed share down so 100% means done', () => {
    expect(formatSharePct(0.29)).toBe('29');
    expect(formatSharePct(0.9999)).toBe('99');
    expect(formatSharePct(1)).toBe('100');
  });
});
