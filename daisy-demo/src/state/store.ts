// Zustand store for UI state. Phase 0 holds only the selected bottom tab; engine state arrives with the worker (T2.5).
import { create } from 'zustand';

export const BOTTOM_TABS = [
  'Failure curve',
  'Cost vs range',
  'Edge over time',
  'Compare A/B',
] as const;
export type BottomTab = (typeof BOTTOM_TABS)[number];

interface UiState {
  bottomTab: BottomTab;
  setBottomTab: (tab: BottomTab) => void;
}

export const useUiStore = create<UiState>((set) => ({
  bottomTab: BOTTOM_TABS[0],
  setBottomTab: (bottomTab) => set({ bottomTab }),
}));
