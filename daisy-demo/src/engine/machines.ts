// Frontier machines of the Build & failure tab (D51): each team of the phase at work drives its route through
// the stage's work zone, but only while it has coverage; without coverage it stops where it stands, offline.
import type { EquipmentGlyph } from '../config/play';
import type { Graph } from './network';
import type { BuildClock, PlayModel } from './playModel';

/** One machine or crew of the phase at work, in world meters. */
export interface Machine {
  glyph: EquipmentGlyph;
  /** Index into `frontierPhases`. */
  phase: number;
  /** Index into the stage's teams; its face (-1 west, 1 east). */
  team: number;
  face: number;
  x: number;
  y: number;
  /** The connected node whose coverage it is in (nearest first), -1 when it has none. */
  coveredBy: number;
  /** Inside coverage: connected, so it works. A machine without coverage stops and waits offline. */
  online: boolean;
  /** Share of its route the team has worked in this phase, 0 to 1 (it only advances while online). */
  progress: number;
}

/**
 * The network over one part of the current phase: from `fromFrac` to `toFrac` of the phase, these nodes are
 * connected. The parts follow each other and start at 0.
 */
export interface CoverageSpan {
  fromFrac: number;
  toFrac: number;
  connected: Uint8Array;
}

/** The connected node nearest to (x, y) whose coverage reaches it, or -1. */
export function coveringNode(
  graph: Graph,
  connected: Uint8Array,
  radiusM: number,
  x: number,
  y: number,
): number {
  let best = -1;
  let bestD = Infinity;
  for (let id = 0; id < graph.nodeCount; id++) {
    if (!connected[id]) continue;
    const d = Math.hypot(graph.x[id] - x, graph.y[id] - y);
    if (d <= radiusM && d < bestD) {
      best = id;
      bestD = d;
    }
  }
  return best;
}

/**
 * A point on a route: `index` counts units along it (fractions lie between two units). Between two lanes a
 * team first drives along the lane it leaves, which is nearer the base and so already covered, then across.
 */
export function routePoint(
  model: PlayModel,
  route: number[],
  index: number,
): { x: number; y: number } {
  const last = route.length - 1;
  const i = Math.min(last, Math.max(0, index));
  const a = model.units[route[Math.floor(i)]];
  const b = model.units[route[Math.min(last, Math.floor(i) + 1)]];
  const f = i - Math.floor(i);
  if (a.lane === b.lane) return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  const along = Math.abs(b.y - a.y);
  const total = along + Math.abs(b.x - a.x);
  const d = f * total;
  if (d <= along) return { x: a.x, y: a.y + Math.sign(b.y - a.y) * d };
  return { x: a.x + Math.sign(b.x - a.x) * (d - along), y: b.y };
}

/**
 * The machines at work at a build time. `spans` describe the network through the current phase up to now;
 * a team advances through a part only along ground that part covers, so a team that loses coverage stops
 * where it stands and resumes from there when coverage returns.
 */
export function machinesAt(
  model: PlayModel,
  graph: Graph,
  clock: BuildClock,
  spans: CoverageSpan[],
): Machine[] {
  if (clock.done || spans.length === 0) return [];
  const now = spans[spans.length - 1].connected;
  const radius = model.config.coverageRadiusM;
  const stage = model.stages[clock.stage];
  const glyphs = model.config.frontierPhases[clock.phase].glyphs;
  const out: Machine[] = [];
  stage.teams.forEach((team, t) => {
    const last = team.route.length - 1;
    // Progress in route units, so a step of 1/2 never skips more than half a unit pitch of ground.
    let index = 0;
    let coveredBy = -1;
    for (const span of spans) {
      const at = (i: number) => {
        const p = routePoint(model, team.route, i);
        return coveringNode(graph, span.connected, radius, p.x, p.y);
      };
      coveredBy = at(index);
      if (coveredBy < 0) continue;
      const target = Math.min(last, index + (span.toFrac - span.fromFrac) * last);
      while (index < target) {
        const next = Math.min(target, Math.floor(index * 2 + 1) / 2);
        if (at(next) < 0) break;
        index = next;
      }
      coveredBy = at(index);
    }
    const progress = last > 0 ? index / last : clock.frac > 0 && coveredBy >= 0 ? 1 : 0;
    glyphs.forEach((glyph, slot) => {
      // A second machine of the phase (the carrier behind the crane) trails the first by one unit.
      const p = routePoint(model, team.route, index - slot);
      const by = slot === 0 ? coveredBy : coveringNode(graph, now, radius, p.x, p.y);
      out.push({
        glyph,
        phase: clock.phase,
        team: t,
        face: team.face,
        x: p.x,
        y: p.y,
        coveredBy: by,
        online: by >= 0,
        progress,
      });
    });
  });
  return out;
}
