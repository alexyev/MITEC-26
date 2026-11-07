// Zustand store for UI state. T1.3 holds the selected build day; engine state arrives with the worker (T2.5).
import { create } from 'zustand';
import { UI } from '../config/defaults';

interface UiState {
  buildDay: number;
  setBuildDay: (day: number) => void;
}

export const useUiStore = create<UiState>((set) => ({
  buildDay: UI.initialBuildDay,
  setBuildDay: (buildDay) => set({ buildDay }),
}));
