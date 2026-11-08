// Requests to the mounted tab's player from outside the tab (D94): the guided tour moves the walkthrough to
// "Your turn" so the viewer can click a radio. A request is a counter; the player acts on each increase.
import { create } from 'zustand';

interface PlayerCommands {
  /** Incremented by every request to jump to "Your turn". */
  yourTurn: number;
  requestYourTurn: () => void;
}

export const usePlayerCommands = create<PlayerCommands>((set) => ({
  yourTurn: 0,
  requestYourTurn: () => set((s) => ({ yourTurn: s.yourTurn + 1 })),
}));
