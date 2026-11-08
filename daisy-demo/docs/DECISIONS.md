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

## D9 - Single-failure scenario with a center base (spec 8.2) - superseded

**Superseded in v3 (T4.4)**: the failure scenario no longer runs on the full site.
It runs on the play model of the Build & failure tab (spec 9.5), with the base on its own pad at the center and the failed radio in the middle of the watched route (D40, D41, D44, D46, D50).

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

The site is 2,000 acres with exactly 23,000 units and 25 units per lane.
With the north-south lanes of D33 and the base pad of D34, that is 5 block columns along the lanes (125 units per lane row) and 186 lane rows in 10 block rows of 18 or 19 lanes, as D2 describes.
This replaces the 80,000-unit numbers of D2 and D3.
With so few lane rows the lane pitch is about 21.5 m, so the corridor between two lanes (about 19 m clear) is wider than a 10 m road.
The old pitch solver still used a 12.4 m center distance (unit depth plus road) across each block-row road, which made the lanes either side of a road closer together than the lanes inside a block, and pushed the pitch to 22.1 m.
When the even pitch over all lane rows is at least the unit depth plus the road width, the generator now uses that even pitch everywhere and centers each block-row road in the lane corridor where the block rows meet.
The lane pitch is then 21.52 m everywhere, and the unit grid is 3,983 m (east-west) by 1,813 m (north-south).
On denser sites, where the even pitch is smaller than a road, the generator keeps the old rule; the road rectangle formula gives the same position there.

## D31 - Survey paths and the surveyed-ground model (T3.2)

Spec 8.2 leaves a few details open; `src/engine/survey.ts` uses the simplest choice for each.

- The base is on its pad at the site center (D5, D34), and the survey area is the unit grid, 3,983 m by 1,813 m (`unitGridRect` in `site.ts`), pad included.
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

With 1, 3 and 6 4x4s the survey takes 46.0 h, 15.5 h and 8.0 h, and the 4x4-hours stay between 46.0 and 47.6.

## D32 - The pricing file follows the cost workbook (T3.3)

`pricing.json` replaces the v2.1 file (bulk tiers, range scaling, per-module flat costs) with the keys of the team's workbook, as spec 10.1 shows; `PRICING_FORMAT.md` lists the workbook cell of every key.
Two values are constants inside the workbook's formulas rather than Inputs cells, so the file names them: `battery.fleetExtraPacks` (the `+2` packs of the reused fleet) and `battery.groundBoxFromWh` (the 1,000 Wh from which a pack sits on the ground).
The six setups keep the workbook's row order; `defaultSetup` is HaLow with integrated antennas, the workbook's recommendation.
The `PricingConfig` types of v2.1 are removed from `types.ts`; the file's type, `Pricing`, lives in `pricing.ts` with the engine that reads it (spec 13).
`NetworkCost` carries the contract fields of spec 13.1, where `moduleUsd` and `batteryUsd` are the prices of one module and one pack, plus the totals (`modulesUsd`, `batteriesUsd`, `subtotalUsd`), the pack size and the module grid (`gridCols` x `gridRows`) for the cost breakdown.
The golden tests use the workbook's own layout and reproduce its totals; the v3 site gives different numbers for HaLow, see D33.
`PRICING` in `pricing.ts` is the shipped file, validated once when the app loads; its errors go to the console, and the cost section shows a warning when `PRICING.errors` is not empty.

## D33 - P3 units stand north-south (captain's feedback)

The captain asked for the units to be vertically aligned, not horizontal, in both tabs.
`SITE.laneAxis` is now `'NS'`: lanes run north-south, so every unit has its 12.2 m long axis north-south and lanes are spaced east-west; the generator already supported both axes.
The site stays a 2:1 rectangle of 4,023 m by 2,012 m with exactly 23,000 units: a lane is still 25 units (355 m), 5 block columns fit along the 2,012 m height, and 186 lane rows (with the pad of D34) fill the width at a 21.52 m pitch.
The survey does not depend on the lane direction; its north-south passes now run along the lanes.
The build still advances east and west from the center line, now one lane row pair at a time.

The cost formulas of spec 10.2 count modules along a lane row and across lane rows, so the HaLow grid changes with the direction: `ceil(125 / 29) x ceil(186 / 19)` = 5 x 10 = 50 modules (was 9 x 5 = 45), 18 battery packs (was 17), and a total of $80,619 ($3.51 per container, $0.14 per kWh, 0.047% of the P3 hardware) instead of $74,616.
The workbook's own layout still gives its own totals (the golden tests); only the demo's site differs.
The spec's statement that the full-site grid equals the 9 x 5 play-model grid (open question 2) no longer holds; the cost readout reads the module count from `pricing.ts`.

## D34 - The base has its own pad (captain's feedback)

The captain asked for the base, which will be larger, to have its own area rather than a marker on top of the units.
`SITE.basePadLanes` x `SITE.basePadUnits` (10 lane rows x 25 units, one block length) unit places at the center of the unit grid are left empty, and the pad reaches halfway to the neighbouring units: about 215 m east-west by 365 m north-south (about 19 acres, 1% of the site).
To keep exactly 23,000 units the generator adds the missing places as extra lane rows; this needs the pad to remove a whole number of lane rows' worth of units (10 x 25 = 250 = 2 x 125), which one block length of 10 lanes does.
The pad is symmetric about the center line, so the center-out build stays mirrored (the faces never differ by more than one unit).
Unit ids stay row-major but skip the pad, so a unit is found by `unitRow` and `unitCol` rather than `row * cols + col` (this amends D1).
`Site.basePad` is the pad rectangle and `Site.base` its center, where the base stands; the survey's 4x4s start and end there.
The map draws the pad as a rounded area in the neutral site tones with the white base marker at its center.

## D35 - The unit layer is drawn at screen resolution (supersedes the raster pyramid of D12)

With the units standing north-south, a 2.44 m wide lane is under half a pixel at the full-site fit, and the downsampled raster of D12 blurred the lanes into a faint grey, so the direction of the units did not show.
The map now draws every visible unit at screen resolution, at least `MAP.unitMinPx` (1 CSS px) across, into a cache canvas that is redrawn only when the view or the build day changes; each frame copies the cache.
Planned units are outlines once they are `MAP.unitOutlineFromPx` (4 px) or more in both directions, and filled below that, where an outline would cover them anyway.
23,000 units redraw in a few milliseconds, so panning and zooming stay smooth, and the survey plays at 60 fps.

## D36 - Survey tab details (T3.4)

- A run in "Your turn" plays on the player clock (D21): Send records the player time and plays, so Space pauses and resumes the run, and the view stays a pure function of the inputs and `t`.
  When the last 4x4 is back, the run ends, the player pauses and the stepper unlocks; Restart also unlocks it and puts the walkthrough's 3 4x4s back.
- Seeking back into the walkthrough puts the defaults back, because the walkthrough always shows 3 4x4s.
- The planned path shows only what is still ahead of each 4x4: the drive out, the remaining passes, and the drive back once it starts, so the plan reads as strips rather than spokes from the base.
  Passes closer than `SURVEY_VIEW.minPassGapPx` on screen are thinned out (every k-th pass), and zooming in shows every pass.
- 4x4s at the base park in a row under the base marker, so the fleet reads as a fleet; the hover card works on parked 4x4s too.
- The readout card has one row for the site (acres and units) and one for elapsed and total hours, and puts the hourly rate next to the 4x4-hours, so the whole card, survey cost included, fits at 1280 x 720 without scrolling.
- The Done caption reads "Done in 16 h with 3 4x4s. ..." so it fits on one line of the player bar.
- The kit has no text button, so the Send button is styled in `src/ui/survey/survey.css` from the tokens (spec 6.5: 32 px, radius 8, light fill, dark text).
- By the captain's request the brand chip and the browser tab title read "Exowatt: Daisy Does It" (`UI.brand`, `index.html`).

## D37 - The site has a ground tint (T3.4 polish)

Compared with Schoolscape, whose map always has ground under the panels, the full site read as a thin outline on an empty field.
The map now fills the site rectangle with `--highlight` (white at 4%) inside its outline, a neutral tint, so the parcel reads as land; surveyed ground (`--c-done`) stays clearly lighter.

## D40 - Play-model radio position and build symmetry (T4.1)

Each radio sits on the NE corner of the unit whose NE corner is nearest its cell center: the second unit from the south in the cell's middle lane, about 1.6 m from the center.
The build places one lane per step on each side of the center, starting with the two middle lanes, so it advances east and west at the same pace, and mirrored radios switch on together.
Three steps of frontier work come before a lane's placement (D49), so with 30 lanes the units are placed by step 18 and every lane is live at step 20: the build plays in 14 s at 0.7 s per step, as the spec's walkthrough planned.

## D41 - Base links (T4.2)

The base is a radio with the same link range (spec 4), on its own mast at the center of its pad (D46).
It links to every radio within `linkRangeM`: the six radios of the cells on either side of the pad, (4, 1) to (4, 3) and (5, 1) to (5, 3).
So the watched route from (9, 2) is 5 hops before the failure of (7, 2) and 6 hops after it (D50).

## D42 - Backup next hop (T4.2)

A radio's backup next hop is its best other neighbor whose route avoids both the radio and the radio's next hop, so local repair never sends traffic back toward the radio that just failed.
The next hop is not avoided when it is the base, which never fails.
"Best" uses the route tie-breaks of spec 9.3: fewer hops, then nearer the base, then the lower id.
Coverage comes from `computeNetwork` as a share from 0 to 1, because the engine allows no numeric constants other than 0, 1 and 2 (D7); the UI shows it as a percentage.

## D43 - Packet simulation model (T4.3)

- A hop takes `hopS`.
  When the receiver has failed, the sender gets no acknowledgement at the end of the hop, keeps the packet in its queue and holds all traffic for that neighbor until its route changes.
  The dot of such a hop stops where the receiver failed.
- A failed radio's queued packets are lost; packets it was already sending still arrive.
  So the walkthrough's failure loses nothing.
- The neighbors declare a radio down when its third expected hello is missed: its last hello before the failure plus `missedHellosToDown x helloIntervalS`.
  A radio that rejoins first cancels the count.
- At detection, every neighbor that routed through the failed radio switches to its backup next hop at once (local repair).
  The new routes then spread from the detecting neighbors, and a radio `d` flood hops away switches to them `(d + 1) x updateFloodPerHopS` later.
  "Rerouted in" is the time from the failure until the last reachable radio has switched.
- Radios with no route queue their packets up to `bufferMaxPackets` and then drop them.
  A packet that has made `maxPacketHops` hops is dropped, so a short routing loop during a route update cannot run forever.
- A queue empties one packet every `queueFlushIntervalS`, so the flushed packets show as a short train of dots instead of one dot.
- A repaired radio rejoins at its next hello and the new routes spread from it and its neighbors.

## D44 - Timing of the walkthrough failure (T4.3)

The preset failure happens `failAfterHelloS` (0.05 s) after one of the failed radio's hellos, at or after the planned failure time.
The three missed hellos then fall exactly one interval apart, 0.95 s, 1.95 s and 2.95 s after the failure, so the walkthrough can put its step boundaries on them.

## D45 - Live simulation for clicks (T4.3)

`simulate` replays the whole history, which takes about 25 ms after ten minutes of play: more than one frame.
`createSim` keeps the simulation state, is advanced to the player time every frame, and applies a click at its frontier (the current player time).
The applied changes are kept in `result.changes`, and replaying them with `simulate` gives exactly the same events, so the view stays a pure function of its inputs and `t` (spec rule 6).

## D46 - Vertical units and the base pad (T4.1 revised, captain feedback)

The captain asked for the P3 units to stand vertically on the play model and for the base to have its own area.

- Lanes run north-south, and each unit's long side (12.2 m) runs north-south, as on the full site (D33).
  A cell is 3 lanes wide (63 m) and 4 units tall (56.8 m).
  Lane neighbors (along the lane, now north-south) are 56.8 m apart and column neighbors 63 m, so the link range of 75 m and the coverage radius of 46 m work as before.
- The base has its own pad at the center, like the full site's pad (D34): `basePadLanes` x `basePadUnits` (2 lanes by 4 units, 42 m by 57 m) slots with no units, drawn as an outlined pad with a larger base marker.
  Every cell keeps its radio, because the pad takes only the inner lane of each of the two middle cells, not their middle lanes, where the radios stand.
- With the grid of D50 the section is 30 lanes of 20 units, 630 m by 284 m: 592 units and 50 radios.
  The honesty label reads the grid and the unit count from the model.

## D47 - Build & failure view (T4.4)

- Coverage is the union of the connected circles with one fill, plus a 1 px edge around the union only, drawn on an offscreen canvas that cuts away every edge inside another circle.
  It is not clipped to the section, so the scalloped edge shows each radio's circle and a failed radio leaves a visible hole with its own edge.
  The map fits the section plus that edge between the panels.
- From the data step on, the watched route is drawn in blue.
  After a failure, the routes that went through the failed radio are drawn in blue on their current path, and after the reroute their old path is dashed grey.
- The upstream radio shows a "n queued" badge in the data color, and the failed radio shows "Missed hellos k/3", then "Down" for a second after detection.
  Cut-off radios get no queue badge: their queues only grow, and the hollow red ring already says they are cut off.
- The maintenance ticket appears below the failed radio when the walkthrough's "Recovered" step starts (detection plus the reroute step), so it never covers the new route, which goes north.
  In "Your turn" it shows for the latest detected failure that is still down.
- The readout card keeps "STRESS-TEST" for the latest failure even after a repair.
  Sent and delivered packets are a note under "Packets lost", and failed and cut-off radios are a note under "Radios online", so the card fits at 1280 x 720 next to the legend.
- The legend has one row for data and its route (both blue), so it shows 7 items.

## D48 - "Your turn" clicks (T4.4)

A click on a radio or Reset during the walkthrough jumps to "Your turn" and plays, because the packets and the reroute need the clock to run (D21).
A click fails an alive radio or repairs a failed one at the current time; the change goes into the live simulation at once (D45), and the failure, the coverage hole and any cut-off radios show in the same frame.
The reroute then follows the same detection as in the walkthrough, about 3 s later.
A click after seeking back drops the user's later changes, so the timeline forks there; Restart clears every user change.

## D49 - Construction phases at the frontier (T4.4, captain's request)

The captain asked to see the work move out at both faces as layers, with the equipment of each layer.
The layers are illustrative: they follow the construction sequence the team took from Exowatt's challenge video (`research/exowatt-company-research.md` section 3.2) and the autonomous equipment it cites; **Exowatt has not published its construction method**.
From the outermost layer inward:

1. Grading: a dozer levels the strip.
2. Foundations: a pile rig drives the piles.
3. Trenching: a trencher digs the cable trenches.
4. Placement: a carrier brings each unit and a crane lifts it onto its foundation.
5. Connection: a crew connects the cables, tests the unit and starts it; its radio is amber (waiting for power).
6. Live: the unit runs and its radio adds its coverage circle.

- The layers come from the existing build steps, not a separate clock: each layer takes one lane per step, a lane's placement is its build step, grading starts three steps before, and connection lasts until the radio switches on `commissionLagSteps` after placement (`lanePhaseAt`, `frontierAt` in `playModel.ts`).
  So at every step the layers sit side by side in this order, mirrored on both faces, and the build starts with grading the two middle lanes.
- The phases are `PLAY.frontierPhases`, so their names, equipment and order can change in the config.
- The map tints every lane under work with a faint work-amber band (outside the base pad), and draws each layer's equipment as a small amber side-view mark that drives along its lane during the step.
  The marks of different layers start at different points along their lanes, so a face reads as layers, not as one train.
- A machine inside the coverage of a connected radio or the base gets a small blue online dot, so the walkthrough shows the network reaching the frontier machines as it grows.
- Small uppercase labels name the layers once, above the east face, each on a hairline leader to its lane; near the right edge they flip to read leftward, so they never run under the readout card.
  The legend has no new colors; "Work in progress" (amber) covers the layers, the machines and the radios that wait for power.
- The walkthrough's build is two steps: "Build" ("Work moves out from the center in layers: grade, piles, trench, place, connect.") until the first radio switches on, then "Power".
- Hovering a unit shows its phase ("Foundations · pile rig at work", "Live · powered") and the phase number.

## D50 - One design: the play model uses the full-site cost grid (T4.4)

Worker B's cost on the north-south site (D33) puts the default HaLow design in a grid of 5 modules along the lanes by 10 across them: 50 modules for $80.6k.
The play model now uses that grid, 10 cells across by 5 down (`PLAY.cellCols`, `PLAY.cellRows`), so the play model and the cost readout describe one design, as spec open question 2 asks.
`tests/buildTab.test.ts` checks that the play grid and the radio count equal `networkCost`'s grid on the generated site, so a change to the pricing file or the site that changes the grid fails the tests instead of drifting silently.

- The walkthrough's radios are derived, not configured: the watched source is the east-most radio of the middle row, (9, 2), and the failed radio is the middle radio of its route, (7, 2) (`presetRadios`).
  Superseded by D70: the failure now happens mid-build, on a robot's route.
- On this grid the detour is 1 hop longer, not the spec's 2: the base also links (5, 3), so the route around (7, 2) through row 3 rejoins the base one hop early.
- Every number in the walkthrough's captions comes from the code: the "Recovered" caption from the network and a short simulation (packets lost and extra hops), and the "Cost" caption from `networkCost` (modules, total and share of the P3 hardware).
- The cost section shows the default setup, its total, per container, per kWh of storage and share of the P3 hardware, with the "Team estimate · not quotes" chip while the pricing file is not verified, and a breakdown of modules, batteries, base, spares and contingency with a bar for each share of the total.
  The breakdown opens by default from the "Cost" step on, and the cost section is outlined and scrolled into view during that step.

## D51 - The staged build: machines only work inside coverage (round 2, captain's feedback)

The captain saw machines working outside the green coverage, and "a machine can't operate if it's not connected".
With the old layers (D49) that could not be fixed by pacing: radio columns were 63 m apart and the illustrative coverage was 46 m, so every third lane lay out of reach until its own unit was placed.
The captain chose the real-life model instead: all work happens inside the coverage, in order, and the coverage grows when a ring is finished.

- **Real ranges, scaled.** The default HaLow setup has a reliable range of 500 m, and `networkCost` spaces its radios every 29 units along a lane (411.8 m) and every 19 lanes across (408.8 m) on the generated site.
  The play model keeps the ratio of range to column spacing: 63 m x 500 / 408.8 = 77 m for both `coverageRadiusM` and `linkRangeM` (the base uses the same radio).
  `tests/buildTab.test.ts` keeps the two equal, as D50 does for the grid.
- **The captain's assumption holds.** A finished column of radios covers a strip of sqrt(500² - 205.9²) = 455.6 m on each side along the whole lane, so the next column's radio spot, 408.8 m out, lies inside coverage with 47 m to spare.
  In the play model the strip is 71.6 m against a 63 m column spacing.
- **Stages.** Stage 1's work zone is every unit whose footprint lies inside the base's coverage.
  Every phase works the whole zone, one after another: grading, foundations, trenching, placement, connection.
  When the connection phase ends, the zone's radios switch on, the coverage grows, and the newly covered ground is the next stage's zone (`planStages` in `playModel.ts`).
  On the play model this gives 8 stages, outward on both faces; the last stage holds the two corner units that only the last radios reach.
- **Teams.** Three teams of each phase work each face, each on a route through its share of the zone: lane by lane from the base outward, alternating direction.
  Between two lanes a team drives along the lane it leaves, which is nearer the base and so already covered, then across.
  A phase lasts 0.035 s per unit of the longest route and at least 0.55 s, so the build plays in about 25 s at 1x.
  The crane sets each unit down as it passes (the unit turns grey), and the carrier trails the crane by one unit.
- **Offline machines stop.** A team advances only along ground the current network covers (`machinesAt` in `engine/machines.ts`).
  When a failure leaves it without coverage it stops where it stands, turns grey with a red "no link" ring, and resumes from the same point when coverage returns; the time it waited is lost.
  The walkthrough's failure and every "Your turn" click happen after the build, when no machines are on the map, so they are machine-free; the engine tests fail radios mid-build to check the rule.
  Superseded by D70: the walkthrough's failure now happens mid-build, with the machines at work; "Your turn" stays after the build.
- **Engine tests** (`tests/machines.test.ts`): at every tenth of every phase of every stage, every machine is online and inside a connected circle; every team route is covered along its whole length; a machine whose coverage fails stops, shows offline and resumes.
- **Overlap.** At the real ratio a failed radio's neighbors cover its cell, so the walkthrough's failure no longer opens a coverage hole: coverage stays at 100% while the data reroutes.
  The failure caption says so ("Its neighbors' circles overlap, so the ground stays covered."); failing a full column still cuts off the radios beyond it.
- **On the map** the stage's zone has a faint amber tint clipped to the coverage, and a small label above the section names the stage and phase ("STAGE 3 OF 8 · TRENCHING").
  Machines are 22 px dark tiles with the machine's side view in amber, a blue online dot and a soft amber work pulse (none with reduced motion).
  Hovering a machine shows its kind, phase and task and the radio it is connected through, or "Offline · no coverage, stopped".
  Hovering a unit shows its stage, and the phase at work there.
- The construction phases stay illustrative: Exowatt has not published its method (D49).
- The legend's red ring reads "Cut off or no link", for cut-off radios and offline machines.

## D52 - Playback speed (round 2, captain's request)

The player bar has a speed control after Restart: 1×, 2× and 4× (`UI.player.speeds`), with 1× titled "normal speed", the designed pace.
The speed multiplies the frame time in `clock.tick`, so step durations, the build, the packets and the survey's vehicles all scale together; `wallSeconds` gives a step's wall-clock length, and the clock tests cover both.
The speed is one setting for both tabs (`player/speed.ts`), so it persists when switching tabs.
Changing it never moves `t`, the step or the playing state, so it does not disturb "Your turn".
The Survey tab's "Sped up" note multiplies its hours per second by the speed, so it stays true.

## D53 - Fewer labels: the badge, the estimate chip, "to confirm" and the map note (round 2, captain's request)

The captain asked to remove the top-right "Simulated · Illustrative values" badge, the "Team estimate · not quotes" chip of the Build tab's cost, every "to confirm" label, and the play-model note under the Build map.
This overrides the honesty badge of spec 0.4 and D10.
Honesty stays in what is shown rather than in labels: a cost appears only where the team's cost workbook or the research gives one, and an option without a sourced cost shows its trade-off and no figure.
The construction phases stay marked illustrative in the code and in D49.
The Survey tab's cost chip is left to the Survey tab's own work.

## D54 - The cost is small and off to the side, with the alternatives behind it (round 2, captain's request)

The full-site network cost left the readout card, which now holds only CONNECT and STRESS-TEST.
It is a quiet chip at the right of the top row ("Network cost $80.6k"), in a new `top` dock slot; a click opens a card under it with the total, per container, per kWh of storage, share of the P3 hardware and the breakdown.
The card opens by itself during the walkthrough's "Cost" step; Escape or a click elsewhere closes it.
"Compare alternatives" opens a sheet over the dimmed view with two parts:

- **Radio setups:** all six setups of `pricing.json`, each costed with `networkCost` on the generated site, with its module count, a bar for its total and a one-line trade-off (`SETUP_TRADEOFFS`); ours is marked.
- **Other ways to connect the site:** our corner modules; one site base (Exowatt today, 30/30 online at 315 units and 3/37 at 1,668, from the challenge video, no cost); Exowatt's relay masts along the roads ($41k hardware and 1.7 kW for their example, 84% coverage when one relay fails); HaLow and Rajant relays on 58 solar masts; private LTE (CBRS); Starlink on every machine; and Starlink with Wi-Fi access points (the usual site setup, no sourced cost).
- The mast, LTE and Starlink costs are the workbook's Alternatives sheet, computed on the generated site by `engine/alternatives.ts` from `config/alternatives.ts` and the pricing file's base, labor, radio and contingency.
  On the workbook's own geometry the formulas reproduce its totals to the cent (`tests/alternatives.test.ts`); our site has the same area, units and build rate, so the totals match.
- A footnote names the sources.
- The research copy of the workbook differs from the older copy only by two Inputs rows (site area and aspect) that `pricing.json` does not use.

## D55 - Contrast of the data steps (round 2, captain's request)

From the data step on, while packets move, the map under the routes is dimmed (`--c-map-dim`), so coverage, units and idle links recede.
Since D70 that is while the robot's data and the failure play out mid-build, and again in "Your turn".
Live routes are 3 px of the data blue on a dark casing, packets are 4 px dots of full-strength blue on a dark ring, larger than the route is wide, and the replaced path is a dashed light grey (`--c-old-route`).
A failed radio is a red cross in a red ring.

## D56 - Hover cards never cover a panel (round 2)

`placeHoverCard` tries the four corners around the pointer (right and below first) and takes the first that clears every panel, the top row, the cost chip and the map tools, else the one that covers the least of them.

## D60 - Survey paths stay off the base pad (survey round 2, captain's feedback)

The captain asked that the 4x4s not drive over the base while they survey.
`planSurvey` now takes the base pad (`Site.basePad`, D34) and plans around it; the pad is not surveyed, and no other ground is left out.

- A strip that overlaps the pad is split at the pad's east and west edges into sections, each with `ceil(width / swathM)` evenly spaced columns, so the column boundaries meet the pad edges exactly and no sliver beside the pad is missed.
  A section narrower than `SURVEY.minSectionM` (1 m) joins its neighbor.
- A column beside the pad is surveyed in two half-passes, one from each end of the area to the pad edge, so every pass stops at the pad instead of crossing it.
- A 4x4 sweeps its strip from the edge nearest the base and surveys the side of the pad it reaches first; it sweeps the other side on its way back toward the start, so it ends next to the pad.
  The pad section has an even number of columns, so its first side ends where it began, and the section after the pad an odd number, so the 4x4 ends on the pad's far side; at most one column is added for this, and the spacing stays at most `swathM`.
- A strip whose west or east edge is at the base (an even fleet) starts there, next to the pad; the strip that contains the base starts at its west edge, as before (spec 8.2).
- Moves that the straight line would take across the pad go around it by its corners (`routeAround`, the shortest way on a six-point visibility graph); with the rules above this only happens for fleets larger than the stepper allows.
- A 4x4 leaves and enters the pad at its edge, where the straight line between the base and its first or last point meets the pad, so the base, inside the pad, is the only place a 4x4 is when it is on the pad.
- Cells whose center is on the pad have no survey hour (NaN) and do not count toward the surveyed share; the surveyed rectangles cover the area exactly, less the pad.
- `tests/survey.test.ts` checks for 1 to 8 4x4s that no leg crosses the pad (by `crossesRect` and by sampling every leg each metre), that no surveyed rectangle overlaps it, and that the surveyed ground is the whole area but the pad, with no overlaps.

The times barely move: 46.0, 15.5 and 8.0 h with 1, 3 and 6 4x4s, and the 4x4-hours stay between 46.0 and 47.4.
From the walkthrough's Done step on, the frame is exactly at the finish, so rounding in the step starts never leaves the last 4x4 at the pad edge instead of parked.

## D61 - A drone follows each 4x4, online through its Starlink (survey round 2, captain's request)

Each 4x4 carries a drone that flies with it; the drone's only link is its 4x4, whose Starlink carries the data, so a drone is online exactly when its 4x4 is (always, on this tab).

- The drone flies while its 4x4 is out on the site and rides docked on it at the base (`droneFlying`).
- On the map it follows `SURVEY_VIEW.droneTrailPx` (20 px) behind its 4x4 along the path the 4x4 drove (`trailPoint`), so it trails it down a pass and round each turn, never further back than where the 4x4 left the pad.
  The distance is fixed on screen, so it reads the same at every zoom.
- The mark is a small four-rotor drone (crossed arms, rotor rings and a body) in the work amber on a dark halo, on a short solid blue link to its 4x4: amber is equipment at work and blue is data moving (spec 5.2), so no new hue is needed.
  The legend adds "Drone" (a new `drone` swatch in the kit's `LegendSwatch`) and "Drone link".
- Hovering a drone shows its card ("Drone #2", "Online · via 4x4 #2 Starlink · Following"); the 4x4's card has a Drone row (flying or docked, linked), the base's card counts drones online, and the readout's CONNECT section shows "Drones online · via 4x4".
- The survey model does not change: the drone captures the same strip from the air at the 4x4's pace, so the survey time stays the 4x4's.
  None of the research files gives a drone survey rate or swath, so the demo does not claim a faster survey.
- Captions: "Each 4x4 gets its own strip; the paths stop at the base pad, never cross it." (Paths), "Each 4x4 carries Starlink and a drone that follows it, online through the 4x4." (Survey), and the Done caption now says more 4x4s finish sooner in the same 4x4-hours, since Starlink and drones are per 4x4.

## D62 - The survey cost shows only sourced prices (survey round 2, captain's request)

The survey cost adds what each 4x4 needs besides its hours: a Starlink kit with its mounting, Starlink service for the survey, and a drone.

- `pricing.json` `survey` holds `starlinkKitUsd` ($649, Starlink Mini with shipping), `starlinkMountUsd` ($150, mounting and power) and `starlinkPlanUsdPerMonth` ($250, Business Mobile Priority), the cost workbook's Alternatives sheet cells B59, B62 and B60, and `starlinkBillingDays` (30, the workbook's month in B61).
  Service is billed per terminal in whole months of the survey time, at least one.
- By the captain's request, only a sourced price is shown as a cost: a number from the team's workbook or the research files.
  `survey.unverified` lists the keys whose value is a placeholder; `vehicleHourUsd` keeps the spec's $150 but is listed there, and `droneUsd` is `null` because no research file prices a drone.
  `surveyCost` returns null for any part without a sourced price, the sum of the sourced parts, and whether that sum is complete.
- The Survey tab's "Team estimate · not quotes" chip is removed, as on the Build tab (D53); no "to confirm" label is shown anywhere.
  Where a part has no sourced price, the card says what the figure leaves out ("Without the 4x4 hire and the 3 drones: no sourced price yet.") instead of showing a placeholder.
- When a sourced hourly rate or drone price lands in the file (and leaves `unverified`), the 4x4 hire and drones rows appear, and the chip reads "Survey cost" with the whole total.

With 3 4x4s the sourced cost is $3.15k: 3 x $799 for the kits and mounting, and 3 x 1 month x $250 of service.

## D63 - The survey cost is small and off to the side, with the alternatives behind it (survey round 2)

The survey tab uses the Build tab's cost pattern (D54) rather than a second one: a quiet chip at the right of the top row ("Survey connectivity $3.15k"), a card under it with the cost, the 4x4-hours and the breakdown with a bar for each share, and "Compare alternatives", which opens a sheet over the dimmed view.

- The chip, card and sheet reuse the Build tab's classes from `ui/build/build.css` (`cost-chip`, `cost-card`, `build-breakdown`, `alts-*`); the components are the Survey tab's own (`SurveyCostChip`, `SurveyAlternativesSheet`), because the Build tab's are typed to the network cost.
  The survey rows have no bar column, since only one approach has a cost to scale against.
- The cost left the readout card, which now holds MODEL and CONNECT only and fits at 1280 x 720 with the drone row.
- The card opens by itself during the walkthrough's Done step, next to the caption with the finish time.
- The comparison lists our approach (4x4s with drones, Starlink on each) and four others, each with a one-line trade-off (`SURVEY_ALTERNATIVES`): a survey crew with GPS rovers, drones only with ground control, an aerial survey contractor, and the quadruped robot (GO2) from Exowatt's challenge video.
  No research file prices any of them, so only ours shows a figure, marked "Starlink only" while it is incomplete; the footnote names the sources (the workbook for Starlink, the brief and video for the GO2, the connectivity research for RTK).

## D64 - No "Starlink on every machine" alternative (survey round 2, captain's request)

The Build & failure sheet showed "Starlink on every machine" at about $33.6k, below our $80.6k network.
The captain asked to remove it, since it does not solve the links going down: each machine has only its own dish, with no local link between machines, crews or units, and a blocked dish leaves the machine alone.
The option is gone from the sheet (`ui/build/alternatives.ts`), from `engine/alternatives.ts` and from `config/alternatives.ts` (`STARLINK_PER_MACHINE`), and `AlternativeSite` keeps only the site area, which is all the remaining options use.
"Starlink and Wi-Fi access points" stays, and the Survey tab's Starlink on each 4x4 (D61, D62) is unchanged, as is the survey comparison, which has no Starlink-on-every-machine option either.

## D70 - The failure happens mid-build, on a robot's data (round 3, captain's request)

The captain asked to stop mid-construction and show a failure through a robot sending its data, rather than pausing after the build and showing the radios' traffic.
This supersedes the "failure only after the build" of D51 and the after-build failure scene of the walkthrough (D44, D47, D50).

- **The moment.** The build holds halfway through the foundations phase of the middle stage: stage 5 of 8, 32 of 50 radios on (`failureScenario` in `engine/scenario.ts`, `PLAY.scenario`).
  The stage, phase and share are config; the robot and the radios follow from the model.
- **The robot.** Of that phase's machines on the east face, the one whose covering radio is furthest from the base in hops, then the one nearest the base's row: a pile rig covered by C8-2, 4 radio hops from the base.
  It sends its task status and safety messages four times a second (`robotPacketIntervalS`, 0.25 s, a placeholder) while the build holds.
- **The failed radio** is the middle radio between the robot's radio and the base on that route: C6-2.
  Its neighbors miss 3 hellos (D44), C7-2 holds the data in its queue, switches to its backup C7-3 at detection (D42), and the new route spreads; the robot's route is 1 hop longer and no packet is lost.
- **The robot stays online, truthfully.** C6-2 does not cover the robot, and the coverage rule (D51) is checked with C6-2 down: C8-2 still covers it, so it keeps working, and the failure caption says so.
  If a failure took away its coverage, the same rule would stop it and the caption would say it stops (`tests/robotSource.test.ts` checks that case in the engine).
- **The hold.** The build clock stands still from the robot step to the resume step (`buildTimeAt`, `timeOfBuild` in `ui/build/walkthrough.ts`): the network reacts in seconds and the build takes weeks, so the robot step's caption opens with "Time slows mid-build", and the player bar says "Packets slowed for visibility".
  The machines keep their places and their work pulse while it holds.
- **After the failure, a repair.** Of the two truthful ways on (repair it, or build around it), repair is the simpler: the maintenance ticket goes out at the "Recovered" step, and the crew's swap goes in when the build resumes (about 15 min, a placeholder, is nothing on the build's time scale).
  The radio rejoins at its next hello (D43), so the rest of the build runs on the network its stages were planned for, and the "Coverage" step and "Your turn" start with every radio up.
- **Steps:** Section, Build, Power, Robot data, Failure, Detection, Reroute, Recovered, Resume, Coverage, Cost, Your turn.
  Every name and number in the captions comes from the code: the robot's kind, its radio and hops, the failed radio, the queueing radio, the backup from the local-repair event, the queued packets just before detection, packets lost and the extra hops from a short simulation of the hold.
- **On the map,** while the robot sends the map is dimmed as in D55 and the robot's route is the one cased blue route, from its tile through its radio to the base; after the reroute its old route is dashed grey.
  The robot has a 1.5 px data-blue frame around its tile and a "Pile rig · sending" badge above it; its packets are the full-size bright dots, and the radios' own traffic shows as smaller, fainter dots; the other machines fade to 45%.
  The readout's last row reads "Extra hops, pile rig route" while the robot sends, and "Extra hops, C8-2 route" after.
  Hovering the robot shows the radio it sends through, its hops to the base and the packets it has sent.
- **Between the failure and "Your turn"** the dim lifts and no packets are drawn, so the rest of the build and the cost read as before; the simulation keeps running underneath, so the readout's numbers stay live.
- "Your turn" is unchanged (D48), with the robot's radio, C8-2, as its watched route.

## D71 - Machines as packet sources, and radios that switch on mid-simulation (engine, D70)

- `SimInput.sources` lists machines that send their own data; a machine is node `graph.nodeCount + k` (`sourceNode`).
  It links through the nearest node within the coverage radius that has a route in the latest routing version: the coverage rule of D51 on the routes the network knows.
  It learns of a change when its radios do: it relinks at every detection, rejoin and switch-on, so when its radio fails it sends into silence, holds its packets for that radio, and relinks or stops linking at detection.
  With no radio in reach it queues up to `bufferMaxPackets` and sends the queue when coverage returns.
- Its hop to its radio is an ordinary hop: the same acknowledgement, queues and flushing as between radios (D43).
  `pathAt`, `hopsAt` (its own hop counted), `queueAt` and the new `sentByAt` read it back like any node, and the scene draws its hop from the machine's position.
- A radio's first switch-on is a change of kind `on`: the radio says hello at once, joins the routes, and the new routes spread from it and its neighbors as after a rejoin.
  The walkthrough's simulation starts at the hold with the radios that are on then (`online`) and switches the later stages' radios on as the build reaches them, so it runs unbroken into "Your turn".
- A repair only acts on a radio that failed, so an unbuilt radio cannot be "repaired" on.
- The machine's position is fixed in the input: the walkthrough's robot stands still while the build holds.
- Tests (`tests/robotSource.test.ts`): the same events for the same seed; detection within `missedHellosToDown x helloIntervalS +- helloIntervalS` with only built radios watching; the robot route around the failed radio; zero packets lost and every queued and robot packet delivered; the robot online by the coverage rule and linked through the same radio in the simulation; a robot whose every covering radio fails losing its link and resending its queue after the repair; a radio switched on mid-run joining and sending.

## D72 - The legend keeps 7 rows (D70)

The readout card and the legend share the right side, and at 1280 x 720 the card with STRESS-TEST fits only beside a 7-row legend (D47).
The legend adds "Route before reroute" (the dashed grey of D55, through `LegendItem.colorVar`) and drops "P3 unit": the units are the grey blocks the build sets down, and their hover card names them.
The robot needs no legend row: its badge on the map names it while it sends.

## D80 - Sourced survey rates (survey round 3, captain's question about the 11.6 h)

The captain asked where the survey time came from.
The 11.6 h on the captain's screenshot was the old model with 4 UTVs: a 20 m swath at 8 km/h on passes and 20 km/h in transit, placeholders from the v3 spec rewrite with no source (spec section 14).
With 1, 3 and 6 UTVs it gave 46.0 h, 15.5 h and 8.0 h.
The rates are now sourced, each with its source and the date it was read next to its value in `src/config/survey.ts`:

- **Transit, 24 km/h:** the 15 mph UTV limit on a utility-scale solar build (Cobra-Barrett Solar Project "Rules of the Road"; 10 mph near active work, which a pre-construction site has none of).
- **Pass spacing:** a ground-only RTK survey asks for passes 15 m apart on ground with relief, 15-30 m on flat ground and never more than 50 m (OptiSurface's field survey guide); a lidar drone at Propeller's 60 m ceiling for the Zenmuse L2, with 50% side overlap and the L2's 70 degree swath, flies lines 42 m apart.
  The drone maps the ground between the passes, so the passes can be 40 m apart (D83 keeps 40 m for the UTV's own lidar).
- **Pass speed:** RTK point logging runs at 7 km/h with turns (an 80-acre ATV grid at 50 ft spacing in about 3 hours, RPLS.com forum) to 15 km/h (OptiSurface: one point every 5 m at 1 s); D83 raises it for mobile lidar.

## D81 - The base pad is built up: no path, UTV or drone on it (survey round 3, captain's request)

The captain asked that the UTVs avoid the base area, since it is already built up.
Reproduced on main (161dac2) in the browser at 1280 x 720 and 1440 x 900, before and after Send: the planned passes, transit legs and the drawn paths already stopped at the pad (D60), so the captain's screenshot, with passes through the pad, was from a deploy before PR 8.
Two things still sat on the pad on main: the parked UTVs (in a row under the base marker, inside the pad) and the first and last leg of every UTV, which started and ended at the base inside the pad.
With 8 UTVs, the strip boundary between the 4th and 5th strip was also drawn through the pad.

- **One gate.** The UTVs leave and return at the pad's gate (`SurveyPlan.gate`), the middle of the pad's edge on the side where the survey starts (south, below the base); `VehiclePlan.home` is the gate, so a UTV at the base is at the gate, never on the pad.
  Every leg, the first and last included, routes around the pad from the gate (`routeAround`); before, legs left the pad wherever the line to the base crossed its edge.
- **Parked outside.** Before Send and after the return the fleet parks in a row just outside the gate (`SURVEY_VIEW.parkedBelowPx`), never on the pad, at any zoom.
- **Drawn as built up.** The pad is filled, hatched (`MAP.basePadHatchPx`) and outlined in a lighter edge (`--c-pad-fill`, `--c-pad-hatch`, `--c-pad-edge`), and the legend's "Base" row is now "Base · built up" with a hatched pad swatch around the base marker (`LegendItem.shape` 'pad').
  The strip boundaries break around the pad, and the base's hover card reads "Built up".
- **Tests.** `tests/survey.test.ts` checks for 1 to 8 UTVs that every UTV position and drone position, sampled over the whole run, is off the pad, and that the first and last leg start and end at the gate.
  `tests/surveyLayers.test.ts` records the rendered planned paths and strip boundaries for 1 to 8 UTVs, at 25 moments of the run, fitted and zoomed in up to 60x on the pad at both sizes, and checks that no stroked segment crosses the pad and that no UTV, parked UTV (halo included) or drone is drawn on it.

## D82 - Slower playback and a close-up on a UTV and its drone (survey round 3, captain's request)

The captain asked to slow down so the drone following its UTV can be seen.

- **Slower speeds.** The shared speed control is ¼×, ½×, 1×, 2× and 4× (`UI.player.speeds`), with 1× (`UI.player.normalSpeed`) where both tabs open; the slower speeds are labeled with fractions so the control stays compact, and their tooltips read "0.25× · slower" and "0.5× · slower".
  The clock multiplies its frame time by the speed (D52), so both tabs work at every speed; the clock tests cover all five.
- **A slower pace at 1×.** Half an hour of work plays in 1 s (`SURVEY.playbackHoursPerS`, 1 h before), and the player note reads it in minutes ("Sped up: 30 min of work plays in 1 s").
- **The close-up.** Partway through the Survey step the map zooms in on UTV #1 halfway down a southbound pass (`SURVEY_CLOSE_UP`): over 1.6 s the zoom eases to 1.8 px/m while the clock eases down to about five times real time, holds for 5 s while the UTV drives through the middle of the screen with its drone behind it on its link, and eases back out to the view it started from.
  Southbound, the UTV drives in from the open top of the map rather than from under the player bar.
  The clock's hours are the integral of the eased rate, so they are continuous and never run faster than the playback rate; hours, zoom and labels are pure functions of the step time, so seeking and stepping work (`surveyClock` in `ui/survey/walkthrough.ts`).
  In the hold the UTV and the drone carry labels ("UTV #1 · Starlink", "Drone #1 · via UTV"), faded in only as the zoom lands, and the player note reads "Up close: 1 s plays 4.8 s of work".
  With reduced motion the close-up cuts in and out instead of zooming.
- **The camera.** `MapView` takes an optional `camera` (target, zoom, blend), and `cameraViewport` slides the target on a straight screen line to the center of the area between the panels while the zoom eases geometrically.
  Panning or zooming hands the view back to the viewer until the camera clears; a cleared camera restores the view it started from, also when a seek skips the zoom out.
- **The drone stays distinct.** A drone follows at least 20 px on screen, and at least 18 m on the ground (`SURVEY_VIEW.droneTrailM`), so its link reads in the close-up too.

## D83 - Mobile lidar, field days and the overheads (survey round 3, captain's follow-up)

The captain asked whether the survey time includes refueling, turns and navigation, and to update it given how fast lidar is.
The model now adds every overhead the sources allow, and adopts vehicle-mounted mobile lidar on the UTVs.

- **Mobile lidar on each UTV.** Mobile lidar collects at road speed: TxDOT's design-grade specification sets its density at 60 mph, and YellowScan's Fly & Drive drives at 50 km/h typically.
  TxDOT cautions against ground models more than 50 ft past the pavement edge, about 20 m from the vehicle, so a pass covers about 40 m: `swathM` stays 40.
  The pace is then the site's, not the sensor's: 20 km/h on passes, under the 24 km/h UTV limit, to keep the scanner steady on unpaved ground.
  The drone keeps its role: it flies the UTV's line at 60 m with its own lidar (Propeller allows up to 9 m/s), and its 84 m swath sees every point twice and fills what the ground scanner cannot see.
- **U-turns.** The shift between passes is a half circle 40 m across, driven at 10 km/h (`turnSpeedKmh`), a team estimate: no source gives UTV turn times, and tractor studies time whole headlands.
- **Drone battery swaps.** The drone flies 35 min on a set of batteries (`droneFlightMin`): DJI rates the Matrice 350 RTK at 55 min with no payload, and the L2 and a landing reserve take the rest.
  It then lands on its UTV, which stops for 3 min (`droneSwapMin`, a team estimate) while the hot-swappable TB65 batteries are changed.
- **Refueling.** A Polaris Ranger XP 1000 carries 11.5 gal, and owners report about 130 miles a tank at slow speeds, so a UTV refuels every 180 km (`fuelRangeKm`), for 15 min where it stands (`refuelMin`, a team estimate); the drone swaps batteries during the refuel.
  Only a single UTV surveying the whole site drives that far (about 200 km).
- **Field days.** A field day is a 10-hour shift (`shiftH`, the shift solar builders post for site crews) that starts with 30 min setting up and checking the RTK base (`baseSetupH`, Trimble).
  `surveySchedule` counts the days the work needs and adds a setup to each.
- **On the map,** a stop is a `stop` leg: the UTV stands, its drone docks on it, and its hover card reads "Drone battery swap" or "Refueling".
  No stop is made on the way home.
- **In the readout,** the Elapsed row carries one note for the UTV that finishes last: its field days, then hours of driving, turns, drone swaps, fuel (when it refuels) and base setup, for example "1 field day: 3.2 h driving, 0.2 h turns, 0.3 h drone swaps, 0.5 h base setup".
  The readout still fits at 1280 x 720 with one UTV, whose note is the longest.
- **Times.** With 1, 3 and 6 UTVs the work on site takes 11.1 h, 3.7 h and 2.0 h, in 2, 1 and 1 field days (12.1 h, 4.2 h and 2.5 h with the base setups); before this round it was 46.0 h, 15.5 h and 8.0 h of driving only.
  The UTV-hours stay within 5% from 1 to 6 UTVs (11.0 h to 11.4 h), so the Done caption reads "More UTVs: less time, same UTV-hours", and the captions say "in a day" or "in 2 days" to stay on one line at 1280 x 720.
- **Not in the time:** processing the lidar data into a ground model, and placing ground control and checkpoints (TxDOT asks for at least 30 ground-truth points), which the UTVs' RTK can shoot along their passes.

## D84 - "UTV", the survey UTV's kit and what one costs (survey round 3, captain's request)

The captain asked to say UTV instead of 4x4, to show what a survey UTV would look like kitted out with lidar front and back, and whether $50k is a good all-in estimate for one.

- **UTV everywhere.** Every user-facing "4x4" (labels, captions, hover cards, the legend, the cost card, the alternatives and the map's strip labels) now reads "UTV", as do the code comments, tests and the current docs (`ASSUMPTIONS.md`, `PRICING_FORMAT.md`) and D80 onward; the code's identifiers were already "vehicle".
- **The drawing.** `UtvIllustration` is a side view of a utility UTV of the Polaris Ranger class, about 80 units to the meter: roll cage, cab, cargo bed, a lidar scanner on a bracket at each end with its scan fan to the ground, the RTK GNSS antenna and the Starlink Mini on the roof, a rugged computer and the drone's dock in the bed, and the lidar drone lifting off the dock.
  It is line art in the map's colors, all from tokens: amber for the drone (as on the map), blue for the lidar's scan, neutral greys for the vehicle; callouts name each part.
- **Where it is.** The cost card has a row "One survey UTV, all in" with the price, which opens the sheet "The survey UTV" in the Alternatives sheet pattern: the drawing, the parts with their prices, the total, and the lidar grades.
- **The kit, each part with its source and date in `src/config/utvKit.ts`:** the UTV (Polaris Ranger XP 1000, $21,499 MSRP plus $1,095 destination), two robotics-grade lidar scanners (Hesai XT32 class, $4,500 each), an RTK GNSS receiver (Emlid Reach M2 with antenna, $1,023), rugged compute (Connect Tech Rudi-NX with a Jetson Orin NX, $3,258), the Starlink Mini with its mounting and power ($799, the cost workbook), and the drone (DJI Matrice 350 RTK, $12,559, with the Zenmuse L2 lidar, $12,430).
  Integration and calibration (mounts, wiring, lidar-to-GNSS calibration) has no public price, so it shows "No public price" and is left out of the total.
- **Total:** $61.7k a UTV all in, without integration; $36.7k for the UTV and its ground kit without the drone; Starlink service is $250 a month on top.
- **The lidar grades** the sheet compares, front and back: robotics grade, $9k for two (priced); a survey-grade SLAM scanner (Stonex X120GO with its vehicle mount, $37.75k each, $75.5k for two); a mobile mapping system of the Trimble MX9 or Leica Pegasus TRK class, $400k to $1.2M a rig.
- **The captain's $50k** covers the UTV and its robotics-grade ground kit ($36.7k) with about $13k for integration, but not the M350 and L2 drone too ($25.0k, so $61.7k); with survey-grade lidar it is well over (the two SLAM scanners alone are $75.5k).
- The fleet's survey cost in the card is unchanged (Starlink only, D62); its note now says the hourly UTV rate has no source and points to the UTV's kit, which prices the drones.

## D90 - A home screen over the loaded map (home and tour round, captain's request)

The app opens on a short home screen, modeled on the Schoolscape landing in craft but not in color.

- It is not a separate page: the map loads underneath and shows through, blurred and dimmed (`--home-scrim`), and the home screen is a dialog over the shell; the shell behind it is `inert`.
- It holds the "Exowatt: Daisy Does It" title, two sentences on what the demo shows (the site's acres and units, the survey, the radio mesh and the reroute, all read from the code), one line on the two tabs, the primary "Open the demo" and a quiet second action, and a footer with how to reopen it and the credit.
- The title is set at 40 px (`--fs-40`), the one display size outside the spec's 11 to 20 px scale (6.4); nothing else on the home screen goes above 16 px.
- Leaving it is a same-page transition of 720 ms (`--dur-home`, `HOME.transitionMs`): the column lifts and fades, the backdrop fades, the map comes into focus from a slight zoom, and the top row and docks slide in from their edges, moving only transform, filter and opacity. Under reduced motion it is a 200 ms crossfade with nothing moving.
- The brand chip at the top left is now a button that reopens it (the map blurs again and the panels step away); Escape leaves it for the map.
- The page itself takes focus when it opens, not its first button, so no focus ring greets a mouse user; Tab reaches the actions, then the credit link.
- First visit: "Open the demo" goes into the guided tour (D91) once the map is in focus, and "Skip the tour" goes straight to the map. Once the viewer finished or skipped the tour, "Open the demo" goes straight in and the second action reads "Take the tour".

## D91 - The guided tour: eleven coach marks over both tabs (home and tour round)

A HubSpot-style product tour on the live app, not on screenshots: each step spotlights real UI, says what it is and what it means, and the viewer can use it there and then.

- **Steps** (`tourSteps` in `src/config/tour.ts`, data with copy, targets, the tab each step shows and an optional action): Two tabs; The map and its colors (the map and the legend, with four story-color swatches drawn by the legend's own `LegendSwatch`); Play the walkthrough; Steps and speed; Plan the survey (UTV count and Send); What it costs (the chip, its card, the survey UTV's kit and Compare alternatives); Now, Build & failure; The story (stages, the robot's data, the failure and the reroute); Hover for details; Your turn (fail and repair radios); That is the tour (the ? button and the brand).
- **Facts, not typed numbers.** The copy is a function of `TourFacts` (`src/ui/guide/facts.ts`): the acres and units of the generated site, the default and largest fleet, the survey time on site, the survey UTV's all-in price, the slowest, normal and fastest speeds, the tab names, the play model's stages and radios, the failure scenario's robot, uplink, hops and failed radio, and the missed hellos. No color is named in the copy, so a palette change cannot make it wrong.
- **Interactive steps** move on when the viewer does the thing, after a short tick (`TOUR.advanceDelayMs`): Press Play (a click on Play), Switch to Build & failure (the tab changes), Hover the map (the Build tab's hover is set) and Click a radio (a radio is failed or repaired). Next always works too.
- Entering a step switches to its tab; Hover and Your turn also move the Build walkthrough to "Your turn" (D94), so every radio is built and clickable.
- **Keys:** Enter or Right goes on, Left goes back, Escape exits. They are taken on the window in the capture phase, so the player does not also step; buttons keep Enter, and the tabs and the speed control keep their arrows.
- **Memory per viewer:** finishing or skipping (Skip tour, Escape, or reopening the home screen mid-tour) writes `exowatt-demo.tour.v1` to localStorage, in try/catch: when storage is blocked the session still remembers it and the app works the same. The ? button beside the brand replays the tour any time.

## D92 - Spotlight, callout and focus (home and tour round)

- **The dim** is one SVG path over the shell with a rounded hole per target, filled even-odd (`dimPath`): the dim catches clicks, the holes let them through to the real controls. A ring marks each hole, pulsing on the step's interactive target (steady under reduced motion).
- **Layers:** the dim sits above the panels and the cost card (z-index 3) and under the hover cards (the float layer is now z-index 4), so a hovered radio's card reads during the tour; the callout is above everything but the home screen. While a modal sheet (the Alternatives or the survey UTV) is open, the tour steps aside and comes back when it closes.
- **Holes** are measured every frame from `data-tour` targets (D93), so they follow panels that fold, cards that open and window resizes; the map's hole is its stage cut to the gap between the top row, the docks and the player, where the site is drawn (`TOUR_INSETS`). Neighbors whose rings would touch (the brand and the ? button) share one hole.
- **The callout** (320 px, a panel's width) goes beside its anchor: below a target in the top row, above one in the player's row, else right or left, whichever faces the middle; it may move in from the window's edge by at most its gap, and it is placed clear of every hole (a target with an open card counts as one), else where it covers the least (`placeCallout`). It glides between steps (`TOUR.glideMs`), and snaps under reduced motion.
- **Focus** moves into the callout on every step; Tab cycles through the callout's buttons and the spotlit controls only; ending the tour gives focus back to where it was before (the ? button, for example) and releases Tab.

## D93 - `data-tour` targets (home and tour round)

The tour finds its targets by stable `data-tour` attributes, never by class names or text: `brand`, `tour`, `tabs` and `map` in the shell; `steps` (the step list), `player`, `play` and `speed` in the player; `legend` in the legend; `fleet`, `cost` and `cost-card` on the Survey tab; `try-it`, `cost` and `cost-card` on the Build tab.
`Panel`, `Section`, `Segmented` and `IconButton` forward a `data-tour` prop; the tab files only gained these attributes.
`TOUR_OPTIONAL_TARGETS` lists targets a step may show without (the cost card, which the viewer can close while its step is up), and `tests/guide.test.tsx` runs every step and checks each of its targets is on screen, opened by the step (D160).

## D94 - Player commands from outside a tab (home and tour round)

The players live inside the tabs, so the tour asks rather than reaches in: `usePlayerCommands.requestYourTurn()` (`src/ui/player/commands.ts`) is a counter, and the mounted tab's `usePlayer` jumps to "Your turn" on each increase.
A player ignores requests made before it mounted, so switching tabs never replays an old request.

## D100 - The color story: P3 units in Exowatt orange, work in progress in violet (desert round, captain's request)

The captain asked for the P3 containers in orange, because they are orange in the field.
This supersedes spec 5.1's "Orange stays only in the favicon" and 5.2's grey units; the rule of one meaning per color stays.
Amber meant work in progress and sat 18 degrees of hue from the new orange, and the failure red 20 degrees on the other side, so three meanings would have shared one warm family.

| Token        | Value                                            | Meaning                                                                                                                         | Change                                                                                    |
| ------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `--c-unit`   | `#F47320` orange                                 | P3 units, live                                                                                                                  | was grey `#5B6270`; build states in D102                                                  |
| `--c-work`   | `#A78BFA` violet                                 | Work in progress: UTVs, drones, machines, planned paths, radios waiting for power, the stage label and work zone, progress bars | was amber `#F5B82E`                                                                       |
| `--c-fail`   | `#F0384F` crimson                                | Failure                                                                                                                         | was `#F04438`; 11 degrees cooler, 31 degrees from the orange, so it never reads as a unit |
| `--c-signal` | `#2FBF71` green                                  | Radio signal                                                                                                                    | unchanged                                                                                 |
| `--c-data`   | `#3B9EFF` blue                                   | Data moving                                                                                                                     | unchanged                                                                                 |
| `--c-done`   | `#D9CBB6`, drawn as a 14% veil (`--c-done-fill`) | Surveyed ground                                                                                                                 | was an opaque grey fill, which would hide the desert (D101)                               |
| `--c-base`   | `#FFFFFF`                                        | The base                                                                                                                        | unchanged                                                                                 |

- **Why violet.** It is the hue farthest from orange, green and red at once.
  Yellow would sit next to the orange (for a deuteranope both read yellow), cyan sits between signal and data, and pink or magenta collides with the failure red.
  Violet and the data blue are 45 degrees apart and differ in lightness, and every violet mark has its own shape: a UTV is a dot with a separate blue online dot, a drone has rotors, a machine is a tile with its glyph, a planned path is dashed.
  Violet beside the orange also reads as dusk, which suits the desert (D101).
- **Orange means a unit and nothing else.** The cost cards, the Alternatives sheet and the robot-dog comparison drew their neutral bars with the old grey unit token; they now use a neutral bar color (`--bar-neutral`, the `'neutral'` token of `InlineBar`), so an orange bar always means a unit.
- **Contrast.** On the desert every story color stands at least 3.36:1 from the lightest 1% of the ground (WCAG relative luminance), the failure crimson lowest; `tests/terrain.test.ts` keeps it at 3:1 or more.
- **Legend.** The Survey tab names "P3 unit · planned" with an outline swatch.
  The Build & failure tab adds "P3 unit: planned to live" with a four-step swatch and drops "Base", so it keeps the 7 rows that let the readout with STRESS-TEST fit beside it at 1280 x 720 (D72); the first caption ("The base at the center links to Starlink") and its hover card name the base.
- **Hover cards.** A unit's card now opens with its state on an orange bar (D102); progress bars of work (strip progress, phases, the surveyed share) are violet.
- **Captions and copy.** No caption names a color except "Green circles show where the signal reaches", which is still true.
  The tour's copy still names no color (D91); its "map and its colors" step gains the units' four-step swatch.
  Comments that said amber say violet, and the survey UTV drawing (D84) follows the token, so its drone is violet like the map's.

## D101 - The desert under both maps (desert round, captain's request)

The captain asked to set both demos on an abstract rendering of the desert they would be built in, so the map reads as real ground without competing with the story.

- **Dark, with the terrain glowing softly through, not a dusk palette.** The page stays dark and the ground is warm, desaturated umber: gravel `#1A1612` to sand `#2F271E`, wash beds `#4B3E2F`, slopes that face the light up to a third lighter.
  The orange units need contrast in lightness: on a mid-tone sand they would differ mostly in saturation and turn muddy, and the 1 to 2 px planned units of the full site would vanish.
  The coverage tint, the blue packets on their dark rings and the white base were tuned for dark ground (D55), and the glass panels are dark.
  Schoolscape's map has the same craft: a quiet dark basemap where the land reads faintly under the data.
  So the ground stays under 0.05 relative luminance and within 2:1 of itself (`tests/terrain.test.ts`), and the neutrals moved from cold slate to warm stone so the glass sits on it: the surfaces, borders, text greys, marker halo, data-step dim, the home screen's scrim and the tour's dim.
- **Three layers, each a texture that tiles.** Seeded, periodic gradient noise (whole lattice cells per tile in every octave), so every layer repeats with no seam and the ground runs on past the site in every direction:
  - _Macro_, 20.48 km a tile at 20 m a texel: rolling relief with ridged buttes in places, lit from the northwest at 38 degrees; patches of paler sand and darker gravel; the major dry washes, running northeast to southwest with pale beds (zero lines of a sheared, anisotropic noise, whose integer shear keeps the tile).
  - _Detail_, 10.24 km at 5 m: the small washes, traced as streams down a meandering flow, widening downstream and joined by tributaries, each with a pale bed and a darker fringe of scrub; the fine relief; and wind ripples about 37 m apart in patches, as light and shade over the macro layer.
  - _Scrub_, 512 m at 0.25 m: bushes in loose clusters with their shadows to the southeast, and pebbles.
- **Generated once, off the main thread.** A module worker (`terrain.worker.ts`) builds the layers from `TERRAIN.seed` and the `--c-ground-*` tokens, macro first: about 0.35 s, 0.6 s and 0.05 s on an Apple M4 Pro; the main thread only uploads the texels.
  Each layer comes with its mip levels (a 2 x 2 box filter that wraps, so they tile too).
  Without workers (the tests) the map keeps a flat ground color.
- **Drawn as part of the map.** Each map has a backdrop canvas under its own (`Backdrop`), redrawn only when the view or the canvas size changes, or while a layer fades in (700 ms; none under reduced motion).
  The layers are repeating patterns anchored to the world, so they pan and zoom with the map, drawn from the mip level whose texels are at least 0.75 device px, so a zoomed-out view is filtered rather than sparkling.
  The scrub comes in between 0.3 and 1.1 px per meter, where a bush covers a pixel, and the vignette is drawn once per canvas size.
  The tabs stand on different ground of the same desert (`TERRAIN.origin`): the Build & failure section beside a dry wash.
- **The parcel.** Inside the site boundary the ground lifts by 2.5% (`--c-site-fill`), with a warm outline, so the parcel reads on the desert (D37).
- **Performance** (Apple M4 Pro, Chrome, 1280 x 720, the site at 80,000 units for the Survey tab; frames per second with the 95th-percentile frame time):

| Run                                              | Main           | With the desert |
| ------------------------------------------------ | -------------- | --------------- |
| Survey, zooming in and out every frame           | 60 (16.7 ms)   | 60 (16.7 ms)    |
| Survey step with the close-up                    | 60 (16.7 ms)   | 60 (16.7 ms)    |
| Survey step at 4x                                | 60 (16.7 ms)   | 60 (16.7 ms)    |
| Build & failure walkthrough, first 60 s          | 60 (16.7 ms)   | 60 (16.7 ms)    |
| CPU slowed 6x: Survey zooming every frame        | 47.9 (33.4 ms) | 48.7 (33.4 ms)  |
| CPU slowed 6x: Survey step with the close-up     | 59.9 (16.7 ms) | 60 (16.7 ms)    |
| CPU slowed 6x: Build & failure walkthrough, 30 s | 58.3 (16.8 ms) | 60 (16.7 ms)    |

The backdrop costs no measurable frame time: a still view draws nothing, and a moving one fills three patterns, on the GPU.

## D102 - The P3 units by build state (desert round)

The units are one orange in steps of lightness, so every state reads as a unit and the steps read in order.

- **Planned:** a thin outline at 30% (`--c-unit-planned`), filled when a unit is under 4 px.
- **Placed:** dark orange (`--c-unit-placed`), once the crane sets it down in its stage's placement phase.
- **Commissioned:** brighter (`--c-unit-commissioned`), once the crew of the connection phase has connected and tested it.
- **Live:** full orange (`--c-unit`), when its stage ends and the stage's radios switch on: powered.

`unitStateAt` in `playModel.ts` gives the state (`UnitState` in `config/play.ts`), the scene holds it per unit, and `tests/buildTab.test.ts` checks that every unit goes through the four in order and that the build ends with all of them live.
The full site's map uses the same tokens for planned, placed and commissioned; the Survey tab shows only planned units.

## D103 - Packets stop when the visualization does (desert round, captain's report)

The captain saw packets still moving after everything on the map had visually finished.
Reproduced on main (74c06a0; ed132a2 did not touch it) in the browser at 1280 x 720, reading the map's pixels over time:

- **Paused at any step** the map stands still: every view is a function of the player's time, and pausing stops the clock.
  In "Your turn" the paused map still showed packets frozen mid-hop.
- **At the end of the walkthrough** the cost step ran into "Your turn", whose clock never ends, and every radio kept sending one packet a second for as long as the tab stayed open (the readout's sent count kept rising, 3,445 after half a minute), at every speed, with the progress track already full.
- **After a click and after Reset** in "Your turn" the same endless stream played on.
- **Switching tabs and back** starts the walkthrough over, paused on its first step, with no packets; playing it into "Your turn" streamed again.

The cause: the live packet simulation ran to `endS: Infinity`, every radio scheduled its next send forever (`Ev.Gen` re-armed itself), and "Your turn" shows data for all of its endless time.

The fix drives traffic by the story, not by the open tab:

- **Traffic windows.** The radios send their own packets only inside traffic windows (`SimInput.trafficUntilS`, `SimChange.trafficS`); hellos, detection and routing run all the time.
  The walkthrough's window is the robot's data, from the hold to the resume, so its traffic stops as the build resumes; the packets still in flight are cleared at that step boundary together with the routes and the dim.
  A click in "Your turn" (a failure, a repair or Reset) opens a window of `PLAY.clickTrafficS` (6 s), long enough for the missed hellos, the reroute and the queues to drain, so it plays as a bounded burst.
  Without a window the simulation keeps its old default of a network that always sends.
- **The settle time.** `SimResult.quietFromS` is the time of the last event once no event is left, and the scene's `settleS` adds the marks that keep playing after their event (the update ring, the fail flash, a radio's fade-in, the missed-hello label) and the maintenance ticket.
- **The player pauses at the end.** In "Your turn" the Build & failure tab pauses once the scene has settled, so the bar never says playing over a still map: right away when the walkthrough arrives there, and after the burst of a click.
  Play over a settled "Your turn" has nothing to play and pauses again; the next click plays.
- **Tests.** `tests/packetTraffic.test.ts` checks the windows in the engine (no send outside them, quiet with no packet in flight, the live click equal to the replay), that the walkthrough sends nothing after the resume and "Your turn" stays still for ten minutes, that packets hold still at a fixed time, and that a click and a Reset settle to zero packets with a constant sent count.
  `tests/buildTraffic.test.tsx` drives the running app frame by frame: paused at the failure, detection, reroute and recovered steps the readout's sent count stands still; past the cost step at ¼×, 1× and 4× the player pauses in "Your turn" and the count stays put, also after Play; a click plays a burst, then the player pauses and the count stops.
  On main these tests fail everywhere but the paused steps, as the repro found.
  `tests/scene3dView.test.tsx` now fails a radio before it plays "Your turn" under the 3D view (D120), since an idle "Your turn" has no traffic to play.
- In reality the radios report all the time; the map shows their traffic only while a story plays out, like the "Packets slowed for visibility" note (spec 0.5).

## D110 - Why UTVs, not robot dogs (survey round 4, captain's question)

The captain asked why the survey uses UTVs instead of the robot dog Exowatt shows surveying in its challenge video, how that justifies the UTV's cost, and how much faster a UTV is per hour.

- **The dog, sourced.** `src/config/go2.ts` holds the Unitree GO2's facts with their sources and dates: 0 to 2.5 m/s walking and about 5 m/s running in the lab; a 15,000 mAh, 432 Wh pack rated about 2 to 4 h (reviews measure about 2 to 2.5 h of continuous walking with a payload) and a 0.8 to 1.5 h fast charge; the built-in L1 lidar, 360 x 90 degrees, 20 m on bright and 10 m on dark targets; Wi-Fi 6, Bluetooth and 4G with an eSIM, and no satellite link.
  The variant priced is the GO2 EDU ($11,190), the one with the SDK that planned survey routes need; the Air and Pro run from the phone app.
- **The dog in the survey engine.** `GO2_SURVEY` is a `SurveyConfig`: passes 20 m apart (its lidar sees bare ground, a dark target at a grazing angle, to 10 m each side), 5.4 km/h on passes and turns (a sustained 1.5 m/s, a team estimate under Spot's 1.6 m/s top speed), 2.5 m/s in transit, no drone (`droneFlightMin` is Infinity), and a pack swap every 2 h of walking in the place of the UTV's refuel, 5 min where it stands.
  The swap in the field favors the dog: walking back to the base to charge would cost more.
- **Numbers from code.** `compareSurveyors` (`src/engine/surveyCompare.ts`) plans the site for each config with `planSurvey` and `surveySchedule`: one unit alone on the whole site gives the acres an hour with every overhead; the default fleet gives the field days; the smallest fleet that finishes in the UTV fleet's field days gives the matching fleet and its kit.
- **Results on the generated site** (1,765 acres of unit grid off the pad):
  - One UTV surveys 159 acres an hour, one GO2 24.7: the UTV is **6.4 times faster**. Even at its 2.5 m/s top walking speed the whole time, a GO2 surveys 40.9 acres an hour, and a UTV is still 3.9 times faster.
  - With 3 of each, the UTVs take 3.7 h on site, 1 field day; the GO2s take 24.2 h, 3 field days.
  - To finish in 1 field day: 2 UTVs ($123k with their drones) or 8 GO2s ($104k), which make 32 battery swaps out on the site.
  - Kit per acre, if the fleet is bought for this one site: $69.9 for the UTVs, $59.0 for the GO2s.
  - Kit per acre an hour of capacity: $387 for a UTV ($61.7k / 159), $527 for a GO2 ($13.0k / 24.7). A UTV costs 4.7 times a GO2 but surveys 6.4 times as fast.
- **Honest about the dog's edge.** On hardware alone the dog wins: a GO2 kit is $13.0k, and the one-day dog fleet is $19k cheaper than the one-day UTV fleet, but it carries no drone and no link; the sheet says so, and its table marks the better side of every row, the dog's included.
  Crew time is not priced (no sourced rate); it would favor the UTVs: 2 drivers for a day against 8 dogs to watch and keep in batteries.
- **In the app.** The survey cost card has a second row, "Why UTVs, not robot dogs" with "6.4× faster", under the survey UTV's row; the survey UTV sheet links to it too.
  The sheet leads with the two reasons side by side: "6.4× faster" with a bar per surveyor of acres an hour and the field days of 3 of each, and "Online from day one": each UTV carries its own Starlink Mini and is its drone's link, so the survey is connected before any site network exists, while the GO2 has no satellite link and nothing to join on a new desert site.
  Then the table of both on this site, the cost case in two lines, the dog's assumptions, and the sources.
- **Walkthrough and tour.** The Survey step's caption reads "UTVs scan with lidar at 6.4× a robot dog's pace, their drones from above.", one line at 1280 x 720; the tour's "What it costs" step names the sheet with the speed-up from `TourFacts.dogSpeedUp`.
- **Tests** (`tests/surveyCompare.test.ts`, `tests/surveyCostChip.test.tsx`, `tests/surveyWalkthrough.test.ts`): the GO2 config follows its facts; the dog never stops for a drone and swaps its pack about every 2 h; the acres off the pad; the 6.4 times; 1 and 3 field days; each matching fleet is the fewest that finish in time; the dog wins the kit and the one-day fleet and the UTV the capacity; the sheet opens from the card and from the UTV sheet, leads with the two reasons and marks the better side of each row.

## D111 - Why robotics-grade lidar is enough (survey round 4)

The survey UTV sheet says, under the lidar grades, why the kit is priced with robotics-grade lidar and not survey grade, each point with its source in `ROBOTICS_GRADE_ENOUGH` (`src/config/utvKit.ts`):

- RTK GNSS places every pile and unit, to 7 mm + 1 ppm on the move (Emlid Reach M2 specs).
- The lidar only models the ground and finds obstacles, where the drone's Zenmuse L2, rated to 4 cm vertical and 5 cm horizontal (DJI specs), covers a flat desert site.
- Exowatt's own GO2 surveys with a navigation-class lidar (the Unitree L1).
- Survey-grade rigs are built for design-grade highway mapping (TxDOT's mobile lidar specification).

## D120 - A 3D view of a radio's corner, loaded only when asked for (3D round, captain's request)

The captain asked for a "take me there" button that moves the camera from the top-down map down to the side of the units, to a 3D scene of P3 units side by side with the four-beam corner module sticking out of one of them.

- **One scene, the map's own.** The 3D view draws the play-model section the Build map shows, from the same model: every unit placed by the time the viewer flew down, every built radio's corner module, the base on its pad.
  So the view that starts the flight is the map's own view of the same spot, in 3D, and the radio the camera lands on is the one the pin stood on.
- **three.js 0.186.1, pinned exactly** (`@types/three` 0.186.0), used directly rather than through react-three-fiber: the scene is built once and then only the camera moves, so a declarative scene graph would add weight and nothing else.
  Orbit controls, rounded boxes and geometry merging come from three's own `examples/jsm` add-ons.
- **Procedural.** Every shape (the units, the lens arrays, the modules, the base, the scrub, the hills) and every texture (corrugation, Fresnel grooves, sand grain) is made in code; there are no model or image files.
- **Lazy.** The pin, its loader and the pin's two settings (`src/config/cornerPin.ts`) are in the main bundle; three.js, the scene and its settings (`src/config/scene3d.ts`) are one chunk fetched the first time the viewer hovers, focuses or clicks the pin, so the first page load does not fetch or parse any of it.
  A failed fetch logs an error, leaves the map as it was and can be tried again.
- **Bundle** (minified, and gzip -9), against main at 873c9dd: the main JS grows from 325.1 kB to 330.0 kB (108.6 kB to 110.7 kB gzipped) and the main CSS by 1.4 kB, for the pin, the loader and Vite's preload helper; the 3D chunk is 594.8 kB of JS (150.0 kB gzipped) and 4.0 kB of CSS.
  `build.chunkSizeWarningLimit` is 650 kB so the expected size of the lazy chunk does not warn; `tests/scene3dBundle.test.ts` builds the app in memory and fails if three.js or the scene reaches the entry or anything it imports statically.
- **While the 3D view is up** the Build tab's panels, cost chip, player and hover cards step aside; the brand, the ? button and the tab switch stay.
  The walkthrough pauses where it was and Space and the arrows stop driving it; on Back to map it plays on if it was playing (`tests/scene3dView.test.tsx`).
  Starting the tour or opening the home screen goes back to the map at once, and switching tabs closes the view.

## D121 - "Take me there": a pin above radio C4-3 (3D round)

- **On the map, not in the hover card.** The hover card follows the pointer and has no controls (spec 6.6), so the button is a small pin above one radio with a short stem down to it, like the maintenance ticket below a failed radio.
- **Radio C4-3** (`CORNER_PIN.featuredCell`): north of the base pad on an ordinary lane, with a neighbor radio both ways down the lane and the column; it is built in the first stage, so the pin shows early in the build, and it is not the radio that fails in the walkthrough.
- **When it shows.** From the moment its radio is built; it steps aside while that radio is failed, because the view is there to show the four beams and a failed radio's labels need the space above it.
  While the chunk loads, the pin's icon turns into a spinner.
- **The tour.** Its last step adds "On the Build & failure map, Take me there flies down to radio C4-3's corner module in 3D." (the radio from `tourFacts().cornerRadio`); clicking the pin during the tour ends it, as the brand chip does.

## D122 - The P3 unit in 3D (3D round)

Exowatt has not published drawings of the P3, so the unit is a 40 ft container at real proportions with a stylized lens array.

- **The box:** 12.2 m by 2.44 m (`SITE.unitWidthM`, `SITE.unitDepthM`) and 2.9 m tall (`UNIT_HEIGHT_M`), on pile caps 0.12 m high (the foundations phase), with corner posts, top and bottom rails, corner castings, corrugated walls and roof (a normal map in ridge pitches of 0.28 m) and doors with locking bars at the south end.
  The paint is `--c-scene-unit`, Exowatt orange; dust and shade darken the foot of the walls.
- **The lens array:** two rows of nine Fresnel lenses along the roof, each row on its own north-south tracker tube on posts, every lens tilted toward the sun's east-west angle as a single-axis tracker would.
  The lenses are pale acrylic with concentric grooves (a normal map and a faint ring pattern), so they read as lenses and not as solar panels.
- **Spacing as on the map:** units 14.2 m apart along a lane (the 2 m column gap) and lanes 21 m apart (an 18.56 m lane corridor).
- All units are instances of a few merged meshes, one per material, so the whole section is a handful of draw calls.
- **Update (P3 model round, captain's request).** The captain's reference of the real P3 replaced the lens array with a sun tracker beside each unit, and added the roof railing, the receiver porthole, vents and the EXOWATT wordmark (D150 to D152).

## D123 - The corner module in 3D (3D round)

- **Mount:** a square bracket arm bolted over the unit's north-east top corner casting, running 0.5 m out along the diagonal (`MODULE.offsetM`), with a short riser to the head.
- **Head:** a square enclosure with a flat-panel radome on each face, facing north and south down the lane and east and west down the column (spec 4), under a rounded cap, its antennas 3.2 m above the ground (`MODULE.heightM`).
  The status light on the cap is the map's story color for the radio: green online, amber waiting for power, red failed or cut off.
- **Battery:** the 30-day battery that bridges the time before the unit powers the module, on the corner post below the arm, its cable up the post and out under the arm.
- Every built radio carries one; the featured one gets a callout, "4-beam corner module" with its radio, status and hops to the base as the hover card words them.
  A soft glow behind it was tried and dropped: on the orange paint it read as a smudge.

## D124 - The four beams (3D round)

- Each beam is a faint wedge at the antenna height, 30 degrees each side of its axis (`MODULE.beamHalfWidthDeg`), most of it near the axis, with a crisp line a few centimeters wide on the axis; all in the radio signal's green (`--c-signal`), fading out toward the neighbor 57 m (lane) or 63 m (column) away.
- Each beam's label names its way and the neighbor at its end: "Down the lane · North to C4-4, 57 m", or "edge of the section", and "no link" when the map has that link down.
- A label sits at the farthest of a few distances along its beam where it fits on screen clear of the edges, the card and the module's callout, so all four show from the landing view and while looking around.
- The beams show while the radio is on; a failed or not-yet-powered module has none.

## D125 - The camera: from the map, down and around to the side (3D round)

- **Start = the map.** The flight starts looking straight down over the map's center, north up, at the height where a meter on the ground is as many pixels as on the 2D map, so the first 3D frame lands every point of the ground on the pixel the map drew it at (`tests/scene3dPose.test.ts`, also against a three.js camera).
  The 3D canvas crossfades in over the map in 420 ms (`--dur-scene-fade`) while the panels step aside.
- **The flight (3.6 s, eased):** the distance falls geometrically, so the descent feels even; the target moves so that the module slides on a straight screen line from where the map showed it to the middle, never leaving the screen; the tilt and the turn start late (38% and 30% of the way), so the camera first comes down over the site and then swings round to the side.
- **The landing:** 12.5 m from the module, standing in the lane corridor north-east of it, 8 degrees above the antennas (an eye about 4.9 m up, just over the roofs, so the lens arrays show), looking at the corner so the lane and column beams run away in a V.
  The line of sight to the module is clear of every unit (tested).
- **Looking around:** drag to orbit the module and scroll to come closer (2.6 m) or step back (48 m); the camera stays above a 1.4 m eye height and below 62 degrees.
- **Back to map** flies the same path in reverse (2.6 s) from wherever the viewer is, to the map's view at the window's current size, then crossfades back; Escape does the same.
- **Reduced motion:** both ways are cuts, with no flight and no crossfade.
- **Update (P3 model round).** The landing is now at 128 degrees, 13.5 m out and 7 degrees up, so the module's own unit shows its wordmark, porthole and tracker (D153).

## D126 - The look, the palette and the frame rate (3D round)

- **Daylight:** a late-morning sun (azimuth 150 degrees, 40 degrees up) that rakes the east walls so the corrugation shows and casts the units' shadows north-north-west; a sky that goes from a thin band of haze at the horizon to blue, a low range of hazy hills, desert sand with grain and a large-scale tone, the graded site, the gravel base pad and scrub outside the site; the metal and the lenses reflect the same sky.
  The shadow box follows the camera, from the whole section seen from above down to about 190 m around the module.
- **Colors come from tokens** (`--c-scene-*` in `tokens.css`, read at runtime); the beams and status lights use the story colors.
  When the desert backdrop and orange units land in the 2D map's tokens, the scene tokens can point at them so both views share one palette.
- **Frame rate**, measured in Chrome on an Apple M4 Pro: 60 fps through the whole flight at 1280 x 720 and 1440 x 900, at device pixel ratio 1 and 2, with no frame over 16.8 ms; 60 fps through a full orbit of the module at 1440 x 900 and pixel ratio 2.
  Building the scene and compiling its shaders takes about 80 ms on the click, before anything moves.
  The pixel ratio is capped at 2, and the scene renders only while the camera moves.
- **Update (P3 model round).** The sun is now at azimuth 125 degrees, 42 degrees up, so the receiver portholes on the east walls face it (D152); the frame rate with the new model is in D153.

## D130 - The home screen's daisy, "Daisy Does It!" and the bare-domain credit (home polish, captain's request)

The captain asked for a shorter home screen with more character, and for the credit to read as the site's address.

- **Copy.** The "Interactive demo" eyebrow, the "Two tabs ..." note, the "A short tour shows you around first." hint and the footer's "Reopen this page from the name at the top left." are gone.
  The page reads: the title, "Daisy Does It!", the lede, then "Open the demo" with "Skip the tour" (or "Take the tour" for a returning viewer).
  The brand chip still reopens the page, and the tour's last step still says so.
- **The daisy.** `src/ui/guide/Daisy.tsx` redraws the captain's reference as an inline SVG with nothing behind it: five outlined elliptical petals 72 degrees apart, one pointing straight down, around a filled center, in the reference's proportions (petal 40 units long and 15 wide, center radius 10, stroke 2.7).
  Its colors are sampled from the reference and live in `tokens.css`: `--daisy-petal` (#cbd6c6, sage) and `--daisy-center` (#f2b33d, orange-yellow), with a faint warm light behind it (`--daisy-glow`).
- **Layout.** The home screen is a two-column grid: the 560 px text column on the left and the daisy centered in the rest, as large as `min(30vw, 50vh)` within 240 to 420 px (360 px at 1280 x 720, 420 px at 1440 x 900), its center level with the text's middle.
  Under 860 px wide the daisy shrinks to 96 px above the title.
- **Entry.** The title fades in sliding 48 px from the left; "Daisy Does It!", in the daisy's center color at 20 px semibold, follows a word at a time; the lede and the actions rise into place; the daisy pops in from 40% with a little turn, overshoots to 107% and settles, its center popping first and the petals unfurling from it clockwise.
  The whole entry takes about 1.4 s and replays when the page is reopened.
  Under reduced motion every part only fades in, in the same order: nothing slides, scales, turns or blooms.
- **Credit.** `UI.credit.label` is "alexanderyevchenko.com", linking to https://alexanderyevchenko.com in a new tab, at the bottom center of the map and of the home screen; the home screen's credit sits exactly where the map's lands, so it stays put as the page gives way to the map.
  No "by Alexander Yevchenko" wording is left in the app or the README.
- **Tests** (`tests/guide.test.tsx`): the column reads title, subheader, lede and actions and none of the removed copy; the daisy is decorative with five petals, a center and no background shape; both credits read the bare domain and open the site in a new tab.

- **Update (brand rename, captain's request).** The brand reads "Exowatt: Daisy Does It" (`UI.brand`, the tab title, the README, the home title), and the home screen's "Daisy Does It!" subheader and its word reveal are gone: the title slides in, then the lede (20 px below it) and the actions.
  The brand chip carries a small still daisy (24 px, the same `Daisy` drawing with `.daisy-logo`, no spin or entry) to the left of the text.

## D140 - Follow a UTV up close (survey follow round, captain's request)

The captain asked for a zoom on the survey, to watch how a drone follows its UTV, with the speed control unchanged.

- **Starting.** The Survey panel has an "Up close" section with a "Follow a UTV" button (`data-tour="follow"`), which follows UTV #1, and the hint "Or click a UTV on the map."
  A click on a UTV or its drone follows that UTV; their hover cards end in "Click to follow".
  A press that moves less than 4 px is a click, not a pan (`MapView`'s `onTap`).
- **Following.** The map eases in over 1.2 s to 2.4 px/m (`SURVEY_FOLLOW`), and from then on the UTV stays at the center of the area between the panels, where the walkthrough's close-up puts its UTV (D82), parked or driving.
  The section then shows a UTV picker (#1 to #n), the link chain (D143), "Back to site" and an "Esc" key hint.
  Another UTV, from the picker or a click on the map, takes over in 1 s from the view on screen.
- **Ending.** "Back to site" and Escape ease the view back out to where it was before the follow, in 1.2 s.
  Panning or zooming ends the follow at once and leaves the view where the viewer put it: easing away under the viewer's hand would fight the input.
  A fleet made smaller keeps the camera on its last UTV.
- **Pure.** Where the camera looks is a function of the plan, the UTV and the survey hour (`followPoint`, `followCamera` in `ui/survey/follow.ts`), so pausing, seeking and the speed all behave.
  Only the ease in and out runs on wall time, so it also plays while the walkthrough is paused.
  With reduced motion the follow cuts in and out.

## D141 - Camera hand-over between the close-up, a follow and the viewer

- `Camera` takes an optional `from`, the camera it takes over from: at blend 0 the view is that camera's view, so a follow that starts during the walkthrough's close-up, or switches UTVs, starts exactly where the screen is.
  At blend 1 the view does not depend on it.
- `Camera` takes an optional `key` naming one camera move ("closeUp", "follow").
  After the viewer pans or zooms, the map tells the tab once (`onCameraRelease`), and a camera with another key starts over from the viewer's view.
- Once a follow takes over from the close-up, or the viewer moves the map during it, the close-up stays out until its window is over, so it never snaps back in when the follow ends.
  Its slower clock still runs for the rest of its window, and the player note still says so.

## D142 - The work slows down up close

At the walkthrough's pace, half an hour of work a second, a UTV would cross 18,000 px a second at the follow zoom.
Following, the player's clock slows so the ground passes under the UTV at 60 px/s on a survey pass at 1x (25 m/s, about 4.5 times real time), close to the close-up's pace (D82).

- `usePlayer` takes a `rate(t)` on top of the shared speed, so everything stays a function of the clock's time and the speed control works unchanged: at 4x, 1 s plays 18 s of work; at ¼x, 1.1 s.
- The rate eases with the zoom, geometrically as the zoom does, and is 1 while the survey hours stand still (Site, Paths, Done and "Your turn" before Send), so those steps keep their length.
  It never speeds the clock up, so the close-up's slower hold plays as before.
- The survey clock gives the slope of its hours (`rateAt`), and the frame how fast the hours pass now (`hoursPerS`).
- The player note reads "Up close: 1 s plays 4.5 s of work".

## D143 - The link chain while following

The follow makes the point of the survey's connectivity: the drone is online through its UTV, the UTV through Starlink.

- **On the map.** A Starlink satellite (a body between two solar wings, named "Starlink") sits up and to the left of the followed UTV, near the top of the area between the panels, with a dashed blue beam down to the UTV's online dot.
  It is on the left because the labels are on the right of the marks, so the beam never crosses them.
  The beam's dashes move up with the data, and one data pulse each way runs on the drone's link: scan data to the UTV, commands back.
  Both move with the survey hour (`pulsePhase`), so they stop when the clock stops and speed up with it; with reduced motion they hold still and there are no pulses.
  The UTV and its drone keep the close-up's labels (D82); a parked UTV's label sits below the row, clear of its neighbors.
  All of it fades in as the zoom lands, in the data color, with the satellite in the neutral text color.
- **In the panel.** The chain reads Starlink (Online), then the UTV (what it is doing, and its strip progress), then its drone (Flying, or Docked on its UTV during a battery swap or at the base), joined by a dashed and a solid blue line as on the map, with the line "The drone is online through its UTV, the UTV through Starlink."
- **Tour.** The Plan the survey step spotlights the Up close section with the fleet, and adds "Follow a UTV to ride along with its drone."

## D144 - The map measures its layout size

Opening the demo from the home screen mounts the map while the home screen still scales it to 104% (D90), and `MapView` sized its canvas from that scaled box, so the whole map drew 4% off and hover and clicks missed what they pointed at until the window was resized.
It now sizes the canvas from the container's layout size (`clientWidth` and `clientHeight`), which a transform does not change.

## D150 - The P3 from the captain's reference (P3 model round, captain's request)

The captain sent a render of the real Exowatt P3, an orange container beside a white pole-mounted tracker that holds a Fresnel lens and a corrugated fin, and asked for the 3D view's model to match it.
It replaces D122's lens array on the roof.

- **The footprint stays.** The reference's containers read as 20 ft boxes, about 2.3 times as long as they are tall, so about 6 m.
  The site model keeps the 40 ft unit from the team's research (12.2 m by 2.44 m by 2.9 m, D122), so the lanes, the gaps and the 2D map are unchanged.
  The details keep the reference's sizes against the wall's height, so a 40 ft unit reads as the same product, longer; the length is the captain's call (`SITE.unitWidthM`).
- **The container** keeps its corrugated walls, frame, castings and pile caps.
  The door leaves at the south end are ribbed across, and their locking bars are painted, with handles and hinges.
  A railing runs round the roof: posts 0.36 m high at most 1.55 m apart, and a top rail.
  Four louvered vents and an access hatch sit on the east wall, where the reference has them around the porthole and under the end of the wordmark.
- **The receiver porthole** is a steel plate with a ring, a satin metal window, a hinge and a latch, high on the east wall (its center 0.78 m below the roof) and 3.95 m from the north end, above the end of the wordmark as in the reference.
- **The paint** (`--c-scene-unit`) moves from `#e2702a` to `#dc5f2a`, the redder orange of the reference.

## D151 - The EXOWATT wordmark (P3 model round)

- White EXOWATT with its ring mark sits on both long walls, centered, in the reference's proportions: a cap height of 13% of the wall (0.38 m), the mark 2.7 caps across and the word about 8 caps wide, widely spaced, so the lockup is 4.6 m long.
- It is drawn in code on a canvas (`brandTexture` in `textures.ts`), with no font or image file.
  The letters are geometric strokes, since E, X, O, W, A and T need only bars, slants and a circle, and the mark is three slightly irregular concentric rings, as in the reference.
- The drawing is a coverage map on a decal with its own UV set, so it filters and mipmaps cleanly at any distance.
  The decal shares the wall's corrugation normal map, so the paint follows the ridges, and its color is `--c-scene-mark`.

## D152 - Each unit's sun tracker, focused into its porthole (P3 model round)

- **The tracker** is a white pole (`--c-scene-tracker`) on a base plate with a flange and gussets, east of its unit.
  At its head a yoke turns a level axle, with a drum and collars.
  The axle carries the corrugated fin (0.9 m by 3 m, five ribs, with a slim mast) on its east half, and on its west end an arm and a sub-frame that hold the lens: a white frame of 3 by 3 square Fresnel panes, 3 m across.
  An actuator runs from the drum to the sub-frame.
- **The aim.** The lens faces the sun, and its center sits 3.5 m from the porthole along the sun's direction, so the lens's axis runs through the porthole and focuses the sun there.
  The axle is level and square to the sun's azimuth, and the fin and the lens tilt on it together.
  The pole stands where that puts the head: about 3.5 m east of the wall, level with the porthole along the unit, its axle 3.8 m up, with the lens's center 4.6 m up and 1.5 m south of the porthole.
  `trackerLayout` in `geometry.ts` derives all of it from the sun's direction.
- **The sun moves** from azimuth 150 to 125 degrees and from 40 to 42 degrees up: still late morning, now in the south-east.
  At 150 degrees the light reached the east walls 67 degrees from square, too grazing to be a believable focus, and every lens stood edge-on to the landing view.
  At 125 degrees it is 52 degrees, the lenses turn toward the landing view, and the corrugation still shows; the shadows fall north-west.
- **The panes** are clear acrylic (`--c-scene-lens`, 30% opaque) that reflects the sky, seen from both sides.
  Each pane has its own concentric grooves as a normal map and the light they catch as faint radial streaks from its center (`fresnelSheenMap`), like the starbursts in the reference.
- **Build states (D102).** A live unit's lens tracks the sun; a placed or commissioned unit, not yet powered, stows its lens flat.
  Planned units are not drawn, as before.
- **Tests** (`tests/scene3dP3.test.ts`): the porthole faces the sun from high on the east wall, above the wordmark's end; the live lens faces the sun with its axis through the porthole at the focal length; the lens and the fin clear the container and its railing, live and stowed; and the tracker keeps more than 2 m from the module's antennas, south of the unit's north end.

## D153 - The landing, the frame rate and the bundle (P3 model round)

- **The landing** moves round to 128 degrees, 13.5 m out and 7 degrees up (from 120 degrees, 12.5 m and 8 degrees).
  The module's own unit shows its wordmark and porthole, and its tracker stands whole on the left of the frame below the card, while the module stays in the middle with its beams in a V.
  The landing test now raycasts the real container and tracker geometry of every unit near the line of sight from the eye: none of them is between the camera and the module.
- **Frame rate**, measured in Chrome on an Apple M4 Pro with a 120 Hz display: the flight and a full orbit of the module hold 120 fps at 1280 x 720 and 1440 x 900, at pixel ratio 1 and 2, with no flight frame over 9.3 ms and no orbit frame over 16.7 ms.
  Drawing a frame and reading it back takes 5.6 ms at the landing at 1440 x 900 and pixel ratio 2, against 4.6 ms on main: 37 draw calls and 5.1 million triangles with the shadow pass, against 33 and 2.2 million.
  That leaves about three times the 60 fps budget on this machine.
- **How.** A unit is about 3,700 triangles: 2,400 for the container and 1,300 for the tracker.
  Every repeated part is one instanced mesh per material, with the materials shared by every unit, and the flat or see-through parts (the wordmark, the panes, the porthole's window) cast no shadow.
  Splitting the units into tiles, so the camera and the shadow box skip the ones they cannot see, was tried and dropped: it saved little time and multiplied the draw calls.
  From the click to the start of the flight takes about 170 ms.
- **Bundle** (minified, and gzip -9), against main at 14bc998: the main JS is unchanged at 341.5 kB, and the main CSS grows by 49 bytes for the two new tokens.
  The 3D chunk grows from 594.8 kB to 607.9 kB (150.0 kB to 154.5 kB gzipped).
  The fin is a hand-built sweep rather than three.js's `ExtrudeGeometry`, which would have added another 28 kB.

## D160 - Every panel starts folded (panels round, captain's request)

The captain asked for the app to open with all of the menus closed, directly or after the tour, so it does not feel cluttered.

- **Folded by default.** The control panel with its step list, the readout card, the legend and the cost card of both tabs start folded into their chips, so the map opens clean with only the top row, the chips and the player bar (Play and speed) around it.
- **One store.** Which panels are open lives in `usePanelStore` (`src/state/panels.ts`), per tab, instead of in each `Panel`.
  `Panel` and `Legend` take a `minimized` prop and still keep their own state when it is left out; the tabs bind theirs with `usePanelFold(tab, id)`, and both cost chips with `useCostCard` (`src/ui/build/useCostCard.ts`).
- **Per tab.** Switching tabs unmounts the other tab (spec 7), but its panels stay as the viewer left them, because the state is outside the tab.
- **Back to clean.** Leaving the home screen ("Open the demo", "Skip the tour" or Escape), reopening it, starting the tour (the ? button) and ending it (Finish, Close, Skip tour, Escape or the brand chip) fold every panel of both tabs.
  Between those, a panel the viewer opens stays open while they work.
- **The tour opens what it shows.** Each step opens exactly the panels holding its targets and folds every other one (`TOUR_TARGET_PANELS` and `tourStepPanels` in `src/config/tour.ts`): the legend for the map and its colors, the control panel for the steps, the fleet, the story and Your turn, and the cost card for What it costs.
  The cost step's copy now says the card is open here rather than asking the viewer to open it, and a click in the callout no longer closes the card it talks about.
- **Starting a walkthrough opens nothing.** Play, Start and the step keys never open a panel; the step caption sits in the player bar, which never folds.
  The one exception is the cost card, which the walkthrough already opened by itself on its cost step and folded after (spec 10.3: the Build tab's Cost step and the Survey tab's Done step).
  That step's caption is about the number in that card, so it keeps doing so; it is the only panel any walkthrough opens, and only while that step plays.
- **The map fit is unchanged.** The site still fits the gap between the 320 px docks (`UI.mapFitPaddingPx`), so opening a panel never covers it.

## D161 - Chips that read as something that opens (panels round)

A folded panel used to be a text-only chip ("Survey", "Full site", "Legend"), and the control panel's chip read like the tab of the same name.

- Each chip now has the panel's icon, its name and a chevron pointing the way it opens, like the cost chip: down for the panels at the top, up for the legend.
- The icons say what the panel holds: sliders for the control panel, a gauge for the readout card ("Full site" and "Readout") and a palette for the legend.
- The control panel's chip reads "Controls & steps" on both tabs (`UI.controlsChip`), since the panel's own title is the tab's name; the panel keeps its title when open.
- At 1280 x 720 and 1440 x 900 the chips sit at the top of the left and right docks, under the brand and the cost chip, and the legend's chip under the map tools, clear of the player bar and the "Take me there" call to action.
