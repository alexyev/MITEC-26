// Survey map layers (spec 5, 8): surveyed ground, strip boundaries, the planned paths ahead of each UTV,
// the UTVs with their online dots, and their drones on a link to them. Pure drawing from the plan and the hour.
import { SURVEY_VIEW } from '../../config/survey';
import { droneFlying, surveyedRects, trailPoint, vehicleAt } from '../../engine/survey';
import type { SurveyLeg, SurveyPlan, VehicleState } from '../../engine/survey';
import { canvasFont, cssVar } from '../kit/tokens';
import type { MapColors } from '../kit/tokens';
import { worldToScreen } from '../map/viewport';
import type { Viewport } from '../map/viewport';

/** Where a UTV is drawn, for drawing and hit-testing alike. */
export interface VehicleMarker {
  id: number;
  sx: number;
  sy: number;
  state: VehicleState;
}

/**
 * Screen positions of the UTVs at `hours`. A UTV at the base (before Send and after its return) parks in a
 * row just outside the pad's gate (D81), never on the built-up pad, so the fleet reads as a fleet instead of
 * one stacked dot.
 */
export function vehicleMarkers(plan: SurveyPlan, hours: number, view: Viewport): VehicleMarker[] {
  const gate = worldToScreen(view, plan.gate.x, plan.gate.y);
  // Outside the pad: below a gate on its south edge, above one on its north edge.
  const north = plan.pad !== null && plan.gate.y >= plan.pad.y + plan.pad.h;
  const rowSy = gate.sy + (north ? -1 : 1) * SURVEY_VIEW.parkedBelowPx;
  const n = plan.vehicles.length;
  return plan.vehicles.map((v) => {
    const state = vehicleAt(v, hours);
    if (state.kind === 'base') {
      return {
        id: v.id,
        sx: gate.sx + (v.id - (n - 1) / 2) * SURVEY_VIEW.parkedGapPx,
        sy: rowSy,
        state,
      };
    }
    const p = worldToScreen(view, state.x, state.y);
    return { id: v.id, sx: p.sx, sy: p.sy, state };
  });
}

/**
 * Where a flying drone is drawn: behind its UTV along the path, a fixed distance on screen (D61), or a fixed
 * distance on the ground when the map is zoomed in far enough for that to be longer (D82).
 */
export interface DroneMarker {
  /** The id of its UTV. */
  id: number;
  sx: number;
  sy: number;
}

/** The drones in the air at `hours`; a drone at the base rides docked on its UTV and is not drawn. */
export function droneMarkers(
  plan: SurveyPlan,
  vehicles: VehicleMarker[],
  hours: number,
  view: Viewport,
): DroneMarker[] {
  const trailM = Math.max(SURVEY_VIEW.droneTrailPx / view.scale, SURVEY_VIEW.droneTrailM);
  return vehicles
    .filter((m) => droneFlying(m.state))
    .map((m) => {
      const p = trailPoint(plan.vehicles[m.id], hours, trailM);
      const s = worldToScreen(view, p.x, p.y);
      return { id: m.id, sx: s.sx, sy: s.sy };
    });
}

/** What the pointer is over: a UTV or a drone (nearest first), the base, or nothing. */
export type SurveyHit =
  { kind: 'vehicle'; id: number } | { kind: 'drone'; id: number } | { kind: 'base' } | null;

export function hitTest(
  plan: SurveyPlan,
  markers: VehicleMarker[],
  view: Viewport,
  sx: number,
  sy: number,
  drones: DroneMarker[] = [],
): SurveyHit {
  const r = SURVEY_VIEW.hitRadiusPx;
  let best: SurveyHit = null;
  let bestD = r;
  const consider = (kind: 'vehicle' | 'drone', m: { id: number; sx: number; sy: number }) => {
    const d = Math.hypot(m.sx - sx, m.sy - sy);
    if (d <= bestD) {
      best = { kind, id: m.id };
      bestD = d;
    }
  };
  for (const m of markers) consider('vehicle', m);
  for (const m of drones) consider('drone', m);
  if (best) return best;
  const b = worldToScreen(view, plan.base.x, plan.base.y);
  return Math.hypot(b.sx - sx, b.sy - sy) <= r ? { kind: 'base' } : null;
}

/** Surveyed ground: one fill for every pass rectangle of every UTV (spec 5.2, `--c-done`); never the pad. */
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

/**
 * Strip boundaries in the neutral border color, broken around the built-up base pad (D81), and a "UTV #n"
 * label over each strip.
 */
export function drawStrips(ctx: CanvasRenderingContext2D, view: Viewport, plan: SurveyPlan): void {
  const top = worldToScreen(view, 0, plan.area.y + plan.area.h).sy;
  const bottom = worldToScreen(view, 0, plan.area.y).sy;
  const pad = plan.pad;
  ctx.strokeStyle = cssVar('--border-strong');
  ctx.lineWidth = SURVEY_VIEW.stripLineWidthPx;
  ctx.beginPath();
  for (const v of plan.vehicles.slice(1)) {
    const sx = Math.round(worldToScreen(view, v.strip.x, 0).sx) + 1 / 2;
    if (pad && v.strip.x > pad.x && v.strip.x < pad.x + pad.w) {
      ctx.moveTo(sx, top);
      ctx.lineTo(sx, worldToScreen(view, 0, pad.y + pad.h).sy);
      ctx.moveTo(sx, worldToScreen(view, 0, pad.y).sy);
      ctx.lineTo(sx, bottom);
      continue;
    }
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
    ctx.fillText(`UTV #${v.id + 1}`, cx, top - SURVEY_VIEW.stripLabelGapPx);
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
 * The planned path still ahead of each UTV, dashed amber (spec 8.1): the drive out, the passes, and the
 * drive back once it starts. Paths never cross the base pad (D60). When the passes are closer than
 * `minPassGapPx` on screen, only every k-th pass is drawn, so the plan reads as lanes and not as a solid
 * fill; the pass the UTV is on is always drawn. Zoom in to see every pass.
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
    const now = vehicleAt(v, hours);
    for (const leg of v.legs) {
      if (leg.t1H <= hours) continue;
      const current = leg.t0H <= hours;
      // A shift between passes is one pass spacing; with passes left out it only adds noise.
      if (leg.kind === 'shift' && stride > 1) continue;
      // Drives between the parts of a strip and back to the base show once the UTV is on them, so the plan
      // reads as strips, not spokes.
      if (leg.kind === 'transit' && leg.t0H > 0 && !current) continue;
      // Thinned by column, so the two half-passes of a column beside the pad are kept or left out together.
      if (leg.kind === 'pass' && !current && (leg.column ?? 0) % stride !== 0) continue;
      // The current leg starts at the UTV; before Send the UTV is parked by the gate, so the leg starts at
      // the gate, on the pad's edge, and no dash crosses the pad (D60, D81).
      if (current && now.kind !== 'base') line(ctx, view, now.x, now.y, leg);
      else line(ctx, view, leg.x0, leg.y0, leg);
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

/** The UTVs: amber dots on a dark halo, each with a small blue online dot (Starlink, spec 8.3). */
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

/** The link from each flying drone to its UTV: a short solid blue line, the drone's data path (D61). */
export function drawDroneLinks(
  ctx: CanvasRenderingContext2D,
  vehicles: VehicleMarker[],
  drones: DroneMarker[],
  colors: MapColors,
): void {
  if (drones.length === 0) return;
  ctx.strokeStyle = colors.data;
  ctx.lineWidth = SURVEY_VIEW.droneLinkWidthPx;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const d of drones) {
    const v = vehicles.find((m) => m.id === d.id);
    if (!v) continue;
    ctx.moveTo(v.sx, v.sy);
    ctx.lineTo(d.sx, d.sy);
  }
  ctx.stroke();
  ctx.lineCap = 'butt';
}

/** The drone mark centered on (x, y): crossed arms, a small body and four rotor rings. */
function drawDroneMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  widen: number,
): void {
  const a = SURVEY_VIEW.droneArmPx;
  const r = SURVEY_VIEW.droneRotorRadiusPx;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = SURVEY_VIEW.droneRotorWidthPx + widen;
  ctx.beginPath();
  ctx.moveTo(x - a, y - a);
  ctx.lineTo(x + a, y + a);
  ctx.moveTo(x + a, y - a);
  ctx.lineTo(x - a, y + a);
  ctx.stroke();
  ctx.beginPath();
  for (const [dx, dy] of [
    [-a, -a],
    [a, -a],
    [a, a],
    [-a, a],
  ]) {
    ctx.moveTo(x + dx + r, y + dy);
    ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, SURVEY_VIEW.droneBodyRadiusPx + widen / 2, 0, Math.PI * 2);
  ctx.fill();
}

/** The flying drones: amber four-rotor marks on a dark halo, like the UTVs they follow. */
export function drawDrones(
  ctx: CanvasRenderingContext2D,
  drones: DroneMarker[],
  colors: MapColors,
  hoveredId: number | null,
): void {
  const reach = SURVEY_VIEW.droneArmPx + SURVEY_VIEW.droneRotorRadiusPx;
  for (const d of drones) {
    drawDroneMark(ctx, d.sx, d.sy, colors.halo, SURVEY_VIEW.droneHaloPx * 2);
    drawDroneMark(ctx, d.sx, d.sy, colors.work, 0);
    if (d.id === hoveredId) {
      ctx.beginPath();
      ctx.arc(d.sx, d.sy, reach + SURVEY_VIEW.hoverRingGapPx, 0, Math.PI * 2);
      ctx.strokeStyle = colors.base;
      ctx.lineWidth = SURVEY_VIEW.hoverRingWidthPx;
      ctx.stroke();
    }
  }
}

/**
 * The close-up's labels (D82): the name of the UTV the map zoomed in on and of its drone, beside each mark,
 * faded in with the zoom (`alpha`).
 */
export function drawCloseUpLabels(
  ctx: CanvasRenderingContext2D,
  vehicles: VehicleMarker[],
  drones: DroneMarker[],
  id: number,
  alpha: number,
  colors: MapColors,
): void {
  const v = vehicles.find((m) => m.id === id);
  const d = drones.find((m) => m.id === id);
  if (!v || alpha <= 0) return;
  const gap = SURVEY_VIEW.closeUpLabelGapPx;
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.font = canvasFont(12, 500);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = SURVEY_VIEW.vehicleHaloPx * 2;
  ctx.strokeStyle = colors.halo;
  ctx.fillStyle = cssVar('--text-1');
  const label = (text: string, x: number, y: number) => {
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  };
  label(`UTV #${id + 1} · Starlink`, v.sx + gap, v.sy);
  if (d) {
    ctx.fillStyle = cssVar('--text-2');
    label(`Drone #${id + 1} · via UTV`, d.sx + gap, d.sy);
  }
  ctx.restore();
}
