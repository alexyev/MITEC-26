// Playback speed (captain's request): one setting for both tabs, so it persists while switching tabs.
// 1 is the designed pace of the walkthroughs; the player clock multiplies its frame time by the speed.
import { create } from 'zustand';
import { UI } from '../../config/defaults';

interface SpeedState {
  speed: number;
  setSpeed: (speed: number) => void;
}

export const usePlaybackSpeed = create<SpeedState>((set) => ({
  speed: UI.player.normalSpeed,
  setSpeed: (speed) => set({ speed }),
}));

/** Labels of the slower speeds: vulgar fractions keep the control as compact as "2×". */
const FRACTIONS: Record<number, string> = { 0.25: '¼', 0.5: '½' };

/** The speed as the player bar labels it: "¼×", "½×", "1×", "2×", "4×". */
export function speedLabel(speed: number): string {
  return `${FRACTIONS[speed] ?? speed}×`;
}

/** The speed's tooltip: "1× · normal speed", "½× · slower", "2× · faster". */
export function speedTitle(speed: number): string {
  const pace =
    speed === UI.player.normalSpeed
      ? 'normal speed'
      : speed < UI.player.normalSpeed
        ? 'slower'
        : 'faster';
  return `${speed}× · ${pace}`;
}
