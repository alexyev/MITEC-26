// Uniform-grid spatial index over 2D points for fast radius queries (CSR cell lists, no allocation per cell).
// Points are interleaved [x0, y0, x1, y1, ...] in meters; ids are point indices.

export interface SpatialIndex {
  readonly count: number;
  /** Appends ids of all points within `radius` of (x, y) (inclusive) to `out`, and returns `out`. */
  queryRadius(x: number, y: number, radius: number, out?: number[]): number[];
}

export function buildSpatialIndex(points: ArrayLike<number>, cellSizeM: number): SpatialIndex {
  const count = Math.floor(points.length / 2);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < count; i++) {
    const x = points[2 * i];
    const y = points[2 * i + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (count === 0) {
    minX = minY = maxX = maxY = 0;
  }
  const cols = Math.floor((maxX - minX) / cellSizeM) + 1;
  const rows = Math.floor((maxY - minY) / cellSizeM) + 1;

  const cellOf = (x: number, y: number): number =>
    Math.floor((y - minY) / cellSizeM) * cols + Math.floor((x - minX) / cellSizeM);

  // Counting sort of point ids by cell.
  const cellStart = new Int32Array(cols * rows + 1);
  for (let i = 0; i < count; i++) cellStart[cellOf(points[2 * i], points[2 * i + 1]) + 1]++;
  for (let c = 0; c < cols * rows; c++) cellStart[c + 1] += cellStart[c];
  const fill = cellStart.slice(0, cols * rows);
  const items = new Int32Array(count);
  for (let i = 0; i < count; i++) items[fill[cellOf(points[2 * i], points[2 * i + 1])]++] = i;

  function queryRadius(x: number, y: number, radius: number, out: number[] = []): number[] {
    const c0 = Math.max(0, Math.floor((x - radius - minX) / cellSizeM));
    const c1 = Math.min(cols - 1, Math.floor((x + radius - minX) / cellSizeM));
    const r0 = Math.max(0, Math.floor((y - radius - minY) / cellSizeM));
    const r1 = Math.min(rows - 1, Math.floor((y + radius - minY) / cellSizeM));
    const r2 = radius * radius;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const cell = r * cols + c;
        for (let k = cellStart[cell]; k < cellStart[cell + 1]; k++) {
          const id = items[k];
          const dx = points[2 * id] - x;
          const dy = points[2 * id + 1] - y;
          if (dx * dx + dy * dy <= r2) out.push(id);
        }
      }
    }
    return out;
  }

  return { count, queryRadius };
}
