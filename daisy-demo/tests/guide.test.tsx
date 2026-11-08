// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UI } from '../src/config/defaults';
import { HOME, TOUR, tourStepPanels, tourSteps } from '../src/config/tour';
import { useBuildStore } from '../src/state/build';
import { readTourSeen, useGuideStore, writeTourSeen } from '../src/state/guide';
import { PANEL_IDS, usePanelStore, type PanelId } from '../src/state/panels';
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
  usePanelStore.getState().foldAll();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The panels of a tab that are open, by the store. */
const openPanels = (tab: 'survey' | 'build') =>
  PANEL_IDS.filter((id) => usePanelStore.getState().open[tab][id]);

/** What the viewer sees: the panels on screen (the player bar is not one that folds) and the folded chips. */
function onScreen() {
  return {
    panels: Array.from(document.querySelectorAll('section.panel:not(.player)'), (el) =>
      el.getAttribute('aria-label'),
    ),
    chips: Array.from(document.querySelectorAll('.panel-chip'), (el) =>
      el.getAttribute('aria-label'),
    ),
  };
}

/** Every panel of both tabs is folded, and the tab on screen shows only its chips. */
function expectAllFolded() {
  expect(openPanels('survey')).toEqual([]);
  expect(openPanels('build')).toEqual([]);
  const { panels, chips } = onScreen();
  expect(panels).toEqual([]);
  expect(chips).toEqual(
    useShellStore.getState().tab === 'survey'
      ? ['Show Controls & steps', 'Show Full site', 'Show Legend']
      : ['Show Controls & steps', 'Show Readout', 'Show Legend'],
  );
  expect(document.querySelector('[data-tour="cost-card"]')).toBe(null);
}

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
      f.failed,
      f.handover,
      `radio ${f.cornerRadio}'s corner module in 3D`,
      `${f.buildStages} stages`,
      `${f.radios} radios`,
      `${f.failedHops} hops`,
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

  it("every step's targets are on screen as it shows: it opens exactly the panels holding them (D160)", () => {
    renderTourAt(0);
    for (let i = 0; i < STEPS.length; i++) {
      const step = STEPS[i];
      act(() => useGuideStore.getState().goToStep(i));
      expect(useShellStore.getState().tab, step.id).toBe(step.tab);
      for (const target of [...step.targets, ...(step.anchor ? [step.anchor] : [])]) {
        const el = document.querySelector(`[data-tour="${target}"]`);
        expect(el, `${step.id}: ${target}`).not.toBe(null);
        // The target itself, not the chip of its folded panel.
        expect(el!.matches('.panel-chip'), `${step.id}: ${target} folded`).toBe(false);
      }
      expect(openPanels(step.tab).sort(), step.id).toEqual(tourStepPanels(step).sort());
      expect(openPanels(step.tab === 'survey' ? 'build' : 'survey'), step.id).toEqual([]);
    }
  });

  it('opens the panels the copy talks about, and leaves the rest folded', () => {
    const panelsOf = (id: string) => tourStepPanels(STEPS[indexOf(id)]);
    expect(panelsOf('tabs')).toEqual([]);
    expect(panelsOf('map')).toEqual<PanelId[]>(['legend']);
    expect(panelsOf('play')).toEqual([]);
    expect(panelsOf('steps')).toEqual<PanelId[]>(['controls']);
    expect(panelsOf('fleet')).toEqual<PanelId[]>(['controls']);
    expect(panelsOf('cost')).toEqual<PanelId[]>(['cost']);
    expect(panelsOf('story')).toEqual<PanelId[]>(['controls']);
    expect(panelsOf('hover')).toEqual([]);
    expect(panelsOf('your-turn')).toEqual<PanelId[]>(['controls']);
    expect(panelsOf('replay')).toEqual([]);
  });

  it('a click in the callout leaves the cost card it spotlights open', () => {
    renderTourAt(indexOf('cost'));
    expect(document.querySelector('[data-tour="cost-card"]')).not.toBe(null);
    fireEvent.pointerDown(screen.getByRole('dialog', { name: 'What it costs' }));
    expect(document.querySelector('[data-tour="cost-card"]')).not.toBe(null);
    // A click on the map still closes it, as it does outside the tour.
    fireEvent.pointerDown(document.querySelector('.stage')!);
    expect(document.querySelector('[data-tour="cost-card"]')).toBe(null);
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
    const home = screen.getByRole('dialog', { name: 'Exowatt: Daisy Does It' });
    expect(home.querySelector('.home-btn:not(.primary)')?.textContent).toBe('Take the tour');
  });
});

describe('home screen (D90)', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));

  it('opens over the map with the title, and Open the demo leads into the tour the first time', () => {
    render(<App />);
    const home = screen.getByRole('dialog', { name: 'Exowatt: Daisy Does It' });
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

  it('reads the title, the lede and the actions, with the daisy beside them (D130, D131)', () => {
    render(<App />);
    const home = screen.getByRole('dialog', { name: 'Exowatt: Daisy Does It' });
    const column = home.querySelector('.home-column')!;
    expect([...column.children].map((el) => el.className)).toEqual([
      'home-title',
      'home-lede',
      'home-actions',
    ]);
    expect(home.querySelector('.home-sub')).toBeNull();
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
    const daisy = home.querySelector('.home-art > svg.daisy')!;
    expect(daisy.getAttribute('aria-hidden')).toBe('true');
    expect(daisy.querySelectorAll('ellipse.daisy-petal')).toHaveLength(5);
    expect(daisy.querySelectorAll('circle.daisy-center')).toHaveLength(1);
    expect(daisy.querySelectorAll('rect, image')).toHaveLength(0);
    // One group turns the whole flower about its center; the lede explains the name.
    expect(daisy.querySelectorAll('g.daisy-spin ellipse.daisy-petal')).toHaveLength(5);
    expect(daisy.querySelectorAll('g.daisy-spin circle.daisy-center')).toHaveLength(1);
    expect(home.querySelector('.home-lede')!.textContent).toContain('daisy-chained');
    // A handful of mini daisies bloom around it and fade: decorative, the same drawing, no layout of their own.
    const minis = home.querySelectorAll('.daisy-burst[aria-hidden="true"] svg.daisy-mini');
    expect(minis.length).toBeGreaterThanOrEqual(6);
    expect(minis.length).toBeLessThanOrEqual(10);
    expect(minis[0].querySelectorAll('ellipse.daisy-petal')).toHaveLength(5);
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
    fireEvent.click(screen.getByRole('button', { name: /Exowatt: Daisy Does It: home/ }));
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

describe('panels start folded (D160)', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));

  const leaveHome = (button: RegExp | string) => {
    fireEvent.click(screen.getByRole('button', { name: button }));
    act(() => vi.advanceTimersByTime(HOME.transitionMs));
  };

  it('after Open the demo, for a viewer who has seen the tour', () => {
    window.localStorage.setItem(TOUR.storageKey, 'done');
    useGuideStore.setState({ seen: readTourSeen() });
    render(<App />);
    leaveHome(/Open the demo/);
    expect(useGuideStore.getState().tourStep).toBe(null);
    expectAllFolded();
    // The tab switch, the player with Play and speed, the brand and the cost chip stay on screen.
    for (const target of ['tabs', 'play', 'speed', 'brand', 'tour', 'cost']) {
      expect(document.querySelector(`[data-tour="${target}"]`), target).not.toBe(null);
    }
  });

  it('after Skip the tour', () => {
    render(<App />);
    leaveHome('Skip the tour');
    expectAllFolded();
  });

  it('when the tour finishes, is skipped or is exited, whatever the viewer opened during it', () => {
    render(<App />);
    leaveHome(/Open the demo/);
    expect(useGuideStore.getState().tourStep).toBe(0);
    expectAllFolded();

    act(() => useGuideStore.getState().goToStep(indexOf('your-turn')));
    expect(onScreen().panels).toEqual(['Build & failure']);
    fireEvent.click(screen.getByRole('button', { name: 'Show Legend' }));
    act(() => useGuideStore.getState().goToStep(STEPS.length - 1));
    fireEvent.click(screen.getByRole('button', { name: 'Show Readout' }));
    expect(onScreen().panels).toEqual(['Readout']);
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(useGuideStore.getState().tourStep).toBe(null);
    expectAllFolded();

    // Skip tour and Escape, from a step with panels open.
    for (const exit of ['skip', 'escape'] as const) {
      act(() => useGuideStore.getState().startTour());
      act(() => useGuideStore.getState().goToStep(indexOf('fleet')));
      expect(openPanels('survey')).toEqual(['controls']);
      if (exit === 'skip') fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }));
      else fireEvent.keyDown(window, { key: 'Escape' });
      expect(useGuideStore.getState().tourStep, exit).toBe(null);
      expectAllFolded();
    }
  });

  it('a chip opens its panel, and it stays open while the viewer works, Play included', () => {
    useGuideStore.setState({ home: 'closed', seen: true });
    render(<App />);
    expectAllFolded();
    const chip = screen.getByRole('button', { name: 'Show Controls & steps' });
    expect(chip.getAttribute('aria-expanded')).toBe('false');
    expect(chip.textContent).toBe('Controls & steps');
    // An icon names the panel and a chevron shows it opens; both are decoration.
    expect(chip.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(2);
    fireEvent.click(chip);
    expect(onScreen().panels).toEqual(['Survey']);
    // Starting the walkthrough opens nothing else and folds nothing.
    fireEvent.click(document.querySelector('[data-tour="play"]')!);
    expect(onScreen().panels).toEqual(['Survey']);
    expect(openPanels('survey')).toEqual(['controls']);
    // The minimize button folds it back.
    fireEvent.click(screen.getByRole('button', { name: 'Minimize Controls & steps' }));
    expectAllFolded();
  });

  it('each tab keeps its own open and folded panels across a switch', () => {
    useGuideStore.setState({ home: 'closed', seen: true });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Show Legend' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Build & failure' }));
    expect(onScreen().panels).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Show Controls & steps' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show Readout' }));
    expect(onScreen().panels).toEqual(['Build & failure', 'Readout']);

    fireEvent.click(screen.getByRole('radio', { name: 'Survey' }));
    expect(onScreen().panels).toEqual(['Legend']);
    fireEvent.click(screen.getByRole('radio', { name: 'Build & failure' }));
    expect(onScreen().panels).toEqual(['Build & failure', 'Readout']);
    expect(openPanels('survey')).toEqual(['legend']);
    expect(openPanels('build')).toEqual(['controls', 'readout']);
  });

  it('replaying the tour or reopening the home screen comes back to the clean map', () => {
    useGuideStore.setState({ home: 'closed', seen: true });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Show Legend' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show Full site' }));
    fireEvent.click(screen.getByRole('button', { name: 'Take the tour' }));
    // The tour starts on the clean map, and its first step spotlights the tabs only.
    expect(onScreen().panels).toEqual([]);
    fireEvent.keyDown(window, { key: 'Escape' });
    expectAllFolded();

    fireEvent.click(screen.getByRole('button', { name: 'Show Controls & steps' }));
    fireEvent.click(screen.getByRole('button', { name: /Exowatt: Daisy Does It: home/ }));
    act(() => useGuideStore.getState().homeShown());
    fireEvent.keyDown(window, { key: 'Escape' });
    act(() => vi.advanceTimersByTime(HOME.transitionMs));
    expect(useGuideStore.getState().home).toBe('closed');
    expectAllFolded();
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
