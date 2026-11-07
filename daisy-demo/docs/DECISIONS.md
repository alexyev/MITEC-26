# Decisions

Unclear requirements and the simplest choice made for them (spec section 1, rule 5).

## D1 - Unit ids and extra site arrays (T1.1)

Unit ids are row-major in the lane frame: `id = row * cols + col`.
`Site` has `unitRow` and `unitCol` in addition to the arrays of the spec (`unitBlock`, `unitLane`, `unitPosInLane`).
The global lane id is `row * blockCols + blockCol`: a lane is one row of one block.

## D2 - Lanes per block row (T1.1)

80,000 units on 260 columns need 308 lane rows.
With 20 lanes per block this is 15.4 block rows.
The generator uses 16 block rows and distributes the lanes as evenly as possible (19 or 20 lanes per block row), so the last block row is not a stub.
The row pitch is solved so that the lanes fill the usable height.
This keeps the actual count within 0.2% of the target.

## D3 - Centering (T1.1)

The blocks that fit in the usable width take 3,812 m of 3,983 m.
The block grid is centered in the site.

## D4 - Corridor arrays (T1.1)

`laneCorridorY[row]` is the corridor on the +lane-row side of lane row `row` (the gap to the next lane, or the road center after the last lane of a block row).
`columnCorridorX[col]` is the gap after unit column `col` (the 2 m gap, or the road center after the last unit of a block).
For `laneAxis = 'NS'` the names are kept but the values are world x (lane corridors) and world y (column corridors).

## D5 - Front coordinate (T1.2)

Each build order maps every unit to a scalar `frontKey` in meters: x for west to east, y for south to north, distance from the origin for from-base, and distance along the build path for the block serpentine.
Units are built in `frontKey` order, so a front is a single number per day.
The serpentine goes block by block (rows of blocks alternate direction) and inside a block from the start side to the end side.
For `fromBase` the origin defaults to the middle of the west edge (the "1 base (west)" preset).

## D6 - Placed day numbering (T1.2)

Day numbers start at 1.
The unit with build rank r is placed on day `floor(r / unitsPerDay) + 1` and commissioned `placeToCommissionDays` days later.

## D7 - Numeric constants in the engine (T0.2)

The acceptance rule allows only 0, 1, 2 and math constants in `src/engine/`.
The mulberry32 constants live in `src/config/defaults.ts` (`MULBERRY32`) and are passed in, so `rng.ts` has no other literals.
`tests/engineConstants.test.ts` scans `src/engine/` for other numeric literals.

## D8 - Result.zones for non-x build orders (T1.2)

`Result.zones` is copied as written in the spec (x coordinates).
`Fronts` in `schedule.ts` carries a `kind` (`x`, `y`, `radial`, `path`) so later workers can draw the other build orders.
