// State of the home screen and the guided tour (D90, D91, D92). The home screen opens on every load over the
// already-loaded map; the tour runs on the live app. Whether the viewer finished or skipped the tour is kept
// per viewer in localStorage, and the app works the same when storage is missing or throws.
import { create } from 'zustand';
import { TOUR } from '../config/tour';

export type TourOutcome = 'done' | 'skipped';

/** True when this viewer finished or skipped the tour before; false when unknown or storage fails. */
export function readTourSeen(): boolean {
  try {
    const v = window.localStorage.getItem(TOUR.storageKey);
    return v === 'done' || v === 'skipped';
  } catch {
    return false;
  }
}

/** Remember the tour's outcome for this viewer; a storage failure only loses the memory, never the app. */
export function writeTourSeen(outcome: TourOutcome): void {
  try {
    window.localStorage.setItem(TOUR.storageKey, outcome);
  } catch {
    // Private windows and blocked storage: the outcome is still kept for this session in the store.
  }
}

/**
 * The home screen's phase: `open`, `closing` while it gives way to the map, `opening` for the frame before
 * it fades back in from the brand chip, and `closed`.
 */
export type HomePhase = 'open' | 'closing' | 'opening' | 'closed';

interface GuideState {
  home: HomePhase;
  /** What follows the home screen once it has given way: the map alone or the tour. */
  afterHome: 'map' | 'tour';
  /** Index of the tour step on screen, or null when the tour is not running. */
  tourStep: number | null;
  /** The viewer finished or skipped the tour, this session or before. */
  seen: boolean;
  /** Leave the home screen; `tour` starts the tour once the map is in focus. */
  leaveHome: (next: 'map' | 'tour') => void;
  /** The leaving transition has ended. */
  homeLeft: () => void;
  /** Reopen the home screen over the map (the brand chip); ends a running tour. */
  openHome: () => void;
  /** The reopening frame has painted; fade in. */
  homeShown: () => void;
  startTour: () => void;
  goToStep: (index: number) => void;
  endTour: (outcome: TourOutcome) => void;
}

export const useGuideStore = create<GuideState>((set, get) => ({
  home: 'open',
  afterHome: 'map',
  tourStep: null,
  seen: readTourSeen(),
  leaveHome: (next) => {
    if (get().home !== 'open') return;
    set({ home: 'closing', afterHome: next });
  },
  homeLeft: () => {
    if (get().home !== 'closing') return;
    set((s) => ({ home: 'closed', tourStep: s.afterHome === 'tour' ? 0 : null }));
  },
  openHome: () => {
    if (get().home === 'open' || get().home === 'opening') return;
    set({ home: 'opening', tourStep: null });
  },
  homeShown: () => {
    if (get().home === 'opening') set({ home: 'open' });
  },
  startTour: () => set({ tourStep: 0 }),
  goToStep: (index) => set({ tourStep: index }),
  endTour: (outcome) => {
    writeTourSeen(outcome);
    set({ tourStep: null, seen: true });
  },
}));

/** Skip the tour from the home screen: remembered like a skip from inside it. */
export function skipTourFromHome(): void {
  writeTourSeen('skipped');
  useGuideStore.setState({ seen: true });
  useGuideStore.getState().leaveHome('map');
}
