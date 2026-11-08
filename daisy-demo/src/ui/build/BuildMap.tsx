// Play-model map of the Build & failure tab: draws the scene on a canvas fitted between the panels, finds
// the radio, machine or unit under the pointer, and shows the maintenance ticket next to a failed radio.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { UI } from '../../config/defaults';
import { PLAY, PLAY_VIEW } from '../../config/play';
import type { Graph } from '../../engine/network';
import type { PlayModel } from '../../engine/playModel';
import { prefersReducedMotion, readColorTokens } from '../kit/tokens';
import { fitViewport, screenToWorld, worldToScreen, type Viewport } from '../map/viewport';
import {
  coverageSpill,
  drawScene,
  readDrawColors,
  sameHit,
  type BuildHit,
  type DrawColors,
} from './draw';
import type { Scene } from './scene';

export interface BuildMapProps {
  model: PlayModel;
  graph: Graph;
  scene: Scene;
  hover: BuildHit | null;
  /** What is under the pointer, and the pointer in map pixels. */
  onHover: (hit: BuildHit | null, x: number, y: number) => void;
  onClickRadio: (radio: number) => void;
}

/** Fit the section and its coverage edge, centered on the section, between the panels. */
function fitWithCoverage(model: PlayModel, w: number, h: number): Viewport {
  const spill = coverageSpill(model);
  const v = fitViewport(
    model.widthM + spill.x * 2,
    model.heightM + spill.y * 2,
    w,
    h,
    UI.mapFitPaddingPx,
  );
  return { ...v, cx: v.cx - spill.x, cy: v.cy - spill.y };
}

export function BuildMap({ model, graph, scene, hover, onHover, onClickRadio }: BuildMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scratchRef = useRef<HTMLCanvasElement | null>(null);
  const colorsRef = useRef<DrawColors | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const viewport: Viewport | null = size.w > 0 ? fitWithCoverage(model, size.w, size.h) : null;

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !viewport) return;
    colorsRef.current ??= readDrawColors(readColorTokens());
    scratchRef.current ??= document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(size.w * dpr);
    const h = Math.round(size.h * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawScene(ctx, viewport, model, graph, scene, colorsRef.current, {
      hover,
      reducedMotion: prefersReducedMotion(),
      emphasis: scene.traffic,
      scratch: scratchRef.current,
      dpr,
    });
  });

  /**
   * The radio, base or machine nearest the pointer within its hit radius, else the unit slot under it.
   * Radios that are not built do not count.
   */
  const hitTest = (x: number, y: number): BuildHit | null => {
    if (!viewport) return null;
    let best: BuildHit | null = null;
    let bestD = Infinity;
    for (let id = 0; id < graph.nodeCount; id++) {
      if (id !== graph.baseId && scene.radioBuild[id] === 0) continue;
      const p = worldToScreen(viewport, graph.x[id], graph.y[id]);
      const d = Math.hypot(p.sx - x, p.sy - y);
      // The base and its own cell's radio are close together: prefer the radio on a tie.
      if (d <= PLAY_VIEW.hitRadiusPx && (d < bestD || (d === bestD && id !== graph.baseId))) {
        best = { kind: 'node', id };
        bestD = d;
      }
    }
    scene.machines.forEach((m, i) => {
      const p = worldToScreen(viewport, m.x, m.y);
      const d = Math.hypot(p.sx - x, p.sy - y);
      if (d <= PLAY_VIEW.machineHitPx && d < bestD) {
        best = { kind: 'machine', id: i };
        bestD = d;
      }
    });
    if (best !== null) return best;
    // Otherwise the unit slot under the pointer (the lane strip by the unit pitch), for its phase.
    const w = screenToWorld(viewport, x, y);
    if (w.x < 0 || w.y < 0 || w.x >= model.widthM || w.y >= model.heightM) return null;
    const lane = Math.floor(w.x / model.lanePitchM);
    const pos = Math.floor(w.y / model.unitPitchM);
    const unit = model.unitSlot[lane * model.unitsPerLane + pos];
    return unit >= 0 ? { kind: 'unit', id: unit } : null;
  };

  // Machines drive while the pointer rests: keep the hover on whatever is under it now.
  useEffect(() => {
    const p = pointerRef.current;
    if (!p) return;
    const hit = hitTest(p.x, p.y);
    if (!sameHit(hit, hover)) onHover(hit, p.x, p.y);
  });

  const local = (e: ReactPointerEvent) => {
    const r = containerRef.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };
  const onMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const p = local(e);
    pointerRef.current = p;
    onHover(hitTest(p.x, p.y), p.x, p.y);
  };
  const onLeave = () => {
    pointerRef.current = null;
    onHover(null, 0, 0);
  };
  const onDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const { x, y } = local(e);
    const hit = hitTest(x, y);
    if (hit?.kind === 'node' && hit.id !== graph.baseId) onClickRadio(hit.id);
  };

  const clickable = hover?.kind === 'node' && hover.id < graph.baseId;
  let ticket = null;
  if (scene.ticket && viewport) {
    const p = worldToScreen(viewport, graph.x[scene.ticket.radio], graph.y[scene.ticket.radio]);
    ticket = (
      <div
        className="build-ticket"
        style={{ left: Math.round(p.sx), top: Math.round(p.sy + PLAY_VIEW.ticketGapPx) }}
        role="status"
      >
        <div className="label">Maintenance ticket</div>
        <p className="build-ticket-text">
          Replace the radio on P3 #{scene.ticket.unitNumber} (cell&nbsp;{scene.ticket.col},&nbsp;
          {scene.ticket.row}).
        </p>
        <p className="build-ticket-note">
          Swap time about {PLAY.ticket.swapTimeMin} min (placeholder).
        </p>
      </div>
    );
  }

  return (
    <div className="map" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className={clickable ? 'map-canvas static clickable' : 'map-canvas static'}
        aria-label="Play-model section: click a radio to fail or repair it"
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        onPointerDown={onDown}
      />
      {ticket}
    </div>
  );
}
