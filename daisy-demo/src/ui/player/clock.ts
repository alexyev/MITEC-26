// Walkthrough clock (spec 7) as pure functions of the steps and a { t, playing } state, so the player can be
// tested without a browser. Steps play back to back; the last step ("Your turn") usually has no end.
import type { WalkStep } from './types';

export interface ClockState {
  t: number;
  playing: boolean;
}

/** Start time of every step, in seconds. */
export function stepStarts(steps: readonly WalkStep[]): number[] {
  const starts: number[] = [];
  let acc = 0;
  for (const s of steps) {
    starts.push(acc);
    acc += s.durationS;
  }
  return starts;
}

/** Start of the last step: the length of the narrated part, which the progress track spans. */
export function walkDuration(steps: readonly WalkStep[]): number {
  if (steps.length === 0) return 0;
  return stepStarts(steps)[steps.length - 1];
}

/** End of the whole walkthrough: Infinity when the last step has no end. */
export function endTime(steps: readonly WalkStep[]): number {
  return steps.reduce((acc, s) => acc + s.durationS, 0);
}

/** Index of the step that is playing at `t`. */
export function stepIndexAt(steps: readonly WalkStep[], t: number): number {
  const starts = stepStarts(steps);
  let i = 0;
  while (i + 1 < starts.length && t >= starts[i + 1]) i++;
  return i;
}

/** `t` kept between 0 and the end of the walkthrough. */
export function clampTime(steps: readonly WalkStep[], t: number): number {
  return Math.min(endTime(steps), Math.max(0, Number.isFinite(t) ? t : 0));
}

/**
 * Advance a playing clock by `dt` seconds of wall time at a playback speed (1 is the designed pace); a
 * walkthrough with a finite end stops there. Everything on screen is a function of `t`, so the speed scales
 * step durations and every motion on the map together.
 */
export function tick(
  steps: readonly WalkStep[],
  s: ClockState,
  dt: number,
  speed: number = 1,
): ClockState {
  if (!s.playing) return s;
  const end = endTime(steps);
  const t = Math.min(end, s.t + dt * speed);
  return { t, playing: t < end };
}

/** Wall-clock seconds a span of walkthrough time takes at a playback speed. */
export function wallSeconds(walkS: number, speed: number): number {
  return walkS / speed;
}

/** Play; at the finite end of a walkthrough, play starts it again. */
export function play(steps: readonly WalkStep[], s: ClockState): ClockState {
  if (s.t >= endTime(steps)) return { t: 0, playing: true };
  return { t: s.t, playing: true };
}

export function pause(s: ClockState): ClockState {
  return { t: s.t, playing: false };
}

/** Jump to `t`; the clock keeps playing or stays paused. */
export function seek(steps: readonly WalkStep[], s: ClockState, t: number): ClockState {
  return { t: clampTime(steps, t), playing: s.playing };
}

/**
 * Step to a step boundary. Forward goes to the start of the next step (nothing at the last step).
 * Back goes to the start of the current step when more than `graceS` into it, else to the previous step;
 * from "Your turn" (no end) it always goes to the previous step.
 */
export function stepBy(
  steps: readonly WalkStep[],
  s: ClockState,
  d: 1 | -1,
  graceS: number,
): ClockState {
  if (steps.length === 0) return s;
  const starts = stepStarts(steps);
  const i = stepIndexAt(steps, s.t);
  if (d === 1) {
    if (i + 1 >= steps.length) return s;
    return { t: starts[i + 1], playing: s.playing };
  }
  const open = !Number.isFinite(steps[i].durationS);
  const target = !open && s.t - starts[i] > graceS ? i : Math.max(0, i - 1);
  return { t: starts[target], playing: s.playing };
}

/** Back to the first step, playing. */
export function restart(): ClockState {
  return { t: 0, playing: true };
}

/** User input during the walkthrough: pause and jump to the last step. Inside "Your turn" nothing changes. */
export function toYourTurn(steps: readonly WalkStep[], s: ClockState): ClockState {
  if (steps.length === 0) return s;
  const last = steps.length - 1;
  if (stepIndexAt(steps, s.t) === last) return s;
  return { t: stepStarts(steps)[last], playing: false };
}
