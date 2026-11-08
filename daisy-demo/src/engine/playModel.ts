// Play model of the Build & failure tab (spec 9.1, 9.2): north-south lanes of P3 units on the 10 x 5 radio grid,
// the base on its own pad at the center, and the staged build that only works inside coverage (D46, D51).
import { SITE } from '../config/defaults';
import { PLAY, UnitState, type PlayConfig } from '../config/play';
import type { Rect, SiteConfig } from './types';

/** A P3 unit. World frame: x grows east, y grows north; the play-model rectangle starts at (0, 0). */
export interface PlayUnit {
  /** Index into `units`. */
  id: number;
  /** Lane index from west to east; lanes run north-south. */
  lane: number;
  /** Position along the lane from south to north. */
  pos: number;
  /** Center of the unit. */
  x: number;
  y: number;
  /** Build stage (0-based) whose work zone holds the unit. */
  stage: number;
  /** Its team in the stage, and its place on that team's route. */
  team: number;
  routeIndex: number;
  /** Build time (seconds from the start of the build) at which the crane sets it down. */
  placedS: number;
}

export interface PlayRadio {
  /** Node id in the network: radios are 0 .. radios.length - 1, row-major by cell. */
  id: number;
  cellCol: number;
  cellRow: number;
  /** "C6-2" for cell (6, 2). */
  label: string;
  /** The unit the corner module is bolted onto. */
  unitId: number;
  x: number;
  y: number;
  /** Build stage of its unit. */
  stage: number;
  /** Build time at which its unit is placed (the radio shows violet), and at which it switches on: the end of
   *  its stage, when the stage's connection work is done. */
  placedS: number;
  onS: number;
}

export interface PlayBase {
  /** Node id in the network: always `radios.length`. */
  id: number;
  x: number;
  y: number;
  /** The base pad at the center, where no unit stands. */
  yard: Rect;
}

export interface PlayModel {
  config: PlayConfig;
  widthM: number;
  heightM: number;
  /** A cell is `lanesPerCell` lanes wide (x) and `unitsPerCell` units tall (y). */
  cellWidthM: number;
  cellHeightM: number;
  /** Center distance of units along a lane (north-south), and of lanes (east-west). */
  unitPitchM: number;
  lanePitchM: number;
  /** Unit footprint on the map: the long side runs north-south. */
  unitSizeXM: number;
  unitSizeYM: number;
  lanes: number;
  unitsPerLane: number;
  units: PlayUnit[];
  radios: PlayRadio[];
  /** Unit id of every lane slot (`lane * unitsPerLane + pos`), -1 in the base yard. */
  unitSlot: Int32Array;
  /** Radio id of every cell (row-major), -1 for a cell without one. */
  cellRadio: Int32Array;
  base: PlayBase;
  /** The build stages, from the base outward (D51). */
  stages: BuildStage[];
  /** Build time of the whole build: the end of the last stage. */
  buildS: number;
}

/** A team of one phase's machines on one face of a stage, and the units it works, in order. */
export interface BuildTeam {
  /** -1 west of the base, 1 east. */
  face: number;
  route: number[];
}

/**
 * One stage of the build (D51): the unbuilt units inside the coverage at its start. Every phase works the
 * whole zone, one after the other; at the end of the connection phase the zone's radios switch on.
 */
export interface BuildStage {
  index: number;
  units: number[];
  radios: number[];
  teams: BuildTeam[];
  /** Build time at which the stage starts, and the length of each of its phases. */
  startS: number;
  phaseS: number;
}

/** Build state of every unit and radio at one build time. */
export interface BuildState {
  /** Seconds since the start of the build. */
  elapsedS: number;
  /** 1 when the unit is placed. */
  unitPlaced: Uint8Array;
  /** 0 not placed, 1 placed but off (work in progress), 2 on. */
  radioState: Uint8Array;
  placedUnits: number;
  onRadios: number;
}

export const RadioBuild = { None: 0, Placed: 1, On: 2 } as const;

/** Index of the placement phase: the phase in which the crane sets the units down. */
function placementPhase(config: PlayConfig): number {
  return Math.max(
    0,
    config.frontierPhases.findIndex((p) => p.id === 'placement'),
  );
}

/** Share of a phase after which a team has worked the unit at `index` of a route of `length` units. */
export function routeShare(index: number, length: number): number {
  return length > 1 ? index / (length - 1) : 0;
}

export function buildPlayModel(config: PlayConfig = PLAY, site: SiteConfig = SITE): PlayModel {
  const unitPitchM = site.unitWidthM + site.unitGapM;
  const lanePitchM = config.rowPitchM;
  const lanes = config.cellCols * config.lanesPerCell;
  const unitsPerLane = config.cellRows * config.unitsPerCell;
  const cellWidthM = config.lanesPerCell * lanePitchM;
  const cellHeightM = config.unitsPerCell * unitPitchM;
  const unitSizeXM = site.unitDepthM;
  const unitSizeYM = site.unitWidthM;
  // The base pad: the middle basePadLanes lanes by the middle basePadUnits units.
  const padLane0 = Math.floor((lanes - config.basePadLanes) / 2);
  const padPos0 = Math.floor((unitsPerLane - config.basePadUnits) / 2);
  const inPad = (lane: number, pos: number) =>
    lane >= padLane0 &&
    lane < padLane0 + config.basePadLanes &&
    pos >= padPos0 &&
    pos < padPos0 + config.basePadUnits;

  // Every unit slot except the base pad, lane by lane.
  const units: PlayUnit[] = [];
  const slot = new Int32Array(lanes * unitsPerLane).fill(-1);
  for (let lane = 0; lane < lanes; lane++) {
    for (let pos = 0; pos < unitsPerLane; pos++) {
      if (inPad(lane, pos)) continue;
      slot[lane * unitsPerLane + pos] = units.length;
      units.push({
        id: units.length,
        lane,
        pos,
        x: (lane + 1 / 2) * lanePitchM,
        y: (pos + 1 / 2) * unitPitchM,
        stage: -1,
        team: -1,
        routeIndex: -1,
        placedS: Infinity,
      });
    }
  }

  // Each radio sits on the NE corner of the unit (of its cell) whose NE corner is nearest the cell
  // center; ties go to the lower unit id. A cell whose units all lie in the pad has no radio.
  const radios: PlayRadio[] = [];
  const cellRadio = new Int32Array(config.cellCols * config.cellRows).fill(-1);
  for (let row = 0; row < config.cellRows; row++) {
    for (let col = 0; col < config.cellCols; col++) {
      const cx = (col + 1 / 2) * cellWidthM;
      const cy = (row + 1 / 2) * cellHeightM;
      let best: PlayUnit | null = null;
      let bestD = Infinity;
      for (let l = 0; l < config.lanesPerCell; l++) {
        for (let u = 0; u < config.unitsPerCell; u++) {
          const id =
            slot[(col * config.lanesPerCell + l) * unitsPerLane + row * config.unitsPerCell + u];
          if (id < 0) continue;
          const unit = units[id];
          const d = Math.hypot(unit.x + unitSizeXM / 2 - cx, unit.y + unitSizeYM / 2 - cy);
          if (d < bestD) {
            best = unit;
            bestD = d;
          }
        }
      }
      if (!best) continue;
      cellRadio[row * config.cellCols + col] = radios.length;
      radios.push({
        id: radios.length,
        cellCol: col,
        cellRow: row,
        label: `C${col}-${row}`,
        unitId: best.id,
        x: best.x + unitSizeXM / 2,
        y: best.y + unitSizeYM / 2,
        stage: -1,
        placedS: Infinity,
        onS: Infinity,
      });
    }
  }

  const yard: Rect = {
    x: padLane0 * lanePitchM,
    y: padPos0 * unitPitchM,
    w: config.basePadLanes * lanePitchM,
    h: config.basePadUnits * unitPitchM,
  };
  const base: PlayBase = {
    id: radios.length,
    x: yard.x + yard.w / 2,
    y: yard.y + yard.h / 2,
    yard,
  };

  const stages = planStages(config, units, radios, base, unitSizeXM, unitSizeYM);
  return {
    config,
    widthM: lanes * lanePitchM,
    heightM: unitsPerLane * unitPitchM,
    cellWidthM,
    cellHeightM,
    unitPitchM,
    lanePitchM,
    unitSizeXM,
    unitSizeYM,
    lanes,
    unitsPerLane,
    units,
    radios,
    unitSlot: slot,
    cellRadio,
    base,
    stages,
    buildS: stages.length > 0 ? stageEndS(config, stages[stages.length - 1]) : 0,
  };
}

/** Build time at which a stage's last phase ends and its radios switch on. */
function stageEndS(config: PlayConfig, stage: BuildStage): number {
  return stage.startS + config.frontierPhases.length * stage.phaseS;
}

/**
 * The staged build (D51). A stage's work zone is every unbuilt unit whose footprint lies inside the coverage
 * of the base and the radios already on; its teams work the zone from the base outward, lane by lane, and
 * when the stage ends the zone's radios switch on and the next stage works the newly covered ground.
 */
function planStages(
  config: PlayConfig,
  units: PlayUnit[],
  radios: PlayRadio[],
  base: PlayBase,
  sizeX: number,
  sizeY: number,
): BuildStage[] {
  const r = config.coverageRadiusM;
  const sources: { x: number; y: number }[] = [{ x: base.x, y: base.y }];
  const covered = (x: number, y: number) => sources.some((p) => Math.hypot(p.x - x, p.y - y) <= r);
  const corners = [-1, 1];
  const inside = (u: PlayUnit) =>
    covered(u.x, u.y) &&
    corners.every((dx) =>
      corners.every((dy) => covered(u.x + (dx * sizeX) / 2, u.y + (dy * sizeY) / 2)),
    );
  const radioOfUnit = new Map(radios.map((radio) => [radio.unitId, radio]));
  const { teamsPerFace, unitWorkS, minPhaseS } = config.build;
  const placing = placementPhase(config);

  const stages: BuildStage[] = [];
  let left = units.slice();
  let startS = 0;
  while (left.length > 0) {
    const zone = left.filter(inside);
    if (zone.length === 0) {
      throw new Error(
        `The coverage cannot reach the ${left.length} units left after stage ${stages.length}.`,
      );
    }
    const index = stages.length;
    const teams: BuildTeam[] = [];
    for (const face of [-1, 1]) {
      const route = faceRoute(zone, face, base.x);
      for (let k = 0; k < teamsPerFace; k++) {
        const part = route.slice(
          Math.floor((k * route.length) / teamsPerFace),
          Math.floor(((k + 1) * route.length) / teamsPerFace),
        );
        if (part.length > 0) teams.push({ face, route: part.map((u) => u.id) });
      }
    }
    const longest = Math.max(...teams.map((t) => t.route.length));
    const phaseS = Math.max(minPhaseS, longest * unitWorkS);
    const stage: BuildStage = {
      index,
      units: zone.map((u) => u.id),
      radios: [],
      teams,
      startS,
      phaseS,
    };
    const endS = stageEndS(config, stage);
    teams.forEach((team, t) => {
      team.route.forEach((id, i) => {
        const unit = units[id];
        unit.stage = index;
        unit.team = t;
        unit.routeIndex = i;
        unit.placedS = startS + (placing + routeShare(i, team.route.length)) * phaseS;
        const radio = radioOfUnit.get(id);
        if (radio) {
          radio.stage = index;
          radio.placedS = unit.placedS;
          radio.onS = endS;
          stage.radios.push(radio.id);
        }
      });
    });
    stage.radios.sort((a, b) => a - b);
    for (const id of stage.radios) sources.push({ x: radios[id].x, y: radios[id].y });
    stages.push(stage);
    left = left.filter((u) => u.stage < 0);
    startS = endS;
  }
  return stages;
}

/** The zone's units on one face in work order: lane by lane from the base outward, alternating direction. */
function faceRoute(zone: PlayUnit[], face: number, baseX: number): PlayUnit[] {
  const mine = zone.filter((u) => Math.sign(u.x - baseX) === face);
  // Ascending face * lane runs from the base outward on both faces.
  const lanes = Array.from(new Set(mine.map((u) => u.lane))).sort((a, b) => face * a - face * b);
  const out: PlayUnit[] = [];
  lanes.forEach((lane, k) => {
    const inLane = mine.filter((u) => u.lane === lane).sort((a, b) => a.pos - b.pos);
    out.push(...(k % 2 === 0 ? inLane : inLane.reverse()));
  });
  return out;
}

/** The radio of a cell, or undefined when the base pad covers all its units. */
export function radioAt(model: PlayModel, col: number, row: number): PlayRadio | undefined {
  const id = model.cellRadio[row * model.config.cellCols + col];
  return id >= 0 ? model.radios[id] : undefined;
}

/** The radio id of a cell. */
export function cellRadioId(model: PlayModel, col: number, row: number): number {
  const radio = radioAt(model, col, row);
  if (!radio) throw new Error(`Cell (${col}, ${row}) has no radio.`);
  return radio.id;
}

/** Build state at a build time; before the build only the base stands, after it the build is finished. */
export function buildStateAt(model: PlayModel, elapsedS: number): BuildState {
  const unitPlaced = new Uint8Array(model.units.length);
  const radioState = new Uint8Array(model.radios.length);
  let placedUnits = 0;
  let onRadios = 0;
  for (const unit of model.units) {
    if (unit.placedS <= elapsedS) {
      unitPlaced[unit.id] = 1;
      placedUnits++;
    }
  }
  for (const radio of model.radios) {
    if (radio.onS <= elapsedS) {
      radioState[radio.id] = RadioBuild.On;
      onRadios++;
    } else if (radio.placedS <= elapsedS) {
      radioState[radio.id] = RadioBuild.Placed;
    }
  }
  return { elapsedS, unitPlaced, radioState, placedUnits, onRadios };
}

/** Where the build is at a build time: the stage and phase at work and how far through the phase. */
export interface BuildClock {
  /** The stage at work; `stages.length` once the build is finished. */
  stage: number;
  /** Index into `frontierPhases`. */
  phase: number;
  /** Share of the phase done, 0 to 1. */
  frac: number;
  /** Build time at which the phase started. */
  phaseStartS: number;
  done: boolean;
}

export function buildClockAt(model: PlayModel, elapsedS: number): BuildClock {
  const phases = model.config.frontierPhases.length;
  const t = Math.max(0, elapsedS);
  for (const stage of model.stages) {
    const endS = stageEndS(model.config, stage);
    if (t >= endS) continue;
    const phase = Math.min(phases - 1, Math.floor((t - stage.startS) / stage.phaseS));
    const phaseStartS = stage.startS + phase * stage.phaseS;
    return {
      stage: stage.index,
      phase,
      frac: (t - phaseStartS) / stage.phaseS,
      phaseStartS,
      done: false,
    };
  }
  return { stage: model.stages.length, phase: 0, frac: 0, phaseStartS: model.buildS, done: true };
}

/** What a unit is going through at a build time (for its hover card): planned, a phase of its stage, live. */
export function unitStatusAt(
  model: PlayModel,
  unitId: number,
  elapsedS: number,
): { kind: 'planned' | 'work' | 'live'; phase: number; done: boolean } {
  const unit = model.units[unitId];
  const clock = buildClockAt(model, elapsedS);
  if (clock.stage < unit.stage) return { kind: 'planned', phase: 0, done: false };
  if (clock.stage > unit.stage) return { kind: 'live', phase: 0, done: true };
  const team = model.stages[unit.stage].teams[unit.team];
  const done = clock.frac >= routeShare(unit.routeIndex, team.route.length);
  return { kind: 'work', phase: clock.phase, done };
}

export { UnitState };

/** A unit's build state at a build time. */
export function unitStateAt(model: PlayModel, unitId: number, elapsedS: number): UnitState {
  const unit = model.units[unitId];
  if (unit.placedS > elapsedS) return UnitState.Planned;
  const status = unitStatusAt(model, unitId, elapsedS);
  if (status.kind === 'live') return UnitState.Live;
  const connection = model.config.frontierPhases.findIndex((p) => p.id === 'connection');
  if (status.kind === 'work' && status.phase === connection && status.done) {
    return UnitState.Commissioned;
  }
  return UnitState.Placed;
}
