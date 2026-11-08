// Segmented control (spec 6.5): a pill track with a raised selected segment, 32 px high.
// A radio group: Tab focuses the selected segment, Left and Right move the selection.
import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { SegmentedProps } from './types';

export function Segmented<V extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedProps<V>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const d =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0;
    if (!d) return;
    // Keep the arrows inside the group, so the player does not step.
    e.preventDefault();
    e.stopPropagation();
    const next = (current + d + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div className="segmented" role="radiogroup" aria-label={ariaLabel} onKeyDown={onKeyDown}>
      {options.map((o, i) => {
        const selected = i === current;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            className={selected ? 'segment selected' : 'segment'}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
