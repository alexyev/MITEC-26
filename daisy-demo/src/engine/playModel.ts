// Play model of the Build & failure tab (spec 9.1, 9.2): north-south lanes of P3 units on a 9 x 5 radio grid,
// the base in its own yard at the center, and the build step and frontier phase of every lane (D46, D49).
import { SITE } from '../config/defaults';
import { PLAY, type PlayConfig } from '../config/play';
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
  /** Build step (1-based) on which the unit is placed. */
  placedStep: number;
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
  /** Build step on which its unit is placed. */
  placedStep: number;
  /** Build step on which the radio switches on: `placedStep + commissionLagSteps`. */
  onStep: number;
}

export interface PlayBase {
  /** Node id in the network: always `radios.length`. */
  id: number;
  cellCol: number;
  cellRow: number;
  x: number;
  y: number;
  /** The base yard: its whole cell, where no unit stands. */
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
  /** Radio id of every cell (row-major), -1 for the base cell. */
  cellRadio: Int32Array;
  base: PlayBase;
  /** Number of steps that place units (one lane pair each). */
  placeSteps: number;
  /** The step on which the last lane goes live; the build is complete from here. */
  lastStep: number;
}

/** Build state of every unit and radio at one step. */
export interface BuildState {
  step: number;
  /** 1 when the unit is placed. */
  unitPlaced: Uint8Array;
  /** 0 not placed, 1 placed but off (work in progress), 2 on. */
  radioState: Uint8Array;
  placedUnits: number;
  onRadios: number;
}

export const RadioBuild = { None: 0, Placed: 1, On: 2 } as const;

/**
 * Center-out pairing of lanes (decision D5): the middle lane (or the two middle lanes) is step 1, the next
 * pair step 2, and so on, so the build advances east and west at the same pace.
 */
function laneStep(lane: number, lanes: number): number {
  return Math.ceil(Math.abs(lane - (lanes - 1) / 2) - 1 / 2) + 1;
}

/**
 * Build steps of frontier work before a lane's units are placed: the phases outside the placement phase.
 * The first build step grades the middle lane, so the placement of a lane comes this many steps later.
 */
function placementLead(config: PlayConfig): number {
  return Math.max(
    0,
    config.frontierPhases.findIndex((p) => p.id === 'placement'),
  );
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
  const baseCol = config.baseCell.col;
  const baseRow = config.baseCell.row;
  const cellOf = (lane: number, pos: number) => ({
    col: Math.floor(lane / config.lanesPerCell),
    row: Math.floor(pos / config.unitsPerCell),
  });

  // Every unit slot except the base yard, lane by lane.
  const units: PlayUnit[] = [];
  const slot = new Int32Array(lanes * unitsPerLane).fill(-1);
  for (let lane = 0; lane < lanes; lane++) {
    for (let pos = 0; pos < unitsPerLane; pos++) {
      const cell = cellOf(lane, pos);
      if (cell.col === baseCol && cell.row === baseRow) continue;
      slot[lane * unitsPerLane + pos] = units.length;
      units.push({
        id: units.length,
        lane,
        pos,
        x: (lane + 1 / 2) * lanePitchM,
        y: (pos + 1 / 2) * unitPitchM,
        placedStep: laneStep(lane, lanes) + placementLead(config),
      });
    }
  }

  // Each radio sits on the NE corner of the unit (of its cell) whose NE corner is nearest the cell
  // center; ties go to the lower unit id. The base cell has no units and no radio.
  const radios: PlayRadio[] = [];
  const cellRadio = new Int32Array(config.cellCols * config.cellRows).fill(-1);
  for (let row = 0; row < config.cellRows; row++) {
    for (let col = 0; col < config.cellCols; col++) {
      if (col === baseCol && row === baseRow) continue;
      const cx = (col + 1 / 2) * cellWidthM;
      const cy = (row + 1 / 2) * cellHeightM;
      let best: PlayUnit | null = null;
      let bestD = Infinity;
      for (let l = 0; l < config.lanesPerCell; l++) {
        for (let u = 0; u < config.unitsPerCell; u++) {
          const id =
            slot[(col * config.lanesPerCell + l) * unitsPerLane + row * config.unitsPerCell + u];
          const unit = units[id];
          const d = Math.hypot(unit.x + unitSizeXM / 2 - cx, unit.y + unitSizeYM / 2 - cy);
          if (d < bestD) {
            best = unit;
            bestD = d;
          }
        }
      }
      const unit = best as PlayUnit;
      cellRadio[row * config.cellCols + col] = radios.length;
      radios.push({
        id: radios.length,
        cellCol: col,
        cellRow: row,
        label: `C${col}-${row}`,
        unitId: unit.id,
        x: unit.x + unitSizeXM / 2,
        y: unit.y + unitSizeYM / 2,
        placedStep: unit.placedStep,
        onStep: unit.placedStep + config.commissionLagSteps,
      });
    }
  }

  const base: PlayBase = {
    id: radios.length,
    cellCol: baseCol,
    cellRow: baseRow,
    x: (baseCol + 1 / 2) * cellWidthM,
    y: (baseRow + 1 / 2) * cellHeightM,
    yard: { x: baseCol * cellWidthM, y: baseRow * cellHeightM, w: cellWidthM, h: cellHeightM },
  };

  const placeSteps = laneStep(0, lanes) + placementLead(config);
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
    placeSteps,
    // Every lane goes live (powered) commissionLagSteps after its placement, radio or not.
    lastStep: Math.max(placeSteps + config.commissionLagSteps, ...radios.map((r) => r.onStep)),
  };
}

/** The radio of a cell, or undefined for the base cell. */
export function radioAt(model: PlayModel, col: number, row: number): PlayRadio | undefined {
  const id = model.cellRadio[row * model.config.cellCols + col];
  return id >= 0 ? model.radios[id] : undefined;
}

/** The radio id of a cell; the base cell has none. */
export function cellRadioId(model: PlayModel, col: number, row: number): number {
  const radio = radioAt(model, col, row);
  if (!radio) throw new Error(`Cell (${col}, ${row}) holds the base, not a radio.`);
  return radio.id;
}

/** Build state at a step; step 0 has only the base. Steps past `lastStep` show the finished build. */
export function buildStateAt(model: PlayModel, step: number): BuildState {
  const unitPlaced = new Uint8Array(model.units.length);
  const radioState = new Uint8Array(model.radios.length);
  let placedUnits = 0;
  let onRadios = 0;
  for (const unit of model.units) {
    if (unit.placedStep <= step) {
      unitPlaced[unit.id] = 1;
      placedUnits++;
    }
  }
  for (const radio of model.radios) {
    if (radio.onStep <= step) {
      radioState[radio.id] = RadioBuild.On;
      onRadios++;
    } else if (radio.placedStep <= step) {
      radioState[radio.id] = RadioBuild.Placed;
    }
  }
  return { step, unitPlaced, radioState, placedUnits, onRadios };
}

/** Phase of a lane before any frontier work. */
export const PHASE_PLANNED = -1;

/** Phase index of a lane at a build step: PHASE_PLANNED, an index into `frontierPhases`, or `phaseLive`. */
export function lanePhaseAt(model: PlayModel, lane: number, step: number): number {
  const { frontierPhases: phases, commissionLagSteps: lag } = model.config;
  const lead = placementLead(model.config);
  const placed = laneStep(lane, model.lanes) + lead;
  const d = step - placed;
  if (d < -lead) return PHASE_PLANNED;
  if (d < 0) return lead + d;
  if (d === 0) return lead;
  if (d < lag && lead + 1 < phases.length) return lead + 1;
  return phaseLive(model);
}

/** The phase index of a finished lane: one past the frontier phases. */
export function phaseLive(model: PlayModel): number {
  return model.config.frontierPhases.length;
}

/** A frontier lane: its phase and which face it is on (-1 west, 1 east, 0 the middle lane). */
export interface FrontierLane {
  lane: number;
  phase: number;
  face: number;
}

/** Lanes under frontier work at a build step, from the center outward on each face. */
export function frontierAt(model: PlayModel, step: number): FrontierLane[] {
  const out: FrontierLane[] = [];
  const mid = (model.lanes - 1) / 2;
  for (let lane = 0; lane < model.lanes; lane++) {
    const phase = lanePhaseAt(model, lane, step);
    if (phase === PHASE_PLANNED || phase === phaseLive(model)) continue;
    out.push({ lane, phase, face: Math.sign(lane - mid) });
  }
  return out;
}

/** Build step shown at a time since the build started (one step every `buildStepS`). */
export function buildStepAt(model: PlayModel, elapsedS: number): number {
  if (elapsedS <= 0) return 0;
  return Math.min(model.lastStep, Math.floor(elapsedS / model.config.buildStepS));
}

/** Playback time from the start of the build to the finished build. */
export function buildDurationS(model: PlayModel): number {
  return model.lastStep * model.config.buildStepS;
}
