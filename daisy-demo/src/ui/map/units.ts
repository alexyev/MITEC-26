// Unit layer: a pre-rendered raster of all units for zoomed-out views, and a vector pass over the visible units
// when zoomed in. Both color units by state (not placed: outline, placed: grey, commissioned: orange).
import type { SiteModel } from '../../state/model';

export interface UnitColors {
  planned: string;
  placed: string;
  commissioned: string;
}

export interface RasterLevel {
  canvas: HTMLCanvasElement;
  /** Raster pixels per meter. */
  pxPerM: number;
}

/**
 * Pre-rendered unit layer as a mip pyramid: level 0 at `pxPerM`, every next level at half the resolution.
 * Drawing from the level closest to the screen scale avoids the moire of one large downscale.
 */
export interface UnitRaster {
  levels: RasterLevel[];
}

/** Create the offscreen canvases that cover the whole site, down to about `minPx` pixels wide. */
export function createUnitRaster(model: SiteModel, pxPerM: number, minPx: number): UnitRaster {
  const levels: RasterLevel[] = [];
  for (let r = pxPerM; levels.length === 0 || model.site.widthM * r >= minPx; r /= 2) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(model.site.widthM * r);
    canvas.height = Math.ceil(model.site.heightM * r);
    levels.push({ canvas, pxPerM: r });
  }
  return { levels };
}

/** The smallest level that still has at least `devicePxPerM` resolution (level 0 when none has). */
export function pickLevel(raster: UnitRaster, devicePxPerM: number): RasterLevel {
  let best = raster.levels[0];
  for (const level of raster.levels) if (level.pxPerM >= devicePxPerM) best = level;
  return best;
}

/**
 * Draw the units of every state with one path per state. `toPx` maps world meters to the target pixels;
 * `visible` limits the pass to a world rectangle (all units when omitted).
 */
export function drawUnits(
  ctx: CanvasRenderingContext2D,
  model: SiteModel,
  states: Uint8Array,
  colors: UnitColors,
  toPx: { scale: number; ox: number; oy: number },
  visible?: { x0: number; y0: number; x1: number; y1: number },
): void {
  const { site, unitW, unitH } = model;
  const { scale, ox, oy } = toPx;
  const w = unitW * scale;
  const h = unitH * scale;
  const paths = [new Path2D(), new Path2D(), new Path2D()];
  const hw = unitW / 2;
  const hh = unitH / 2;
  for (let i = 0; i < site.count; i++) {
    const x = site.centers[2 * i];
    const y = site.centers[2 * i + 1];
    if (
      visible &&
      (x + hw < visible.x0 || x - hw > visible.x1 || y + hh < visible.y0 || y - hh > visible.y1)
    )
      continue;
    paths[states[i]].rect(ox + (x - hw) * scale, oy - (y + hh) * scale, w, h);
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = colors.planned;
  ctx.stroke(paths[0]);
  ctx.fillStyle = colors.placed;
  ctx.fill(paths[1]);
  ctx.fillStyle = colors.commissioned;
  ctx.fill(paths[2]);
}

/** Re-render the raster for new unit states: draw level 0, then halve it into each next level. */
export function renderUnitRaster(
  raster: UnitRaster,
  model: SiteModel,
  states: Uint8Array,
  colors: UnitColors,
): void {
  raster.levels.forEach((level, i) => {
    const ctx = level.canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, level.canvas.width, level.canvas.height);
    if (i === 0) {
      drawUnits(ctx, model, states, colors, {
        scale: level.pxPerM,
        ox: 0,
        oy: model.site.heightM * level.pxPerM,
      });
    } else {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(raster.levels[i - 1].canvas, 0, 0, level.canvas.width, level.canvas.height);
    }
  });
}
