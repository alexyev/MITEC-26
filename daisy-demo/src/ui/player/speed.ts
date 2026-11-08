// Playback speed (captain's request): one setting for both tabs, so it persists while switching tabs.
// 1 is the designed pace of the walkthroughs; the player clock multiplies its frame time by the speed.
import { create } from 'zustand';
import { UI } from '../../config/defaults';

interface SpeedState {
  speed: number;
  setSpeed: (speed: number) => void;
}

export const usePlaybackSpeed = create<SpeedState>((set) => ({
  speed: UI.player.speeds[0],
  setSpeed: (speed) => set({ speed }),
}));

/** The speed as the player bar labels it: "1×", "2×", "4×". */
export function speedLabel(speed: number): string {
  return `${speed}×`;
}
