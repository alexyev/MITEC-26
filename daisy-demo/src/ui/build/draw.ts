// Canvas drawing of the play-model map (spec 5, 6.7, 9): units, coverage union, links, routes, packets,
// radios, the base, queue badges and the failure marks. Colors come from tokens.css only.
import { MAP, ROUTING } from '../../config/defaults';
import { PLAY, PLAY_VIEW } from '../../config/play';
import type { Graph } from '../../engine/network';
import { RadioBuild, type PlayModel } from '../../engine/playModel';
import { canvasFont, cssVar, type MapColors } from '../kit/tokens';
import { worldToScreen, type Viewport } from '../map/viewport';
import type { Scene } from './scene';

export interface DrawColors extends MapColors {
  text2: string;
  text3: string;
  surface: string;
  borderStrong: string;
}

export function readDrawColors(base: MapColors): DrawColors {
  return {
    ...base,
    text2: cssVar('--text-2'),
    text3: cssVar('--text-3'),
    surface: cssVar('--surface-strong'),
    borderStrong: cssVar('--border-strong'),
  };
}

export interface DrawOptions {
  hover: number | null;
  reducedMotion: boolean;
  /** Offscreen canvas for the coverage edge. */
  scratch: HTMLCanvasElement;
  dpr: number;
}

const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function drawScene(
  ctx: CanvasRenderingContext2D,
  v: Viewport,
  model: PlayModel,
  graph: Graph,
  scene: Scene,
  c: DrawColors,
  opt: DrawOptions,
): void {
  const px = (id: number) => worldToScreen(v, graph.x[id], graph.y[id]);
  const s = v.scale;
  const t = scene.t;

  // Section outline.
  const tl = worldToScreen(v, 0, model.heightM);
  ctx.strokeStyle = c.outline;
  ctx.lineWidth = 1;
  ctx.strokeRect(
    Math.round(tl.sx) - 1 / 2,
    Math.round(tl.sy) - 1 / 2,
    Math.round(model.widthM * s) + 1,
    Math.round(model.heightM * s) + 1,
  );

  // Coverage: the union of the connected circles with one fill, so overlaps do not get darker (spec 5.1).
  const circles: { x: number; y: number; r: number }[] = [];
  const radius = PLAY.coverageRadiusM * s;
  for (let id = 0; id < graph.nodeCount; id++) {
    if (!scene.network.connected[id]) continue;
    const p = px(id);
    let k = 1;
    if (id !== graph.baseId && !opt.reducedMotion) {
      k = easeOut(clamp01((t - scene.radioOnS[id]) / PLAY_VIEW.radioFadeInS));
    }
    if (k > 0) circles.push({ x: p.sx, y: p.sy, r: radius * k });
  }
  // Not clipped to the section: the scalloped edge of the union shows each radio's circle.
  ctx.fillStyle = c.signalFill;
  ctx.beginPath();
  for (const ci of circles) {
    ctx.moveTo(ci.x + ci.r, ci.y);
    ctx.arc(ci.x, ci.y, ci.r, 0, Math.PI * 2);
  }
  ctx.fill();
  drawCoverageEdge(ctx, circles, c, opt);

  // Units: planned as thin low-alpha outlines, placed as grey blocks.
  // The base yard: its own cell at the center, outlined in the base color.
  const yard = model.base.yard;
  const inset = PLAY_VIEW.yardInsetM;
  const yt = worldToScreen(v, yard.x + inset, yard.y + yard.h - inset);
  ctx.globalAlpha = PLAY_VIEW.yardAlpha;
  ctx.strokeStyle = c.base;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(
    Math.round(yt.sx) + 1 / 2,
    Math.round(yt.sy) + 1 / 2,
    Math.round((yard.w - inset * 2) * s),
    Math.round((yard.h - inset * 2) * s),
    PLAY_VIEW.yardCornerPx,
  );
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Units stand with their long side north-south.
  const uw = model.unitSizeXM * s;
  const ud = model.unitSizeYM * s;
  ctx.beginPath();
  for (const u of model.units) {
    if (scene.unitPlaced[u.id]) continue;
    const p = worldToScreen(v, u.x - model.unitSizeXM / 2, u.y + model.unitSizeYM / 2);
    ctx.rect(p.sx + 1 / 2, p.sy + 1 / 2, uw - 1, ud - 1);
  }
  ctx.strokeStyle = c.unitPlanned;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  for (const u of model.units) {
    if (!scene.unitPlaced[u.id]) continue;
    const p = worldToScreen(v, u.x - model.unitSizeXM / 2, u.y + model.unitSizeYM / 2);
    ctx.rect(p.sx, p.sy, uw, ud);
  }
  ctx.fillStyle = c.unit;
  ctx.fill();

  // Links between alive nodes.
  ctx.beginPath();
  for (const [a, b] of scene.network.links) {
    const pa = px(a);
    const pb = px(b);
    ctx.moveTo(pa.sx, pa.sy);
    ctx.lineTo(pb.sx, pb.sy);
  }
  ctx.strokeStyle = c.signalLink;
  ctx.lineWidth = PLAY_VIEW.linkWidthPx;
  ctx.stroke();

  // Old paths (dashed grey) under the live routes (blue).
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  strokePaths(
    ctx,
    scene.oldRoutes,
    px,
    c.unit,
    PLAY_VIEW.oldRouteWidthPx,
    PLAY_VIEW.oldRouteDashPx,
  );
  strokePaths(ctx, scene.routes, px, c.dataRoute, PLAY_VIEW.routeWidthPx, []);

  // Route update: a ring that spreads from the failed radio at detection (slowed for visibility).
  for (const f of scene.failures) {
    if (opt.reducedMotion || f.record.detectS === null) continue;
    const age = (t - f.record.detectS) / PLAY_VIEW.updateRingS;
    if (age < 0 || age >= 1) continue;
    const p = px(f.record.radio);
    ctx.globalAlpha = 1 - age;
    ctx.strokeStyle = c.data;
    ctx.lineWidth = PLAY_VIEW.oldRouteWidthPx;
    ctx.beginPath();
    ctx.arc(
      p.sx,
      p.sy,
      (easeOut(age) * Math.max(model.widthM, model.heightM) * s) / 2,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Packets.
  ctx.beginPath();
  for (const d of scene.packets) {
    const a = px(d.from);
    const b = px(d.to);
    const x = a.sx + (b.sx - a.sx) * d.f;
    const y = a.sy + (b.sy - a.sy) * d.f;
    ctx.moveTo(x + PLAY_VIEW.packetPx, y);
    ctx.arc(x, y, PLAY_VIEW.packetPx, 0, Math.PI * 2);
  }
  ctx.fillStyle = c.data;
  ctx.strokeStyle = c.halo;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fill();

  // Radios.
  for (const r of model.radios) {
    const p = px(r.id);
    const build = scene.radioBuild[r.id];
    if (build === RadioBuild.None) continue;
    if (scene.failed[r.id]) {
      drawCross(ctx, p.sx, p.sy, c);
    } else if (scene.network.cutOff[r.id]) {
      dot(ctx, p.sx, p.sy, PLAY_VIEW.cutOffRingPx + PLAY_VIEW.radioHaloPx, c.halo);
      ring(ctx, p.sx, p.sy, PLAY_VIEW.cutOffRingPx, c.fail, PLAY_VIEW.radioHaloPx);
    } else {
      dot(ctx, p.sx, p.sy, PLAY_VIEW.radioPx + PLAY_VIEW.radioHaloPx, c.halo);
      dot(ctx, p.sx, p.sy, PLAY_VIEW.radioPx, build === RadioBuild.On ? c.signal : c.work);
    }
  }

  // A failed radio flashes red once.
  for (const f of scene.failures) {
    if (opt.reducedMotion) continue;
    const k = f.age / PLAY_VIEW.failFlashS;
    if (k < 0 || k >= 1) continue;
    const p = px(f.record.radio);
    ctx.globalAlpha = 1 - k;
    ring(ctx, p.sx, p.sy, PLAY_VIEW.radioPx + easeOut(k) * PLAY_VIEW.failFlashPx, c.fail, 2);
    ctx.globalAlpha = 1;
  }

  // The base: a white square on a dark halo in the middle of its yard.
  const b = px(graph.baseId);
  const br = PLAY_VIEW.baseMarkerPx;
  ctx.fillStyle = c.base;
  ctx.strokeStyle = c.halo;
  ctx.lineWidth = MAP.baseHaloPx;
  ctx.beginPath();
  ctx.roundRect(b.sx - br, b.sy - br, 2 * br, 2 * br, MAP.baseCornerPx);
  ctx.stroke();
  ctx.fill();

  if (opt.hover !== null) {
    const p = px(opt.hover);
    ring(ctx, p.sx, p.sy, PLAY_VIEW.hoverRingPx, c.base, PLAY_VIEW.radioHaloPx);
  }

  // Labels: missed hellos next to a failed radio, queue badges next to waiting radios.
  ctx.font = canvasFont(11, 600);
  ctx.textBaseline = 'middle';
  for (const f of scene.failures) {
    const hold = f.record.detectS !== null && t >= f.record.detectS + PLAY_VIEW.helloLabelHoldS;
    if (f.missedHellos === 0 || hold) continue;
    const p = px(f.record.radio);
    const n = ROUTING.missedHellosToDown;
    const text = f.detected
      ? `Down · ${n}/${n} hellos missed`
      : `Missed hellos ${f.missedHellos}/${n}`;
    badge(ctx, text, p.sx, p.sy - PLAY_VIEW.labelGapPx - PLAY_VIEW.badgeHeightPx / 2, c.fail, c);
  }
  for (const q of scene.queues) {
    const p = px(q.node);
    badge(
      ctx,
      `${q.count} queued`,
      p.sx,
      p.sy + PLAY_VIEW.labelGapPx + PLAY_VIEW.badgeHeightPx / 2,
      c.data,
      c,
    );
  }
}

function drawCoverageEdge(
  ctx: CanvasRenderingContext2D,
  circles: { x: number; y: number; r: number }[],
  c: DrawColors,
  opt: DrawOptions,
): void {
  const cv = opt.scratch;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  if (cv.width !== w || cv.height !== h) {
    cv.width = w;
    cv.height = h;
  }
  const e = cv.getContext('2d');
  if (!e) return;
  e.setTransform(1, 0, 0, 1, 0, 0);
  e.clearRect(0, 0, w, h);
  e.setTransform(opt.dpr, 0, 0, opt.dpr, 0, 0);
  e.globalCompositeOperation = 'source-over';
  e.strokeStyle = c.signalLink;
  e.lineWidth = PLAY_VIEW.coverageEdgePx * 2;
  e.beginPath();
  for (const ci of circles) {
    e.moveTo(ci.x + ci.r, ci.y);
    e.arc(ci.x, ci.y, ci.r, 0, Math.PI * 2);
  }
  e.stroke();
  // Cut away every stroke that lies inside another circle, so only the outer edge of the union stays.
  e.globalCompositeOperation = 'destination-out';
  e.beginPath();
  for (const ci of circles) {
    const r = Math.max(0, ci.r - PLAY_VIEW.coverageEdgePx);
    e.moveTo(ci.x + r, ci.y);
    e.arc(ci.x, ci.y, r, 0, Math.PI * 2);
  }
  e.fill();
  e.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(cv, 0, 0);
  ctx.restore();
}

function strokePaths(
  ctx: CanvasRenderingContext2D,
  paths: number[][],
  px: (id: number) => { sx: number; sy: number },
  color: string,
  width: number,
  dash: number[],
): void {
  if (paths.length === 0) return;
  ctx.beginPath();
  for (const path of paths) {
    path.forEach((id, i) => {
      const p = px(id);
      if (i === 0) ctx.moveTo(p.sx, p.sy);
      else ctx.lineTo(p.sx, p.sy);
    });
  }
  ctx.setLineDash(dash);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.setLineDash([]);
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function ring(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  width: number,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

function drawCross(ctx: CanvasRenderingContext2D, x: number, y: number, c: DrawColors): void {
  const a = PLAY_VIEW.failCrossPx;
  ctx.lineCap = 'round';
  for (const [color, width] of [
    [c.halo, 2 + PLAY_VIEW.radioHaloPx * 2],
    [c.fail, 2],
  ] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x - a, y - a);
    ctx.lineTo(x + a, y + a);
    ctx.moveTo(x + a, y - a);
    ctx.lineTo(x - a, y + a);
    ctx.stroke();
  }
}

/** A small dark pill with a colored hairline and text, centered on (x, y). */
function badge(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  c: DrawColors,
): void {
  const w = Math.ceil(ctx.measureText(text).width) + PLAY_VIEW.badgePadPx * 2;
  const h = PLAY_VIEW.badgeHeightPx;
  const left = Math.round(x - w / 2);
  const top = Math.round(y - h / 2);
  ctx.fillStyle = c.surface;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(left + 1 / 2, top + 1 / 2, w - 1, h - 1, h / 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(text, left + w / 2, top + h / 2 + 1 / 2);
}
