# DAISY_CHAIN_DEMO_SPEC.md - Modular Lane-Radio Network Demo (23,000 units)

**Project:** MITEC Hack '26 · Exowatt challenge · **Version:** 3.0 · **Date:** Nov 7, 2026
**Audience:** A team of coding agents.
Read this full file before you write code.

**Changes in v3:**
- The site has **23,000 P3 units** in place of about 80,000; the site area and layout follow from that count (§3).
- The demo has **two tabs**: **Survey** (4x4 vehicles on autonomous paths, §8) and **Build & failure** (a linear walkthrough on a zoomed-in play model, §9).
- Each tab has a **Play** control that walks the viewer through the work with on-screen captions, so nobody has to narrate (§7).
- A **color story** replaces the Exowatt-matched theme: five colors with one meaning each, explained in an on-screen legend, with circular radio coverage that shows what is covered and what is not (§5).
- **Simplicity first:** everything that does not serve the two tabs moves to **Deferred** (§15), including pricing, presets, the range slider, the directional antenna model, resilience scores, capacity, the build-edge toggles and A/B compare.
- The link to alexanderyevchenko.com moves from the top-right corner to a quiet **"by Alexander Yevchenko"** credit at the bottom center (§6).
- Kept from PR 2: the center base, the center-out build, the less-is-more rule (D10) and favicon option 3.
- Superseded from PR 2: D9 (the failure scenario on the full site) and D11 (the Exowatt theme).

**Context files (read them; do not change them):**
- `research/offgrid-connectivity-research.md` - industry methods and radio options
- `research/exowatt-company-research.md` - P3 unit facts, construction phases, survey robots
- `research/low-frequency-and-data-budget.md` - data budget and latency
- `daisy-demo/docs/DECISIONS.md` - decisions D1 to D12 made while building Phase 0 and Phase 1

---

## Open questions for review

The feedback left these product choices open.
Each one uses the simplest option consistent with the feedback; confirm or change them in the PR review.

1. **Site area for 23,000 units:** 575 acres, from the same rule that gave 80,000 for 2,000 acres (1 MWh per acre, 25 kWh per unit).
   The alternative is to keep 2,000 acres and spread the units out (lane pitch of about 20 m).
2. **Site layout:** the PR 1 blocks (20 units per lane, unit and road sizes) are kept, so the site is 10 block columns by 6 block rows, about 2,993 m × 777 m (aspect 3.85), with a lane pitch of about 6.0 m.
   The count is exactly 23,000 (200 units per lane row × 115 lane rows).
3. **What the survey measures and shows:** ground surveyed over time, time to finish, km driven per 4x4, and the share of drive time with a live link to the base.
   Placeholder survey rates: 20 m swath at 8 km/h, 20 km/h in transit.
4. **How the user sends paths:** the user picks the number of 4x4s (1 to 8, default 3) and presses Send.
   The app plans one back-and-forth path per 4x4 in equal strips, sweeping away from the center base.
   There is no path drawing.
5. **Survey radio coverage:** before the build there are no unit radios, so only the base has signal, drawn as a 450 m circle (a tall mast).
   Outside it, 4x4s work offline and upload when back in range.
6. **Play-model grid:** a 1,800-unit section of the site at real unit size: 9 × 5 radio cells, each 4 units along the lane × 10 lanes (about 57 m × 60 m), about 511 m × 300 m in total, with no roads.
   The base takes the center cell, so there are 44 radios.
7. **Link range and coverage radius in the play model:** radios link to their lane and column neighbors (75 m link range, no diagonals).
   Each radio's coverage circle for machines and people is 45 m, so the finished grid is fully covered and one failed radio leaves a visible hole.
   The base uses the same 45 m circle here so the grid stays readable.
8. **Radio model:** links follow the grid (lane and column neighbors within range); the v2.1 directional beam, side-lobe and obstruction model is deferred.
9. **Failure:** the walkthrough fails a preset radio (the middle radio on the route from the east-most radio of the middle row).
   After the walkthrough the user can click any radio to fail it and click it again to repair it; several failures at once are allowed, and cut-off radios are shown.
10. **Colors:** green = radio signal, blue = data, red = failure, amber = work in progress, neutral greys and white = the site itself (§5.2).
    The page is one neutral dark theme; orange stays only in the favicon.
11. **Play:** one walkthrough per tab (about 30 s for Survey with 3 4x4s, about 40 s for Build & failure); there is no combined "play both tabs".
    After the walkthrough each tab is interactive.
12. **Default tab:** Survey, because it is the first step of the work.
13. **Commissioning in the play model:** a radio switches on 2 build steps after its unit is placed, and shows amber in between.
14. **Full-site build view:** the T1.3 build-day slider and zone view of the full site are hidden in v3 (deferred); the Survey tab shows the full site with planned units only.
15. **Costs:** no cost is shown in v3; pricing is deferred.

---

## 0. Summary

### 0.1 The story this demo tells
- **Modular, like the P3.** Each P3 unit either has a bolt-on corner radio module or does not; there is no other site infrastructure between units.
- **Daisy chain to the base.** Data goes radio to radio, down the lanes and down the columns, to one base at the site center (Starlink backhaul).
- **Survey first.** Before any unit exists, 4x4 vehicles survey the ground on autonomous paths; only the base has signal, so most of the site has no live link yet.
- **Coverage grows with the build.** The build starts at the center and moves east and west; each radio switches on when its unit is powered, and the covered area grows with it.
- **Self-healing.** When one radio fails, its neighbors detect it, the traffic that went through it takes a new path through other radios, and no data is lost.

### 0.2 What the user can do
1. Pick a tab: **Survey** or **Build & failure**.
2. Press **Play** and watch a captioned walkthrough of that tab.
3. On **Survey**: set the number of 4x4s, press **Send**, and see how long the survey takes.
4. On **Build & failure**: click any radio to fail or repair it and watch the traffic reroute and the coverage change.

### 0.3 Decisions already made
| Topic | Decision |
|---|---|
| Unit count | 23,000 P3 units, exactly |
| Hardware | One bolt-on corner module per P3 (yes or no), links down the lane and down the column |
| Base | One base at the site center (D5) |
| Build order | Center-out, east and west at the same pace (D5) |
| Layout | Less is more (D10): the map dominates; show a control only together with its function |
| Tabs | Survey, then Build & failure |
| Favicon | Option 3: a white radio-with-beams mark on an orange-to-red circle |
| Main-site link | "by Alexander Yevchenko" credit, bottom center |

### 0.4 Honesty rules
- Show **"Simulated · Illustrative values"** in the header.
- Label the play model on the map: "Play model: a 1,800-unit section, not to scale with the full site's radio count".
- Label sped-up or slowed-down motion where it happens, for example "Packets slowed for visibility".
- All numbers are in `src/config/`; no magic numbers in other files.
- Do not show facts about Exowatt that are not in `research/`.

---

## 1. Tech stack and rules

| Item | Choice |
|---|---|
| App location | `daisy-demo/` (built in Phase 0) |
| Build | Vite + React 18 + TypeScript (`strict: true`) |
| State | Zustand |
| Map | Canvas 2D (D12); no WebGL |
| Tests | Vitest |
| Lint and format | ESLint + Prettier |
| Platform | macOS, Node 20+. `cd daisy-demo && npm install && npm run dev` |
| Determinism | Seeded RNG (`RNG.seed`) |

Both tabs are small enough to compute on the main thread; the Web Worker of v2.1 is deferred.

**Rules for agents:**
1. Units: meters, seconds, USD, watts, bits per second, degrees.
2. Each file in `src/engine/` starts with a 2-line comment that tells what it does.
3. Run `npm test`, `npm run lint` and `npm run build` before each commit.
4. Small commits, one task at a time, with the task ID in the message.
5. If a requirement is not clear, use the simplest method that satisfies the acceptance criteria, and write it in `daisy-demo/docs/DECISIONS.md`.
6. A tab's view is a pure function of its inputs and the player time `t`, so seeking and stepping back work (§7).

---

## 2. Repository structure (target)

```
daisy-demo/
├── docs/ ASSUMPTIONS.md · DECISIONS.md · DEMO_SCRIPT.md
├── src/
│   ├── config/ defaults.ts · survey.ts · play.ts       ← all numbers
│   ├── engine/                                        ← pure TypeScript, no React
│   │   ├── types.ts · rng.ts · spatialIndex.ts         (built)
│   │   ├── site.ts · schedule.ts                       (built)
│   │   ├── survey.ts        ← 4x4 path planning, time model, surveyed cells
│   │   ├── playModel.ts     ← play-model grid, radios, center-out build steps
│   │   ├── network.ts       ← links, routes to the base, coverage
│   │   └── packetSim.ts     ← discrete-event failure, detection and reroute
│   ├── state/ store.ts (shell) · survey.ts · build.ts
│   └── ui/
│       ├── App.tsx · theme.css
│       ├── shell/      ← header, tabs, legend, credit
│       ├── player/     ← usePlayer, PlayerBar
│       ├── map/        ← full-site map (built in T1.3)
│       ├── survey/     ← SurveyTab and its layers and cards
│       └── build/      ← BuildTab, play-model map and cards
└── tests/
```

---

## 3. Site model (23,000 units)

### 3.1 Geometry (`SITE` in `defaults.ts`)
| Key | Default | Note |
|---|---|---|
| `targetUnits` | 23000 | Exact count |
| `areaAcres` | 575 | 23,000 units × 25 kWh ÷ 1 MWh per acre (`SCALE`) |
| `aspect` | 3.85 | Chosen so 10 block columns fit; about 2,993 m × 777 m |
| `unitWidthM` × `unitDepthM` | 12.2 × 2.44 | 40 ft container footprint (unchanged) |
| `unitGapM` | 2.0 | Gap between units in a lane (unchanged) |
| `unitsPerLane` | 20 | Unchanged |
| `lanesPerBlock` | 20 | Upper limit; the lanes are spread evenly over the block rows (D2) |
| `roadWidthM` | 10 | Unchanged |
| `edgeMarginM` | 20 | Unchanged |

*Expected:* 10 block columns (200 units per lane row), 115 lane rows in 6 block rows (19 or 20 lanes each), lane pitch about 6.0 m, count exactly 23,000.
If the generator's block fit differs, adjust `aspect`, not the count.

Lanes, columns and corridors work as built in T1.1 (D1 to D4).
The full-site build schedule (T1.2, D5 to D8) stays in the engine: at 200 units per day the full build takes 115 days.

---

## 4. Radio model

- **One module design:** a corner module bolted onto a P3 unit, powered by the unit once it is commissioned.
- **Links:** two radios link when they are neighbors on the radio grid (same row of cells or same column of cells) and their distance is at most `linkRangeM`.
  Diagonal neighbors are out of range by design, so the network is a grid of lane and column links.
- **Coverage:** each online, connected radio covers a circle of `coverageRadiusM` around it, for machines and people on the ground.
  The coverage radius is shorter than the link range because radio-to-radio links run down the open corridors, while ground users are among the metal units.
- **The base** is a radio with a Starlink backhaul.
  On the full site (Survey tab) it has a tall mast and covers `SURVEY.baseRadiusM`; in the play model it covers `coverageRadiusM` like a radio.
- **Routes:** every radio sends to the base along a shortest-hop path (§9.3).

Write these assumptions in `docs/ASSUMPTIONS.md`.

---

## 5. Color story

### 5.1 Rules
- Each color has **one meaning**, the same in both tabs.
- A small **legend** on the map names each color in one or two words and shows only the meanings visible in the current tab.
- Failure also has a shape (a red ×), so the story does not depend on telling red from green.
- Coverage is drawn as the **union** of the circles with one translucent fill, so overlaps do not get darker.
  Where there is no tint, there is no signal.
- No other hues on the map.
  Orange stays only in the favicon.

### 5.2 Palette (CSS variables in `src/ui/theme.css`)
| Token | Start value | Meaning | Used for |
|---|---|---|---|
| `--c-signal` | `#2FBF71` green | Radio signal | Online radios, links, coverage fill (about 18% alpha), the base's circle |
| `--c-data` | `#3B9EFF` blue | Data moving | Packets, the route to the base, live 4x4 links |
| `--c-fail` | `#F04438` red | Failure | Failed radio (×), cut-off radio (hollow ring), lost packets |
| `--c-work` | `#F5B82E` amber | Work in progress | 4x4s and their planned paths, placed units whose radio is not on yet |
| `--c-unit` | `#5B6270` grey | Site | Placed P3 units; planned units as thin outlines at low alpha |
| `--c-done` | `#2B323C` grey | Site | Surveyed ground |
| `--c-base` | `#FFFFFF` white | Site | The base marker |
| `--c-bg` | `#0D0F12` | Background | Map and page |

The implementer may tune lightness and alpha for contrast, but not the hue or the meaning.
The page chrome (header, cards, player) is the same neutral dark theme as the map.

---

## 6. Layout and shell

```
┌ Header: title · [ Survey | Build & failure ] ············ Simulated · Illustrative values ┐
│ ┌ Tab card ┐                                                          ┌ KPI card ┐      │
│ └──────────┘                                                          └──────────┘      │
│                                  Map (full bleed)                                       │
│ ┌ Legend ┐                                                                              │
│ └────────┘        [ ▶  ◀◀  ▶▶  ⟲ │ timeline with step markers │ caption ]               │
│                                by Alexander Yevchenko                                   │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Header:** the title, the two tabs and the honesty badge, nothing else.
  Remove the top-right alexanderyevchenko.com link of PR 2.
- **Tab card** (top left): the tab's few inputs (§8.1, §9.6).
- **KPI card** (top right): the tab's live numbers.
- **Legend** (bottom left): §5.1.
- **Player bar** (bottom center): §7.
- **Credit:** "by Alexander Yevchenko" in small, low-contrast text at the bottom center of the map, under the player bar, in the style of a map attribution line.
  It links to `https://alexanderyevchenko.com` and opens in a new tab.
  It never covers a card, the legend or the player.
- Cards and the player float on the map with a dark translucent background.
- Must work at 1280×720 and 1440×900 with no page scroll and no overlap between floating elements.
- Switching tabs unmounts the other tab; returning starts it from the beginning.

---

## 7. Play control (walkthrough)

- Each tab defines a **walkthrough**: an ordered list of steps, each with a one-sentence caption (at most about 90 characters) and a duration.
- **Play** runs the walkthrough; the current caption shows in the player bar, so the walkthrough explains itself.
- Controls: play and pause (also the Space key), step back and step forward (jump to step boundaries), restart, and a timeline with one marker per step that the user can click to seek.
- The last step of each tab is an open **"Your turn"** step with no end; the tab is fully interactive there.
- Any user input during the walkthrough (changing an input, clicking a radio) pauses it and jumps to "Your turn".
- Restart returns to the walkthrough with the tab's default inputs.
- The tab renders the state at time `t`, computed from its inputs, never accumulated frame by frame (rule 6).

---

## 8. Survey tab

### 8.1 Inputs (tab card)
- **4x4s:** a stepper from 1 to `SURVEY.maxVehicles` (8), default 3.
  Changing it re-plans the paths at once and shows them as dashed amber lines.
- **Send:** starts the 4x4s on their paths.
  During a run the stepper is locked; Restart unlocks it.

### 8.2 Path planning (`survey.ts`)
1. The survey area is the unit-grid rectangle of the full site.
2. Split it into N strips of equal width (north-south boundaries), one per 4x4.
3. Each 4x4 drives from the base to the edge of its strip nearest the base, then does back-and-forth north-south passes `swathM` apart across the strip, and returns to the base.
   The strip that contains the base starts at its west edge.
   So the survey front moves outward from the center, ahead of the center-out build.
4. Transit legs run at `transitSpeedKmh`; survey passes at `surveySpeedKmh`; turns take no time.
5. The survey ends when the last 4x4 is back at the base.

### 8.3 Outputs
- **Surveyed ground:** cells of `cellM`; a cell is surveyed when a 4x4's survey pass covers it.
- **Base signal:** the base's circle (`baseRadiusM`) in green; a 4x4 inside it draws a thin blue line to the base (live data).
- **KPI card:** 4x4s · surveyed % · elapsed hours · time to finish (h) · km per 4x4 · live link % (share of drive time inside the base circle).

### 8.4 Config (`src/config/survey.ts`, placeholders)
| Key | Default |
|---|---|
| `maxVehicles` | 8 |
| `defaultVehicles` | 3 |
| `swathM` | 20 |
| `surveySpeedKmh` | 8 |
| `transitSpeedKmh` | 20 |
| `cellM` | 10 |
| `baseRadiusM` | 450 |
| `playbackHoursPerS` | 0.25 (1 hour of work plays in 4 s) |

*Expected:* about 14 h with one 4x4, about 4.6 h with three and about 2.4 h with six; the base circle covers about a quarter of the survey area.

### 8.5 Walkthrough
| Step | Duration | Caption (draft) | What the map shows |
|---|---|---|---|
| Site | 4 s | "23,000 P3 units will go here. First, 4x4s survey the ground." | Full site, planned units as outlines |
| Signal | 4 s | "Only the base has signal so far. It covers about a quarter of the site." | Base and its green circle |
| Paths | 3 s | "Each 4x4 gets an autonomous path. You choose how many to send." | Dashed amber paths |
| Survey | survey time ÷ playback rate | "Inside the green circle the 4x4s send live data. Outside, they upload later." | 4x4s move, surveyed ground fills, blue live links |
| Done | 4 s | "Survey done in 4.6 h with 3 4x4s. Try more 4x4s to finish faster." | Final KPIs (numbers from the run) |
| Your turn | open | "Your turn: change the number of 4x4s and press Send." | Interactive |

---

## 9. Build & failure tab

### 9.1 Play model (`playModel.ts`, `src/config/play.ts`)
| Key | Default | Meaning |
|---|---|---|
| `cellCols` × `cellRows` | 9 × 5 | Radio cells; the base takes the center cell (4, 2), so 44 radios |
| `unitsPerCell` | 4 | Units along the lane per cell |
| `lanesPerCell` | 10 | Lanes per cell |
| `rowPitchM` | 6.0 | Lane pitch; unit size and gap come from `SITE` |
| `linkRangeM` | 75 | Lane and column neighbors (about 57 m and 60 m) link; diagonals (about 83 m) do not |
| `coverageRadiusM` | 45 | Must be at least the cell half-diagonal plus the radio's offset from the cell center, and less than the smaller cell side |
| `buildStepS` | 0.7 | Playback time per build step |
| `commissionLagSteps` | 2 | Build steps from placing a unit to its radio switching on |
| `packetIntervalS` | 1.0 | Each radio sends one packet per interval |
| `hopS` | 0.15 | Playback time per hop (label "Packets slowed for visibility") |

- The grid is 36 units × 50 lanes = 1,800 units, about 511 m × 300 m, with no roads.
- Each radio sits on the NE corner of the unit nearest its cell center.
- The KPI card adds one line that ties the model to the full site: "Full site: 23,000 units · about 575 radios at this spacing" (23,000 ÷ units per cell).

### 9.2 Build sequence
- Step 0: only the base is on, with its coverage circle.
- Each step places one pair of unit columns, from the center out (the pairing of D5), so the build advances east and west at the same pace.
- A placed unit is grey; the radio on it shows amber until `commissionLagSteps` later, then turns green, links to its online neighbors and adds its coverage circle.

### 9.3 Network (`network.ts`)
- Nodes: online radios that have not failed, plus the base.
- Links by §4; draw them as thin green lines.
- **Routes:** BFS hop count from the base; each radio's next hop is its neighbor with the fewest hops, ties broken by straight-line distance to the base, then by lower id.
  Each radio also keeps a **backup next hop**: its best other neighbor that does not route through it.
- **Connected:** a radio with a route to the base.
  A radio that is online but has no route is **cut off** (hollow red ring), and its circle does not count as coverage.
- **Coverage %:** share of sample points (`coverageSampleM` = 2 m) in the play-model rectangle within `coverageRadiusM` of a connected radio or the base.

### 9.4 Failure, detection and reroute (`packetSim.ts`)
Routing model (from v2.1 §8.2, unchanged values):

| Key | Default | Meaning |
|---|---|---|
| `helloIntervalS` | 1.0 | Each radio sends a hello to its neighbors |
| `missedHellosToDown` | 3 | A neighbor is declared down after 3 missed hellos (about 3 s) |
| `localRepair` | true | The upstream neighbor sends to its backup next hop at once |
| `updateFloodPerHopS` | 0.02 | The route update spreads hop by hop |
| `bufferMaxPackets` | 500 | Radios queue packets while they have no route |

- Events: packet send, hop, hello, hello timeout, neighbor down, local repair, route update, queue flush, delivered, lost.
- The simulation precomputes the full event list from the failure time, deterministic with `RNG.seed`, and the view plays it back at time `t`.
- Traffic: every connected radio sends packets along its route as blue dots; the routes of the radios whose path went through the failed radio are highlighted in blue, and their old path is dashed grey after the reroute.
- The upstream neighbor shows a queue badge that grows during detection and empties after the reroute.

### 9.5 Preset failure (walkthrough)
- Watched source: the east-most radio of the middle row, cell (8, 2); its route runs west through (7, 2), (6, 2), (5, 2) to the base.
- Failed radio: (6, 2), the middle of that route.
- *Expected:* detection in about 3 s, every radio stays connected, 0 packets lost, the watched route is 2 hops longer, and a small coverage hole opens at (6, 2).
- After recovery a maintenance ticket appears: "Replace the radio on P3 #N (cell 6, 2). Swap time about 15 min (placeholder)."

### 9.6 Interaction ("Your turn")
- Click a radio to fail it; click a failed radio to repair it (it rejoins at its next hello).
- Several radios can be failed at once; cut-off radios and lost coverage show at once on the map.
- A **Reset** button in the tab card repairs all radios.
- The tab card holds only the hint "Click a radio to fail it" and Reset.

### 9.7 KPI card
Radios online · coverage % · and, after a failure: detected in (s) · rerouted in (s) · packets sent, delivered, lost · largest queue · extra hops · radios cut off · the full-site line (§9.1).

### 9.8 Walkthrough
| Step | Duration | Caption (draft) | What the map shows |
|---|---|---|---|
| Section | 4 s | "A 1,800-unit section of the site. The base at the center links to Starlink." | Planned units, the base and its circle |
| Build | about 14 s | "Units go in from the center out. Each radio switches on once its unit has power." | Build steps (§9.2) |
| Coverage | 4 s | "Green circles show where the signal reaches. The whole section is covered." | Full coverage |
| Data | 5 s | "Blue dots are data. Each radio sends to the base through its neighbors." | Packets on the routes |
| Failure | 1 s | "This radio fails." | Red × at (6, 2), its circle gone |
| Detection | 3 s | "Its neighbors miss three hellos in a row. Data waits in a queue." | Hello counters 1/3 to 3/3, queue badge grows |
| Reroute | 3 s | "The network sends the traffic around the failed radio." | New blue route, old route dashed, update ring |
| Recovered | 5 s | "No data lost. The new path is 2 hops longer. A repair ticket is sent." | KPIs, maintenance ticket |
| Your turn | open | "Your turn: click any radio to fail it. Click it again to repair it." | Interactive |

---

## 10. Shared contracts

These let the three workers of §13 build in parallel.
Worker A creates the files below in its first commit; the others code against this section until then.

```ts
// src/ui/player/types.ts
export interface WalkStep { id: string; caption: string; durationS: number } // durationS = Infinity for "Your turn"
export interface Player {
  t: number; playing: boolean; stepIndex: number;
  play(): void; pause(): void; seek(t: number): void; stepBy(d: 1 | -1): void; restart(): void;
  toYourTurn(): void; // called on user input; pauses and jumps to the last step
}
// src/ui/player/usePlayer.ts:  export function usePlayer(steps: WalkStep[]): Player
// src/ui/player/PlayerBar.tsx: export function PlayerBar(props: { player: Player; steps: WalkStep[] }): JSX.Element

// src/ui/shell/Legend.tsx
export type ColorToken = 'signal' | 'data' | 'fail' | 'work' | 'unit' | 'done' | 'base';
export interface LegendItem { token: ColorToken; label: string; shape: 'dot' | 'circle' | 'line' | 'dash' | 'cross' | 'ring' | 'square' | 'fill' }
export function Legend(props: { items: LegendItem[] }): JSX.Element
```

- Tabs: `src/ui/survey/SurveyTab.tsx` exports `SurveyTab`, and `src/ui/build/BuildTab.tsx` exports `BuildTab`.
  Each renders its map, its cards (CSS classes `.card-tl`, `.card-tr` from `theme.css`), its `Legend` and its `PlayerBar`.
- Each tab keeps its state in its own store file (`state/survey.ts`, `state/build.ts`); `state/store.ts` holds only the active tab.
- Map code reads colors only from the tokens of §5.2.

---

## 11. Tasks (phases, acceptance criteria)

**[MUST]** needed for the demo · **[SHOULD]** important.

### Built
- **Phase 0** (T0.1 to T0.4): app, config, layout shell, RNG and spatial index - PR 1.
- **T1.1** `site.ts` - PR 1.
- **T1.2** `schedule.ts`, center-out - PR 1 and PR 2.
- **T1.3** Full-site map: unit layer, zones, pan, zoom, fit, scale bar - PR 2.

### Phase 2 - Shell and color story (worker A) [MUST]
- **T2.1** App shell: header with the two tabs (Survey default), stub `SurveyTab` (the full-site map with planned units) and stub `BuildTab`, and `state/store.ts`; remove the build-day slider and the top-right link from the page.
  *Accept:* both tabs switch; no page scroll at 1280×720 and 1440×900.
- **T2.2** Player: `usePlayer` and `PlayerBar` (§7, §10), with the Space key.
  *Accept:* unit tests for the clock: step boundaries, pause, seek, step back and forward, restart, `toYourTurn`.
- **T2.3** Color story: tokens of §5.2 in `theme.css`, neutral dark theme for the whole page, `Legend`, card classes; the T1.3 map switches to the tokens.
  Update D11 in `DECISIONS.md` as superseded.
  *Accept:* no hex color outside `theme.css`; the map has no orange.
- **T2.4** Credit (§6).
  *Accept:* the link opens alexanderyevchenko.com in a new tab and overlaps nothing at both sizes.

### Phase 3 - Survey tab (worker B) [MUST]
- **T3.1** Re-target the site to 23,000 units (§3.1) and update the site and schedule tests.
  *Accept:* the count is exactly 23,000; 10 block columns, 115 lane rows, pitch between 5.5 m and 6.5 m.
- **T3.2** `survey.ts` (§8.2 to §8.4).
  *Accept:* tests: the strips cover the survey area with no gap; every cell is surveyed at the end; time to finish falls as the 4x4 count rises; 1 and 3 4x4s give the expected times of §8.4 within 10%; the live-link share is between 0 and 100%.
- **T3.3** Survey tab UI: map layers (planned units, surveyed ground, base circle, paths, 4x4s, live links), tab card, KPI card, legend and walkthrough (§8.5).
  *Accept:* Play runs the walkthrough end to end at 60 fps; seeking to any step shows the right state; changing the 4x4 count re-plans the paths at once.

### Phase 4 - Build & failure tab (worker C) [MUST]
- **T4.1** `playModel.ts` (§9.1, §9.2).
  *Accept:* tests: 1,800 units and 44 radios; the build is symmetric around the center; every radio switches on exactly `commissionLagSteps` after its unit.
- **T4.2** `network.ts` (§9.3).
  *Accept:* tests: the finished grid has every radio connected and 100% coverage; failing (6, 2) keeps all radios connected and drops coverage below 100%; failing a full column of radios cuts off the radios beyond it.
- **T4.3** `packetSim.ts` (§9.4, §9.5).
  *Accept:* tests: detection within `missedHellosToDown × helloIntervalS ± helloIntervalS`; 0 packets lost and all queued packets delivered after the reroute; 2 extra hops on the watched route; the same seed gives the same events.
- **T4.4** Build tab UI: play-model map, coverage union, links, packets, queue badge, click to fail and repair, Reset, KPI card, ticket, legend and walkthrough (§9.6 to §9.8).
  Mark D9 as superseded in `DECISIONS.md`.
  *Accept:* Play runs the walkthrough end to end at 60 fps; clicking radios after the walkthrough reroutes the traffic and updates coverage within one frame.

### Phase 5 - Story and checks (after Phases 2 to 4 merge) [MUST]
- **T5.1** [SHOULD] `docs/DEMO_SCRIPT.md` (§12) and `daisy-demo/README.md`.
- **T5.2** Final checks: build, lint and tests pass; no console errors; both walkthroughs run at 1280×720 and 1440×900 with no overlap; all numbers come from `src/config/`; the legend matches what each tab shows.

---

## 12. Demo script (`docs/DEMO_SCRIPT.md`, about 2 min)
1. **Survey tab, Play.** "23,000 P3 units. First, 4x4s survey the ground. Only the base has signal so far."
2. **Change 3 to 6 4x4s, Send.** "Twice the vehicles, about half the time."
3. **Build & failure tab, Play.** "Units go in from the center out; each radio adds its circle of coverage."
4. **The walkthrough fails a radio.** "Its neighbors notice in about 3 s, the traffic goes around it, and no data is lost."
5. **Your turn.** Click two more radios: the coverage holes and the new routes show at once; click one again to repair it.
6. **Close.** "The full site needs about 575 of these radios, one bolted onto every 40th unit, and no other infrastructure."

---

## 13. Agent team split

| Worker | Area | Tasks | Owns |
|---|---|---|---|
| **A - Shell** | header, tabs, player, color tokens, legend, credit, final checks | T2.1 to T2.4, T5.1, T5.2 | `ui/App.tsx`, `ui/theme.css`, `ui/shell/`, `ui/player/`, `state/store.ts`, the `UI` section of `config/defaults.ts` |
| **B - Survey** | site re-target, survey engine and tab | T3.1 to T3.3 | `engine/site.ts`, `engine/survey.ts`, `config/survey.ts`, the `SITE` section of `config/defaults.ts`, `ui/survey/`, `ui/map/`, `state/survey.ts` |
| **C - Build & failure** | play model, network, packet sim and tab | T4.1 to T4.4 | `engine/playModel.ts`, `engine/network.ts`, `engine/packetSim.ts`, `config/play.ts`, `ui/build/`, `state/build.ts` |

- All three start at once.
  B and C begin with their engine tasks (T3.1, T3.2, T4.1 to T4.3), which touch no file of another worker.
  They start their UI task (T3.3, T4.4) on top of A's merged T2.1 and T2.2, replacing A's stub tab file.
- Shared files: `config/defaults.ts` (A and B edit different sections) and `docs/DECISIONS.md` and `docs/ASSUMPTIONS.md` (append only; new decisions are numbered D20+ for A, D30+ for B, D40+ for C).
- New engine types live in the engine file that uses them, not in `types.ts`.
- A needs a new color token for B or C only if §5.2 lacks one; ask in the PR, do not add hues.
- Merge order: A, then B and C in either order, then T5.

---

## 14. Values to confirm (then change only the config)
1. Site area and layout for 23,000 units (`SITE.*`).
2. 4x4 survey method, swath and speeds (`SURVEY.*`).
3. Base mast range, radio link range and ground coverage radius (`SURVEY.baseRadiusM`, `PLAY.linkRangeM`, `PLAY.coverageRadiusM`).
4. Radio spacing on the real site (`PLAY.unitsPerCell`, `PLAY.lanesPerCell`).
5. Hello timing of the real mesh protocol (`ROUTING.*`).
6. Module swap time for the maintenance ticket.

---

## 15. Deferred

These v2.1 features do not serve the two tabs.
They stay out of v3 and can come back later as their own tasks.

- **Radio presets and the range slider** (v2.1 §4.1, §4.2): BLE, LoRa, HaLow and 5 GHz mesh with automatic preset switching.
- **Directional antenna model** (v2.1 §4.3): beam angles, side lobes, obstruction by placed units, the "lane beams only" toggle.
- **Pricing** (v2.1 §5): bulk tiers, range price points, the pricing editor, import and export, the placeholder-price label.
- **Placement controls and auto-tune** (v2.1 §6.1): every-N and every-M spacing, density balance, the three best designs.
- **Resilience metrics and score** (v2.1 §6.3): articulation points, the random-failure curve, disjoint paths, the A/B/C score.
- **Capacity and bottleneck links** (v2.1 §6.3).
- **Several bases and the base editor** (v2.1 §6.4).
- **Build-edge model** (v2.1 §7): zones, battery bridge, temporary front relays, denser edge, the "Edge over time" chart.
- **Full-site build-day slider and zone view** (built in T1.3, hidden in v3).
- **Area and random failure tools; the "Buffering off" toggle** (v2.1 §8).
- **Web Worker engine interface** (v2.1 §9).
- **Charts and A/B compare** (v2.1 §10.5), keyboard shortcuts other than Space, and KPI export.
