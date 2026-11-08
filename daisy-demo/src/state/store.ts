// Shell state (spec 13.1): only the active tab. Each tab keeps its own state in its own store file.
import { create } from 'zustand';

export type TabId = 'survey' | 'build';

export const TABS: { value: TabId; label: string }[] = [
  { value: 'survey', label: 'Survey' },
  { value: 'build', label: 'Build & failure' },
];

interface ShellState {
  tab: TabId;
  setTab: (tab: TabId) => void;
}

/** Survey opens first (spec 0.3). */
export const useShellStore = create<ShellState>((set) => ({
  tab: 'survey',
  setTab: (tab) => set({ tab }),
}));
