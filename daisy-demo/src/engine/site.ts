// Site layout generator (spec 3.1-3.3): aligned lanes, columns, block grid, roads and corridor coordinates.
// Works in a lane frame (u along the lane axis, v across lanes) and maps to world x/y at the end.
import { SITE, SITE_COUNT_TOLERANCE } from '../config/defaults';
import type { Rect, Site, SiteConfig } from './types';

export function generateSite(config: SiteConfig = SITE): Site {
  const warnings: string[] = [];
  const areaM2 = config.areaAcres * config.acreM2;
  const widthM = Math.sqrt(areaM2 * config.aspect);
  const heightM = areaM2 / widthM;
  const ew = config.laneAxis === 'EW';
  const lengthU = ew ? widthM : heightM; // site extent along lanes
  const lengthV = ew ? heightM : widthM; // site extent across lanes

  const unitPitch = config.unitWidthM + config.unitGapM;
  const blockWidth = config.unitsPerLane * unitPitch;
  const usableU = lengthU - 2 * config.edgeMarginM;
  const usableV = lengthV - 2 * config.edgeMarginM;

  // Block columns that fit (a road sits between neighbouring blocks).
  const blockCols = Math.max(
    1,
    Math.floor((usableU + config.roadWidthM) / (blockWidth + config.roadWidthM)),
  );
  const cols = blockCols * config.unitsPerLane;
  const blockStrideU = blockWidth + config.roadWidthM;
  const totalBlocksU = blockCols * blockWidth + (blockCols - 1) * config.roadWidthM;
  const startU = config.edgeMarginM + (usableU - totalBlocksU) / 2;

  // Lane rows: as near as possible to the target; solve the row pitch so the lanes fill the height.
  const rowStep = config.unitDepthM + config.roadWidthM; // center distance across a road
  const spanV = usableV - config.unitDepthM;
  // A road between block rows needs a center distance of `rowStep`. When the even lane pitch is at
  // least that, the road fits inside a lane corridor and every lane row has the same pitch (D30).
  const pitchFor = (rows: number): { pitch: number; blockRows: number; roadStep: number } => {
    const blockRows = Math.ceil(rows / config.lanesPerBlock);
    const evenPitch = rows > 1 ? spanV / (rows - 1) : Infinity;
    if (evenPitch >= rowStep) return { pitch: evenPitch, blockRows, roadStep: evenPitch };
    const gaps = rows - blockRows;
    const pitch = gaps > 0 ? (spanV - (blockRows - 1) * rowStep) / gaps : Infinity;
    return { pitch, blockRows, roadStep: rowStep };
  };
  let rows = Math.max(1, Math.round(config.targetUnits / cols));
  let { pitch: rowPitch, blockRows, roadStep } = pitchFor(rows);
  const minPitch = config.unitDepthM + config.minRowClearanceM;
  if (rowPitch < minPitch) {
    while (rows > 1 && rowPitch < minPitch) {
      rows--;
      ({ pitch: rowPitch, blockRows, roadStep } = pitchFor(rows));
    }
    warnings.push(
      `Row pitch is below depth + ${config.minRowClearanceM} m; reduced to ${rows * cols} units (target ${config.targetUnits}).`,
    );
  }
  if (!Number.isFinite(rowPitch)) rowPitch = rowStep;

  // Spread lanes over the block rows as evenly as possible (decision D2).
  const lanesInBlockRow: number[] = [];
  const baseLanes = Math.floor(rows / blockRows);
  const extraLanes = rows % blockRows;
  for (let b = 0; b < blockRows; b++) lanesInBlockRow.push(baseLanes + (b < extraLanes ? 1 : 0));

  // v position of every lane row, block row of every lane row, and the corridor after it.
  const rowV = new Float64Array(rows);
  const rowBlock = new Int32Array(rows);
  let v = config.edgeMarginM + config.unitDepthM / 2;
  let row = 0;
  for (let b = 0; b < blockRows; b++) {
    for (let l = 0; l < lanesInBlockRow[b]; l++) {
      if (row > 0) v += l === 0 ? roadStep : rowPitch;
      rowV[row] = v;
      rowBlock[row] = b;
      row++;
    }
  }
  const laneCorridorV = new Float32Array(rows);
  for (let r = 0; r < rows; r++) {
    laneCorridorV[r] = r + 1 < rows ? (rowV[r] + rowV[r + 1]) / 2 : rowV[r] + rowPitch / 2;
  }

  // u position of every unit column and the corridor after it.
  const colU = new Float64Array(cols);
  const columnCorridorU = new Float32Array(cols);
  for (let c = 0; c < cols; c++) {
    const bc = Math.floor(c / config.unitsPerLane);
    const pos = c % config.unitsPerLane;
    const blockStart = startU + bc * blockStrideU;
    colU[c] = blockStart + pos * unitPitch + config.unitWidthM / 2;
    const unitEnd = blockStart + pos * unitPitch + config.unitWidthM;
    const lastInBlock = pos === config.unitsPerLane - 1 && bc < blockCols - 1;
    columnCorridorU[c] = unitEnd + (config.unitGapM + (lastInBlock ? config.roadWidthM : 0)) / 2;
  }

  // Per-unit arrays.
  const count = rows * cols;
  const centers = new Float32Array(2 * count);
  const unitBlock = new Int32Array(count);
  const unitLane = new Int32Array(count);
  const unitPosInLane = new Int16Array(count);
  const unitRow = new Int32Array(count);
  const unitCol = new Int32Array(count);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = r * cols + c;
      const bc = Math.floor(c / config.unitsPerLane);
      centers[2 * id] = ew ? colU[c] : rowV[r];
      centers[2 * id + 1] = ew ? rowV[r] : colU[c];
      unitBlock[id] = rowBlock[r] * blockCols + bc;
      unitLane[id] = r * blockCols + bc;
      unitPosInLane[id] = c % config.unitsPerLane;
      unitRow[id] = r;
      unitCol[id] = c;
    }
  }

  // Lane end points: from the first to the last unit edge of each lane.
  const laneCount = rows * blockCols;
  const laneX0 = new Float32Array(laneCount);
  const laneY0 = new Float32Array(laneCount);
  const laneX1 = new Float32Array(laneCount);
  const laneY1 = new Float32Array(laneCount);
  const laneLength = (config.unitsPerLane - 1) * unitPitch + config.unitWidthM;
  for (let r = 0; r < rows; r++) {
    for (let bc = 0; bc < blockCols; bc++) {
      const lane = r * blockCols + bc;
      const u0 = startU + bc * blockStrideU;
      const u1 = u0 + laneLength;
      laneX0[lane] = ew ? u0 : rowV[r];
      laneY0[lane] = ew ? rowV[r] : u0;
      laneX1[lane] = ew ? u1 : rowV[r];
      laneY1[lane] = ew ? rowV[r] : u1;
    }
  }

  // Road rectangles: one per gap between neighbouring blocks, in both directions.
  const roads: Rect[] = [];
  const toRect = (u: number, vv: number, du: number, dv: number): Rect =>
    ew ? { x: u, y: vv, w: du, h: dv } : { x: vv, y: u, w: dv, h: du };
  const vMin = config.edgeMarginM;
  const vMax = lengthV - config.edgeMarginM;
  for (let bc = 0; bc + 1 < blockCols; bc++) {
    roads.push(
      toRect(startU + bc * blockStrideU + blockWidth, vMin, config.roadWidthM, vMax - vMin),
    );
  }
  let rowCursor = 0;
  for (let b = 0; b + 1 < blockRows; b++) {
    rowCursor += lanesInBlockRow[b];
    // Centered in the corridor between the last lane of this block row and the first of the next.
    const roadV = (rowV[rowCursor - 1] + rowV[rowCursor] - config.roadWidthM) / 2;
    roads.push(toRect(startU, roadV, totalBlocksU, config.roadWidthM));
  }

  const errFraction = Math.abs(count - config.targetUnits) / config.targetUnits;
  if (errFraction > SITE_COUNT_TOLERANCE) {
    warnings.push(
      `Unit count ${count} differs from target ${config.targetUnits} by more than ${SITE_COUNT_TOLERANCE}.`,
    );
  }

  return {
    laneAxis: config.laneAxis,
    widthM,
    heightM,
    targetUnits: config.targetUnits,
    count,
    centers,
    unitBlock,
    unitLane,
    unitPosInLane,
    unitRow,
    unitCol,
    blockCols,
    blockRows,
    rows,
    cols,
    laneCount,
    unitsPerLane: config.unitsPerLane,
    unitPitchM: unitPitch,
    rowPitchM: rowPitch,
    blockWidthM: blockWidth,
    roadWidthM: config.roadWidthM,
    laneX0,
    laneY0,
    laneX1,
    laneY1,
    laneCorridorY: laneCorridorV,
    columnCorridorX: columnCorridorU,
    roads,
    warnings,
  };
}

/** World rectangle of the unit grid, out to the outer unit edges (the survey area of spec 8.2). */
export function unitGridRect(site: Site, config: SiteConfig = SITE): Rect {
  if (site.count === 0) return { x: 0, y: 0, w: 0, h: 0 };
  const ew = site.laneAxis === 'EW';
  const halfW = (ew ? config.unitWidthM : config.unitDepthM) / 2;
  const halfH = (ew ? config.unitDepthM : config.unitWidthM) / 2;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < site.count; i++) {
    const x = site.centers[2 * i];
    const y = site.centers[2 * i + 1];
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { x: x0 - halfW, y: y0 - halfH, w: x1 - x0 + 2 * halfW, h: y1 - y0 + 2 * halfH };
}
