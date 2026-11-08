// Shared player contract (spec 13.1): the walkthrough steps of a tab and the clock that plays them.
// src/ui/player: usePlayer(steps): Player · <PlayerBar player steps /> · <StepList player steps />

export interface WalkStep { id: string; label: string; caption: string; durationS: number } // Infinity for "Your turn"
export interface Player {
  t: number; playing: boolean; stepIndex: number;
  play(): void; pause(): void; seek(t: number): void; stepBy(d: 1 | -1): void; restart(): void;
  toYourTurn(): void; // called on user input; pauses and jumps to the last step
}
