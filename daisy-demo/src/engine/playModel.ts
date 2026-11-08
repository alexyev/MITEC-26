// Play model of the Build & failure tab (spec 9.1, 9.2): units, radios and the base on a 9 x 5 radio grid,
// and the center-out build steps on which each unit is placed and each radio switches on.
import { SITE } from '../config/defaults';
import { PLAY, type PlayConfig } from '../config/play';
import type { SiteConfig } from './types';

/** A P3 unit. World frame: x grows east, y grows north; the play-model rectangle starts at (0, 0). */
export interface PlayUnit {
  /** Row-major: `id = lane * unitCols + col`. */
  id: number;
  col: number;
  lane: number;
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
}

export interface PlayModel {
  config: PlayConfig;
  widthM: number;
  heightM: number;
  cellWidthM: number;
  cellHeightM: number;
  unitPitchM: number;
  rowPitchM: number;
  unitWidthM: number;
  unitDepthM: number;
  unitCols: number;
  laneRows: number;
  units: PlayUnit[];
  radios: PlayRadio[];
  base: PlayBase;
  /** Number of steps that place units (one column pair each). */
  placeSteps: number;
  /** The step on which the last radio switches on; the build is complete from here. */
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
 * Center-out pairing of unit columns (decision D5): the two middle columns form step 1, the next two
 * step 2, and so on, so the build advances east and west at the same pace.
 */
function columnStep(col: number, unitCols: number): number {
  return Math.floor(Math.abs(col - (unitCols - 1) / 2)) + 1;
}

export function buildPlayModel(config: PlayConfig = PLAY, site: SiteConfig = SITE): PlayModel {
  const unitPitchM = site.unitWidthM + site.unitGapM;
  const rowPitchM = config.rowPitchM;
  const unitCols = config.cellCols * config.unitsPerCell;
  const laneRows = config.cellRows * config.lanesPerCell;
  const cellWidthM = config.unitsPerCell * unitPitchM;
  const cellHeightM = config.lanesPerCell * rowPitchM;

  const units: PlayUnit[] = [];
  for (let lane = 0; lane < laneRows; lane++) {
    for (let col = 0; col < unitCols; col++) {
      units.push({
        id: lane * unitCols + col,
        col,
        lane,
        x: (col + 1 / 2) * unitPitchM,
        y: (lane + 1 / 2) * rowPitchM,
        placedStep: columnStep(col, unitCols),
      });
    }
  }

  // Each radio sits on the NE corner of the unit (of its cell) whose NE corner is nearest the cell
  // center; ties go to the lower unit id.
  const radios: PlayRadio[] = [];
  for (let row = 0; row < config.cellRows; row++) {
    for (let col = 0; col < config.cellCols; col++) {
      const cx = (col + 1 / 2) * cellWidthM;
      const cy = (row + 1 / 2) * cellHeightM;
      let best: PlayUnit | null = null;
      let bestD = Infinity;
      for (let l = 0; l < config.lanesPerCell; l++) {
        for (let u = 0; u < config.unitsPerCell; u++) {
          const unit =
            units[(row * config.lanesPerCell + l) * unitCols + col * config.unitsPerCell + u];
          const d = Math.hypot(
            unit.x + site.unitWidthM / 2 - cx,
            unit.y + site.unitDepthM / 2 - cy,
          );
          if (d < bestD) {
            best = unit;
            bestD = d;
          }
        }
      }
      const unit = best as PlayUnit;
      radios.push({
        id: radios.length,
        cellCol: col,
        cellRow: row,
        label: `C${col}-${row}`,
        unitId: unit.id,
        x: unit.x + site.unitWidthM / 2,
        y: unit.y + site.unitDepthM / 2,
        placedStep: unit.placedStep,
        onStep: unit.placedStep + config.commissionLagSteps,
      });
    }
  }

  const base: PlayBase = {
    id: radios.length,
    cellCol: config.baseCell.col,
    cellRow: config.baseCell.row,
    x: (config.baseCell.col + 1 / 2) * cellWidthM,
    y: (config.baseCell.row + 1 / 2) * cellHeightM,
  };

  const placeSteps = columnStep(0, unitCols);
  return {
    config,
    widthM: unitCols * unitPitchM,
    heightM: laneRows * rowPitchM,
    cellWidthM,
    cellHeightM,
    unitPitchM,
    rowPitchM,
    unitWidthM: site.unitWidthM,
    unitDepthM: site.unitDepthM,
    unitCols,
    laneRows,
    units,
    radios,
    base,
    placeSteps,
    lastStep: Math.max(...radios.map((r) => r.onStep), placeSteps),
  };
}

/** The radio of a cell. */
export function radioAt(model: PlayModel, col: number, row: number): PlayRadio {
  return model.radios[row * model.config.cellCols + col];
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

/** Build step shown at a time since the build started (one step every `buildStepS`). */
export function buildStepAt(model: PlayModel, elapsedS: number): number {
  if (elapsedS <= 0) return 0;
  return Math.min(model.lastStep, Math.floor(elapsedS / model.config.buildStepS));
}

/** Playback time from the start of the build to the finished build. */
export function buildDurationS(model: PlayModel): number {
  return model.lastStep * model.config.buildStepS;
}
