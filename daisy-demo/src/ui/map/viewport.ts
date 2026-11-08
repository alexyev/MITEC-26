// Map viewport math: world meters (x east, y north) to CSS pixels (y down), fit, zoom about a point and the scale bar.
// Pure functions so they can be tested without a browser.

export interface Viewport {
  /** World point at the center of the canvas, in meters. */
  cx: number;
  cy: number;
  /** CSS pixels per meter. */
  scale: number;
  /** Canvas size in CSS pixels. */
  width: number;
  height: number;
}

export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function worldToScreen(v: Viewport, x: number, y: number): { sx: number; sy: number } {
  return { sx: (x - v.cx) * v.scale + v.width / 2, sy: (v.cy - y) * v.scale + v.height / 2 };
}

export function screenToWorld(v: Viewport, sx: number, sy: number): { x: number; y: number } {
  return { x: (sx - v.width / 2) / v.scale + v.cx, y: v.cy - (sy - v.height / 2) / v.scale };
}

/** Viewport that shows the whole `widthM` x `heightM` site inside the padded canvas. */
export function fitViewport(
  widthM: number,
  heightM: number,
  width: number,
  height: number,
  pad: Padding,
): Viewport {
  const innerW = Math.max(1, width - pad.left - pad.right);
  const innerH = Math.max(1, height - pad.top - pad.bottom);
  const scale = Math.min(innerW / widthM, innerH / heightM);
  // Center the site in the padded area, not in the whole canvas.
  const offsetX = (pad.left - pad.right) / 2;
  const offsetY = (pad.top - pad.bottom) / 2;
  return {
    cx: widthM / 2 - offsetX / scale,
    cy: heightM / 2 + offsetY / scale,
    scale,
    width,
    height,
  };
}

/** Zoom by `factor` keeping the world point under the screen point (sx, sy) fixed. */
export function zoomAt(
  v: Viewport,
  sx: number,
  sy: number,
  factor: number,
  minScale: number,
  maxScale: number,
): Viewport {
  const scale = Math.min(maxScale, Math.max(minScale, v.scale * factor));
  const anchor = screenToWorld(v, sx, sy);
  return {
    ...v,
    scale,
    cx: anchor.x - (sx - v.width / 2) / scale,
    cy: anchor.y + (sy - v.height / 2) / scale,
  };
}

/** Pan by a screen delta in CSS pixels. */
export function panBy(v: Viewport, dx: number, dy: number): Viewport {
  return { ...v, cx: v.cx - dx / v.scale, cy: v.cy + dy / v.scale };
}

/** A round scale-bar length (1, 2 or 5 x 10^n meters) close to `targetPx` and its length in pixels. */
export function scaleBar(
  scale: number,
  targetPx: number,
): { meters: number; px: number; label: string } {
  const raw = targetPx / scale;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const steps = [1, 2, 5, 10];
  let meters = pow;
  for (const s of steps) if (s * pow <= raw) meters = s * pow;
  const label = meters >= 1000 ? `${meters / 1000} km` : `${meters} m`;
  return { meters, px: meters * scale, label };
}

/** A walkthrough camera (D82): zoom toward a world point, by `blend` from 0 (the start view) to 1. */
export interface Camera {
  target: { x: number; y: number };
  /** Zoom at blend 1, in CSS pixels per meter. */
  pxPerM: number;
  blend: number;
}

/**
 * The view part of the way from `from` to a close view of `camera.target`. The zoom eases geometrically, and
 * the target slides on a straight screen line from where `from` shows it to `focus`, so it never leaves the
 * screen while the map zooms.
 */
export function cameraViewport(
  from: Viewport,
  camera: Camera,
  focus: { sx: number; sy: number },
): Viewport {
  const f = Math.min(1, Math.max(0, camera.blend));
  const scale = from.scale * Math.pow(camera.pxPerM / from.scale, f);
  const start = worldToScreen(from, camera.target.x, camera.target.y);
  const sx = start.sx + (focus.sx - start.sx) * f;
  const sy = start.sy + (focus.sy - start.sy) * f;
  return {
    ...from,
    scale,
    cx: camera.target.x - (sx - from.width / 2) / scale,
    cy: camera.target.y + (sy - from.height / 2) / scale,
  };
}
