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

## D5 - Front coordinate and the center-out build (T1.2, revised)

Each build order maps every unit to a scalar `frontKey` in meters, and units are built in `frontKey` order, so a front is a single number per day.
The default order is `centerOut`, by decision of the team: this is the only demo we plan to show, so the base sits at the center of the site and the build advances east and west at the same pace.
This overrides spec sections 3.4 and 8.2 where they disagree.
For `centerOut` the key is the east-west distance of the unit from the center line of the unit grid.
The distinct unit x values are paired from the outside in, and both columns of a pair get the same key, so mirrored columns tie exactly.
Ties are broken by y (south first) and then by unit id (west first), so the build alternates west, east inside every lane row.
Each face is therefore a straight north-south front: after every completed column pair all lane rows have advanced by the same number of units, and the two faces never differ by more than one unit.
The other keys are kept but nothing new supports them: x for west to east, y for south to north, distance from the origin for from-base, and distance along the build path for the block serpentine.
The serpentine goes block by block (rows of blocks alternate direction) and inside a block from the start side to the end side.
One base at the site center (the `center` base preset, `BASE.defaultPreset`) is the default wherever a default base is chosen, and the `fromBase` origin also defaults to the site center.
The block grid is centered in the site (D3), but the trailing 2 m gap of the last block puts the center line of the unit centers 1 m west of the site center; the build uses the unit grid's center line.

## D6 - Placed day numbering (T1.2)

Day numbers start at 1.
The unit with build rank r is placed on day `floor(r / unitsPerDay) + 1` and commissioned `placeToCommissionDays` days later.

## D7 - Numeric constants in the engine (T0.2)

The acceptance rule allows only 0, 1, 2 and math constants in `src/engine/`.
The mulberry32 constants live in `src/config/defaults.ts` (`MULBERRY32`) and are passed in, so `rng.ts` has no other literals.
`tests/engineConstants.test.ts` scans `src/engine/` for other numeric literals.

## D8 - Result.zones has two faces (T1.2, revised)

`Result.zones` is `{ west, east }`, and each face has `commissionFrontX`, `buildFrontX` and `workZoneEndX` in world x.
This replaces the single west-to-east fronts of spec section 9.
`faceZonesAt(schedule, day)` in `schedule.ts` produces it from the scalar fronts: west values are `centerX - front` and east values are `centerX + front`.
The edge zone of spec section 7.1 now exists on both faces, and each face holds about half of `placeToCommissionDays x unitsPerDay` units.
`faceZonesAt` refuses the single-front build orders; `Fronts` still carries a `kind` for them.

## D9 - Single-failure scenario with a center base (spec 8.2)

The scenario uses the default base preset (one base at the site center) instead of `west1`.
Spec 8.2 puts the watched source about 2 km east of the base, but with the base at the center the east face is only about 1.9 km long.
The source is set to 1.5 km east of the base, so the 800 m x 400 m window around it stays inside the site.

## D10 - Less is more (T1.3)

The dashboard shows only what works.
Menus, panels and controls without a function are hidden instead of shown as empty placeholders.
The map is the dominant element: it fills the page under a slim header.
The controls, metrics and chart panels of spec section 10.2 come back as their features arrive, and they are collapsed or on demand by default rather than always visible.
For T1.3 the only control is the build-day slider (spec 10.2), floating at the bottom of the map; the header buttons (Scenarios, Pricing, About) are hidden until they do something.
The "Simulated · Illustrative values" badge stays visible (spec 0.4).
Later work follows the same rule: add a control only together with its function, and prefer an overlay or a collapsed panel over a new always-visible one.

## D11 - Exowatt theme (T1.3)

The theme follows exowatt.com, inspected in the browser; where it conflicts with spec section 10.1, the Exowatt look wins.

- Page background: warm tan `#EAE8E3`.
  Light cards are white; dark cards are near-black `#0E0E0E`, like Exowatt's product imagery.
- Text: ink `#1D1D1D` for headings, `#434343` for body, labels `#8A8780`.
- Brand: orange `#FF7212`, with an orange to red-orange gradient (`#FF7212` to `#E8452C`) for emphasis.
- Font: Helvetica Neue (Arial fallback), weight 500 for headings, slightly negative letter spacing; small uppercase labels with wide letter spacing.
- Shape: large card radius (24 px) and pill-shaped controls; floating controls on the map use a dark translucent glass, like the Exowatt navigation bar.
- The map is a dark card so the unit states read clearly: commissioned units are brand orange, placed units are grey, not-placed units are dark outlines.
- State colors stay distinct from the brand orange: failure red `#E5383B`, healthy teal `#1D9E75`, battery and temporary amber `#F5B82E` (spec 10.1 had `#EF9F27`, too close to the brand orange), and base purple `#6F63E0` (spec 10.1 had `#534AB7`, too dark on the black map).

All colors are CSS variables in `src/ui/theme.css`; the map reads its colors from them.

## D12 - Map rendering (T1.3)

The unit layer is Canvas 2D.
When zoomed out it draws a pre-rendered raster of all units at 1.5 px per meter, kept as a mip pyramid (each level half the previous one) so the strong downscale at fit does not show moire.
Above 1.6 device pixels per meter it draws the visible units as vectors, one path per unit state.
The raster is re-rendered only when the build day changes.
Panning and zooming change only the view, which lives outside React and is drawn on animation frames.
This holds at least 50 fps with 80,000 units, so the unit layer does not need WebGL.

The fronts are drawn as dashed north-south lines at the outer edge of the front unit column, and the zones span the height of the unit grid.
A front usually runs through a partly finished column pair.
The build front is at the outer edge of the partly placed column.
The edge zone starts at the inner edge of a partly commissioned column (`Fronts.commissionFrontPartial`), so every placed but unpowered unit is inside the edge zone.
