// The radio the Build map's "Take me there" pin flies to (D121): the radio of the featured cell.
import { CORNER_PIN } from '../../config/cornerPin';
import type { PlayModel } from '../../engine/playModel';

/** The radio of the featured cell, or -1 when the cell has none. */
export function featuredRadio(model: PlayModel): number {
  const { col, row } = CORNER_PIN.featuredCell;
  return model.cellRadio[row * model.config.cellCols + col] ?? -1;
}
