// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UI } from '../src/config/defaults';
import { HOME, TOUR, TOUR_OPTIONAL_TARGETS, tourSteps } from '../src/config/tour';
import { useBuildStore } from '../src/state/build';
import { readTourSeen, useGuideStore, writeTourSeen } from '../src/state/guide';
import { useShellStore } from '../src/state/store';
import { App } from '../src/ui/App';
import { tourFacts } from '../src/ui/guide/facts';
import { dimPath, mergeHoles, placeCallout } from '../src/ui/guide/geometry';
import { getTourSteps } from '../src/ui/guide/Tour';
import { usePlayerCommands } from '../src/ui/player/commands';
import { usePlayer } from '../src/ui/player/usePlayer';

// D90-D94: the home screen, the guided tour over the live app, and the tour's memory per viewer.

const STEPS = getTourSteps();
const indexOf = (id: string) => STEPS.findIndex((s) => s.id === id);

let reduced = false;

beforeEach(() => {
  reduced = false;
  // The maps need a size and a 2D context; jsdom has neither, and the tour reads no pixels.
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
    matches: reduced && query.includes('reduce'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  }));
  window.localStorage.clear();
  useGuideStore.setState({ home: 'open', afterHome: 'map', tourStep: null, seen: false });
  useShellStore.setState({ tab: 'survey' });
  useBuildStore.getState().resetInputs();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The app with the home screen gone and the tour on `step`. */
function renderTourAt(step: number) {
  useGuideStore.setState({ home: 'closed', tourStep: step });
  return render(<App />);
}

describe('tour steps (D91)', () => {
  it('run in order over both tabs, about a dozen of them', () => {
    expect(STEPS.map((s) => s.id)).toEqual([
      'tabs',
      'map',
      'play',
      'steps',
      'fleet',
      'cost',
      'switch',
      'story',
      'hover',
      'your-turn',
      'replay',
    ]);
    expect(STEPS.length).toBeGreaterThanOrEqual(8);
    expect(STEPS.length).toBeLessThanOrEqual(12);
    // The Survey steps come first, then the switch, then the Build & failure steps.
    const switchAt = indexOf('switch');
    expect(STEPS.slice(0, switchAt + 1).every((s) => s.tab === 'survey')).toBe(true);
    expect(STEPS.slice(switchAt + 1).every((s) => s.tab === 'build')).toBe(true);
  });

  it('state every number and name from the code', () => {
    const f = tourFacts();
    const copy = STEPS.map((s) => `${s.title} ${s.body} ${s.swatches?.map((w) => w.label)}`).join(
      ' ',
    );
    for (const value of [
      f.acres,
      f.units,
      f.surveyHours,
      f.utvKitUsd,
      f.dogSpeedUp,
      f.slowestSpeed,
      f.fastestSpeed,
      f.surveyTab,
      f.buildTab,
      f.robot,
      f.uplink,
      f.failed,
      `${f.buildStages} stages`,
      `${f.radios} radios`,
      `${f.uplinkHops} hops`,
      `${f.missedHellos} hellos`,
      `1 to ${f.maxVehicles}`,
    ]) {
      expect(copy).toContain(String(value));
    }
    // The copy follows the facts it is given, so nothing is typed in by hand.
    const other = tourSteps({ ...f, failed: 'Z9-9', acres: '1,234', vehicle: 'Rover' });
    const otherCopy = other.map((s) => s.body).join(' ');
    expect(otherCopy).toContain('Z9-9');
    expect(otherCopy).toContain('1,234 acres');
    expect(otherCopy).toContain('Rovers');
    expect(otherCopy).not.toContain(f.failed);
  });

  it("every step's targets exist in the rendered app, on the step's tab", () => {
    render(<App />);
    for (const step of STEPS) {
      act(() => useShellStore.getState().setTab(step.tab));
      for (const target of [...step.targets, ...(step.anchor ? [step.anchor] : [])]) {
        if (TOUR_OPTIONAL_TARGETS.includes(target)) continue;
        expect(document.querySelector(`[data-tour="${target}"]`), `${step.id}: ${target}`).not.toBe(
          null,
        );
      }
    }
    // The cost card is a target only once the viewer opens it.
    act(() => useShellStore.getState().setTab('survey'));
    expect(document.querySelector('[data-tour="cost-card"]')).toBe(null);
    fireEvent.click(screen.getByRole('button', { name: /Survey connectivity|Survey cost/ }));
    expect(document.querySelector('[data-tour="cost-card"]')).not.toBe(null);
  });
});

describe('interactive steps (D91)', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));

  const afterTick = () => act(() => vi.advanceTimersByTime(TOUR.advanceDelayMs));

  it('Press Play: pressing Play ticks the step and moves on', () => {
    renderTourAt(indexOf('play'));
    expect(screen.getByText('Try it: Press Play')).toBeTruthy();
    fireEvent.click(document.querySelector('[data-tour="play"]')!);
    expect(document.querySelector('.tour-action.done')?.textContent).toBe('Done');
    afterTick();
    expect(useGuideStore.getState().tourStep).toBe(indexOf('steps'));
  });

  it('Switch tabs: choosing Build & failure moves on to its story', () => {
    renderTourAt(indexOf('switch'));
    fireEvent.click(screen.getByRole('radio', { name: 'Build & failure' }));
    afterTick();
    expect(useGuideStore.getState().tourStep).toBe(indexOf('story'));
    expect(useShellStore.getState().tab).toBe('build');
  });

  it('Hover and Your turn: a hover card, then a failed radio, move on', () => {
    renderTourAt(indexOf('hover'));
    act(() => useBuildStore.getState().setHover({ kind: 'node', id: 0 }));
    afterTick();
    expect(useGuideStore.getState().tourStep).toBe(indexOf('your-turn'));
    act(() => useBuildStore.getState().toggleRadio(0, 1));
    afterTick();
    expect(useGuideStore.getState().tourStep).toBe(indexOf('replay'));
  });

  it('Next still works without doing the action', () => {
    renderTourAt(indexOf('play'));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(useGuideStore.getState().tourStep).toBe(indexOf('steps'));
  });

  it('a step that needs it moves the walkthrough to "Your turn" (D94)', () => {
    const before = usePlayerCommands.getState().yourTurn;
    renderTourAt(indexOf('your-turn'));
    expect(usePlayerCommands.getState().yourTurn).toBe(before + 1);
  });
});

describe('keys, Skip and the memory per viewer (D91, D92)', () => {
  it('Enter and Right go on, Left goes back, and the player does not step', () => {
    renderTourAt(0);
    const playerLabel = () => document.querySelector('.player .label')?.textContent;
    const before = playerLabel();
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
    expect(useGuideStore.getState().tourStep).toBe(1);
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(useGuideStore.getState().tourStep).toBe(2);
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(useGuideStore.getState().tourStep).toBe(1);
    expect(playerLabel()).toBe(before);
  });

  it('Escape exits and remembers the skip', () => {
    renderTourAt(3);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useGuideStore.getState().tourStep).toBe(null);
    expect(document.querySelector('.tour-callout')).toBe(null);
    expect(window.localStorage.getItem(TOUR.storageKey)).toBe('skipped');
    expect(readTourSeen()).toBe(true);
  });

  it('Skip tour exits from any step; Finish on the last step remembers it done', () => {
    renderTourAt(1);
    fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }));
    expect(useGuideStore.getState().tourStep).toBe(null);
    expect(window.localStorage.getItem(TOUR.storageKey)).toBe('skipped');

    act(() => useGuideStore.setState({ tourStep: STEPS.length - 1 }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(useGuideStore.getState().tourStep).toBe(null);
    expect(window.localStorage.getItem(TOUR.storageKey)).toBe('done');
  });

  it('focus moves into the callout, stays trapped while it runs, and is released on exit', () => {
    render(<App />);
    act(() => useGuideStore.setState({ home: 'closed' }));
    const tourButton = screen.getByRole('button', { name: 'Take the tour' });
    tourButton.focus();
    fireEvent.click(tourButton);
    const callout = screen.getByRole('dialog', { name: STEPS[0].title });
    expect(document.activeElement).toBe(callout);

    // Tab cycles through the callout's buttons and the spotlit controls, never out to the rest of the app.
    const allowed = new Set<Element>([
      ...callout.querySelectorAll('button'),
      ...document.querySelectorAll('[data-tour="tabs"] [tabindex="0"]'),
    ]);
    for (let i = 0; i < 6; i++) {
      const event = fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
      expect(event).toBe(false);
      expect(allowed.has(document.activeElement!)).toBe(true);
    }

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(document.activeElement).toBe(tourButton);
    // Released: Tab is the browser's again.
    expect(fireEvent.keyDown(document.activeElement!, { key: 'Tab' })).toBe(true);
  });

  it('works when localStorage throws: nothing is remembered, nothing breaks', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readTourSeen()).toBe(false);
    expect(() => writeTourSeen('done')).not.toThrow();

    render(<App />);
    expect(screen.getByRole('button', { name: 'Skip the tour' })).toBeTruthy();
    act(() => useGuideStore.setState({ home: 'closed', tourStep: 0 }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useGuideStore.getState().tourStep).toBe(null);
    // The session still knows, so the home screen no longer pushes the tour.
    expect(useGuideStore.getState().seen).toBe(true);
    act(() => useGuideStore.getState().openHome());
    act(() => useGuideStore.getState().homeShown());
    const home = screen.getByRole('dialog', { name: 'Exowatt: Scaling Deployment' });
    expect(home.querySelector('.home-btn:not(.primary)')?.textContent).toBe('Take the tour');
  });
});

describe('home screen (D90)', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));

  it('opens over the map with the title, and Open the demo leads into the tour the first time', () => {
    render(<App />);
    const home = screen.getByRole('dialog', { name: 'Exowatt: Scaling Deployment' });
    expect(home).toBeTruthy();
    expect(document.querySelector<HTMLElement>('.overlay')!.inert).toBe(true);
    expect(screen.getByRole('button', { name: 'Skip the tour' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Open the demo/ }));
    expect(useGuideStore.getState().home).toBe('closing');
    expect(document.querySelector<HTMLElement>('.overlay')!.inert).toBe(false);
    act(() => vi.advanceTimersByTime(HOME.transitionMs));
    expect(useGuideStore.getState().home).toBe('closed');
    expect(useGuideStore.getState().tourStep).toBe(0);
    expect(screen.getByRole('dialog', { name: STEPS[0].title })).toBeTruthy();
  });

  it('reads title, "Daisy Does It!", the lede and the actions, with the daisy beside them (D130)', () => {
    render(<App />);
    const home = screen.getByRole('dialog', { name: 'Exowatt: Scaling Deployment' });
    const column = home.querySelector('.home-column')!;
    expect([...column.children].map((el) => el.className)).toEqual([
      'home-title',
      'home-sub',
      'home-lede',
      'home-actions',
    ]);
    expect(home.querySelector('.home-sub')!.textContent).toBe('Daisy Does It!');
    // The copy the captain asked to drop stays gone.
    for (const gone of [
      'Interactive demo',
      'Two tabs',
      'A short tour shows you around first.',
      'Reopen this page',
    ]) {
      expect(home.textContent).not.toContain(gone);
    }
    // The daisy: decorative, five outlined petals and a center, nothing behind them.
    const daisy = home.querySelector('.home-art svg.daisy')!;
    expect(daisy.getAttribute('aria-hidden')).toBe('true');
    expect(daisy.querySelectorAll('ellipse.daisy-petal')).toHaveLength(5);
    expect(daisy.querySelectorAll('circle.daisy-center')).toHaveLength(1);
    expect(daisy.querySelectorAll('rect, image')).toHaveLength(0);
    // One group turns the whole flower about its center; the lede explains the name.
    expect(daisy.querySelectorAll('g.daisy-spin ellipse.daisy-petal')).toHaveLength(5);
    expect(daisy.querySelectorAll('g.daisy-spin circle.daisy-center')).toHaveLength(1);
    expect(home.querySelector('.home-lede')!.textContent).toContain('daisy-chained');
  });

  it('credits the site by its bare domain on the home screen and the map, in a new tab (D130)', () => {
    expect(UI.credit).toEqual({
      label: 'alexanderyevchenko.com',
      url: 'https://alexanderyevchenko.com',
    });
    render(<App />);
    const links = screen.getAllByRole('link', { name: 'alexanderyevchenko.com', hidden: true });
    expect(links.map((a) => a.closest('.home-foot, .dock-bottom')?.className)).toEqual([
      'dock dock-bottom',
      'home-foot',
    ]);
    for (const a of links) {
      expect(a.textContent).toBe('alexanderyevchenko.com');
      expect(a.getAttribute('href')).toBe('https://alexanderyevchenko.com');
      expect(a.getAttribute('target')).toBe('_blank');
      expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    }
    expect(document.body.textContent).not.toMatch(/by Alexander/i);
  });

  it('Skip the tour goes straight to the map and is remembered', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip the tour' }));
    act(() => vi.advanceTimersByTime(HOME.transitionMs));
    expect(useGuideStore.getState().tourStep).toBe(null);
    expect(window.localStorage.getItem(TOUR.storageKey)).toBe('skipped');
  });

  it('for a returning viewer, Open the demo goes straight in and Take the tour stays offered', () => {
    window.localStorage.setItem(TOUR.storageKey, 'done');
    useGuideStore.setState({ seen: readTourSeen() });
    render(<App />);
    expect(screen.queryByRole('button', { name: 'Skip the tour' })).toBe(null);
    const take = screen.getAllByRole('button', { name: 'Take the tour' });
    expect(take.length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Open the demo/ }));
    act(() => vi.advanceTimersByTime(HOME.transitionMs));
    expect(useGuideStore.getState().tourStep).toBe(null);
  });

  it('the brand chip reopens it, and Escape leaves it', () => {
    useGuideStore.setState({ home: 'closed' });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Exowatt: Scaling Deployment: home/ }));
    expect(useGuideStore.getState().home).toBe('opening');
    act(() => useGuideStore.getState().homeShown());
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useGuideStore.getState().home).toBe('closing');
  });

  it('respects reduced motion: a short crossfade', () => {
    reduced = true;
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip the tour' }));
    act(() => vi.advanceTimersByTime(HOME.reducedTransitionMs));
    expect(useGuideStore.getState().home).toBe('closed');
  });
});

describe('tour geometry (D92)', () => {
  const hole = (left: number, top: number, width: number, height: number) => ({
    left,
    top,
    width,
    height,
    radius: 8,
  });

  it('puts the callout under a target in the top row, right of a left panel, above the player', () => {
    const w = 320;
    const h = 200;
    const tabs = hole(530, 14, 220, 52);
    expect(placeCallout(tabs, [tabs], w, h, 1280, 720).side).toBe('below');
    const panel = hole(10, 220, 330, 230);
    expect(placeCallout(panel, [panel], w, h, 1280, 720).side).toBe('right');
    const play = hole(370, 636, 46, 46);
    expect(placeCallout(play, [play], w, h, 1280, 720).side).toBe('above');
  });

  it('keeps the callout off every hole and inside the window', () => {
    const map = hole(340, 76, 600, 472);
    const legend = hole(1058, 448, 212, 262);
    const spot = placeCallout(map, [map, legend], 320, 300, 1280, 720);
    expect(spot.left + 320).toBeLessThanOrEqual(map.left + TOUR.calloutGapPx);
    expect(spot.left).toBeGreaterThanOrEqual(TOUR.edgePx);
    expect(placeCallout(null, [], 320, 300, 1280, 720).side).toBe('center');
  });

  it('cuts every hole out of the dim, and merges neighbors into one', () => {
    const a = hole(10, 10, 100, 40);
    const b = hole(120, 10, 40, 40);
    expect(dimPath(1280, 720, [a, b]).match(/M/g)).toHaveLength(3);
    expect(mergeHoles([a, b])).toEqual([{ left: 10, top: 10, width: 150, height: 40, radius: 8 }]);
  });
});

describe('player commands (D94)', () => {
  it('a request jumps the mounted player to "Your turn"; earlier requests do not count', () => {
    act(() => usePlayerCommands.getState().requestYourTurn());
    const steps = [
      { id: 'a', label: 'A', caption: 'a', durationS: 4 },
      { id: 'turn', label: 'Your turn', caption: 'turn', durationS: Infinity },
    ];
    const { result } = renderHook(() => usePlayer(steps, { keyboard: false }));
    expect(result.current.stepIndex).toBe(0);
    act(() => usePlayerCommands.getState().requestYourTurn());
    expect(result.current.stepIndex).toBe(1);
  });
});
