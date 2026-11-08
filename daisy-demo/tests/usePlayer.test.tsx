// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerBar } from '../src/ui/player/PlayerBar';
import { StepList } from '../src/ui/player/StepList';
import type { Player, WalkStep } from '../src/ui/player/types';
import { usePlayer } from '../src/ui/player/usePlayer';
import { usePlaybackSpeed } from '../src/ui/player/speed';

const STEPS: WalkStep[] = [
  { id: 'a', label: 'Site', caption: 'The site.', durationS: 4 },
  { id: 'b', label: 'Paths', caption: 'The paths.', durationS: 3 },
  { id: 'turn', label: 'Your turn', caption: 'Your turn: try it.', durationS: Infinity },
];

// Drive requestAnimationFrame by hand so the clock is deterministic.
let frames: FrameRequestCallback[] = [];
let now = 0;
function runFrame(ms: number) {
  now += ms;
  const due = frames;
  frames = [];
  act(() => due.forEach((cb) => cb(now)));
}

beforeEach(() => {
  frames = [];
  now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {
    frames = [];
  });
});

afterEach(() => {
  act(() => usePlaybackSpeed.getState().setSpeed(1));
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('usePlayer', () => {
  it('opens paused on the first step', () => {
    const { result } = renderHook(() => usePlayer(STEPS));
    expect(result.current).toMatchObject({ t: 0, playing: false, stepIndex: 0 });
  });

  it('advances on animation frames while playing', () => {
    const { result } = renderHook(() => usePlayer(STEPS));
    act(() => result.current.play());
    for (let i = 0; i < 10; i++) runFrame(50);
    expect(result.current.t).toBeCloseTo(0.5, 5);
    act(() => result.current.pause());
    runFrame(50);
    expect(result.current.t).toBeCloseTo(0.5, 5);
  });

  it("scales the clock by the tab's rate on top of the shared speed (D142)", () => {
    let rate = 0.25;
    const { result } = renderHook(() => usePlayer(STEPS, { rate: () => rate }));
    act(() => result.current.setSpeed(4));
    act(() => result.current.play());
    for (let i = 0; i < 10; i++) runFrame(50);
    expect(result.current.t).toBeCloseTo(0.5, 5);
    // The rate is read every frame, as a function of the clock's time.
    rate = 1;
    for (let i = 0; i < 10; i++) runFrame(50);
    expect(result.current.t).toBeCloseTo(2.5, 5);
  });

  it('caps a long frame, so a background tab does not jump ahead', () => {
    const { result } = renderHook(() => usePlayer(STEPS));
    act(() => result.current.play());
    runFrame(0);
    runFrame(5000);
    expect(result.current.t).toBeLessThanOrEqual(0.1 + 1e-9);
  });

  it('reports the step index and keeps t inside shorter steps', () => {
    const { result, rerender } = renderHook(({ steps }) => usePlayer(steps), {
      initialProps: { steps: STEPS },
    });
    act(() => result.current.seek(5));
    expect(result.current.stepIndex).toBe(1);
    rerender({ steps: STEPS.slice(0, 2) });
    expect(result.current.t).toBe(5);
    rerender({ steps: [STEPS[0]] });
    expect(result.current.t).toBe(4);
  });

  it('calls onRestart and plays from the start', () => {
    const onRestart = vi.fn();
    const { result } = renderHook(() => usePlayer(STEPS, { onRestart }));
    act(() => result.current.seek(6));
    act(() => result.current.restart());
    expect(onRestart).toHaveBeenCalledTimes(1);
    expect(result.current).toMatchObject({ t: 0, playing: true, stepIndex: 0 });
  });

  it('jumps to "Your turn" and pauses on user input', () => {
    const { result } = renderHook(() => usePlayer(STEPS));
    act(() => result.current.play());
    act(() => result.current.toYourTurn());
    expect(result.current).toMatchObject({ t: 7, playing: false, stepIndex: 2 });
  });

  it('plays and pauses with Space and steps with the arrow keys', () => {
    const { result } = renderHook(() => usePlayer(STEPS));
    act(() => {
      fireEvent.keyDown(window, { key: ' ' });
    });
    expect(result.current.playing).toBe(true);
    act(() => {
      fireEvent.keyDown(window, { key: ' ' });
    });
    expect(result.current.playing).toBe(false);
    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowRight' });
    });
    expect(result.current.t).toBe(4);
    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowRight' });
    });
    expect(result.current.stepIndex).toBe(2);
    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
    });
    expect(result.current.t).toBe(4);
  });

  it('leaves keys typed into a text field alone', () => {
    const { result } = renderHook(() => usePlayer(STEPS));
    const input = document.createElement('input');
    document.body.append(input);
    act(() => {
      fireEvent.keyDown(input, { key: ' ' });
      fireEvent.keyDown(input, { key: 'ArrowRight' });
    });
    expect(result.current).toMatchObject({ t: 0, playing: false });
    input.remove();
  });

  it('ignores the keys when keyboard is off', () => {
    const { result } = renderHook(() => usePlayer(STEPS, { keyboard: false }));
    act(() => {
      fireEvent.keyDown(window, { key: ' ' });
    });
    expect(result.current.playing).toBe(false);
  });
});

function fakePlayer(over: Partial<Player> = {}): Player {
  return {
    t: 5,
    playing: false,
    stepIndex: 1,
    play: vi.fn(),
    pause: vi.fn(),
    seek: vi.fn(),
    stepBy: vi.fn(),
    restart: vi.fn(),
    toYourTurn: vi.fn(),
    speed: 1,
    setSpeed: vi.fn(),
    ...over,
  };
}

describe('usePlayer speed', () => {
  it('advances by the frame time times the shared playback speed', () => {
    const { result } = renderHook(() => usePlayer(STEPS));
    act(() => result.current.setSpeed(4));
    act(() => result.current.play());
    runFrame(0);
    for (let i = 0; i < 10; i++) runFrame(50);
    expect(result.current.speed).toBe(4);
    expect(result.current.t).toBeCloseTo(2, 5);
  });

  it('keeps the speed for another player (switching tabs) and never moves t or pauses', () => {
    const first = renderHook(() => usePlayer(STEPS));
    act(() => first.result.current.seek(5));
    act(() => first.result.current.setSpeed(2));
    expect(first.result.current).toMatchObject({ t: 5, playing: false, stepIndex: 1 });
    first.unmount();
    const second = renderHook(() => usePlayer(STEPS));
    expect(second.result.current.speed).toBe(2);
  });

  it('does not disturb "Your turn"', () => {
    const { result } = renderHook(() => usePlayer(STEPS));
    act(() => result.current.toYourTurn());
    act(() => result.current.play());
    runFrame(0);
    runFrame(50);
    const t = result.current.t;
    act(() => result.current.setSpeed(4));
    expect(result.current).toMatchObject({ t, playing: true, stepIndex: 2 });
    runFrame(50);
    expect(result.current.t).toBeCloseTo(t + 0.2, 5);
  });
});

describe('PlayerBar', () => {
  it('shows the step, its caption and one tick per step boundary', () => {
    const { container } = render(<PlayerBar player={fakePlayer()} steps={STEPS} />);
    expect(screen.getByText('Step 2 of 3 · Paths')).toBeTruthy();
    expect(screen.getByText('The paths.')).toBeTruthy();
    expect(container.querySelectorAll('.player-tick')).toHaveLength(2);
    const fill = (container.querySelector('.player-fill') as HTMLElement).style.width;
    expect(parseFloat(fill)).toBeCloseTo((5 / 7) * 100, 3);
  });

  it('wires play, step and restart to the player', () => {
    const player = fakePlayer();
    render(<PlayerBar player={player} steps={STEPS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous step' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }));
    expect(player.play).toHaveBeenCalled();
    expect(player.stepBy).toHaveBeenCalledWith(1);
    expect(player.stepBy).toHaveBeenCalledWith(-1);
    expect(player.restart).toHaveBeenCalled();
  });

  it('shows Pause while playing, and a full track in "Your turn"', () => {
    const player = fakePlayer({ playing: true, stepIndex: 2, t: 9 });
    const { container } = render(<PlayerBar player={player} steps={STEPS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(player.pause).toHaveBeenCalled();
    expect(container.querySelector('.player-head .label')?.textContent).toBe(
      'Step 3 of 3 · Your turn',
    );
    expect((container.querySelector('.player-fill') as HTMLElement).style.width).toBe('100%');
    expect((screen.getByRole('button', { name: 'Next step' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('shows the playback speeds with the current one selected, and sets a new one', () => {
    const player = fakePlayer();
    render(<PlayerBar player={player} steps={STEPS} />);
    const group = screen.getByRole('radiogroup', { name: 'Playback speed' });
    const options = Array.from(group.querySelectorAll('[role=radio]'));
    expect(options.map((o) => o.textContent)).toEqual(['¼×', '½×', '1×', '2×', '4×']);
    expect(options.map((o) => o.getAttribute('aria-checked'))).toEqual([
      'false',
      'false',
      'true',
      'false',
      'false',
    ]);
    expect(options.map((o) => o.getAttribute('title'))).toEqual([
      '0.25× · slower',
      '0.5× · slower',
      '1× · normal speed',
      '2× · faster',
      '4× · faster',
    ]);
    fireEvent.click(options[4]);
    expect(player.setSpeed).toHaveBeenCalledWith(4);
    fireEvent.click(options[0]);
    expect(player.setSpeed).toHaveBeenCalledWith(0.25);
  });

  it('seeks where the track is clicked', () => {
    const player = fakePlayer();
    render(<PlayerBar player={player} steps={STEPS} />);
    const track = screen.getByRole('slider');
    track.getBoundingClientRect = () => ({
      left: 100,
      width: 200,
      top: 0,
      height: 32,
      right: 300,
      bottom: 32,
      x: 100,
      y: 0,
      toJSON: () => ({}),
    });
    track.setPointerCapture = () => {};
    track.hasPointerCapture = () => false;
    fireEvent.pointerDown(track, { button: 0, clientX: 150, pointerId: 1 });
    expect(player.seek).toHaveBeenCalledWith(0.25 * 7);
  });
});

describe('StepList', () => {
  it('numbers the steps, marks the current one and seeks to a clicked step', () => {
    const player = fakePlayer();
    render(<StepList player={player} steps={STEPS} />);
    expect(screen.getByText('Steps, in order')).toBeTruthy();
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.className)).toEqual(['step done', 'step current', 'step later']);
    expect(buttons[1].getAttribute('aria-current')).toBe('step');
    fireEvent.click(buttons[2]);
    expect(player.seek).toHaveBeenCalledWith(7);
  });
});
