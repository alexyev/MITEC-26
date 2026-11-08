// The app starts with every panel folded into its chip (D160). Tests that read what the panels hold open
// them all first, as a viewer would by clicking each chip.
import { PANEL_IDS, usePanelStore, type PanelsOpen } from '../src/state/panels';

export function openAllPanels(): void {
  const all = () => Object.fromEntries(PANEL_IDS.map((id) => [id, id !== 'cost'])) as PanelsOpen;
  usePanelStore.setState({ open: { survey: all(), build: all() } });
}
