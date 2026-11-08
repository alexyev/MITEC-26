// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCENE3D } from '../src/config/scene3d';
import { cellRadioId } from '../src/engine/playModel';
import { PLAY_MODEL, PLAY_TIMELINE, useBuildStore } from '../src/state/build';
import { useGuideStore } from '../src/state/guide';
import { useShellStore } from '../src/state/store';
import { App } from '../src/ui/App';
import { fitWithCoverage } from '../src/ui/build/BuildMap';
import { usePlayerCommands } from '../src/ui/player/commands';
import { poseFromViewport, type Pose } from '../src/ui/scene3d/pose';
import { featuredRadio } from '../src/ui/scene3d/featured';

// D120, D121, D125, D126: "Take me there" opens the 3D view of the featured radio's corner from the map's
// view of the moment, and "Back to map" puts the map back as it was. jsdom has no WebGL: the renderer is a
// stand-in that records what the view asks of it, and resolves its compile and flights at once.

const fake = vi.hoisted(() => {
  const calls: string[] = [];
  const poses: unknown[] = [];
  const instances: { input: { radio: number } }[] = [];
  class CornerView {
    readonly antenna = { x: 0, y: 3.2, z: 0 };
    private pose: unknown = null;
    constructor(
      _canvas: HTMLCanvasElement,
      readonly input: { radio: number },
    ) {
      instances.push(this);
      calls.push('new');
    }
    compile() {
      calls.push('compile');
      return Promise.resolve();
    }
    resize() {}
    setLabelAvoid() {}
    setCalloutSize() {}
    setPose(p: unknown) {
      this.pose = p;
      poses.push(p);
    }
    currentPose() {
      return this.pose;
    }
    fly(from: unknown, to: unknown, ms: number, reverse = false) {
      calls.push(`fly ${reverse ? 'out' : 'in'} ${ms}`);
      this.pose = reverse ? from : to;
      return Promise.resolve();
    }
    land() {
      calls.push('land');
    }
    release() {
      calls.push('release');
    }
    dispose() {
      calls.push('dispose');
    }
  }
  return { calls, poses, CornerView, last: () => instances[instances.length - 1] ?? null };
});

vi.mock('../src/ui/scene3d/view', () => ({ CornerView: fake.CornerView }));

const W = 1440;
const H = 900;
let reduced = false;

beforeEach(() => {
  reduced = false;
  fake.calls.length = 0;
  fake.poses.length = 0;
  // The map and the 3D view need a size: every element measures 1440 x 900, as the stage does.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly cb: () => void) {}
      observe() {
        this.cb();
      }
      unobserve() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: W,
    bottom: H,
    width: W,
    height: H,
    toJSON: () => ({}),
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduced && query.includes('reduce'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  }));
  useGuideStore.setState({ home: 'closed', afterHome: 'map', tourStep: null, seen: true });
  useShellStore.setState({ tab: 'build' });
  useBuildStore.getState().resetInputs();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const shell = () => document.querySelector('.shell') as HTMLElement;
const view = () => document.querySelector('.scene3d') as HTMLElement | null;
const pin = () => screen.queryByRole('button', { name: /Take me there/ });
const playButton = () => screen.getByRole('button', { name: /^(Play|Pause)$/ });
const sentLine = () => screen.getByText(/ sent · /).textContent;

/** The app on the Build tab at "Your turn", where every radio is built. */
async function openAtYourTurn() {
  render(<App />);
  act(() => usePlayerCommands.getState().requestYourTurn());
  return screen.findByRole('button', { name: /Take me there/ });
}

async function flyDown(button: HTMLElement) {
  fireEvent.click(button);
  await waitFor(() => expect(view()?.dataset.phase).toBe('landed'));
}

describe('Take me there (D120, D121)', () => {
  it('opens the 3D view of the featured radio, starting from the map view of the moment', async () => {
    await flyDown(await openAtYourTurn());

    expect(fake.last()?.input.radio).toBe(featuredRadio(PLAY_MODEL));
    // The flight starts on the pose that shows the map exactly as the 2D canvas drew it.
    const start = fake.poses[0] as Pose;
    expect(start).toEqual(
      poseFromViewport(fitWithCoverage(PLAY_MODEL, W, H), SCENE3D.camera.fovDeg),
    );
    expect(fake.calls).toEqual(['new', 'compile', `fly in ${SCENE3D.motion.flyInMs}`, 'land']);
    expect(shell().classList.contains('scene-3d')).toBe(true);
    expect(screen.getByRole('button', { name: 'Back to map' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Radio C4-3 · corner module' })).toBeTruthy();
    expect(pin()).toBeNull();
  });

  it('toggles back to the map with Back to map: the flight back, the crossfade, then the map', async () => {
    await flyDown(await openAtYourTurn());
    fireEvent.click(screen.getByRole('button', { name: 'Back to map' }));
    await waitFor(() => expect(view()).toBeNull());
    expect(fake.calls.slice(-3)).toEqual([
      'release',
      `fly out ${SCENE3D.motion.flyOutMs}`,
      'dispose',
    ]);
    expect(shell().classList.contains('scene-3d')).toBe(false);
    expect(pin()).toBeTruthy();
  });

  it('pauses the walkthrough while the 3D view is up and restores it after: playing plays on', async () => {
    const button = await openAtYourTurn();
    // In "Your turn" traffic plays only after a click (D103): fail a radio away from the pin's, as a click on
    // the map does, so the walkthrough has a burst of packets to play.
    act(() =>
      useBuildStore.getState().toggleRadio(cellRadioId(PLAY_MODEL, 8, 1), PLAY_TIMELINE.yourTurnS),
    );
    fireEvent.click(playButton());
    expect(playButton().getAttribute('aria-label')).toBe('Pause');
    await flyDown(button);

    // Paused, and frozen: the packet counts do not move while the viewer looks around.
    expect(playButton().getAttribute('aria-label')).toBe('Play');
    const frozen = sentLine();
    await act(() => new Promise((r) => setTimeout(r, 300)));
    expect(sentLine()).toBe(frozen);
    // Space belongs to the 3D view now, not to the walkthrough underneath.
    fireEvent.keyDown(window, { key: ' ' });
    expect(playButton().getAttribute('aria-label')).toBe('Play');

    fireEvent.click(screen.getByRole('button', { name: 'Back to map' }));
    await waitFor(() => expect(view()).toBeNull());
    expect(playButton().getAttribute('aria-label')).toBe('Pause');
    await waitFor(() => expect(sentLine()).not.toBe(frozen));
    expect(screen.getByText(/Your turn: click any radio/)).toBeTruthy();
  });

  it('leaves a paused walkthrough paused', async () => {
    await flyDown(await openAtYourTurn());
    expect(playButton().getAttribute('aria-label')).toBe('Play');
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(view()).toBeNull());
    expect(playButton().getAttribute('aria-label')).toBe('Play');
  });

  it('cuts instead of flying under reduced motion', async () => {
    reduced = true;
    await flyDown(await openAtYourTurn());
    expect(fake.calls).toEqual(['new', 'compile', 'land']);
    fireEvent.click(screen.getByRole('button', { name: 'Back to map' }));
    await waitFor(() => expect(view()).toBeNull());
    expect(fake.calls.some((c) => c.startsWith('fly'))).toBe(false);
  });

  it('gives the whole app to the tour: starting it goes back to the map at once', async () => {
    await flyDown(await openAtYourTurn());
    act(() => useGuideStore.getState().startTour());
    await waitFor(() => expect(view()).toBeNull());
    expect(shell().classList.contains('scene-3d')).toBe(false);
  });

  it('shows the pin once its radio is built, and not while that radio is failed', async () => {
    render(<App />);
    expect(pin()).toBeNull();
    act(() => usePlayerCommands.getState().requestYourTurn());
    await screen.findByRole('button', { name: /Take me there/ });
    act(() =>
      useBuildStore.getState().toggleRadio(featuredRadio(PLAY_MODEL), PLAY_TIMELINE.yourTurnS),
    );
    await waitFor(() => expect(pin()).toBeNull());
  });

  describe('the call to action under the tab switch', () => {
    const cta = () => document.querySelector<HTMLElement>('[data-tour="take-me-there"]');
    const onTheRadio = () => document.querySelector('.scene-pin');

    it('is not there while earlier steps show, where the pin on the radio is instead', async () => {
      render(<App />);
      expect(cta()).toBeNull();
      act(() => usePlayerCommands.getState().requestYourTurn());
      await screen.findByRole('button', { name: /Take me there/ });
      // One step back from "Your turn": the pin is on the radio again and the call to action is gone.
      fireEvent.click(screen.getByRole('button', { name: 'Previous step' }));
      await waitFor(() => expect(cta()).toBeNull());
      expect(onTheRadio()).toBeTruthy();
      expect(screen.getAllByRole('button', { name: /Take me there/ })).toHaveLength(1);
    });

    it('shows at "Your turn" in place of the pin: one button, not two', async () => {
      const button = await openAtYourTurn();
      expect(cta()).toBe(button);
      expect(cta()?.closest('.scene-cta')).toBeTruthy();
      expect(onTheRadio()).toBeNull();
      expect(screen.getAllByRole('button', { name: /Take me there/ })).toHaveLength(1);
    });

    it('opens the 3D view of the featured radio, and is gone while it is up', async () => {
      await flyDown(await openAtYourTurn());
      expect(fake.last()?.input.radio).toBe(featuredRadio(PLAY_MODEL));
      expect(cta()).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Back to map' }));
      await waitFor(() => expect(view()).toBeNull());
      expect(cta()).toBeTruthy();
    });

    it('steps aside while its radio is failed, and returns when it is repaired', async () => {
      await openAtYourTurn();
      const radio = featuredRadio(PLAY_MODEL);
      act(() => useBuildStore.getState().toggleRadio(radio, PLAY_TIMELINE.yourTurnS));
      await waitFor(() => expect(cta()).toBeNull());
      // Reset repairs it and lets the clock run on, as a viewer would.
      fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
      await waitFor(() => expect(cta()).toBeTruthy(), { timeout: 4000 });
    });
  });
});
