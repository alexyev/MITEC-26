// Floating glass panel (spec 6.2, 6.3): docks to a corner, and its minimize button folds it into a compact
// chip in the same corner; clicking the chip restores it. The chip reads as something that opens (D161): the
// panel's icon, its name, and a chevron pointing the way the panel opens. Pass `minimized` to control the
// state from outside (the app keeps it per tab, D160); without it the panel keeps its own, starting open.
import { useState } from 'react';
import { ChevronDown, ChevronUp, Minus } from 'lucide-react';
import { UI } from '../../config/defaults';
import { DockPortal } from './dock';
import { IconButton } from './IconButton';
import type { PanelProps } from './types';

export function Panel({
  corner,
  title,
  minimized: controlled,
  onMinimize,
  chipLabel,
  chipIcon: ChipIcon,
  ariaLabel,
  actions,
  className,
  'data-tour': tour,
  children,
}: PanelProps) {
  const [own, setOwn] = useState(false);
  const minimized = controlled ?? own;
  const label = chipLabel ?? title;
  const toggle = (next: boolean) => {
    setOwn(next);
    onMinimize?.(next);
  };

  if (minimized && label) {
    // A bottom panel opens upward, the others downward.
    const Chevron = corner === 'br' ? ChevronUp : ChevronDown;
    return (
      <DockPortal slot={corner}>
        <button
          type="button"
          className={`panel-chip corner-${corner}`}
          onClick={() => toggle(false)}
          aria-label={`Show ${label}`}
          aria-expanded="false"
          title={`Show ${label}`}
          data-tour={tour}
        >
          {ChipIcon ? (
            <ChipIcon
              className="panel-chip-icon"
              size={UI.icon.sizePx}
              strokeWidth={UI.icon.strokeWidth}
              aria-hidden="true"
            />
          ) : null}
          <span className="panel-chip-label">{label}</span>
          <Chevron
            className="panel-chip-chevron"
            size={UI.icon.sizePx}
            strokeWidth={UI.icon.strokeWidth}
            aria-hidden="true"
          />
        </button>
      </DockPortal>
    );
  }

  return (
    <DockPortal slot={corner}>
      <section
        className={['panel', `corner-${corner}`, className].filter(Boolean).join(' ')}
        aria-label={title ?? ariaLabel}
        data-tour={tour}
      >
        {title || label ? (
          <header className="panel-head">
            {title ? <h2 className="panel-title">{title}</h2> : <span />}
            <span className="panel-actions">
              {actions}
              {label ? (
                <IconButton
                  icon={Minus}
                  label={`Minimize ${label}`}
                  onClick={() => toggle(true)}
                  small
                />
              ) : null}
            </span>
          </header>
        ) : null}
        <div className="panel-body">{children}</div>
      </section>
    </DockPortal>
  );
}
