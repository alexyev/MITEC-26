// Floating glass panel (spec 6.2, 6.3): docks to a corner, and its minimize button folds it into a compact
// chip in the same corner; clicking the chip restores it.
import { useState } from 'react';
import { Minus } from 'lucide-react';
import { DockPortal } from './dock';
import { IconButton } from './IconButton';
import type { PanelProps } from './types';

export function Panel({
  corner,
  title,
  onMinimize,
  chipLabel,
  ariaLabel,
  actions,
  className,
  children,
}: PanelProps) {
  const [minimized, setMinimized] = useState(false);
  const label = chipLabel ?? title;
  const toggle = (next: boolean) => {
    setMinimized(next);
    onMinimize?.(next);
  };

  if (minimized && label) {
    return (
      <DockPortal slot={corner}>
        <button
          type="button"
          className={`panel-chip corner-${corner}`}
          onClick={() => toggle(false)}
          aria-label={`Show ${label}`}
          aria-expanded="false"
        >
          {label}
        </button>
      </DockPortal>
    );
  }

  return (
    <DockPortal slot={corner}>
      <section
        className={['panel', `corner-${corner}`, className].filter(Boolean).join(' ')}
        aria-label={title ?? ariaLabel}
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
