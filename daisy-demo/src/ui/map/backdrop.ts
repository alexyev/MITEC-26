// The desert backdrop under both maps (D101). A worker generates the terrain layers once per session; each
// map draws them on its own canvas under the data, as world-anchored repeating patterns at the mip level that
// suits the zoom, so panning and zooming move the ground with the map and it runs on past every edge. The
// backdrop is redrawn only when the view or the canvas size changes, or while a layer fades in.
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { TERRAIN } from '../../config/terrain';
import { cssVar, prefersReducedMotion } from '../kit/tokens';
import type { Rgb, TerrainLayer, TerrainLayerName, TerrainPalette } from './terrain';
import { worldToScreen, type Viewport } from './viewport';
import './map.css';

interface LoadedLayer {
  layer: TerrainLayer;
  /** One canvas per mip level. */
  canvases: HTMLCanvasElement[];
  readyAt: number;
}

const LAYERS: TerrainLayerName[] = ['macro', 'detail', 'scrub'];
const loaded: Partial<Record<TerrainLayerName, LoadedLayer>> = {};
const listeners = new Set<() => void>();
let started = false;

/** A hex token (`#rrggbb`) as 0-255 channels. */
export function hexChannels(hex: string): Rgb {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) throw new Error(`Not a 6-digit hex color: "${hex}"`);
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

/** The ground colors of the terrain, from tokens.css. */
export function readTerrainPalette(el: Element = document.documentElement): TerrainPalette {
  const c = (name: string) => hexChannels(cssVar(`--c-ground-${name}`, el));
  return {
    gravel: c('gravel'),
    sand: c('sand'),
    wash: c('wash'),
    light: c('light'),
    shadow: c('shadow'),
    scrub: c('scrub'),
    pebbleLight: c('pebble-light'),
    pebbleDark: c('pebble-dark'),
  };
}

/**
 * Start generating the terrain, once per session. Without workers (tests) the map keeps its flat ground; a
 * worker that fails does the same.
 */
export function startTerrain(): void {
  if (started || typeof Worker === 'undefined' || typeof document === 'undefined') return;
  started = true;
  let worker: Worker;
  try {
    worker = new Worker(new URL('./terrain.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return;
  }
  worker.onmessage = (e: MessageEvent<{ name: TerrainLayerName; layer: TerrainLayer }>) => {
    const { name, layer } = e.data;
    const canvases = layer.levels.map((data, k) => {
      const n = layer.size >> k;
      const canvas = document.createElement('canvas');
      canvas.width = n;
      canvas.height = n;
      canvas.getContext('2d')?.putImageData(new ImageData(data, n, n), 0, 0);
      return canvas;
    });
    loaded[name] = { layer, canvases, readyAt: performance.now() };
    if (LAYERS.every((l) => loaded[l])) worker.terminate();
    listeners.forEach((l) => l());
  };
  worker.onerror = () => worker.terminate();
  worker.postMessage(readTerrainPalette());
}

/** Call `listener` whenever a terrain layer is ready; returns the unsubscribe. */
export function onTerrain(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** How far a layer has faded in at `now`, 0 to 1 (0 until it is ready). */
function fadeOf(name: TerrainLayerName, now: number): number {
  const l = loaded[name];
  if (!l) return 0;
  if (prefersReducedMotion()) return 1;
  return smoothstep(0, TERRAIN.fadeInMs, now - l.readyAt);
}

/** A layer's strength at a zoom (CSS px per meter): the scrub comes in only once a bush covers a pixel. */
function zoomAlpha(name: TerrainLayerName, scale: number): number {
  if (name !== 'scrub') return 1;
  return smoothstep(TERRAIN.fade.scrub.from, TERRAIN.fade.scrub.to, scale);
}

/** The mip level whose texels are at least `minTexelPx` device pixels across at this zoom. */
export function mipLevel(layer: TerrainLayer, deviceScale: number, levels: number): number {
  const texelPx = (layer.periodM / layer.size) * deviceScale;
  const k = Math.ceil(Math.log2(TERRAIN.minTexelPx / texelPx));
  return Math.min(levels - 1, Math.max(0, k));
}

/** One map's backdrop canvas. */
export class Backdrop {
  private last: { view: Viewport; dpr: number } | null = null;
  private key = '';
  private frame = 0;
  private patterns = new Map<HTMLCanvasElement, CanvasPattern | null>();
  private vignette: { canvas: HTMLCanvasElement; key: string } | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    /** Where this map stands in the desert, in meters added to its world coordinates. */
    private origin: { x: number; y: number },
  ) {}

  /** Draw the ground under this view; it keeps redrawing itself while a layer fades in. */
  draw(view: Viewport, dpr: number): void {
    this.last = { view, dpr };
    this.paint();
  }

  /** Redraw the last view, for example when a layer has arrived. */
  refresh(): void {
    this.key = '';
    this.paint();
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
  }

  private paint = (): void => {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    if (this.last && this.render(this.last.view, this.last.dpr, performance.now())) {
      this.frame = requestAnimationFrame(this.paint);
    }
  };

  /** Returns true while a layer is still fading in. */
  private render(view: Viewport, dpr: number, now: number): boolean {
    const canvas = this.canvas;
    const w = Math.round(view.width * dpr);
    const h = Math.round(view.height * dpr);
    if (w <= 0 || h <= 0) return false;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      this.key = '';
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    const fades = LAYERS.map((name) => fadeOf(name, now));
    const key = [view.cx, view.cy, view.scale, w, h, ...fades].join(' ');
    const fading = fades.some((f, i) => loaded[LAYERS[i]] && f < 1);
    if (key === this.key) return fading;
    this.key = key;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = cssVar('--c-map-bg');
    ctx.fillRect(0, 0, w, h);
    const deviceScale = view.scale * dpr;
    const o = worldToScreen(view, -this.origin.x, -this.origin.y);
    LAYERS.forEach((name, i) => {
      const l = loaded[name];
      const alpha = fades[i] * zoomAlpha(name, view.scale);
      if (!l || alpha <= 0) return;
      const k = mipLevel(l.layer, deviceScale, l.canvases.length);
      const pattern = this.patternOf(ctx, l.canvases[k]);
      if (!pattern) return;
      const texel = (l.layer.periodM / l.layer.size) * 2 ** k * deviceScale;
      const tile = l.layer.periodM * deviceScale;
      const tx = (((o.sx * dpr) % tile) + tile) % tile;
      const ty = (((o.sy * dpr) % tile) + tile) % tile;
      pattern.setTransform(new DOMMatrix([texel, 0, 0, texel, tx, ty]));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, w, h);
    });
    ctx.globalAlpha = 1;
    ctx.drawImage(this.vignetteFor(w, h), 0, 0);
    return fading;
  }

  private patternOf(ctx: CanvasRenderingContext2D, level: HTMLCanvasElement): CanvasPattern | null {
    if (!this.patterns.has(level)) this.patterns.set(level, ctx.createPattern(level, 'repeat'));
    return this.patterns.get(level) ?? null;
  }

  /** The vignette for a canvas size, drawn once per size: clear in the middle, darker toward the corners. */
  private vignetteFor(w: number, h: number): HTMLCanvasElement {
    const key = `${w} ${h}`;
    if (this.vignette?.key === key) return this.vignette.canvas;
    const canvas = this.vignette?.canvas ?? document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // An ellipse with the canvas's proportions: a circle in a square space, stretched to the canvas.
      const r = Math.SQRT1_2;
      const g = ctx.createRadialGradient(0.5, 0.5, 0, 0.5, 0.5, r);
      // A stand-in context (tests) may hand back no gradient: the map then has no vignette.
      if (g) {
        g.addColorStop(TERRAIN.vignette.from, 'transparent');
        g.addColorStop(TERRAIN.vignette.to, cssVar('--c-map-vignette'));
        ctx.setTransform(w, 0, 0, h, 0, 0);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 1, 1);
      }
    }
    this.vignette = { canvas, key };
    return canvas;
  }
}

/**
 * A map's backdrop: give the returned ref to a canvas under the map's own canvas, then call `draw` with the
 * view whenever the map draws. The terrain starts generating on first use.
 */
export function useBackdrop(origin: { x: number; y: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backdropRef = useRef<Backdrop | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const backdrop = new Backdrop(canvas, origin);
    backdropRef.current = backdrop;
    startTerrain();
    const off = onTerrain(() => backdrop.refresh());
    return () => {
      off();
      backdrop.dispose();
      backdropRef.current = null;
    };
  }, [origin]);
  const draw = useCallback(
    (view: Viewport, dpr: number) => backdropRef.current?.draw(view, dpr),
    [],
  );
  return useMemo(() => ({ canvasRef, draw }), [draw]);
}
