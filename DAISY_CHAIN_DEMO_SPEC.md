# DAISY_CHAIN_DEMO_SPEC.md - Modular Lane-Radio Network Demo (23,000 units)

**Project:** MITEC Hack '26 · Exowatt challenge · **Version:** 3.0 · **Date:** Nov 7, 2026
**Audience:** A team of coding agents.
Read this full file before you write code.

**Changes in v3:**
- The site is **2,000 acres with 23,000 P3 units** in a rectangular buildout; the layout and spacing follow from that (§3).
- **Two tabs**, **Survey** (4x4s on autonomous paths, each on Starlink, §8) and **Build & failure** (a linear walkthrough on a zoomed-in play model, §9), each with a **Play** walkthrough that narrates itself (§7).
- A **color story** replaces the Exowatt-matched theme: five colors with one meaning each, explained in a legend, with circular radio coverage that shows what is covered and what is not (§5).
- A **design system** (§6) so the build looks crafted, not generated, with layout ideas from Schoolscape.
- **Cost** is in scope: one pricing file shaped like the team's cost workbook, and a cost readout for the full-site radio network (§10).
- The corner module has **4 beams**, both ways down the lane and both ways down the column, confirmed by the team (§4).
- **Simplicity first:** what does not serve the two tabs is **Deferred** (§15).
- Kept from PR 2: the center base, the center-out build, the less-is-more rule (D10) and favicon option 3.
- Superseded from PR 2: D9 (the failure scenario on the full site), D11 (the Exowatt theme) and the header link, which becomes a quiet "by Alexander Yevchenko" credit at the bottom center.

**Context files (read them; do not change them):**
- `research/exowatt-challenge-brief.md` - the challenge and Exowatt's frame (model, connect, stress-test, cost); the team adds it to the repo
- `research/radio-pricing-estimate.md` and `research/corner-module-cost-model.xlsx` - the team's cost estimate (§10); the team adds both files to the repo
- `research/exowatt-company-research.md` - P3 unit facts, construction phases, survey robots
- `research/offgrid-connectivity-research.md`, `research/low-frequency-and-data-budget.md` - radio options and data budget
- `daisy-demo/docs/DECISIONS.md` - decisions D1 to D12 made while building Phase 0 and Phase 1

## Open questions for review

The first review settled the earlier list.
These are the new choices that the review's changes create; each uses the simplest option consistent with the feedback.

1. **Units per lane:** 25 (was 20), so 23,000 units fill the 2:1 site exactly: 10 × 5 blocks, 250 units per lane row × 92 lane rows, lane pitch about 21 m.
   The alternative keeps 20 units per lane (13 blocks, 260 per row, as in the team's workbook) and lands on 22,880 or 23,140 units.
2. **Default radio design:** HaLow with integrated antennas, the workbook's recommendation.
   On this site it is a 9 × 5 grid of 45 modules, the same grid as the play model, so the play model and the cost readout describe one design.
3. **Play-model cells:** 4 units × 3 lanes (about 57 m × 63 m), so 540 units; 45 radios plus the base; 75 m link range and 46 m coverage radius.
   The cells are drawn small so the build and the failure are visible; distances are not to scale with the full-site design.
4. **Cost readout:** shows the default design only, with a line-item breakdown; an expandable "Compare radios" list with one line per workbook setup is a [SHOULD].
   There is no radio selector that changes the map.
5. **Pricing format:** flat per-item prices that mirror the workbook's Inputs sheet; v2.1's bulk tiers and range price points stay deferred.
6. **Survey cost:** 4x4-hours × a placeholder hourly rate ($150), which is not in the workbook yet.
7. **Stress-test:** only on the Build & failure tab; the Survey tab shows model, connect and cost.
8. **Coverage target:** 95%, from Exowatt's example, shown next to the coverage number.
9. **Chrome:** no header bar; a "Daisy chain" brand chip top left, the tab switch as a segmented control top center, the honesty badge top right, and the walkthrough steps as a numbered list in the left panel.
10. **Font:** Inter, self-hosted.

## 0. Summary
### 0.1 The story this demo tells
- **Modular, like the P3.** Each P3 unit either has a bolt-on corner radio module or does not; there is no other site infrastructure between units.
- **Daisy chain to the base.** Data goes radio to radio, down the lanes and down the columns, to one base at the site center (Starlink backhaul).
- **Survey first.** Before any unit exists, 4x4s survey the ground on coordinated autonomous paths; each carries Starlink, so the fleet is online everywhere.
- **Coverage grows with the build.** The build starts at the center and moves east and west; each radio switches on when its unit is powered, and the covered area grows with it.
- **Self-healing.** When one radio fails, its neighbors detect it, the traffic that went through it takes a new path through other radios, and no data is lost.
- **Cheap.** The full-site network costs a small fraction of a percent of the P3 hardware.

### 0.2 What the user can do
1. Pick a tab: **Survey** or **Build & failure**.
2. Press **Play** and watch a captioned walkthrough of that tab, or click a numbered step to jump to it.
3. On **Survey**: set the number of 4x4s, press **Send**, and compare time and cost.
4. On **Build & failure**: click any radio to fail or repair it and watch the traffic reroute and the coverage change; read what the full-site network costs.

### 0.3 Decisions already made
| Topic | Decision |
|---|---|
| Site | 2,000 acres, 23,000 P3 units exactly, rectangular |
| Hardware | One bolt-on corner module per P3 (yes or no), 4 beams: ±lane and ±column |
| Base | One base at the site center (D5) |
| Build order | Center-out, east and west at the same pace (D5) |
| Layout | Less is more (D10): the map dominates; show a control only together with its function |
| Tabs | Survey, then Build & failure; Survey opens first; the full-site build-day view stays hidden |
| Favicon | Option 3: a white radio-with-beams mark on an orange-to-red circle |

### 0.4 Value against Exowatt's frame
Exowatt's brief asks teams to **model** the site, **connect** every asset, **stress-test** the solution and show **what it costs**.

| Frame | Survey tab | Build & failure tab |
|---|---|---|
| Model | 2,000 acres, 23,000 planned units, surveyed ground over time | The build from the center out, unit by unit |
| Connect | Every 4x4 online over Starlink; strips coordinated so no ground is driven twice | Radios online, coverage % against the 95% target |
| Stress-test | - | A radio fails: detection time, reroute, packets lost (0), coverage after the failure |
| Cost | 4x4-hours and survey cost; more 4x4s finish sooner for about the same cost | Full-site network cost, per container, per kWh of storage, % of P3 hardware |

### 0.5 Honesty rules
- Show **"Simulated · Illustrative values"** at all times.
- Label the play model: "Play model: the full-site 9 × 5 radio grid on a 540-unit section; distances not to scale".
- Label sped-up or slowed-down motion where it happens, for example "Packets slowed for visibility".
- Show **"Team estimate · not quotes"** on every cost while `pricing.verified` is false.
- All numbers are in `src/config/`; no magic numbers in other files.
- Do not show facts about Exowatt that are not in `research/`.

## 1. Tech stack and rules

| Item | Choice |
|---|---|
| App location | `daisy-demo/` (built in Phase 0) |
| Build | Vite + React 18 + TypeScript (`strict: true`) |
| State | Zustand |
| Map | Canvas 2D (D12); no WebGL |
| Font and icons | Inter (`@fontsource-variable/inter`), `lucide-react` icons |
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

## 2. Repository structure (target)

```
daisy-demo/
├── docs/ ASSUMPTIONS.md · DECISIONS.md · DEMO_SCRIPT.md · PRICING_FORMAT.md
├── src/
│   ├── config/ defaults.ts · survey.ts · play.ts · pricing.json   ← all numbers
│   ├── engine/                                        ← pure TypeScript, no React
│   │   ├── types.ts · rng.ts · spatialIndex.ts · site.ts · schedule.ts   (built)
│   │   ├── survey.ts        ← 4x4 path planning, time model, surveyed cells
│   │   ├── pricing.ts       ← full-site network cost and survey cost
│   │   ├── playModel.ts     ← play-model grid, radios, center-out build steps
│   │   ├── network.ts       ← links, routes to the base, coverage
│   │   └── packetSim.ts     ← discrete-event failure, detection and reroute
│   ├── state/ store.ts (shell) · survey.ts · build.ts
│   └── ui/
│       ├── App.tsx · tokens.css · theme.css
│       ├── kit/        ← Panel, Segmented, Stepper, StepList, HoverCard, InlineBar, Legend, Chip
│       ├── shell/      ← brand chip, tab switch, badge, credit
│       ├── player/     ← usePlayer, PlayerBar
│       ├── map/        ← full-site map (built in T1.3)
│       ├── survey/     ← SurveyTab and its layers and cards
│       └── build/      ← BuildTab, play-model map and cards
└── tests/
```

## 3. Site model (2,000 acres, 23,000 units)
### 3.1 Geometry (`SITE` in `defaults.ts`)
| Key | Default | Note |
|---|---|---|
| `targetUnits` | 23000 | Exact count |
| `areaAcres` | 2000 | |
| `aspect` | 2.0 | Rectangle, about 4,023 m × 2,012 m |
| `unitWidthM` × `unitDepthM` | 12.2 × 2.44 | 40 ft container footprint (unchanged) |
| `unitGapM` | 2.0 | Gap between units in a lane (unchanged), so 14.2 m along the lane |
| `unitsPerLane` | 25 | Was 20; 25 makes the count exact (open question 1) |
| `lanesPerBlock` | 20 | Upper limit; lanes are spread evenly over the block rows (D2) |
| `roadWidthM` | 10 | Unchanged |
| `edgeMarginM` | 20 | Unchanged |

*Expected:* 10 block columns (250 units per lane row, about 3,640 m wide), 92 lane rows in 5 block rows (18 or 19 lanes each), lane pitch about 21.0 m, count exactly 23,000.
Lanes, columns and corridors work as built in T1.1 (D1 to D4).
The full-site build schedule (T1.2, D5 to D8) stays in the engine: at 200 units per day the build takes 115 days.

## 4. Radio model

- **One module design:** a corner module bolted onto a P3 unit, powered by the unit once it is commissioned (a 30-day battery bridges the gap; it is costed in §10).
- **4 beams, confirmed by the team:** +lane, -lane, +column and -column, from 2 directional radios and 4 antennas.
  So a radio can send to any of its 4 neighbors, which is what lets traffic go around a failed radio in any direction.
- **Links:** two radios link when they are neighbors on the radio grid (same row or column of cells) and their distance is at most `linkRangeM`.
  Diagonal neighbors are out of range by design, so the network is a grid of lane and column links.
- **Coverage:** each online, connected radio covers a circle of `coverageRadiusM` for machines and people on the ground.
  The coverage radius is shorter than the link range because radio-to-radio links run down the open corridors, while ground users are among the metal units.
- **The base** is a radio with a Starlink backhaul and the same link and coverage ranges in the play model.
- **Routes:** every radio sends to the base along a shortest-hop path (§9.3).

Write these assumptions in `docs/ASSUMPTIONS.md`.

## 5. Color story
### 5.1 Rules
- Each color has **one meaning**, the same in both tabs.
- The legend names each color in one or two words and shows only the meanings visible in the current tab.
- Failure also has a shape (a red ×), so the story does not depend on telling red from green.
- Coverage is drawn as the **union** of the circles with one translucent fill, so overlaps do not get darker.
  Where there is no tint, there is no signal.
- No other hues on the map; the chrome is neutral.
  Orange stays only in the favicon.

### 5.2 Palette (map tokens in `src/ui/tokens.css`)
| Token | Start value | Meaning | Used for |
|---|---|---|---|
| `--c-signal` | `#2FBF71` green | Radio signal | Online radios, links, coverage fill (about 18% alpha) |
| `--c-data` | `#3B9EFF` blue | Data moving | Packets, the route to the base, the 4x4s' online status |
| `--c-fail` | `#F04438` red | Failure | Failed radio (×), cut-off radio (hollow ring), lost packets |
| `--c-work` | `#F5B82E` amber | Work in progress | 4x4s and their planned paths, placed units whose radio is not on yet |
| `--c-unit` | `#5B6270` grey | Site | Placed P3 units; planned units as thin outlines at low alpha |
| `--c-done` | `#2B323C` grey | Site | Surveyed ground |
| `--c-base` | `#FFFFFF` white | Site | The base marker |

The implementer may tune lightness and alpha for contrast, but not the hue or the meaning.

## 6. Design system
### 6.1 Principles
- Dark, quiet, precise: the map is the hero, and the panels recede.
- The story colors of §5 are the only saturated things on screen.
- Every element earns its place (D10); nothing is decorative.
- It must not look generated: no emoji, no gradients or glows on panels, no ambient animation, no placeholder copy, no centered hero text, one primary button per panel at most.

### 6.2 Layout
```
┌────────────────────────────────────────────────────────────────────────────────┐
│ [Daisy chain]           [ Survey | Build & failure ]    [Simulated · Illustr.] │
│ ┌ Control panel 320 ┐                                    ┌ Readout card 320 ┐  │
│ │ inputs            │                                    │ KPIs · cost      │  │
│ │ STEPS, IN ORDER   │            MAP (full bleed)        └──────────────────┘  │
│ │ 1 ...  2 ...      │                 [hover card]                             │
│ └───────────────────┘                                    ┌ Legend ┐            │
│                 [ ▶  ━━━━━━━━━━━━  caption           ]   └────────┘            │
│                           by Alexander Yevchenko                               │
└────────────────────────────────────────────────────────────────────────────────┘
```
- The map fills the viewport; everything else floats over it with a 16 px margin.
- **Top row (48 px):** the brand chip at left ("Daisy chain" on a rounded tile with a hairline border), the tab switch as a segmented control at center, the honesty badge as a small chip at right.
  There is no header bar, and no link in the top row.
- **Control panel (left, 320 px):** a title row with a minimize button, the tab's inputs (§8.1, §9.6), a hairline, then "STEPS, IN ORDER" with the walkthrough steps as a numbered list (§7).
- **Readout card (right, 320 px):** the tab's numbers in sections (for example CONNECT, STRESS-TEST, COST), each with a small uppercase label and separated by hairlines; it has a minimize button.
  The **legend card** sits bottom right.
- **Player bar (bottom center, at most 560 px wide):** play and pause, a progress track with step ticks, and the current caption.
- **Credit:** "by Alexander Yevchenko" in the low-contrast style of a map attribution line at the very bottom center, under the player bar; it links to `https://alexanderyevchenko.com` in a new tab and never covers a panel, the legend or the player.
- A minimized panel folds into a compact chip in its corner; clicking the chip restores it.
- Map fits keep targets in the gap between the panels; the page works at 1280×720 and 1440×900 with no scroll and no overlap.

### 6.3 Surfaces (`src/ui/tokens.css`)
```css
:root { --bg-0: #0b0d11; --surface: rgba(18, 21, 27, 0.86); --surface-strong: rgba(18, 21, 27, 0.92);
  --border: rgba(255, 255, 255, 0.08); --border-strong: rgba(255, 255, 255, 0.16); --highlight: rgba(255, 255, 255, 0.04);
  --text-1: #f2f4f7; --text-2: #aab2bf; --text-3: #6f7886; --r-chip: 8px; --r-card: 12px; --r-panel: 16px; --r-pill: 999px;
  --shadow-panel: 0 12px 40px rgba(0, 0, 0, 0.45); --blur-panel: 18px; --ease: cubic-bezier(0.2, 0.8, 0.2, 1); }
.panel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-panel);
         box-shadow: var(--shadow-panel), inset 0 1px 0 var(--highlight); backdrop-filter: blur(var(--blur-panel)); }
```
- Panel padding 16 px; gaps between sections 12 px; between controls 8 px; all spacing on the 4 px grid.
- Hairlines are 1 px `--border`; the selected or focused element uses `--border-strong`.
- The interactive accent is white (`--text-1`), never a story color, so color keeps its §5 meaning.

### 6.4 Typography
- Inter, self-hosted; sizes 11, 12, 13, 14, 16 and 20 px only.
- 11 px uppercase labels with 0.06 em letter spacing in `--text-3` ("STEPS, IN ORDER", "CONNECT", "COST").
- 13 px body in panels, 16 px weight 600 panel titles, 20 px weight 600 headline numbers.
- Every number uses `font-variant-numeric: tabular-nums` and is right-aligned in its column; units are 12 px `--text-2` next to the value.
- Sentence case everywhere except the small labels; numbers use thousands separators and at most 3 significant digits in readouts ($74.6k, 0.04%).

### 6.5 Controls
- **Segmented control:** a pill track with a raised selected segment (lighter fill and `--border-strong`), 32 px high; used for the tab switch.
- **Stepper:** minus, value, plus, 32 px high; used for the 4x4 count.
- **Buttons:** 32 px high, radius 8; one primary per panel (light fill, dark text); others are quiet (no fill, hairline border).
- **Numbered steps:** a 20 px circle with the number, then the step label; the current step is `--text-1` with a filled circle, done steps are `--text-2`, later steps `--text-3`; clicking a step seeks to it.
- **Chips:** 11 px uppercase on a hairline pill, for badges such as "TEAM ESTIMATE · NOT QUOTES" and "SIMULATED · ILLUSTRATIVE VALUES".

### 6.6 Hover card
- Hovering a radio, the base or a 4x4 shows a card within 120 ms, 14 px right of and below the pointer, flipped to stay 8 px inside the map; it never covers the pointer.
- Shape: a title ("Radio C6-2", "4x4 #2"), a subtitle line in `--text-2` ("Online · 3 hops to base", "Online · Starlink"), a hairline, then rows of label, a small inline bar (48 × 4 px, track `--border`, fill in the row's story color) and a tabular value.
  Example rows: radio - hops, queue, packets forwarded; 4x4 - strip progress, km driven, time left.
- A last line in 11 px uppercase `--text-3` says what a click does ("CLICK TO FAIL", "CLICK TO REPAIR").
- The card uses `--surface-strong`, `--border-strong`, radius 12, padding 10 × 12, width 260 px, and holds no controls.

### 6.7 Motion
- Durations: hover 120 ms, controls 200 ms, panel minimize and restore 280 ms, all with `--ease`.
- Map: a radio fades and scales its circle in over 300 ms when it comes online; a failed radio flashes red once; packets move linearly; nothing loops for decoration.
- `prefers-reduced-motion: reduce`: all UI durations 0 and no fades on the map; packets and vehicles still move because they carry the story.

### 6.8 Interaction and accessibility
- Pointer cursor on every clickable thing, including radios (12 px hit radius) and steps.
- Keyboard: Space plays and pauses, Left and Right step, Tab reaches every control; focus shows a 2 px white ring.
  Every icon button has an accessible label; panel text keeps at least 4.5:1 contrast.

## 7. Play control (walkthrough)

- Each tab defines a **walkthrough**: an ordered list of steps, each with a short label (for the step list), a one-sentence caption (at most about 90 characters) and a duration.
- **Play** runs the walkthrough; the caption shows in the player bar and the current step is highlighted in the step list, so the walkthrough explains itself.
- Controls: play and pause, step back and forward (to step boundaries), restart, a progress track with one tick per step, and the numbered step list.
- The last step of each tab is an open **"Your turn"** step with no end; the tab is fully interactive there.
- Any user input during the walkthrough (changing an input, clicking a radio) pauses it and jumps to "Your turn"; Restart returns to the walkthrough with the default inputs.
- Switching tabs unmounts the other tab; returning starts it from the beginning.
- The tab renders the state at time `t`, computed from its inputs, never accumulated frame by frame (rule 6).

## 8. Survey tab
### 8.1 Inputs (control panel)
- **4x4s:** a stepper from 1 to `SURVEY.maxVehicles` (8), default 3.
  Changing it re-plans the paths at once and shows them as dashed amber lines.
- **Send** (primary button): starts the 4x4s on their paths.
  During a run the stepper is locked; Restart unlocks it.

### 8.2 Path planning (`survey.ts`)
1. The survey area is the unit-grid rectangle of the full site (about 3,640 m × 1,972 m).
2. Split it into N strips of equal width (north-south boundaries), one per 4x4, so no ground is driven twice.
3. Each 4x4 drives from the base to the edge of its strip nearest the base, then does back-and-forth north-south passes `swathM` apart across the strip, and returns to the base.
   The strip that contains the base starts at its west edge.
4. Transit legs run at `transitSpeedKmh`; survey passes at `surveySpeedKmh`; turns take no time.
5. The survey ends when the last 4x4 is back at the base.

### 8.3 Connectivity and readout
Every 4x4 carries a Starlink terminal, so it is online everywhere on the site; each shows a small blue online dot, and there is no coverage circle or offline state on this tab.
The readout card shows:
- **MODEL:** 2,000 acres · 23,000 planned units · surveyed %.
- **CONNECT:** 4x4s online (for example 3/3) · elapsed hours · time to finish (h).
- **COST:** 4x4-hours · survey cost (§10.4), with the estimate chip.

### 8.4 Config (`src/config/survey.ts`, placeholders)
| Key | Default |
|---|---|
| `maxVehicles` | 8 |
| `defaultVehicles` | 3 |
| `swathM` | 20 |
| `surveySpeedKmh` | 8 |
| `transitSpeedKmh` | 20 |
| `cellM` | 10 |
| `playbackHoursPerS` | 1 (1 hour of work plays in 1 s) |

*Expected:* about 45 h with one 4x4, about 15 h with three and about 8 h with six; the 4x4-hours, and so the cost, stay within about 5% of each other.

### 8.5 Walkthrough
| Step | Duration | Caption (draft) | What the map shows |
|---|---|---|---|
| Site | 4 s | "2,000 acres and 23,000 P3 units to place. First, 4x4s survey the ground." | Full site, planned units as outlines, the base |
| Paths | 3 s | "Each 4x4 gets its own strip, so no ground is driven twice." | Dashed amber paths |
| Survey | survey time ÷ playback rate | "Every 4x4 carries Starlink, so the whole fleet stays online anywhere on site." | 4x4s move, surveyed ground fills |
| Done | 4 s | "Survey done in 15 h with 3 4x4s. More 4x4s finish sooner at about the same cost." | Final readout (numbers from the run) |
| Your turn | open | "Your turn: change the number of 4x4s and press Send." | Interactive |

## 9. Build & failure tab
### 9.1 Play model (`playModel.ts`, `src/config/play.ts`)
| Key | Default | Meaning |
|---|---|---|
| `cellCols` × `cellRows` | 9 × 5 | Radio cells, one radio each (45); the same grid as the full-site default design (§10.3) |
| `unitsPerCell` | 4 | Units along the lane per cell |
| `lanesPerCell` | 3 | Lanes per cell |
| `rowPitchM` | 21.0 | Lane pitch, as on the full site; unit size and gap come from `SITE` |
| `linkRangeM` | 75 | Lane neighbors (about 57 m) and column neighbors (about 63 m) link; diagonals (about 85 m) do not |
| `coverageRadiusM` | 46 | At least the cell half-diagonal (about 42 m) plus the radio's offset from the cell center (about 2 m), and less than the smaller cell side (about 57 m) |
| `coverageTargetPct` | 95 | Exowatt's example target |
| `buildStepS` | 0.7 | Playback time per build step |
| `commissionLagSteps` | 2 | Build steps from placing a unit to its radio switching on |
| `packetIntervalS` | 1.0 | Each radio sends one packet per interval |
| `hopS` | 0.15 | Playback time per hop (label "Packets slowed for visibility") |

- The grid is 36 units × 15 lanes = 540 units, about 511 m × 315 m, with no roads.
- Each radio sits on the NE corner of the unit nearest its cell center; the base stands at the center of the middle cell (4, 2), beside that cell's radio.

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
- Traffic: every connected radio sends packets along its route as blue dots; the routes that went through the failed radio are highlighted in blue, and their old path is dashed grey after the reroute.
- The upstream neighbor shows a queue badge that grows during detection and empties after the reroute.

### 9.5 Preset failure (walkthrough)
- Watched source: the east-most radio of the middle row, cell (8, 2); its route runs west along the middle row to the base.
- Failed radio: (6, 2), in the middle of that route.
- *Expected:* detection in about 3 s, every radio stays connected, 0 packets lost, the watched route is 2 hops longer, and a small coverage hole opens at (6, 2) while coverage stays above the 95% target.
- After recovery a maintenance ticket appears: "Replace the radio on P3 #N (cell 6, 2). Swap time about 15 min (placeholder)."

### 9.6 Interaction ("Your turn")
- Click a radio to fail it; click a failed radio to repair it (it rejoins at its next hello).
- Several radios can be failed at once; cut-off radios and lost coverage show at once on the map.
- The control panel holds only the hint "Click a radio to fail it", a Reset button that repairs all radios, and the step list.

### 9.7 Readout card
- **CONNECT:** radios online (for example 45/45) · coverage % against the 95% target, with an inline bar and a tick at the target.
- **STRESS-TEST** (after a failure): detected in (s) · rerouted in (s) · packets sent, delivered, lost · largest queue · extra hops · radios cut off.
- **COST · FULL SITE:** §10.3.

### 9.8 Walkthrough
| Step | Duration | Caption (draft) | What the map shows |
|---|---|---|---|
| Section | 4 s | "A small section of the site. The base at the center links to Starlink." | Planned units, the base and its circle |
| Build | about 14 s | "Units go in from the center out. Each radio switches on once its unit has power." | Build steps (§9.2) |
| Coverage | 4 s | "Green circles show where the signal reaches. The whole section is covered." | Full coverage |
| Data | 5 s | "Blue dots are data. Each radio sends to the base through its neighbors." | Packets on the routes |
| Failure | 1 s | "This radio fails." | Red × at (6, 2), its circle gone |
| Detection | 3 s | "Its neighbors miss three hellos in a row. Data waits in a queue." | Hello counters 1/3 to 3/3, queue badge grows |
| Reroute | 3 s | "The traffic goes around the failed radio, down another lane and column." | New blue route, old route dashed, update ring |
| Recovered | 5 s | "No data lost. The new path is 2 hops longer. A repair ticket is sent." | Stress-test numbers, ticket |
| Cost | 5 s | "The full site needs 45 of these radios: about $75k, 0.04% of the P3 hardware." | The cost section highlighted (numbers from §10) |
| Your turn | open | "Your turn: click any radio to fail it. Click it again to repair it." | Interactive |

## 10. Cost
### 10.1 Pricing file (`src/config/pricing.json`, documented in `docs/PRICING_FORMAT.md`)
One file holds every price and cost assumption.
Its keys mirror the Inputs sheet of the team's workbook (`research/corner-module-cost-model.xlsx`), and `PRICING_FORMAT.md` lists the workbook cell for each key, so new numbers drop in by copying values.
Do not copy the workbook into the app.

```json
{ "verified": false, "source": "Team estimate, Nov 7 2026 (corner-module-cost-model.xlsx)", "currency": "USD",
  "project": { "kwhPerUnit": 25, "p3UnitPriceUsd": 7500 }, "placement": { "spacingFactor": 0.85 },
  "battery": { "bridgeDays": 30, "depthOfDischarge": 0.8, "usdPerKwh": 400, "reusedFleet": true, "fleetSpares": 0.2, "fleetExtraPacks": 2,
               "heatOversize": 0.15, "bmsPremium": 0.1, "shadedBoxUsd": 40, "groundBoxUsd": 90, "groundBoxFromWh": 1000 },
  "module": { "sunShieldUsd": 15 }, "labor": { "wageUsdPerH": 29.36, "burden": 1.8 }, "base": { "count": 1, "unitPriceUsd": 8000 },
  "spares": 0.05, "contingency": 0.1, "defaultSetup": "halowIntegrated",
  "setups": [ { "id": "halowIntegrated", "label": "HaLow · integrated antennas", "rangeM": 500, "radioUsd": 91.8, "radiosPerModule": 2,
                "radioTariff": 0, "hostUsd": 419.5, "hostTariff": 0, "antennaUsd": 8, "antennasPerModule": 4, "enclosureUsd": 40,
                "enclosureTariff": 0.1, "bracketUsd": 40, "hardwareUsd": 20, "laborHPerModule": 0.75, "avgPowerW": 2.5 } ],
  "survey": { "vehicleHourUsd": 150 } }
```
- `setups` holds all six rows of the workbook (BLE and HaLow with off-the-shelf or integrated antennas, LoRa, 5 GHz mesh); only the first is shown above.
- Values from the workbook are the team's estimates; `survey.vehicleHourUsd` is a placeholder that the workbook does not have yet.
- Layout values (units per lane row, lane rows, pitches, units per day) come from the site model and `BUILD`, not from this file.
- On load, validate the file (no negative values, known `defaultSetup`, fractions between 0 and 1) and show errors in the console and as a cost-section warning.

### 10.2 Network cost (`pricing.ts`, the workbook's formulas)
For a setup on the full site:
1. `N = max(1, floor(rangeM × spacingFactor ÷ unit pitch along the lane))`, `M = max(1, floor(rangeM × spacingFactor ÷ lane pitch))`.
2. `modules = ceil(units per lane row ÷ N) × ceil(lane rows ÷ M)`.
3. `moduleUsd = radioUsd × radiosPerModule × (1 + radioTariff) + hostUsd × (1 + hostTariff) + antennaUsd × antennasPerModule + enclosureUsd × (1 + enclosureTariff) + bracketUsd + hardwareUsd + laborHPerModule × wageUsdPerH × burden + sunShieldUsd`.
4. `batteryWh = avgPowerW × 24 × bridgeDays ÷ depthOfDischarge × (1 + heatOversize)`.
5. `batteryUsd = batteryWh ÷ 1000 × usdPerKwh × (1 + bmsPremium) + (batteryWh < groundBoxFromWh ? shadedBoxUsd : groundBoxUsd)`.
6. `packs = reusedFleet ? min(modules, ceil(modules × bridgeDays × unitsPerDay ÷ units × (1 + fleetSpares)) + fleetExtraPacks) : modules`.
7. `subtotal = modules × moduleUsd + packs × batteryUsd + base.count × base.unitPriceUsd`; `total = subtotal × (1 + spares) × (1 + contingency)`.
8. Per container = `total ÷ units`; per kWh of storage = `total ÷ (units × kwhPerUnit)`; share of P3 hardware = `total ÷ (units × p3UnitPriceUsd)`.

*Expected on this site:* HaLow with integrated antennas gives N = 29, M = 20, a 9 × 5 grid of 45 modules, 17 battery packs and a total of about $74.6k ($3.24 per container, $0.13 per kWh of storage, 0.04% of P3 hardware).

### 10.3 Cost readout (Build & failure readout card)
- Title "COST · FULL SITE" with the "TEAM ESTIMATE · NOT QUOTES" chip while `verified` is false.
- The setup label, the total as the headline number, then per container, per kWh of storage and % of P3 hardware.
- A breakdown, open by default after the walkthrough's Cost step: modules (count × unit price), batteries (packs × pack price, "reused fleet"), base, spares, contingency; each row has an inline bar for its share of the total.
- [SHOULD] An expandable "Compare radios" list: one row per setup with modules, total and per container; the default setup is marked.

### 10.4 Survey cost
`4x4-hours = sum of each 4x4's drive time`; `survey cost = 4x4-hours × survey.vehicleHourUsd`.

## 11. Tasks (phases, acceptance criteria)

**[MUST]** needed for the demo · **[SHOULD]** important.

### Built
- **Phase 0** (T0.1 to T0.4): app, config, layout shell, RNG and spatial index - PR 1.
- **T1.1** `site.ts` - PR 1.
- **T1.2** `schedule.ts`, center-out - PR 1 and PR 2.
- **T1.3** Full-site map: unit layer, zones, pan, zoom, fit, scale bar - PR 2.

### Phase 2 - Shell and design system (worker A) [MUST]
- **T2.1** Design tokens and kit: `tokens.css` (§5.2, §6.3), Inter, and the `ui/kit/` components of §13.1, each with a render test.
  Mark D11 as superseded in `DECISIONS.md`.
  *Accept:* no hex color or font size outside `tokens.css`; components match §6.4 to §6.6.
- **T2.2** Shell: brand chip, tab switch, honesty badge, credit, minimize to chip, and stub `SurveyTab` (the full-site map with planned units) and `BuildTab`; remove the build-day slider, the header and the top-right link.
  *Accept:* both tabs switch; no page scroll and no overlap at 1280×720 and 1440×900; the credit opens alexanderyevchenko.com in a new tab.
- **T2.3** Player: `usePlayer`, `PlayerBar` and `StepList` (§7), with Space and the arrow keys.
  *Accept:* unit tests for the clock: step boundaries, pause, seek, step back and forward, restart, `toYourTurn`.

### Phase 3 - Site, survey and cost engine (worker B) [MUST]
- **T3.1** Re-target the site to 2,000 acres and 23,000 units (§3.1) and update the site and schedule tests.
  *Accept:* the count is exactly 23,000; 10 block columns, 92 lane rows, lane pitch between 20 m and 22 m.
- **T3.2** `survey.ts` (§8.2, §8.4).
  *Accept:* tests: the strips cover the survey area with no gap and no overlap; every cell is surveyed at the end; time to finish falls as the 4x4 count rises; 1, 3 and 6 4x4s give the expected times of §8.4 within 10%.
- **T3.3** `pricing.json`, `docs/PRICING_FORMAT.md` and `pricing.ts` (§10).
  *Accept:* golden tests with the workbook's own layout (260 units per lane row, 89 lane rows, 14.2 m and 22.6 m pitch) reproduce its totals to the dollar: BLE off-the-shelf 1,950 modules $1,040,204; BLE integrated 1,950 $615,069; LoRa 6 $11,480; HaLow integrated 45 $74,616; HaLow off-the-shelf 45 $98,086; 5 GHz mesh 144 $634,408.
  On the v3 site, HaLow integrated gives 45 modules (9 × 5); an invalid file fails validation.
- **T3.4** Survey tab UI: map layers (planned units, surveyed ground, paths, 4x4s with online dots), control panel, readout card, hover card for 4x4s, legend and walkthrough (§8).
  *Accept:* Play runs the walkthrough end to end at 60 fps; seeking to any step shows the right state; changing the 4x4 count re-plans the paths at once.

### Phase 4 - Build & failure tab (worker C) [MUST]
- **T4.1** `playModel.ts` (§9.1, §9.2).
  *Accept:* tests: 540 units and 45 radios; the build is symmetric around the center; every radio switches on exactly `commissionLagSteps` after its unit.
- **T4.2** `network.ts` (§9.3).
  *Accept:* tests: the finished grid has every radio connected and 100% coverage; failing (6, 2) keeps all radios connected and drops coverage below 100% but above 95%; failing a full column of radios cuts off the radios beyond it.
- **T4.3** `packetSim.ts` (§9.4, §9.5).
  *Accept:* tests: detection within `missedHellosToDown × helloIntervalS ± helloIntervalS`; 0 packets lost and all queued packets delivered after the reroute; 2 extra hops on the watched route; the same seed gives the same events.
- **T4.4** Build tab UI: play-model map, coverage union, links, packets, queue badge, click to fail and repair, Reset, hover card for radios, readout card with the cost section (§10.3), ticket, legend and walkthrough (§9.6 to §9.8).
  Mark D9 as superseded in `DECISIONS.md`.
  *Accept:* Play runs the walkthrough end to end at 60 fps; clicking radios after the walkthrough reroutes the traffic and updates coverage within one frame; the cost numbers come from `pricing.ts`.

### Phase 5 - Story and checks (after Phases 2 to 4 merge) [MUST]
- **T5.1** [SHOULD] `docs/DEMO_SCRIPT.md` (§12), `daisy-demo/README.md`, and the "Compare radios" list (§10.3).
- **T5.2** Final checks: build, lint and tests pass; no console errors; both walkthroughs run at 1280×720 and 1440×900 with no overlap; all numbers come from `src/config/`; the legend matches what each tab shows; a design pass against §6 with screenshots of every step.

## 12. Demo script (`docs/DEMO_SCRIPT.md`, about 2 min)
1. **Survey tab, Play.** "2,000 acres, 23,000 P3 units. First, 4x4s survey the ground, each in its own strip, all online over Starlink."
2. **Change 3 to 6 4x4s, Send.** "Twice the vehicles, half the time, about the same cost."
3. **Build & failure tab, Play.** "Units go in from the center out; each radio adds its circle of coverage."
4. **The walkthrough fails a radio.** "Its neighbors notice in about 3 s, the traffic goes around it, and no data is lost."
5. **Cost.** "The whole site needs 45 radios: about $75k, 0.04% of the P3 hardware."
6. **Your turn.** Click two more radios: the coverage holes and the new routes show at once; click one again to repair it.

## 13. Agent team split

| Worker | Area | Tasks | Owns |
|---|---|---|---|
| **A - Shell** | design system, kit, shell, player, final checks | T2.1 to T2.3, T5.1, T5.2 | `ui/App.tsx`, `ui/tokens.css`, `ui/theme.css`, `ui/kit/`, `ui/shell/`, `ui/player/`, `state/store.ts`, the `UI` section of `config/defaults.ts` |
| **B - Site, survey, cost** | site re-target, survey engine and tab, pricing engine | T3.1 to T3.4 | `engine/site.ts`, `engine/survey.ts`, `engine/pricing.ts`, `config/survey.ts`, `config/pricing.json`, `docs/PRICING_FORMAT.md`, the `SITE` section of `config/defaults.ts`, `ui/survey/`, `ui/map/`, `state/survey.ts` |
| **C - Build & failure** | play model, network, packet sim and tab | T4.1 to T4.4 | `engine/playModel.ts`, `engine/network.ts`, `engine/packetSim.ts`, `config/play.ts`, `ui/build/`, `state/build.ts` |

- All three start at once.
  B and C begin with their engine tasks (T3.1 to T3.3, T4.1 to T4.3), which touch no file of another worker.
  They start their UI task (T3.4, T4.4) on top of A's merged T2.1 to T2.3, replacing A's stub tab file.
- Shared files: `config/defaults.ts` (A and B edit different sections) and `docs/DECISIONS.md` and `docs/ASSUMPTIONS.md` (append only; new decisions are numbered D20+ for A, D30+ for B, D40+ for C).
- New engine types live in the engine file that uses them, not in `types.ts`.
- Merge order: A, then B and C in either order, then T5.

### 13.1 Shared contracts
Worker A creates these files in its first commit; the others code against this section until then.

```ts
// src/ui/player/types.ts
export interface WalkStep { id: string; label: string; caption: string; durationS: number } // Infinity for "Your turn"
export interface Player {
  t: number; playing: boolean; stepIndex: number;
  play(): void; pause(): void; seek(t: number): void; stepBy(d: 1 | -1): void; restart(): void;
  toYourTurn(): void; // called on user input; pauses and jumps to the last step
}
// src/ui/player: usePlayer(steps): Player · <PlayerBar player steps /> · <StepList player steps />

// src/ui/kit (minimum props; add optional ones freely): <Panel title? onMinimize? corner: 'tl'|'tr'|'br'> · <Section label>
// <Segmented options value onChange /> · <Stepper min max value onChange label /> · <InlineBar pct token /> · <Chip text />
// <Kpi label value unit? bar?: { pct; token; targetPct? } /> · <HoverCard x y title subtitle rows: { label; value; pct?; token? }[] hint? />
export type ColorToken = 'signal' | 'data' | 'fail' | 'work' | 'unit' | 'done' | 'base';
export interface LegendItem { token: ColorToken; label: string; shape: 'dot' | 'circle' | 'line' | 'dash' | 'cross' | 'ring' | 'square' | 'fill' }
// <Legend items />

// src/engine/pricing.ts (worker B)
export interface NetworkCost { setupId: string; label: string; n: number; m: number; modules: number; moduleUsd: number;
  packs: number; batteryUsd: number; basesUsd: number; sparesUsd: number; contingencyUsd: number; totalUsd: number;
  perContainerUsd: number; perKwhUsd: number; shareOfP3: number; verified: boolean }
export function networkCost(pricing: Pricing, layout: SiteLayoutSummary, setupId?: string): NetworkCost
```

- Tabs: `src/ui/survey/SurveyTab.tsx` exports `SurveyTab`, and `src/ui/build/BuildTab.tsx` exports `BuildTab`; each renders its map, panels, legend, hover card and player.
- Each tab keeps its state in its own store file; `state/store.ts` holds only the active tab.
- Map code reads colors only from the tokens of §5.2.

## 14. Values to confirm (then change only the config)
1. Real site layout: units per lane, lane direction, lane pitch (`SITE.*`).
2. 4x4 survey method, swath, speeds and hourly cost (`SURVEY.*`, `pricing.survey`).
3. Supplier quotes for the corner module and batteries (`pricing.json`, then set `verified` to true).
4. Radio link range and ground coverage radius on site (`setups[].rangeM`, `PLAY.linkRangeM`, `PLAY.coverageRadiusM`).
5. Hello timing of the real mesh protocol (`ROUTING.*`).
6. Module swap time for the maintenance ticket.

## 15. Deferred

These v2.1 features do not serve the two tabs.
They stay out of v3 and can come back later as their own tasks.

- **Radio presets, the range slider, placement controls and auto-tune** (v2.1 §4.1, §4.2, §6.1); the pricing file keeps all six setups for later.
- **Directional antenna model** (v2.1 §4.3): beam angles, side lobes, obstruction by placed units, the "lane beams only" toggle.
- **Pricing extras** (v2.1 §5): bulk tiers, range price points, the pricing editor, import and export.
- **Resilience metrics, score and capacity** (v2.1 §6.3): articulation points, the random-failure curve, disjoint paths, bottleneck links; the workbook notes which setups carry P3 telemetry.
- **Several bases and the base editor** (v2.1 §6.4).
- **Build-edge model** (v2.1 §7): zones, temporary front relays, denser edge, the "Edge over time" chart; the battery bridge is costed in §10 but not simulated.
- **Full-site build-day slider and zone view** (built in T1.3, hidden in v3).
- **Area and random failure tools; the "Buffering off" toggle** (v2.1 §8).
- **Web Worker engine interface** (v2.1 §9).
- **Charts and A/B compare** (v2.1 §10.5) and KPI export.
