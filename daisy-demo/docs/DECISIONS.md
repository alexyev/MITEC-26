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

## D11 - Exowatt theme (T1.3) - superseded

**Superseded in v3 (T2.1)** by the color story of spec section 5 and the design system of spec section 6: a dark map with five story colors, Inter, and every color and font size as a token in `src/ui/tokens.css`.
The header link of T1.3 became the "by Alexander Yevchenko" credit at the bottom center.
The text below is kept as the record of the T1.3 choice.


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

## D20 - Dock slots for the floating layout (T2.2)

The shell owns the layout of spec 6.2 as a CSS grid over the map, with one slot per place: `tl` (control panel), `tr` (readout card), `tools` (map tools), `br` (legend), `player` (player bar) and `float` (hover cards).
`Panel`, `Legend`, `PlayerBar` and `HoverCard` render into their slot through a React portal (`DockPortal` in `src/ui/kit/dock.tsx`), so a tab can return its map and panels in any nesting and they still land in the right place.
The readout card and the legend share the right column: the legend and the map tools stay at the bottom, and the readout card shrinks and scrolls inside itself when both do not fit, so they never overlap.
Outside a shell (tests, isolated renders) the components render in place.
Hover-card coordinates are in map pixels, and the map fills the viewport, so they are viewport pixels too.

## D21 - Player clock semantics (T2.3)

The clock is a pure function of the steps and `{ t, playing }` (`src/ui/player/clock.ts`); `usePlayer` advances it on animation frames, with each frame capped at `UI.player.maxFrameS` so a background tab does not jump ahead.
"Your turn" has no end, so while playing `t` keeps running inside it; a tab can use that running time for interactive motion, such as packets after a radio fails.
A walkthrough whose last step has an end stops there, and Play then starts it again.
`toYourTurn()` pauses and jumps to the start of the last step, as in the contract; inside "Your turn" it changes nothing, so every click there can call it safely, and a tab that animates its "Your turn" calls `play()` after it.
Step forward goes to the start of the next step; step back goes to the start of the current step when more than `UI.player.stepBackGraceS` (1 s) into it, else to the previous step; from "Your turn" it always goes to the previous step.
Seeking and stepping keep the playing state; `restart()` plays from the start and calls the optional `onRestart` of `usePlayer`, where a tab puts its inputs back to the defaults.
The player opens paused on its first step, so the viewer presses Play.

## D22 - Keyboard (T2.3)

Space plays and pauses, Left and Right step, from anywhere on the page except text fields.
A button keeps focus after a mouse click; Space then plays and pauses instead of clicking that button again, while a button focused with the keyboard keeps its native Space.
The segmented tab switch is a radio group: Left and Right move its selection and do not step the player.

## D23 - Stub tabs (T2.2)

Until workers B and C replace them, the Survey tab shows the full-site map with the planned units and the base, and the Build & failure tab shows the 540-unit play-model section as planned units with the base and its coverage circle (geometry in `UI.buildStub`).
Each stub has a two-step walkthrough ("Site" or "Section", then "Your turn"), a step list and a legend, and no readout card, because it has no numbers to show yet (D10).
The stubs do not show the unit count, which still comes from the 80,000-unit site until T3.1 re-targets it.

## D24 - Map tools and fit padding (T2.2)

The scale bar, zoom and fit buttons of T1.3 moved from the top right (now the honesty badge and the readout card) into one small toolbar above the legend.
The T1.3 legend inside the map is gone; each tab shows the kit `Legend` with only its own meanings (spec 5.1).
Map fits use `UI.mapFitPaddingPx`, which clears the top row, both 320 px docks and the player bar, so the site lands in the gap between the panels (spec 6.2).
`MapView` takes the build day as a prop (default 0, all units planned), because the build-day slider is hidden in v3; planned units are thin outlines in `--c-unit-planned`, and the base is a white square on a dark halo, with no text label.

## D25 - Tokens beyond spec 5.2 and 6.3 (T2.1)

`tokens.css` adds alpha variants of the story colors for map layers (`--c-signal-fill`, `--c-signal-link`, `--c-data-route`, `--c-unit-planned`, `--c-work-path`), the map ground and outline, type sizes `--fs-11` to `--fs-20`, spacing, durations and the layout widths; the variants keep the hue and meaning of their story color.
Canvas code reads them once with `readColorTokens()` and builds fonts with `canvasFont()` (`src/ui/kit/tokens.ts`), so no file but `tokens.css` holds a color or a font size; `tests/tokens.test.ts` checks this.
A legend `fill` or `circle` swatch uses the token's area tint (`--c-<token>-area`) and edge (`--c-<token>-edge`) when defined, so the coverage swatch matches the coverage on the map.

## D30 - The v3 site: 23,000 units and one lane pitch (T3.1)

The site is 2,000 acres with exactly 23,000 units: 25 units per lane, 10 block columns (250 units per lane row) and 92 lane rows.
This replaces the 80,000-unit numbers of D2 and D3; the 92 lane rows spread over 5 block rows of 18 or 19 lanes, as D2 describes.
With so few lane rows the lane pitch is about 21.6 m, so the corridor between two lanes (about 19.2 m clear) is wider than a 10 m road.
The old pitch solver still used a 12.4 m center distance (unit depth plus road) across each block-row road, which made the lanes either side of a road closer together than the lanes inside a block, and pushed the pitch to 22.1 m.
When the even pitch over all lane rows is at least the unit depth plus the road width, the generator now uses that even pitch everywhere and centers each block-row road in the lane corridor where the block rows meet.
The lane pitch is then 21.64 m everywhere, and the unit grid is 3,638 m by 1,972 m.
On denser sites, where the even pitch is smaller than a road, the generator keeps the old rule; the road rectangle formula gives the same position there.

## D31 - Survey paths and the surveyed-ground model (T3.2)

Spec 8.2 leaves a few details open; `src/engine/survey.ts` uses the simplest choice for each.

- The base is at the site center (D5), and the survey area is the unit grid, 3,638 m by 1,972 m (`unitGridRect` in `site.ts`).
- A strip of width W gets `ceil(W / swathM)` passes spaced evenly at `W / passes`, which is at most `swathM`, so the passes tile the strip exactly and no ground is driven twice.
- Each pass runs the full height of the area at the center of its sub-strip.
  The first pass starts at the north or south end nearer the base (south on a tie, which is the case for the center base).
- A 4x4 drives in a straight line from the base to the start of its first pass and from the end of its last pass back to the base, at `transitSpeedKmh`.
  The short shift from one pass to the next is driven at `surveySpeedKmh`; turns take no time.
- A strip east of the base starts at its west edge and a strip west of the base at its east edge; the strip that contains the base starts at its west edge.
- The ground is a grid of `cellM` cells.
  A cell is surveyed at the hour the pass over its sub-strip reaches the cell's center, so the surveyed share at any hour is one lookup in the sorted cell hours, and seeking works (spec rule 6).
- The map draws the surveyed ground as one rectangle per started pass (`surveyedRects`), which matches the cell share to within 1%.
- Unit conversions (m per km, Wh per kWh, hours per day) are in `src/config/units.ts`, because the engine allows no other numeric literals (D7).

With 1, 3 and 6 4x4s the survey takes 45.5 h, 15.3 h and 7.9 h, and the 4x4-hours stay between 45.5 and 47.1.

## D32 - The pricing file follows the cost workbook (T3.3)

`pricing.json` replaces the v2.1 file (bulk tiers, range scaling, per-module flat costs) with the keys of the team's workbook, as spec 10.1 shows; `PRICING_FORMAT.md` lists the workbook cell of every key.
Two values are constants inside the workbook's formulas rather than Inputs cells, so the file names them: `battery.fleetExtraPacks` (the `+2` packs of the reused fleet) and `battery.groundBoxFromWh` (the 1,000 Wh from which a pack sits on the ground).
The six setups keep the workbook's row order; `defaultSetup` is HaLow with integrated antennas, the workbook's recommendation.
The `PricingConfig` types of v2.1 are removed from `types.ts`; the file's type, `Pricing`, lives in `pricing.ts` with the engine that reads it (spec 13).
`NetworkCost` carries the contract fields of spec 13.1, where `moduleUsd` and `batteryUsd` are the prices of one module and one pack, plus the totals (`modulesUsd`, `batteriesUsd`, `subtotalUsd`), the pack size and the module grid (`gridCols` x `gridRows`) for the cost breakdown.
On the v3 site, lane pitch 21.64 m, HaLow gives M = 19 rather than the 20 of spec 10.2, but the grid is the same 9 x 5 = 45 modules and the total the same $74,616.
`PRICING` in `pricing.ts` is the shipped file, validated once when the app loads; its errors go to the console, and the cost section shows a warning when `PRICING.errors` is not empty.
