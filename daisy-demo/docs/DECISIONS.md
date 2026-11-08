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
- On this grid the detour is 1 hop longer, not the spec's 2: the base also links (5, 3), so the route around (7, 2) through row 3 rejoins the base one hop early.
- Every number in the walkthrough's captions comes from the code: the "Recovered" caption from the network and a short simulation (packets lost and extra hops), and the "Cost" caption from `networkCost` (modules, total and share of the P3 hardware).
- The cost section shows the default setup, its total, per container, per kWh of storage and share of the P3 hardware, with the "Team estimate · not quotes" chip while the pricing file is not verified, and a breakdown of modules, batteries, base, spares and contingency with a bar for each share of the total.
  The breakdown opens by default from the "Cost" step on, and the cost section is outlined and scrolled into view during that step.
