// Which floating panels are open, per tab (D160). Every panel starts folded into its chip, so the viewer lands
// on a clean map; a chip opens its panel. The state lives here rather than in each panel because the tabs
// unmount when the viewer switches away (each keeps its own panels as it left them), the guided tour opens
// exactly the panels each step spotlights, and leaving the home screen or ending the tour folds them all again.
import { useCallback } from 'react';
import { create } from 'zustand';
import type { TabId } from './store';

/**
 * controls: the tab's control panel with its step list (top left) · readout: the card at the top right ·
 * legend: the legend at the bottom right · cost: the cost chip's card in the top row.
 */
export type PanelId = 'controls' | 'readout' | 'legend' | 'cost';

export const PANEL_IDS: readonly PanelId[] = ['controls', 'readout', 'legend', 'cost'];

export type PanelsOpen = Record<PanelId, boolean>;

const folded = (): PanelsOpen => ({ controls: false, readout: false, legend: false, cost: false });

const allFolded = (): Record<TabId, PanelsOpen> => ({ survey: folded(), build: folded() });

interface PanelState {
  open: Record<TabId, PanelsOpen>;
  setOpen: (tab: TabId, id: PanelId, open: boolean) => void;
  /** Fold every panel of both tabs into its chip: the clean map. */
  foldAll: () => void;
  /** Open exactly these panels of `tab` and fold every other panel of both tabs (a tour step). */
  showOnly: (tab: TabId, ids: readonly PanelId[]) => void;
}

export const usePanelStore = create<PanelState>((set) => ({
  open: allFolded(),
  setOpen: (tab, id, open) =>
    set((s) =>
      s.open[tab][id] === open ? s : { open: { ...s.open, [tab]: { ...s.open[tab], [id]: open } } },
    ),
  foldAll: () => set({ open: allFolded() }),
  showOnly: (tab, ids) => {
    const open = allFolded();
    for (const id of ids) open[tab][id] = true;
    set({ open });
  },
}));

/** A panel's open state on a tab and its setter, for a `<Panel>` or a cost chip. */
export function usePanelOpen(tab: TabId, id: PanelId): [boolean, (open: boolean) => void] {
  const open = usePanelStore((s) => s.open[tab][id]);
  const setOpen = useCallback(
    (next: boolean) => usePanelStore.getState().setOpen(tab, id, next),
    [tab, id],
  );
  return [open, setOpen];
}

/** Props that bind a `<Panel>` (or the `<Legend>`) to its state in the store. */
export function usePanelFold(
  tab: TabId,
  id: PanelId,
): { minimized: boolean; onMinimize: (minimized: boolean) => void } {
  const [open, setOpen] = usePanelOpen(tab, id);
  const onMinimize = useCallback((minimized: boolean) => setOpen(!minimized), [setOpen]);
  return { minimized: !open, onMinimize };
}
