// Survey map layers (spec 5, 8): surveyed ground, strip boundaries, the planned paths ahead of each 4x4,
// and the 4x4s with their online dots. Pure drawing from the plan and the survey hour; no state.
import { SURVEY_VIEW } from '../../config/survey';
import { surveyedRects, vehicleAt } from '../../engine/survey';
import type { SurveyLeg, SurveyPlan, VehicleState } from '../../engine/survey';
import { canvasFont, cssVar } from '../kit/tokens';
import type { MapColors } from '../kit/tokens';
import { worldToScreen } from '../map/viewport';
import type { Viewport } from '../map/viewport';

/** Where a 4x4 is drawn, for drawing and hit-testing alike. */
export interface VehicleMarker {
  id: number;
  sx: number;
  sy: number;
  state: VehicleState;
}

/**
 * Screen positions of the 4x4s at `hours`. A 4x4 at the base (before Send and after its return) parks in a
 * row under the base marker, so the fleet reads as a fleet instead of one stacked dot.
 */
export function vehicleMarkers(plan: SurveyPlan, hours: number, view: Viewport): VehicleMarker[] {
  const base = worldToScreen(view, plan.base.x, plan.base.y);
  const n = plan.vehicles.length;
  return plan.vehicles.map((v) => {
    const state = vehicleAt(v, hours);
    if (state.kind === 'base') {
      return {
        id: v.id,
        sx: base.sx + (v.id - (n - 1) / 2) * SURVEY_VIEW.parkedGapPx,
        sy: base.sy + SURVEY_VIEW.parkedBelowPx,
        state,
      };
    }
    const p = worldToScreen(view, state.x, state.y);
    return { id: v.id, sx: p.sx, sy: p.sy, state };
  });
}

/** What the pointer is over: a 4x4 (nearest first), the base, or nothing. */
export type SurveyHit = { kind: 'vehicle'; id: number } | { kind: 'base' } | null;

export function hitTest(
  plan: SurveyPlan,
  markers: VehicleMarker[],
  view: Viewport,
  sx: number,
  sy: number,
): SurveyHit {
  const r = SURVEY_VIEW.hitRadiusPx;
  let best: VehicleMarker | null = null;
  let bestD = r;
  for (const m of markers) {
    const d = Math.hypot(m.sx - sx, m.sy - sy);
    if (d <= bestD) {
      best = m;
      bestD = d;
    }
  }
  if (best) return { kind: 'vehicle', id: best.id };
  const b = worldToScreen(view, plan.base.x, plan.base.y);
  return Math.hypot(b.sx - sx, b.sy - sy) <= r ? { kind: 'base' } : null;
}

/** Surveyed ground: one fill for every pass rectangle of every 4x4 (spec 5.2, `--c-done`). */
export function drawSurveyed(
  ctx: CanvasRenderingContext2D,
  view: Viewport,
  plan: SurveyPlan,
  hours: number,
  colors: MapColors,
): void {
  if (hours <= 0) return;
  ctx.fillStyle = colors.done;
  ctx.beginPath();
  for (const v of plan.vehicles) {
    for (const r of surveyedRects(v, hours)) {
      const a = worldToScreen(view, r.x, r.y + r.h);
      ctx.rect(a.sx, a.sy, r.w * view.scale, r.h * view.scale);
    }
  }
  ctx.fill();
}

/** Strip boundaries in the neutral border color, and a "4x4 #n" label over each strip. */
export function drawStrips(ctx: CanvasRenderingContext2D, view: Viewport, plan: SurveyPlan): void {
  const top = worldToScreen(view, 0, plan.area.y + plan.area.h).sy;
  const bottom = worldToScreen(view, 0, plan.area.y).sy;
  ctx.strokeStyle = cssVar('--border-strong');
  ctx.lineWidth = SURVEY_VIEW.stripLineWidthPx;
  ctx.beginPath();
  for (const v of plan.vehicles.slice(1)) {
    const sx = Math.round(worldToScreen(view, v.strip.x, 0).sx) + 1 / 2;
    ctx.moveTo(sx, top);
    ctx.lineTo(sx, bottom);
  }
  ctx.stroke();

  ctx.font = canvasFont(11, 500);
  ctx.fillStyle = cssVar('--text-3');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  for (const v of plan.vehicles) {
    const cx = worldToScreen(view, v.strip.x + v.strip.w / 2, 0).sx;
    ctx.fillText(`4x4 #${v.id + 1}`, cx, top - SURVEY_VIEW.stripLabelGapPx);
  }
}

function line(
  ctx: CanvasRenderingContext2D,
  view: Viewport,
  x0: number,
  y0: number,
  leg: SurveyLeg,
) {
  const a = worldToScreen(view, x0, y0);
  const b = worldToScreen(view, leg.x1, leg.y1);
  ctx.moveTo(a.sx, a.sy);
  ctx.lineTo(b.sx, b.sy);
}

/**
 * The planned path still ahead of each 4x4, dashed amber (spec 8.1): the drive out, the passes, and the
 * drive back once it starts. When the passes are closer than
 * `minPassGapPx` on screen, only every k-th pass is drawn, so the plan reads as lanes and not as a solid
 * fill; the pass the 4x4 is on is always drawn. Zoom in to see every pass.
 */
export function drawPaths(
  ctx: CanvasRenderingContext2D,
  view: Viewport,
  plan: SurveyPlan,
  hours: number,
  colors: MapColors,
): void {
  ctx.strokeStyle = colors.workPath;
  ctx.lineWidth = SURVEY_VIEW.pathWidthPx;
  ctx.setLineDash(SURVEY_VIEW.pathDashPx);
  ctx.beginPath();
  for (const v of plan.vehicles) {
    const stride = Math.max(1, Math.ceil(SURVEY_VIEW.minPassGapPx / (v.passSpacingM * view.scale)));
    let pass = -1;
    for (const leg of v.legs) {
      if (leg.kind === 'pass') pass++;
      if (leg.t1H <= hours) continue;
      const current = leg.t0H <= hours;
      // A shift between passes is one pass spacing; with passes left out it only adds noise.
      if (leg.kind === 'shift' && stride > 1) continue;
      // The drive back to the base shows once the 4x4 is on it, so the plan reads as strips, not spokes.
      if (leg.kind === 'transit' && leg.t0H > 0 && !current) continue;
      if (leg.kind === 'pass' && !current && pass % stride !== 0) continue;
      if (current) {
        const s = vehicleAt(v, hours);
        line(ctx, view, s.x, s.y, leg);
      } else {
        line(ctx, view, leg.x0, leg.y0, leg);
      }
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

/** The 4x4s: amber dots on a dark halo, each with a small blue online dot (Starlink, spec 8.3). */
export function drawVehicles(
  ctx: CanvasRenderingContext2D,
  markers: VehicleMarker[],
  colors: MapColors,
  hoveredId: number | null,
): void {
  const r = SURVEY_VIEW.vehicleRadiusPx;
  const o = SURVEY_VIEW.onlineDotOffsetPx;
  const d = SURVEY_VIEW.onlineDotRadiusPx;
  for (const m of markers) {
    ctx.beginPath();
    ctx.arc(m.sx, m.sy, r + SURVEY_VIEW.vehicleHaloPx, 0, Math.PI * 2);
    ctx.fillStyle = colors.halo;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(m.sx, m.sy, r, 0, Math.PI * 2);
    ctx.fillStyle = colors.work;
    ctx.fill();
    if (m.id === hoveredId) {
      ctx.beginPath();
      ctx.arc(m.sx, m.sy, r + SURVEY_VIEW.hoverRingGapPx, 0, Math.PI * 2);
      ctx.strokeStyle = colors.base;
      ctx.lineWidth = SURVEY_VIEW.hoverRingWidthPx;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(m.sx + o, m.sy - o, d + SURVEY_VIEW.vehicleHaloPx / 2, 0, Math.PI * 2);
    ctx.fillStyle = colors.halo;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(m.sx + o, m.sy - o, d, 0, Math.PI * 2);
    ctx.fillStyle = colors.data;
    ctx.fill();
  }
}
