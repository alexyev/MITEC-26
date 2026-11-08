// usePlayer (spec 7): the walkthrough clock of a tab. It advances on animation frames while playing, and
// Space plays and pauses, Left and Right step, unless the keys belong to a focused control.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { UI } from '../../config/defaults';
import * as clock from './clock';
import type { ClockState } from './clock';
import { usePlayerCommands } from './commands';
import { usePlaybackSpeed } from './speed';
import type { Player, WalkStep } from './types';

export interface PlayerOptions {
  /** Start playing on mount (default false: the tab opens on its first step, paused). */
  autoplay?: boolean;
  /** Listen to Space and the arrow keys on the window (default true). */
  keyboard?: boolean;
  /** Called by restart(), so the tab can put its inputs back to the defaults (spec 7). */
  onRestart?: () => void;
  /**
   * The tab's own time scale at walkthrough time t, on top of the shared speed (1 when absent), for example
   * while the Survey tab follows a UTV up close (D142). Like the speed, it only rescales the next frames, so t
   * never jumps.
   */
  rate?: (t: number) => number;
}

/** Keys typed into these elements are theirs, not the player's. */
const TEXT_ENTRY = 'input, textarea, select, [contenteditable="true"]';
/** Space activates these elements natively when they have keyboard focus. */
const SPACE_OWNERS = 'button, a[href], summary, [role="button"]';

function hasKeyboardFocus(el: Element): boolean {
  try {
    return el.matches(':focus-visible');
  } catch {
    return true;
  }
}

export function usePlayer(steps: WalkStep[], options: PlayerOptions = {}): Player {
  const { autoplay = false, keyboard = true, onRestart, rate } = options;
  const [state, setState] = useState<ClockState>({ t: 0, playing: autoplay });
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const onRestartRef = useRef(onRestart);
  onRestartRef.current = onRestart;
  // The speed is shared by every tab; a change only rescales the next frames, so t and the step never jump.
  const speed = usePlaybackSpeed((s) => s.speed);
  const setSpeed = usePlaybackSpeed((s) => s.setSpeed);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const rateRef = useRef(rate);
  rateRef.current = rate;

  // Advance on animation frames while playing, by the frame's wall time times the playback speed and the tab's rate.
  useEffect(() => {
    if (!state.playing) return;
    let last = performance.now();
    let frame = requestAnimationFrame(function loop(now) {
      const dt = Math.min(UI.player.maxFrameS, Math.max(0, (now - last) / 1000));
      last = now;
      setState((s) =>
        clock.tick(stepsRef.current, s, dt, speedRef.current * (rateRef.current?.(s.t) ?? 1)),
      );
      frame = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(frame);
  }, [state.playing]);

  const play = useCallback(() => setState((s) => clock.play(stepsRef.current, s)), []);
  const pause = useCallback(() => setState(clock.pause), []);
  const seek = useCallback((t: number) => setState((s) => clock.seek(stepsRef.current, s, t)), []);
  const stepBy = useCallback(
    (d: 1 | -1) => setState((s) => clock.stepBy(stepsRef.current, s, d, UI.player.stepBackGraceS)),
    [],
  );
  const restart = useCallback(() => {
    onRestartRef.current?.();
    setState(clock.restart());
  }, []);
  const toYourTurn = useCallback(() => setState((s) => clock.toYourTurn(stepsRef.current, s)), []);

  // A request from outside the tab (the guided tour, D94); requests made before this player mounted do not count.
  const yourTurnRequests = usePlayerCommands((s) => s.yourTurn);
  const seenRequestsRef = useRef(yourTurnRequests);
  useEffect(() => {
    if (yourTurnRequests === seenRequestsRef.current) return;
    seenRequestsRef.current = yourTurnRequests;
    toYourTurn();
  }, [yourTurnRequests, toYourTurn]);

  // Steps can change length (for example the survey time); keep t inside the walkthrough.
  const t = clock.clampTime(steps, state.t);
  const playing = state.playing && t < clock.endTime(steps);
  const stepIndex = clock.stepIndexAt(steps, t);

  const playingRef = useRef(playing);
  playingRef.current = playing;

  useEffect(() => {
    if (!keyboard) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target instanceof Element ? e.target : null;
      if (e.key === ' ') {
        if (target?.closest(TEXT_ENTRY)) return;
        const owner = target?.closest(SPACE_OWNERS);
        // A button keeps focus after a mouse click; Space then plays and pauses instead of clicking it again.
        if (owner && hasKeyboardFocus(owner)) return;
        if (owner instanceof HTMLElement) owner.blur();
        e.preventDefault();
        if (playingRef.current) pause();
        else play();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (target?.closest(TEXT_ENTRY)) return;
        e.preventDefault();
        stepBy(e.key === 'ArrowRight' ? 1 : -1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [keyboard, pause, play, stepBy]);

  return useMemo(
    () => ({
      t,
      playing,
      stepIndex,
      play,
      pause,
      seek,
      stepBy,
      restart,
      toYourTurn,
      speed,
      setSpeed,
    }),
    [t, playing, stepIndex, play, pause, seek, stepBy, restart, toYourTurn, speed, setSpeed],
  );
}
