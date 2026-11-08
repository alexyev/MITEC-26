// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cellRadioId } from '../src/engine/playModel';
import { PLAY_MODEL, PLAY_TIMELINE, useBuildStore } from '../src/state/build';
import { useGuideStore } from '../src/state/guide';
import { useShellStore } from '../src/state/store';
import { App } from '../src/ui/App';
import { usePlaybackSpeed } from '../src/ui/player/speed';

// D103 in the running app: the Build & failure readout counts the packets sent, so it shows whether traffic
// moves. Animation frames are driven by hand, so the clock is deterministic.

let frames: FrameRequestCallback[] = [];
let now = 0;
function runFrames(count: number, ms = 100) {
  for (let i = 0; i < count; i++) {
    now += ms;
    const due = frames;
    frames = [];
    act(() => due.forEach((cb) => cb(now)));
  }
}

beforeEach(() => {
  frames = [];
  now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  }));
  useGuideStore.setState({ home: 'closed', tourStep: null, seen: true });
  useShellStore.setState({ tab: 'build' });
  useBuildStore.getState().resetInputs();
});

afterEach(() => {
  act(() => usePlaybackSpeed.getState().setSpeed(1));
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  useBuildStore.getState().resetInputs();
});

/** "451 sent · 437 delivered" in the readout's STRESS-TEST section. */
const sentText = () => screen.getByText(/ sent · /).textContent;
const playing = () => screen.queryByRole('button', { name: 'Pause' }) !== null;
const goTo = (label: string) => fireEvent.click(screen.getByRole('button', { name: label }));
const press = (name: 'Play' | 'Pause') => fireEvent.click(screen.getByRole('button', { name }));

describe('packets follow the playing clock (D103)', () => {
  it('stand still while paused at every data step', () => {
    render(<App />);
    for (const step of ['Failure', 'Detection', 'Reroute', 'Recovered']) {
      goTo(step);
      press('Play');
      runFrames(5);
      press('Pause');
      const before = sentText();
      runFrames(100);
      expect(playing()).toBe(false);
      expect(sentText()).toBe(before);
    }
    // Playing moves the traffic on, so the count above is live.
    const before = sentText();
    press('Play');
    runFrames(5);
    expect(sentText()).not.toBe(before);
  });

  it.each([0.25, 1, 4])(
    'stop at the end of the walkthrough, and the player pauses there (speed %s×)',
    (speed) => {
      act(() => usePlaybackSpeed.getState().setSpeed(speed));
      render(<App />);
      goTo('Cost');
      press('Play');
      // The cost step lasts a few seconds of walkthrough time; run well past it.
      runFrames(Math.ceil(120 / speed));
      expect(screen.getByRole('button', { name: 'Your turn' }).className).toContain('current');
      expect(playing()).toBe(false);
      const sent = sentText();
      runFrames(100);
      expect(sentText()).toBe(sent);
      // Play over a still "Your turn" has nothing to play: it stays still and pauses again.
      press('Play');
      runFrames(100);
      expect(playing()).toBe(false);
      expect(sentText()).toBe(sent);
    },
  );

  it('play a click in "Your turn" as a burst that settles, then pause', () => {
    render(<App />);
    // Seeking to "Your turn" puts the clock at its start, where the click applies.
    goTo('Your turn');
    const sent = sentText();
    // A click on a radio: the store applies it and the tab plays (as BuildTab's own click handler does).
    act(() => useBuildStore.getState().toggleRadio(cellRadioId(PLAY_MODEL, 6, 2), PLAY_TIMELINE.yourTurnS));
    press('Play');
    runFrames(20);
    expect(playing()).toBe(true);
    expect(sentText()).not.toBe(sent);
    runFrames(300);
    expect(playing()).toBe(false);
    const settled = sentText();
    runFrames(200);
    expect(sentText()).toBe(settled);
  });
});
