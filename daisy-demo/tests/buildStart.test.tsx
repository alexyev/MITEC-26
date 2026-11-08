// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBuildStore } from '../src/state/build';
import { useGuideStore } from '../src/state/guide';
import { useShellStore } from '../src/state/store';
import { App } from '../src/ui/App';
import { usePlaybackSpeed } from '../src/ui/player/speed';

// The Build & failure panel's Start button drives the shared player. Animation frames are driven by hand.

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

const panelBtn = (name: string) => screen.getByRole('button', { name: `${name} walkthrough` });
const barBtn = (name: string) => screen.getByRole('button', { name });
const eyebrow = () => document.querySelector('.player .label')?.textContent ?? '';
const goTo = (label: string) => fireEvent.click(screen.getByRole('button', { name: label }));

describe('Start button in the Build & failure panel', () => {
  it('starts from the beginning, pauses, resumes and replays, in step with the player bar', () => {
    render(<App />);
    const btn = panelBtn('Start');
    expect(btn.textContent).toBe('Start');
    expect(btn.closest('[data-tour="start"]')).not.toBeNull();
    expect(eyebrow()).toContain('Step 1 of');

    fireEvent.click(btn);
    runFrames(10);
    expect(panelBtn('Pause').textContent).toBe('Pause');
    expect(barBtn('Pause')).toBeTruthy();

    fireEvent.click(panelBtn('Pause'));
    expect(barBtn('Play')).toBeTruthy();
    const paused = eyebrow();
    runFrames(20);
    expect(eyebrow()).toBe(paused);
    expect(panelBtn('Resume').textContent).toBe('Resume');

    // Resume continues from where it stopped, not from step 1.
    fireEvent.click(panelBtn('Resume'));
    runFrames(5);
    expect(barBtn('Pause')).toBeTruthy();
    expect(panelBtn('Pause')).toBeTruthy();

    // The bar's Pause and Space move the panel button too.
    fireEvent.click(barBtn('Pause'));
    expect(panelBtn('Resume')).toBeTruthy();
    fireEvent.keyDown(window, { key: ' ' });
    expect(panelBtn('Pause')).toBeTruthy();
    fireEvent.keyDown(window, { key: ' ' });
    expect(panelBtn('Resume')).toBeTruthy();
    fireEvent.click(barBtn('Play'));
    expect(panelBtn('Pause')).toBeTruthy();
  });

  it('reads Replay once the walkthrough has played out, and restarts from step 1', () => {
    render(<App />);
    goTo('Cost');
    fireEvent.click(panelBtn('Resume'));
    runFrames(300);
    expect(screen.getByRole('button', { name: 'Your turn' }).className).toContain('current');
    const replay = panelBtn('Replay');
    expect(replay.textContent).toBe('Replay');
    fireEvent.click(replay);
    expect(eyebrow()).toContain('Step 1 of');
    expect(panelBtn('Pause')).toBeTruthy();
    expect(barBtn('Pause')).toBeTruthy();
  });
});
