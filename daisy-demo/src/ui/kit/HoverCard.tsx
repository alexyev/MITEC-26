// Hover card (spec 6.6): 14 px from the pointer, never over the pointer, 8 px inside the map, and never over a
// panel: of the four corners around the pointer it takes the first that clears every panel, else the one that
// covers the least of them. A title, a subtitle, rows with inline bars, and what a click does. No controls.
import { useLayoutEffect, useRef } from 'react';
import { UI } from '../../config/defaults';
import { DockPortal } from './dock';
import { InlineBar } from './InlineBar';
import type { HoverCardProps } from './types';

/** A rectangle in map pixels. */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The floating UI a hover card must not cover: panels, the top row and the map tools. */
const AVOID = '.panel, .brand, .top-center .segmented, .cost-chip, .map-tools';

function overlap(a: Box, b: Box): number {
  const w = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
  const h = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * Top-left corner of a `w` x `h` card for a pointer at (x, y) inside a `bw` x `bh` map, clear of `avoid`.
 * Preference order: right and below, left and below, right and above, left and above.
 */
export function placeHoverCard(
  x: number,
  y: number,
  w: number,
  h: number,
  bw: number,
  bh: number,
  avoid: readonly Box[] = [],
): { left: number; top: number } {
  const { offsetPx: o, edgePx: e } = UI.hoverCard;
  const clampX = (left: number) => Math.max(e, Math.min(left, bw - e - w));
  const clampY = (top: number) => Math.max(e, Math.min(top, bh - e - h));
  const right = x + o;
  const left = x - o - w;
  const below = y + o;
  const above = y - o - h;
  // A side that runs past the map edge is only used when the other side does not fit either.
  const xs = right + w > bw - e && left >= e ? [left, right] : [right, left];
  const ys = below + h > bh - e && above >= e ? [above, below] : [below, above];
  let best = { left: clampX(xs[0]), top: clampY(ys[0]) };
  let bestCover = Infinity;
  for (const top of ys) {
    for (const lx of xs) {
      const cand = { left: clampX(lx), top: clampY(top) };
      const box = { ...cand, width: w, height: h };
      const cover = avoid.reduce((n, a) => n + overlap(box, a), 0);
      if (cover < bestCover) {
        best = cand;
        bestCover = cover;
        if (cover === 0) return best;
      }
    }
  }
  return best;
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
    const origin = parent?.getBoundingClientRect() ?? { left: 0, top: 0 };
    const avoid: Box[] = [];
    for (const node of document.querySelectorAll(AVOID)) {
      const r = node.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        avoid.push({
          left: r.left - origin.left,
          top: r.top - origin.top,
          width: r.width,
          height: r.height,
        });
      }
    }
    const { left, top } = placeHoverCard(x, y, el.offsetWidth, el.offsetHeight, bw, bh, avoid);
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
