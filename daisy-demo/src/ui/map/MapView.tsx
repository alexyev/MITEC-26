// Site map (spec 10.3, T1.3): unit layer, zones of both build faces, the center base, pan, zoom, fit and scale bar.
// The view lives in refs and redraws on animation frames, so panning never re-renders React.
import { useCallback, useEffect, useRef } from 'react';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { BASE, MAP, UI } from '../../config/defaults';
import { faceZonesAt, frontsAt } from '../../engine/schedule';
import type { FaceZones } from '../../engine/types';
import { getSiteModel, unitStates } from '../../state/model';
import { DockPortal } from '../kit/dock';
import { IconButton } from '../kit/IconButton';
import { readColorTokens } from '../kit/tokens';
import { createUnitRaster, drawUnits, pickLevel, renderUnitRaster } from './units';
import type { UnitColors, UnitRaster } from './units';
import { fitViewport, panBy, scaleBar, screenToWorld, worldToScreen, zoomAt } from './viewport';
import type { Viewport } from './viewport';

interface Palette extends UnitColors {
  edge: string;
  work: string;
  buildFront: string;
  commissionFront: string;
  base: string;
  halo: string;
  siteOutline: string;
}

/** Map colors from the story tokens (spec 5.2): planned units are thin grey outlines, placed units grey. */
function readPalette(el: HTMLElement): Palette {
  const c = readColorTokens(el);
  return {
    planned: c.unitPlanned,
    placed: c.unit,
    commissioned: c.unit,
    edge: c.work,
    work: c.unitPlanned,
    buildFront: c.work,
    commissionFront: c.signal,
    base: c.base,
    halo: c.halo,
    siteOutline: c.outline,
  };
}

/** Diagonal hatch tile; the pattern is anchored to the world so it does not swim while panning. */
function hatchPattern(
  ctx: CanvasRenderingContext2D,
  color: string,
  spacing: number,
): CanvasPattern | null {
  const tile = document.createElement('canvas');
  tile.width = spacing;
  tile.height = spacing;
  const t = tile.getContext('2d');
  if (!t) return null;
  t.strokeStyle = color;
  t.lineWidth = 1;
  t.beginPath();
  // Three segments so the diagonal stays continuous across tile edges.
  for (const o of [-spacing, 0, spacing]) {
    t.moveTo(o, spacing);
    t.lineTo(o + spacing, 0);
  }
  t.stroke();
  return ctx.createPattern(tile, 'repeat');
}

export interface MapViewProps {
  /** Build day to show; 0 shows every unit as planned (the full-site build-day view is hidden in v3). */
  day?: number;
}

export function MapView({ day: buildDay = 0 }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scaleBarRef = useRef<HTMLDivElement>(null);
  const scaleLabelRef = useRef<HTMLSpanElement>(null);
  const viewRef = useRef<Viewport | null>(null);
  const dirtyRef = useRef(true);
  const frameRef = useRef(0);
  const dayRef = useRef(buildDay);
  const rasterDayRef = useRef(-1);
  const rasterRef = useRef<UnitRaster | null>(null);
  const statesRef = useRef<Uint8Array | null>(null);
  const paletteRef = useRef<Palette | null>(null);
  const patternsRef = useRef<{ edge: CanvasPattern | null; work: CanvasPattern | null } | null>(
    null,
  );

  const model = getSiteModel();

  const requestDraw = useCallback(() => {
    dirtyRef.current = true;
  }, []);

  const minMaxScale = useCallback(() => {
    const v = viewRef.current;
    if (!v) return { min: 0, max: MAP.maxPxPerM };
    const fit = fitViewport(
      model.site.widthM,
      model.site.heightM,
      v.width,
      v.height,
      UI.mapFitPaddingPx,
    );
    return { min: fit.scale * MAP.minZoomOfFit, max: MAP.maxPxPerM };
  }, [model]);

  const fit = useCallback(() => {
    const v = viewRef.current;
    if (!v) return;
    viewRef.current = fitViewport(
      model.site.widthM,
      model.site.heightM,
      v.width,
      v.height,
      UI.mapFitPaddingPx,
    );
    requestDraw();
  }, [model, requestDraw]);

  const zoomButton = useCallback(
    (factor: number) => {
      const v = viewRef.current;
      if (!v) return;
      const { min, max } = minMaxScale();
      viewRef.current = zoomAt(v, v.width / 2, v.height / 2, factor, min, max);
      requestDraw();
    },
    [minMaxScale, requestDraw],
  );

  useEffect(() => {
    dayRef.current = buildDay;
    requestDraw();
  }, [buildDay, requestDraw]);

  // Size the canvas to its container (device pixels) and keep the view centered on resize.
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    paletteRef.current = readPalette(container);
    const observer = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const prev = viewRef.current;
      viewRef.current = prev
        ? { ...prev, width: rect.width, height: rect.height }
        : fitViewport(
            model.site.widthM,
            model.site.heightM,
            rect.width,
            rect.height,
            UI.mapFitPaddingPx,
          );
      patternsRef.current = null;
      requestDraw();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [model, requestDraw]);

  // Render loop: draws only when something changed.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const draw = () => {
      const v = viewRef.current;
      const palette = paletteRef.current;
      if (!v || !palette) return;
      const dpr = canvas.width / v.width;
      const day = dayRef.current;

      // Unit states and the raster follow the build day.
      if (rasterDayRef.current !== day) {
        statesRef.current = unitStates(model.schedule, day, statesRef.current ?? undefined);
        rasterRef.current ??= createUnitRaster(model, MAP.rasterPxPerM, MAP.rasterMinLevelPx);
        renderUnitRaster(rasterRef.current, model, statesRef.current, palette);
        rasterDayRef.current = day;
      }
      if (!patternsRef.current) {
        patternsRef.current = {
          edge: hatchPattern(ctx, palette.edge, MAP.hatchSpacingPx * dpr),
          work: hatchPattern(ctx, palette.work, MAP.hatchSpacingPx * dpr),
        };
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Site boundary.
      const tl = worldToScreen(v, 0, model.site.heightM);
      ctx.strokeStyle = palette.siteOutline;
      ctx.lineWidth = 1;
      ctx.strokeRect(tl.sx, tl.sy, model.site.widthM * v.scale, model.site.heightM * v.scale);

      // Units: raster when zoomed out, vectors for the visible units when zoomed in.
      const raster = rasterRef.current;
      const states = statesRef.current;
      if (raster && states) {
        if (v.scale * dpr <= MAP.vectorAbovePxPerM) {
          const level = pickLevel(raster, v.scale * dpr);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'medium';
          ctx.drawImage(
            level.canvas,
            tl.sx,
            tl.sy,
            level.canvas.width * (v.scale / level.pxPerM),
            level.canvas.height * (v.scale / level.pxPerM),
          );
        } else {
          const a = screenToWorld(v, 0, v.height);
          const b = screenToWorld(v, v.width, 0);
          const origin = worldToScreen(v, 0, 0);
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          drawUnits(
            ctx,
            model,
            states,
            palette,
            { scale: v.scale * dpr, ox: origin.sx * dpr, oy: origin.sy * dpr },
            { x0: a.x, y0: a.y, x1: b.x, y1: b.y },
          );
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
      }

      // Zones of both faces (spec 7.1): edge zone between the fronts, work zone beyond the build front.
      const zones = faceZonesAt(model.schedule, day);
      const fronts = frontsAt(model.schedule, day);
      const placed = Math.min(day, model.schedule.buildDays) >= 1;
      const g = model.grid;
      const top = worldToScreen(v, 0, g.y1).sy;
      const bottom = worldToScreen(v, 0, g.y0).sy;
      const hw = model.unitW / 2;
      const o = worldToScreen(v, 0, 0);
      const patterns = patternsRef.current;
      const band = (xa: number, xb: number, fill: CanvasPattern | string | null) => {
        if (!fill) return;
        const lo = Math.max(0, Math.min(xa, xb));
        const hi = Math.min(model.site.widthM, Math.max(xa, xb));
        if (hi <= lo) return;
        const sa = worldToScreen(v, lo, 0).sx;
        const sb = worldToScreen(v, hi, 0).sx;
        // Anchor the hatch to the world origin so it moves with the map.
        if (fill instanceof CanvasPattern)
          fill.setTransform(new DOMMatrix().translate(o.sx * dpr, o.sy * dpr));
        ctx.fillStyle = fill;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillRect(sa * dpr, top * dpr, (sb - sa) * dpr, (bottom - top) * dpr);
        ctx.restore();
      };
      const vline = (x: number, color: string) => {
        const sx = Math.round(worldToScreen(v, x, 0).sx) + 0.5;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash(MAP.frontDashPx);
        ctx.beginPath();
        ctx.moveTo(sx, top);
        ctx.lineTo(sx, bottom);
        ctx.stroke();
        ctx.setLineDash([]);
      };
      const face = (f: FaceZones, outward: number) => {
        // Fronts sit on unit centers; the zones reach the outer edge of the outermost unit.
        // A partly commissioned column belongs to the edge zone, so the zone starts at its inner edge.
        const anyCommissioned = fronts.commissionedCount > 0;
        const commissionEdge = !anyCommissioned
          ? model.schedule.centerX
          : f.commissionFrontX + (fronts.commissionFrontPartial ? -outward : outward) * hw;
        const buildEdge = f.buildFrontX + outward * hw;
        band(commissionEdge, buildEdge, patterns?.edge ?? null);
        band(buildEdge, f.workZoneEndX + outward * hw, patterns?.work ?? null);
        vline(buildEdge, palette.buildFront);
        if (anyCommissioned) vline(commissionEdge, palette.commissionFront);
      };
      if (placed && day < model.schedule.lastDay) {
        face(zones.west, -1);
        face(zones.east, 1);
      }

      // The base at the site center (BASE.defaultPreset): a white square on a dark halo.
      const s = BASE.presets[BASE.defaultPreset][0];
      const bp = worldToScreen(v, s.fx * model.site.widthM, s.fy * model.site.heightM);
      const r = MAP.baseMarkerPx;
      ctx.fillStyle = palette.base;
      ctx.strokeStyle = palette.halo;
      ctx.lineWidth = MAP.baseHaloPx;
      ctx.beginPath();
      ctx.roundRect(bp.sx - r, bp.sy - r, 2 * r, 2 * r, MAP.baseCornerPx);
      ctx.stroke();
      ctx.fill();

      // Scale bar (DOM, updated in place).
      const bar = scaleBar(v.scale, MAP.scaleBarTargetPx);
      if (scaleBarRef.current) scaleBarRef.current.style.width = `${bar.px}px`;
      if (scaleLabelRef.current) scaleLabelRef.current.textContent = bar.label;
    };

    const loop = () => {
      if (dirtyRef.current) {
        dirtyRef.current = false;
        draw();
      }
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameRef.current);
  }, [model]);

  // Pan with the pointer, zoom with the wheel or a trackpad pinch.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let last: { x: number; y: number } | null = null;
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      canvas.setPointerCapture(e.pointerId);
      last = { x: e.clientX, y: e.clientY };
      canvas.classList.add('dragging');
    };
    const move = (e: PointerEvent) => {
      if (!last || !viewRef.current) return;
      viewRef.current = panBy(viewRef.current, e.clientX - last.x, e.clientY - last.y);
      last = { x: e.clientX, y: e.clientY };
      requestDraw();
    };
    const up = (e: PointerEvent) => {
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      last = null;
      canvas.classList.remove('dragging');
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      if (!v) return;
      const rect = canvas.getBoundingClientRect();
      const lineScale = e.deltaMode === 1 ? 16 : 1;
      const factor = Math.pow(MAP.wheelZoomPer100Px, (-e.deltaY * lineScale) / 100);
      const { min, max } = minMaxScale();
      viewRef.current = zoomAt(v, e.clientX - rect.left, e.clientY - rect.top, factor, min, max);
      requestDraw();
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', wheel, { passive: false });
    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('wheel', wheel);
    };
  }, [minMaxScale, requestDraw]);

  return (
    <div className="map" ref={containerRef}>
      <canvas ref={canvasRef} className="map-canvas" aria-label="Site map" />
      <DockPortal slot="tools">
        <div className="map-tools" role="toolbar" aria-label="Map view">
          <span className="scale" aria-label="Scale">
            <span className="scale-bar" ref={scaleBarRef} />
            <span className="num" ref={scaleLabelRef} />
          </span>
          <IconButton
            icon={Minus}
            label="Zoom out"
            onClick={() => zoomButton(1 / MAP.buttonZoom)}
          />
          <IconButton icon={Plus} label="Zoom in" onClick={() => zoomButton(MAP.buttonZoom)} />
          <IconButton icon={Maximize2} label="Fit the site" onClick={fit} />
        </div>
      </DockPortal>
    </div>
  );
}
