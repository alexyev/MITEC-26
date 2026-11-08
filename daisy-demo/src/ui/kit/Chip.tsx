// Chip (spec 6.5): 11 px uppercase on a hairline pill, for badges such as "Team estimate · not quotes".
import type { ChipProps } from './types';

export function Chip({ text, title }: ChipProps) {
  return (
    <span className="chip" title={title}>
      {text}
    </span>
  );
}
