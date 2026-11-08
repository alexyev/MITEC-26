import { describe, expect, it } from 'vitest';
import * as clock from '../src/ui/player/clock';
import type { WalkStep } from '../src/ui/player/types';

// T2.3 acceptance: the clock's step boundaries, pause, seek, step back and forward, restart and toYourTurn.
const STEPS: WalkStep[] = [
  { id: 'a', label: 'A', caption: 'A.', durationS: 4 },
  { id: 'b', label: 'B', caption: 'B.', durationS: 3 },
  { id: 'c', label: 'C', caption: 'C.', durationS: 5 },
  { id: 'turn', label: 'Your turn', caption: 'Your turn.', durationS: Infinity },
];
const GRACE = 1;
const paused = (t: number) => ({ t, playing: false });
const playing = (t: number) => ({ t, playing: true });

describe('step boundaries', () => {
  it('starts every step where the previous one ends', () => {
    expect(clock.stepStarts(STEPS)).toEqual([0, 4, 7, 12]);
    expect(clock.walkDuration(STEPS)).toBe(12);
    expect(clock.endTime(STEPS)).toBe(Infinity);
  });

  it('finds the step at a time, with each boundary belonging to the next step', () => {
    expect(clock.stepIndexAt(STEPS, 0)).toBe(0);
    expect(clock.stepIndexAt(STEPS, 3.999)).toBe(0);
    expect(clock.stepIndexAt(STEPS, 4)).toBe(1);
    expect(clock.stepIndexAt(STEPS, 6.5)).toBe(1);
    expect(clock.stepIndexAt(STEPS, 7)).toBe(2);
    expect(clock.stepIndexAt(STEPS, 12)).toBe(3);
    expect(clock.stepIndexAt(STEPS, 1e6)).toBe(3);
  });

  it('handles an empty and a one-step walkthrough', () => {
    expect(clock.walkDuration([])).toBe(0);
    expect(clock.stepIndexAt([STEPS[3]], 5)).toBe(0);
    expect(clock.walkDuration([STEPS[3]])).toBe(0);
  });
});

describe('play, pause and tick', () => {
  it('advances only while playing', () => {
    expect(clock.tick(STEPS, paused(1), 0.5)).toEqual(paused(1));
    expect(clock.tick(STEPS, playing(1), 0.5)).toEqual(playing(1.5));
  });

  it('plays on into "Your turn", which has no end', () => {
    const s = clock.tick(STEPS, playing(11.9), 0.5);
    expect(s.playing).toBe(true);
    expect(clock.stepIndexAt(STEPS, s.t)).toBe(3);
  });

  it('stops at the end of a walkthrough with a finite end, and play then starts it again', () => {
    const finite = STEPS.slice(0, 3);
    const end = clock.tick(finite, playing(11.8), 0.5);
    expect(end).toEqual(paused(12));
    expect(clock.play(finite, end)).toEqual(playing(0));
  });

  it('pauses and resumes at the same time', () => {
    const p = clock.pause(playing(5.2));
    expect(p).toEqual(paused(5.2));
    expect(clock.play(STEPS, p)).toEqual(playing(5.2));
  });
});

describe('seek', () => {
  it('jumps to a time and keeps the playing state', () => {
    expect(clock.seek(STEPS, playing(1), 8)).toEqual(playing(8));
    expect(clock.seek(STEPS, paused(1), 8)).toEqual(paused(8));
  });

  it('clamps to the walkthrough', () => {
    expect(clock.seek(STEPS, paused(3), -2).t).toBe(0);
    expect(clock.seek(STEPS.slice(0, 3), paused(3), 99).t).toBe(12);
    expect(clock.seek(STEPS, paused(3), Number.NaN).t).toBe(0);
  });
});

describe('step forward and back', () => {
  it('steps forward to the start of the next step', () => {
    expect(clock.stepBy(STEPS, paused(0), 1, GRACE)).toEqual(paused(4));
    expect(clock.stepBy(STEPS, playing(5), 1, GRACE)).toEqual(playing(7));
    expect(clock.stepBy(STEPS, paused(8), 1, GRACE)).toEqual(paused(12));
  });

  it('does not step forward from the last step', () => {
    expect(clock.stepBy(STEPS, paused(20), 1, GRACE)).toEqual(paused(20));
  });

  it('steps back to the start of the current step when well into it', () => {
    expect(clock.stepBy(STEPS, paused(6), -1, GRACE)).toEqual(paused(4));
  });

  it('steps back to the previous step near the start of the current one', () => {
    expect(clock.stepBy(STEPS, paused(4.5), -1, GRACE)).toEqual(paused(0));
    expect(clock.stepBy(STEPS, paused(7), -1, GRACE)).toEqual(paused(4));
  });

  it('steps back from "Your turn" to the step before it, however long it has run', () => {
    expect(clock.stepBy(STEPS, paused(40), -1, GRACE)).toEqual(paused(7));
  });

  it('stays at 0 on the first step', () => {
    expect(clock.stepBy(STEPS, paused(0.5), -1, GRACE)).toEqual(paused(0));
  });
});

describe('restart and toYourTurn', () => {
  it('restarts from the first step, playing', () => {
    expect(clock.restart()).toEqual(playing(0));
  });

  it('pauses and jumps to "Your turn" on user input during the walkthrough', () => {
    expect(clock.toYourTurn(STEPS, playing(5))).toEqual(paused(12));
    expect(clock.toYourTurn(STEPS, paused(0))).toEqual(paused(12));
  });

  it('changes nothing when already in "Your turn"', () => {
    expect(clock.toYourTurn(STEPS, playing(30))).toEqual(playing(30));
    expect(clock.toYourTurn(STEPS, paused(12))).toEqual(paused(12));
  });
});
