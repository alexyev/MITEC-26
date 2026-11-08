// Hover card (spec 6.6): 14 px right of and below the pointer, flipped to stay 8 px inside the map, so it
// never covers the pointer; a title, a subtitle, rows with inline bars, and what a click does. No controls.
import { useLayoutEffect, useRef } from 'react';
import { UI } from '../../config/defaults';
import { DockPortal } from './dock';
import { InlineBar } from './InlineBar';
import type { HoverCardProps } from './types';

/** Top-left corner of a `w` x `h` card for a pointer at (x, y) inside a `bw` x `bh` map. */
export function placeHoverCard(
  x: number,
  y: number,
  w: number,
  h: number,
  bw: number,
  bh: number,
): { left: number; top: number } {
  const { offsetPx: o, edgePx: e } = UI.hoverCard;
  let left = x + o;
  let top = y + o;
  if (left + w > bw - e) left = x - o - w;
  if (top + h > bh - e) top = y - o - h;
  return { left: Math.max(e, left), top: Math.max(e, top) };
}

export function HoverCard(props: HoverCardProps) {
  // The body mounts with the portal, so it is measured and placed as soon as the float slot exists.
  return (
    <DockPortal slot="float">
      <HoverCardBody {...props} />
    </DockPortal>
  );
}

function HoverCardBody({ x, y, title, subtitle, rows, hint }: HoverCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Place the card before paint, from its measured size; no extra React render.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const parent = el.offsetParent as HTMLElement | null;
    const bw = parent?.clientWidth || window.innerWidth;
    const bh = parent?.clientHeight || window.innerHeight;
    const { left, top } = placeHoverCard(x, y, el.offsetWidth, el.offsetHeight, bw, bh);
    el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  });

  return (
    <div className="hover-card" ref={ref} role="tooltip">
      <div className="hover-card-title">{title}</div>
      <div className="hover-card-subtitle">{subtitle}</div>
      {rows.length > 0 ? (
        <div className="hover-card-rows">
          {rows.map((r) => (
            <div className="hover-card-row" key={r.label}>
              <span className="hover-card-label">{r.label}</span>
              {r.pct !== undefined && r.token ? (
                <InlineBar pct={r.pct} token={r.token} />
              ) : (
                <span />
              )}
              <span className="hover-card-value num">{r.value}</span>
            </div>
          ))}
        </div>
      ) : null}
      {hint ? <div className="hover-card-hint">{hint}</div> : null}
    </div>
  );
}
