// Following a UTV (D140-D143): the camera eases in on one UTV and stays on it as it drives, its drone behind it
// on its link. Where the camera looks is a pure function of the plan, the UTV and the survey hour, so pause,
// seek and speed changes behave; only the ease in and out runs on wall time, so it also plays while paused.
import { SURVEY_FOLLOW, SURVEY_VIEW } from '../../config/survey';
import { UNITS } from '../../config/units';
import { vehicleAt } from '../../engine/survey';
import type { Point, SurveyPlan } from '../../engine/survey';
import type { Camera } from '../map/viewport';

/** The key of the follow camera's move, so the map tells it from the walkthrough's close-up (D141). */
export const FOLLOW_CAMERA_KEY = 'follow';

/** What the viewer follows, and where the ease in or out stands. */
export interface Follow {
  /** The UTV (0-based). */
  vehicle: number;
  /** 'in' while following (the blend eases to 1), 'out' while handing the view back (it eases to 0). */
  dir: 'in' | 'out';
  /** When the current ease started (ms, `performance.now()`), how long it takes, and the blend it starts from. */
  atMs: number;
  durS: number;
  fromBlend: number;
  /**
   * The camera the ease in starts from: the walkthrough's close-up, or the UTV followed before a switch. Without
   * it the ease starts from the viewer's view.
   */
  from?: Camera;
}

/** Smoothstep, 0 to 1 over u in 0 to 1. */
function smooth(u: number): number {
  const x = Math.min(1, Math.max(0, u));
  return x * x * (3 - 2 * x);
}

/** How far in the camera is at `nowMs`: 0 is the viewer's view, 1 is up close. Reduced motion cuts (D141). */
export function followBlend(f: Follow, nowMs: number, reduced: boolean): number {
  const to = f.dir === 'in' ? 1 : 0;
  if (reduced || f.durS <= 0) return to;
  const u = smooth((nowMs - f.atMs) / 1000 / f.durS);
  return f.fromBlend + (to - f.fromBlend) * u;
}

/** True once the ease has landed, so nothing needs to animate until the next change. */
export function followSettled(f: Follow, nowMs: number, reduced: boolean): boolean {
  return reduced || nowMs - f.atMs >= f.durS * 1000;
}

/**
 * Where the camera looks while following UTV `id` at `hours`: the UTV itself. At the base the UTV parks in a row
 * outside the pad's gate, placed in screen pixels (D81), so the point is where that row lands at the follow zoom.
 */
export function followPoint(plan: SurveyPlan, id: number, hours: number): Point {
  const vehicle = plan.vehicles[id];
  const state = vehicleAt(vehicle, hours);
  if (state.kind !== 'base') return { x: state.x, y: state.y };
  const z = SURVEY_FOLLOW.pxPerM;
  const north = plan.pad !== null && plan.gate.y >= plan.pad.y + plan.pad.h;
  const n = plan.vehicles.length;
  return {
    x: plan.gate.x + ((id - (n - 1) / 2) * SURVEY_VIEW.parkedGapPx) / z,
    y: plan.gate.y + ((north ? 1 : -1) * SURVEY_VIEW.parkedBelowPx) / z,
  };
}

/** The map camera of a follow at `hours`, `blend` of the way in. */
export function followCamera(plan: SurveyPlan, f: Follow, hours: number, blend: number): Camera {
  return {
    target: followPoint(plan, f.vehicle, hours),
    pxPerM: SURVEY_FOLLOW.pxPerM,
    blend,
    from: f.dir === 'in' ? f.from : undefined,
    key: FOLLOW_CAMERA_KEY,
  };
}

/**
 * Start following UTV `id`, or switch to it (D140). Following the same UTV again keeps the ease where it is;
 * another UTV eases over from the view on screen now, so nothing jumps.
 */
export function startFollow(
  current: Follow | null,
  id: number,
  nowMs: number,
  /** The camera on screen now: the follow's own, the walkthrough's close-up, or null for the viewer's view. */
  onScreen: Camera | null,
  reduced: boolean,
): Follow {
  if (current && current.vehicle === id) {
    if (current.dir === 'in') return current;
    // Back in from wherever the ease out has got to.
    const blend = followBlend(current, nowMs, reduced);
    return { ...current, dir: 'in', atMs: nowMs, durS: SURVEY_FOLLOW.easeS, fromBlend: blend };
  }
  const following = current?.dir === 'in' && onScreen !== null && onScreen.blend >= 1;
  return {
    vehicle: id,
    dir: 'in',
    atMs: nowMs,
    durS: following ? SURVEY_FOLLOW.switchS : SURVEY_FOLLOW.easeS,
    fromBlend: 0,
    // A camera fully in no longer depends on where it came from: drop the chain.
    from: onScreen
      ? { ...onScreen, from: onScreen.blend >= 1 ? undefined : onScreen.from }
      : undefined,
  };
}

/** Hand the view back: ease out from wherever the ease in has got to (D140). */
export function exitFollow(current: Follow, nowMs: number, reduced: boolean): Follow {
  if (current.dir === 'out') return current;
  return {
    ...current,
    dir: 'out',
    atMs: nowMs,
    durS: SURVEY_FOLLOW.easeS,
    fromBlend: followBlend(current, nowMs, reduced),
    from: undefined,
  };
}

/** Hours of work per second of playback at 1x while following (D142): the ground passes at `screenSpeedPxS`. */
export function followHoursPerS(plan: SurveyPlan): number {
  const mPerH = plan.config.surveySpeedKmh * UNITS.mPerKm;
  return SURVEY_FOLLOW.screenSpeedPxS / SURVEY_FOLLOW.pxPerM / mPerH;
}

/**
 * The player's time scale while following (D142): up close the work slows to `followHPerS`, eased with the zoom
 * (geometrically, as the zoom is), so the UTV never races across the screen. Never faster than the walkthrough,
 * and 1 while the hours stand still, so the Site, Paths and Done steps keep their length.
 */
export function followTimeScale(hoursPerS: number, followHPerS: number, blend: number): number {
  if (hoursPerS <= 0 || blend <= 0) return 1;
  const full = Math.min(1, followHPerS / hoursPerS);
  return Math.pow(full, Math.min(1, blend));
}

/** Where the data pulses on the links are, 0 to 1, as a function of the survey hour (D143). */
export function pulsePhase(hours: number): number {
  const secondsPerHour = 3600;
  const cycles = (hours * secondsPerHour) / SURVEY_FOLLOW.pulseWorkS;
  return cycles - Math.floor(cycles);
}
