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
- By the captain's request the brand chip and the browser tab title read "Exowatt: Scaling Deployment" (`UI.brand`, `index.html`).

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
- It holds the "Exowatt: Scaling Deployment" title, two sentences on what the demo shows (the site's acres and units, the survey, the radio mesh and the reroute, all read from the code), one line on the two tabs, the primary "Open the demo" and a quiet second action, and a footer with how to reopen it and the credit.
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
`TOUR_OPTIONAL_TARGETS` lists targets that exist only on demand (the cost card), and `tests/guide.test.tsx` checks every other target of every step is in the rendered app on its tab.

## D94 - Player commands from outside a tab (home and tour round)

The players live inside the tabs, so the tour asks rather than reaches in: `usePlayerCommands.requestYourTurn()` (`src/ui/player/commands.ts`) is a counter, and the mounted tab's `usePlayer` jumps to "Your turn" on each increase.
A player ignores requests made before it mounted, so switching tabs never replays an old request.
