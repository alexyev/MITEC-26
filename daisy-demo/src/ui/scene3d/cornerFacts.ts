// What the 3D view says about a radio (D123, D124): its status on the map when the viewer flew down, and its
// four beams, each to the neighbor radio down the lane or the column. Pure, so tests can check it.
import { RadioBuild, type PlayModel } from '../../engine/playModel';
import type { Graph } from '../../engine/network';
import type { Scene } from '../build/scene';

export type RadioStatus = 'online' | 'cutOff' | 'waiting' | 'failed';

/** A beam: its direction on the site (unit vector, x east, y north) and its neighbor radio, if any. */
export interface BeamFact {
  key: '+lane' | '-lane' | '+col' | '-col';
  dx: number;
  dy: number;
  title: string;
  detail: string;
  neighbor: number | null;
  /** The link to the neighbor is up on the map. */
  linked: boolean;
}

export interface CornerFacts {
  label: string;
  /** P3 number of the unit the module is bolted to, 1-based as on the map. */
  unitNumber: number;
  status: RadioStatus;
  /** One line for the module's label, as the map's hover card words it. */
  statusLine: string;
  beams: BeamFact[];
}

export function radioStatus(scene: Scene, radio: number): RadioStatus {
  if (scene.failed[radio]) return 'failed';
  if (scene.radioBuild[radio] !== RadioBuild.On) return 'waiting';
  if (scene.network.cutOff[radio]) return 'cutOff';
  return 'online';
}

const BEAMS: { key: BeamFact['key']; dx: number; dy: number; way: string; title: string }[] = [
  { key: '+lane', dx: 0, dy: 1, way: 'North', title: 'Down the lane' },
  { key: '-lane', dx: 0, dy: -1, way: 'South', title: 'Down the lane' },
  { key: '+col', dx: 1, dy: 0, way: 'East', title: 'Down the column' },
  { key: '-col', dx: -1, dy: 0, way: 'West', title: 'Down the column' },
];

export function cornerFacts(
  model: PlayModel,
  graph: Graph,
  scene: Scene,
  radio: number,
): CornerFacts {
  const r = model.radios[radio];
  const status = radioStatus(scene, radio);
  const hops = scene.network.routing.hops[radio];
  const statusLine =
    status === 'failed'
      ? 'Failed · no signal'
      : status === 'waiting'
        ? 'Waiting for power · not on yet'
        : status === 'cutOff'
          ? 'Cut off · no route to the base'
          : `Online · ${hops} ${hops === 1 ? 'hop' : 'hops'} to the base`;
  const linked = new Set(
    scene.network.links.map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`),
  );
  const cols = model.config.cellCols;
  const rows = model.config.cellRows;
  const beams = BEAMS.map((b): BeamFact => {
    const col = r.cellCol + b.dx;
    const row = r.cellRow + b.dy;
    const inside = col >= 0 && col < cols && row >= 0 && row < rows;
    const id = inside ? model.cellRadio[row * cols + col] : -1;
    const neighbor = id >= 0 ? id : null;
    const up =
      neighbor !== null && linked.has(`${Math.min(radio, neighbor)}-${Math.max(radio, neighbor)}`);
    let detail = `${b.way} · edge of the section`;
    if (neighbor !== null) {
      const n = model.radios[neighbor];
      const m = Math.round(Math.hypot(graph.x[neighbor] - r.x, graph.y[neighbor] - r.y));
      detail = `${b.way} to ${n.label}, ${m} m${up ? '' : ' · no link'}`;
    }
    return { key: b.key, dx: b.dx, dy: b.dy, title: b.title, detail, neighbor, linked: up };
  });
  return { label: r.label, unitNumber: r.unitId + 1, status, statusLine, beams };
}
