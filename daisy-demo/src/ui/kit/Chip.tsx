// Chip (spec 6.5): 11 px uppercase on a hairline pill, for small badges.
import type { ChipProps } from './types';

export function Chip({ text, title }: ChipProps) {
  return (
    <span className="chip" title={title}>
      {text}
    </span>
  );
}
