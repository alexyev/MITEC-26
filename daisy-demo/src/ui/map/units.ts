// Unit layer: every visible unit drawn at screen resolution, at least `minPx` across, into a cache canvas that
// is redrawn only when the view or the unit states change (decision D35). Units are colored by state.
import type { SiteModel } from '../../state/model';

export interface UnitColors {
  planned: string;
  placed: string;
  commissioned: string;
}

/** World meters to target pixels: x right, y down from `oy`. */
export interface PixelTransform {
  scale: number;
  ox: number;
  oy: number;
}

/**
 * Draw the units of every state with one path per state. Each unit is at least `minPx` wide and tall, so a
 * 2.44 m unit stays a visible line when the whole site is on screen. Planned units are thin outlines once
 * they are at least `outlineFromPx` in both directions; below that an outline would cover the unit anyway,
 * so they are filled. `visible` limits the pass to a world rectangle.
 */
export function drawUnits(
  ctx: CanvasRenderingContext2D,
  model: SiteModel,
  states: Uint8Array,
  colors: UnitColors,
  toPx: PixelTransform,
  visible: { x0: number; y0: number; x1: number; y1: number },
  minPx: number,
  outlineFromPx: number,
): void {
  const { site, unitW, unitH } = model;
  const { scale, ox, oy } = toPx;
  const w = Math.max(minPx, unitW * scale);
  const h = Math.max(minPx, unitH * scale);
  const outline = Math.min(w, h) >= outlineFromPx;
  const paths = [new Path2D(), new Path2D(), new Path2D()];
  const hw = unitW / 2;
  const hh = unitH / 2;
  for (let i = 0; i < site.count; i++) {
    const x = site.centers[2 * i];
    const y = site.centers[2 * i + 1];
    if (x + hw < visible.x0 || x - hw > visible.x1 || y + hh < visible.y0 || y - hh > visible.y1)
      continue;
    paths[states[i]].rect(ox + x * scale - w / 2, oy - y * scale - h / 2, w, h);
  }
  if (outline) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = colors.planned;
    ctx.stroke(paths[0]);
  } else {
    ctx.fillStyle = colors.planned;
    ctx.fill(paths[0]);
  }
  ctx.fillStyle = colors.placed;
  ctx.fill(paths[1]);
  ctx.fillStyle = colors.commissioned;
  ctx.fill(paths[2]);
}
