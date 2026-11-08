// Survey walkthrough (spec 7, 8.5): the steps with their captions, and what the map shows at player time t.
// Pure functions of the plan and t (spec rule 6), so seeking and stepping back show the right state.
import { SURVEY, SURVEY_CLOSE_UP, SURVEY_WALK } from '../../config/survey';
import { UNITS } from '../../config/units';
import { surveySchedule, vehicleAt } from '../../engine/survey';
import type { Point, SurveyLeg, SurveyPlan } from '../../engine/survey';
import type { WalkStep } from '../player/types';
import { formatHours, formatInt } from './format';

export type SurveyStepId = 'site' | 'paths' | 'survey' | 'done' | 'yourTurn';

/** Smoothstep, 0 to 1 over u in 0 to 1: the ease of the close-up's zoom and of its clock. */
function smooth(u: number): number {
  const x = Math.min(1, Math.max(0, u));
  return x * x * (3 - 2 * x);
}

/** The integral of `smooth` from 0 to u (u in 0 to 1). */
function smoothIntegral(u: number): number {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x - (x * x * x * x) / 2;
}

/**
 * The Survey step's clock (D82): survey hours at the playback rate, except for a close-up on one UTV halfway
 * down a pass, where the clock eases down to `slowHPerS` while the map zooms in, holds, and eases back up
 * while the map zooms out. Hours and zoom are pure functions of the step time, so seeking works.
 */
export interface SurveyClock {
  /** Length of the Survey step in seconds. */
  durationS: number;
  /** Survey hours at `s` seconds into the step. */
  hoursAt: (s: number) => number;
  /** The close-up at `s` seconds into the step, or null outside it. */
  closeUpAt: (s: number) => CloseUp | null;
  /** Hours of work per second of playback at 1x in the close-up (the playback rate when there is none). */
  closeUpHPerS: number;
}

/** What the map's camera does in the close-up: the world point it zooms to, the zoom, and how far in it is. */
export interface CloseUp {
  target: Point;
  pxPerM: number;
  /** 0 is the view before the close-up, 1 is fully zoomed in. */
  blend: number;
  /** The UTV the close-up shows (0-based). */
  vehicle: number;
}

const clocks = new WeakMap<SurveyPlan, SurveyClock>();

/** The Survey step's clock of a plan, with its close-up; computed once per plan. */
export function surveyClock(plan: SurveyPlan): SurveyClock {
  let clock = clocks.get(plan);
  if (!clock) {
    clock = buildSurveyClock(plan);
    clocks.set(plan, clock);
  }
  return clock;
}

function buildSurveyClock(plan: SurveyPlan): SurveyClock {
  const fast = plan.config.playbackHoursPerS;
  const plain: SurveyClock = {
    durationS: plan.finishH / fast,
    hoursAt: (s) => Math.min(plan.finishH, Math.max(0, s * fast)),
    closeUpAt: () => null,
    closeUpHPerS: fast,
  };
  const c = SURVEY_CLOSE_UP;
  const vehicle = plan.vehicles[c.vehicle];
  if (!vehicle) return plain;
  const slow = c.screenSpeedPxS / c.pxPerM / (plan.config.surveySpeedKmh * UNITS.mPerKm);
  const holdH = c.holdS * slow;
  const rampH = (c.rampS * (fast + slow)) / 2;
  // The first southbound pass the UTV drives from `atShare` of its drive time; the hold is centered on its
  // middle. Southbound, the UTV drives into the close-up from the top of the map, clear of the player bar.
  const at = c.atShare * vehicle.driveH;
  const southbound = (l: SurveyLeg) => l.kind === 'pass' && l.y1 < l.y0;
  const pass =
    vehicle.legs.find((l) => southbound(l) && l.t0H >= at) ?? vehicle.legs.find(southbound);
  if (!pass) return plain;
  const midH = (pass.t0H + pass.t1H) / 2;
  const holdStartH = midH - holdH / 2;
  const holdEndH = midH + holdH / 2;
  const startH = holdStartH - rampH;
  const endH = holdEndH + rampH;
  if (startH < 0 || endH > plan.finishH || pass.t1H - pass.t0H < holdH) return plain;

  const target = vehicleAt(vehicle, midH);
  const a = startH / fast;
  const b = a + c.rampS;
  const d = b + c.holdS;
  const e = d + c.rampS;
  const hoursAt = (s: number): number => {
    if (s <= a) return Math.max(0, s * fast);
    if (s <= b) {
      const u = (s - a) / c.rampS;
      return startH + c.rampS * (fast * u - (fast - slow) * smoothIntegral(u));
    }
    if (s <= d) return holdStartH + (s - b) * slow;
    if (s <= e) {
      const u = (s - d) / c.rampS;
      return holdEndH + c.rampS * (slow * u + (fast - slow) * smoothIntegral(u));
    }
    return Math.min(plan.finishH, endH + (s - e) * fast);
  };
  const blendAt = (s: number): number => {
    if (s <= a || s >= e) return 0;
    if (s < b) return smooth((s - a) / c.rampS);
    if (s <= d) return 1;
    return 1 - smooth((s - d) / c.rampS);
  };
  return {
    durationS: e + (plan.finishH - endH) / fast,
    hoursAt,
    closeUpAt: (s) => {
      const blend = blendAt(s);
      if (blend <= 0) return null;
      return { target: { x: target.x, y: target.y }, pxPerM: c.pxPerM, blend, vehicle: c.vehicle };
    },
    closeUpHPerS: slow,
  };
}

/** The five steps of the Survey tab; the Survey step lasts the survey time at the playback rate. */
export function surveySteps(plan: SurveyPlan): WalkStep[] {
  const count = plan.vehicles.length;
  const fleet = `${count} UTV${count === 1 ? '' : 's'}`;
  const { days: n } = surveySchedule(plan);
  // "Field day" is spelled out in the readout; the caption stays on one line at 1280 x 720.
  const days = n === 1 ? 'in a day' : `in ${n} days`;
  const steps: (WalkStep & { id: SurveyStepId })[] = [
    {
      id: 'site',
      label: 'Site',
      caption: '2,000 acres and 23,000 P3 units to place. First, UTVs survey the ground.',
      durationS: SURVEY_WALK.siteS,
    },
    {
      id: 'paths',
      label: 'Paths',
      caption: `Each UTV gets a strip, in passes ${formatInt(plan.config.swathM)} m apart around the built-up base pad.`,
      durationS: SURVEY_WALK.pathsS,
    },
    {
      id: 'survey',
      label: 'Survey',
      caption: 'Each UTV scans the ground with lidar, and its drone scans it from above.',
      durationS: surveyClock(plan).durationS,
    },
    {
      id: 'done',
      label: 'Done',
      caption: `Done in ${formatHours(plan.finishH)} h with ${fleet}, ${days}. More UTVs: less time, same UTV-hours.`,
      durationS: SURVEY_WALK.doneS,
    },
    {
      id: 'yourTurn',
      label: 'Your turn',
      caption: 'Your turn: change the number of UTVs and press Send.',
      durationS: Infinity,
    },
  ];
  return steps;
}

/** Start time of every step in seconds. */
export function stepStarts(steps: WalkStep[]): number[] {
  const starts: number[] = [];
  let t = 0;
  for (const step of steps) {
    starts.push(t);
    t += step.durationS;
  }
  return starts;
}

/** What the survey map and readout show at a moment. */
export interface SurveyFrame {
  step: SurveyStepId;
  /** The planned paths (dashed amber) are on the map. */
  showPaths: boolean;
  /** Survey hours since Send, 0 to the plan's finish. */
  hours: number;
  /** The close-up of the Survey step (D82), or null. */
  closeUp: CloseUp | null;
  /** Hours of work per second of playback at 1x in this phase: the close-up's or the playback rate. */
  rateHPerS: number;
}

/** The walkthrough frame at player time `t` (every step but "Your turn"). */
export function walkthroughFrame(steps: WalkStep[], plan: SurveyPlan, t: number): SurveyFrame {
  const starts = stepStarts(steps);
  let index = 0;
  while (index + 1 < steps.length && t >= starts[index + 1]) index++;
  const step = steps[index].id as SurveyStepId;
  const surveyStart = starts[steps.findIndex((s) => s.id === 'survey')];
  const clock = surveyClock(plan);
  const s = t - surveyStart;
  // From the Done step on, the run is over exactly: rounding in the step starts must not leave a UTV short of
  // the base, where it would still show as driving with its drone in the air.
  const over = step === 'done' || step === 'yourTurn';
  const closeUp = step === 'survey' ? clock.closeUpAt(s) : null;
  return {
    step,
    showPaths: step !== 'site',
    hours: over ? plan.finishH : step === 'survey' ? clock.hoursAt(s) : 0,
    closeUp,
    rateHPerS: closeUp ? clock.closeUpHPerS : plan.config.playbackHoursPerS,
  };
}

/** Mode of the "Your turn" step: the finished survey, a new plan waiting for Send, or a run. */
export type YourTurnMode = 'result' | 'planned' | 'running';

/** The "Your turn" frame: a run plays at the walkthrough's rate from the moment Send was pressed. */
export function yourTurnFrame(
  plan: SurveyPlan,
  mode: YourTurnMode,
  secondsSinceSend: number,
): SurveyFrame {
  const hours =
    mode === 'result'
      ? plan.finishH
      : mode === 'planned'
        ? 0
        : Math.min(plan.finishH, Math.max(0, secondsSinceSend * plan.config.playbackHoursPerS));
  return {
    step: 'yourTurn',
    showPaths: true,
    hours,
    closeUp: null,
    rateHPerS: plan.config.playbackHoursPerS,
  };
}

/** The fleet size of the walkthrough and of Restart. */
export const WALKTHROUGH_VEHICLES = SURVEY.defaultVehicles;
