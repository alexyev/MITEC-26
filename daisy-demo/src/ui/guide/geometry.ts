// Geometry of the guided tour (D92): the spotlight holes around the targets, the dimming path with those
// holes cut out, and where the callout goes so it stays inside the window and clear of every hole.
import { TOUR, TOUR_INSETS, type TourTarget } from '../../config/tour';

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Hole extends Rect {
  radius: number;
}

export type Side = 'right' | 'left' | 'below' | 'above';

/** The first rendered element with this `data-tour` attribute, or null. */
export function findTarget(target: TourTarget, root: ParentNode = document): HTMLElement | null {
  for (const el of root.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

/** The spotlight hole of a target element: its box less any inset, padded, inside the window. */
export function holeFor(target: TourTarget, el: Element, vw: number, vh: number): Hole {
  const r = el.getBoundingClientRect();
  const inset = TOUR_INSETS[target];
  const pad = inset ? 0 : TOUR.holePadPx;
  let left = r.left + (inset?.left ?? 0) - pad;
  let top = r.top + (inset?.top ?? 0) - pad;
  let right = r.right - (inset?.right ?? 0) + pad;
  let bottom = r.bottom - (inset?.bottom ?? 0) + pad;
  left = Math.max(0, left);
  top = Math.max(0, top);
  right = Math.min(vw, Math.max(left, right));
  bottom = Math.min(vh, Math.max(top, bottom));
  const own = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
  const radius = inset ? TOUR.holeRadiusPx : own > 0 ? Math.min(own, 24) + pad : TOUR.holeRadiusPx;
  return { left, top, width: right - left, height: bottom - top, radius };
}

/** One hole around all of `holes`, with the largest corner radius among them. */
export function mergeHoles(holes: readonly Hole[]): Hole[] {
  if (holes.length < 2) return holes.slice();
  const left = Math.min(...holes.map((h) => h.left));
  const top = Math.min(...holes.map((h) => h.top));
  const right = Math.max(...holes.map((h) => h.left + h.width));
  const bottom = Math.max(...holes.map((h) => h.top + h.height));
  const radius = Math.max(...holes.map((h) => h.radius));
  return [{ left, top, width: right - left, height: bottom - top, radius }];
}

/**
 * The rect the callout sits beside: the first hole together with every hole that overlaps it (a chip and the
 * card it opens), so the callout clears them as one.
 */
export function anchorOf(holes: readonly (Hole | null)[]): Hole | null {
  const first = holes.find((h): h is Hole => h !== null);
  if (!first) return null;
  const near = (a: Rect, b: Rect) => overlap(a, b) > 0;
  const group = holes.filter((h): h is Hole => h !== null && (h === first || near(first, h)));
  return mergeHoles(group)[0];
}

function roundedRect({ left: x, top: y, width: w, height: h, radius }: Hole): string {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  return (
    `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}` +
    `A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}` +
    `V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`
  );
}

/** The window with every hole cut out, for an even-odd fill: the dim catches clicks, the holes let them through. */
export function dimPath(vw: number, vh: number, holes: readonly Hole[]): string {
  const visible = holes.filter((h) => h.width > 0 && h.height > 0);
  return `M0 0H${vw}V${vh}H0Z` + visible.map(roundedRect).join('');
}

function overlap(a: Rect, b: Rect): number {
  const w = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
  const h = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * Shares of the window's height: an anchor whose middle is this close to the top is in the top row, this
 * close to the bottom in the player bar's row.
 */
const TOP_BAND = 0.15;
const BOTTOM_BAND = 0.25;

/** The order sides are tried in: away from the screen edge the anchor sits on (the top row, the player). */
export function sideOrder(anchor: Rect, vw: number, vh: number): Side[] {
  const cx = anchor.left + anchor.width / 2;
  const horizontal: Side[] = cx < vw / 2 ? ['right', 'left'] : ['left', 'right'];
  const cy = anchor.top + anchor.height / 2;
  if (cy < vh * TOP_BAND) return ['below', ...horizontal, 'above'];
  if (cy > vh * (1 - BOTTOM_BAND)) return ['above', ...horizontal, 'below'];
  return [...horizontal, 'below', 'above'];
}

/**
 * Top-left corner of a `w` x `h` callout beside `anchor`, inside a `vw` x `vh` window and clear of `holes`.
 * Sides are tried in `sideOrder`; the first that fits and covers no hole wins, else the fitting side that
 * covers the least, else the middle of the window.
 */
export function placeCallout(
  anchor: Rect | null,
  holes: readonly Rect[],
  w: number,
  h: number,
  vw: number,
  vh: number,
): { left: number; top: number; side: Side | 'center' } {
  const { calloutGapPx: gap, edgePx: edge } = TOUR;
  const center = {
    left: Math.max(edge, (vw - w) / 2),
    top: Math.max(edge, (vh - h) / 2),
    side: 'center' as const,
  };
  if (!anchor) return center;
  const clampX = (x: number) => Math.max(edge, Math.min(x, vw - edge - w));
  const clampY = (y: number) => Math.max(edge, Math.min(y, vh - edge - h));
  const cx = anchor.left + anchor.width / 2;
  const cy = anchor.top + anchor.height / 2;
  let best: { left: number; top: number; side: Side } | null = null;
  let bestCover = Infinity;
  for (const side of sideOrder(anchor, vw, vh)) {
    let left: number;
    let top: number;
    let fits: boolean;
    if (side === 'right' || side === 'left') {
      const raw = side === 'right' ? anchor.left + anchor.width + gap : anchor.left - gap - w;
      left = clampX(raw);
      top = clampY(cy - h / 2);
      // Pushed in from the window edge by at most the gap: it may sit closer to its target, not on it.
      fits = Math.abs(left - raw) <= gap && h <= vh - 2 * edge;
    } else {
      const raw = side === 'below' ? anchor.top + anchor.height + gap : anchor.top - gap - h;
      top = clampY(raw);
      left = clampX(cx - w / 2);
      fits = Math.abs(top - raw) <= gap && w <= vw - 2 * edge;
    }
    if (!fits) continue;
    const box = { left, top, width: w, height: h };
    const cover = holes.reduce((n, hole) => n + overlap(box, hole), 0);
    if (cover < bestCover) {
      best = { left, top, side };
      bestCover = cover;
      if (cover === 0) break;
    }
  }
  return best ?? center;
}
