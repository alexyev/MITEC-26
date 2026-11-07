# DAISY_CHAIN_DEMO_SPEC.md — Modular Lane-Radio Network Demo (2,000-acre site)

**Project:** MITEC Hack '26 · Exowatt challenge · **Version:** 2.1 · **Date:** Nov 7, 2026
**Audience:** A team of coding agents. Read this full file before you write code.
**Changes from v1:** bolt-on modular radios; fully configurable pricing with bulk tiers; a pre-set single-failure reroute scenario with packet simulation; a build-edge model.
**Changes in v2.1:** there is **only one module design**: a **corner module** that sticks out from the edge of the P3 and has beams **down the lane and down the column**. All other antenna options and cross-lane methods are removed.

**Context files (read them; do not change them):**
- `research/exowatt-challenge-brief.md` — challenge and video metrics
- `research/offgrid-connectivity-research.md` — industry methods and radio options
- `research/exowatt-company-research.md` — P3 unit facts
- `research/low-frequency-and-data-budget.md` — data budget and latency
- `BUILD_PLAN.md` — the larger site-twin plan. This demo is a **separate, focused app**. Reuse code and styles from `web/` if they exist, but do not break `web/`.

---

## 0. Summary

### 0.1 The solution that this demo shows
- **Modular, like the P3.** Each P3 unit either has a **bolt-on radio module** on its side, or it does not. There is no other site infrastructure between units. Any unit can take a module later (standard bracket + power connector).
- **One module design: the corner module.** The module mounts on a corner of the P3 and sticks out slightly from the edge, into the open gaps around the unit. It has directional beams **down the lane** (along the row of units) **and down the column** (across the rows). Because the units are on a regular grid, the gaps between units form straight, clear **corridors** in both directions, and the beams look down these corridors.
- **Daisy chain to the base on a grid.** Data goes module → module along lanes **and** along columns to a site base (Starlink backhaul). Each module that is not at the edge has up to 4 neighbors (2 in its lane, 2 in its column), so the network is a **grid of links**, not a single chain.
- **Power from the P3.** A module gets power from its unit after commissioning. As an option, a **battery bridge** powers it from the day the unit is placed (see §7, build edge).

### 0.2 What the user can do
1. Select a **radio preset** or move a **range slider**; set the **placement specs** (which lanes, which units, cross-lane method).
2. See **live results:** number of modules, density, **cost (from configurable pricing with bulk tiers)**, power, resilience (3 metrics), capacity, and **build-edge coverage**.
3. **Edit all prices** in the app, or import a pricing file.
4. **Fail radios** (click, area, random) and see the cut-off units and the reroute.
5. Run the **pre-set scenario "Single radio failure"**: watch packets flow, see the failure detected, the routes updated, and the queued packets delivered.
6. Move the **build-day slider** and see how the network behaves at the **build edge**.
7. Edit **site bases**; **save designs A/B** and compare.

### 0.3 Decisions already made (from the team)
| Topic | Decision |
|---|---|
| Hardware | **Bolt-on corner module per P3 (yes/no). One design only:** beams down the lane and down the column |
| Range input | Continuous slider **plus** radio presets |
| Pricing | **All cost values configurable**, with **bulk quantity tiers** per preset; the team will supply real bulk prices |
| Resilience | All three metrics: N-1 survival, random-failure tolerance, number of separate paths |
| Site layout | Full ≈ 80,000 P3 units (configurable) |
| Scenarios | Pre-set **single radio failure** with detection and packet rerouting |
| Extra scope | Click/area/random failure, build timeline, build-edge model, base settings, A/B compare |

### 0.4 Honesty rules
- Show **"Simulated · Illustrative values"** on the main view.
- All numbers are in `src/config/defaults.ts`, `src/config/presets.ts` and `src/config/pricing.json`. No magic numbers in other files.
- Show **"Placeholder prices — verify before pitch"** in the cost panel until `pricing.verified = true`.
- Do not show facts about Exowatt that are not in `research/`.

---

## 1. Tech stack and rules

| Item | Choice |
|---|---|
| App location | **`daisy-demo/`** at the repo root (a new Vite app) |
| Build | Vite + React 18 + TypeScript (`strict: true`) |
| State | Zustand |
| Heavy computation | **Web Worker** (`src/worker/engine.worker.ts`). The UI thread must never freeze |
| Map | Canvas 2D with an offscreen pre-rendered unit layer. If 80,000 units are slow, use **WebGL via `regl`** for the unit layer |
| Charts | Recharts |
| Tests | Vitest |
| Lint/format | ESLint + Prettier |
| Platform | macOS, Node 20+. `cd daisy-demo && npm install && npm run dev` |
| Determinism | Seeded RNG (`seed` in config) |

**Rules for agents:**
1. Units: meters, seconds, USD, watts, bits per second, degrees.
2. Each file in `src/engine/` starts with a 2-line comment that tells what it does.
3. Run `npm test` and `npm run build` before each commit.
4. Small commits, one task at a time, with the task ID in the message.
5. If a requirement is not clear, use the simplest method that satisfies the acceptance criteria, and write it in `daisy-demo/docs/DECISIONS.md`.

---

## 2. Repository structure (target)

```
daisy-demo/
├── docs/ ASSUMPTIONS.md · DECISIONS.md · DEMO_SCRIPT.md · PRICING_FORMAT.md
├── public/pricing.sample.json, pricing.sample.csv
├── src/
│   ├── config/ defaults.ts · presets.ts · pricing.json · scenarios.ts
│   ├── engine/                 ← pure TypeScript, no React
│   │   ├── types.ts · rng.ts · spatialIndex.ts
│   │   ├── site.ts             ← layout, lanes, roads
│   │   ├── schedule.ts         ← placed / commissioned days, build front
│   │   ├── antenna.ts          ← directional gain → range by angle
│   │   ├── placement.ts        ← which P3 units get a module (lane rules)
│   │   ├── graph.ts            ← links, bases, cross-lane links
│   │   ├── connectivity.ts     ← BFS, served units, hops
│   │   ├── resilience.ts       ← N-1, random curve, disjoint paths
│   │   ├── capacity.ts         ← load, bottleneck
│   │   ├── edge.ts             ← build-edge coverage and resilience
│   │   ├── pricing.ts          ← tiered pricing, totals
│   │   ├── failures.ts
│   │   ├── packetSim.ts        ← discrete-event packet + routing simulation
│   │   └── engine.ts           ← compute(params) → Result
│   ├── worker/engine.worker.ts
│   ├── state/store.ts
│   └── ui/ layout · map · controls · metrics · charts · pricing · scenario · compare
└── tests/
```

---

## 3. Site model (2,000 acres, ≈ 80,000 units)

### 3.1 Geometry
| Key | Default | Note |
|---|---|---|
| `site.areaAcres` | 2000 | first site |
| `site.aspect` | 2.0 | → 4,023 m × 2,012 m (assumption) |
| `site.targetUnits` | 80000 | 2,000 acres × 1 MWh/acre ÷ 25 kWh/unit. **Change when the reps answer** |
| `unit.widthM` × `unit.depthM` × `unit.heightM` | 12.2 × 2.44 × 2.9 | 40 ft container footprint; height is an assumption |
| `unit.gapM` | 2.0 | gap between units in a lane |
| `block.unitsPerLane` | 20 | |
| `block.lanesPerBlock` | 20 | |
| `road.widthM` | 10 | between blocks, both directions |
| `site.edgeMarginM` | 20 | |

### 3.2 Lanes and columns
- A **lane** is a line of units in one row of one block, along the **long axis** of the units (east–west by default). A lane has `unitsPerLane` units and ends at a road on both sides.
- A **column** is the perpendicular line (north–south): the units with the same position index in consecutive lanes of a block.
- `layout.laneAxis`: `'EW'` (default) or `'NS'`. All placement and antenna rules use this axis.
- Lane-to-lane distance = the solved row pitch (≈ 5.5–6.5 m with the defaults).
- **Corridors:** the units in all lanes are **aligned** (same x positions in each block, and blocks aligned across roads). Thus:
  - the gaps between lanes form **lane corridors** (along the lane axis), and
  - the 2 m gaps between units in a lane line up from lane to lane and form **column corridors** (across the lanes).
  The generator must keep this alignment. Store the corridor coordinates (`laneCorridorY[]`, `columnCorridorX[]`), because modules sit at corridor intersections.

### 3.3 Layout generator (`site.ts`)
1. Units in a lane are spaced by `widthM + gapM` (= 14.2 m).
2. Block width = `unitsPerLane × 14.2`. Blocks are separated by roads.
3. Compute the block columns that fit, then solve the row pitch so that the count is as near as possible to `targetUnits`.
4. If the pitch is less than `depthM + 1.0`, reduce the count and show a warning.
5. Output: unit centers (`Float32Array`), `unitBlock`, `unitLane` (global lane id), `unitPosInLane`, lane end points, road rectangles, actual count.

*Expected:* ≈ 13 block columns (260 units per lane line), ≈ 308 lanes, pitch ≈ 5.5–6.5 m, count within 2% of 80,000.

### 3.4 Schedule (`schedule.ts`)
| Key | Default |
|---|---|
| `build.order` | `'westToEast'` (options: `'westToEast'`, `'southToNorth'`, `'fromBase'`, `'blockSerpentine'`) |
| `build.unitsPerDay` | 200 → ≈ 400 build days |
| `build.placeToCommissionDays` | 9 |
| `build.frontWorkZoneM` | 300 (zone ahead of the front where machines and crews work: survey, piling, trenching) |

- `placedDay[i]`, `commissionDay[i]`.
- The **build front** for a day = the boundary between placed and not-placed units.
- The **commission front** = the boundary between commissioned and not-commissioned units. The gap between the two fronts is the **edge zone** (§7).
- **Note:** because the corner module has beams in both directions (lane and column), the edge modules point into the work zone for **both** build directions (along or across the lanes). The demo shows this as an advantage of the corner design (see §7).

---

## 4. Radio module, presets and antennas

### 4.1 Presets (`presets.ts`) — **placeholder values; the team will verify**
| Preset | Along-lane range (default) | Slider limits | Data rate per link | Power W | Notes |
|---|---|---|---|---|---|
| **BLE (long range)** | 80 m | 30–200 m | 125 kbps | 0.3 | Short, cheap |
| **LoRa** | 1,500 m | 500–4,000 m | 5 kbps | 0.5 | Long, very low capacity |
| **Wi-Fi HaLow** | 500 m | 150–1,500 m | 2 Mbps | 2 | Medium |
| **5 GHz mesh** | 300 m | 100–800 m | 50 Mbps | 8 | High capacity |

Prices are **not** in this table. They are in `pricing.json` (§5).

### 4.2 Range slider
- Log scale, 30 m to 4,000 m. A preset sets the slider to its default range.
- If the user moves the slider outside the active preset's limits, switch to the preset whose limits include R (prefer the higher data rate) and show "Preset changed to X".
- Inside the limits, the price and power scale with range by the rules in `pricing.json` (§5.3).

### 4.3 The corner module and its antenna model (`antenna.ts`)
There is **one module design**. Its values are configurable, but the user cannot select other designs.

| Key | Default | Meaning |
|---|---|---|
| `module.corner` | `'NE'` | Which corner of the P3 holds the module (all modules use the same corner) |
| `module.offsetM` | 0.5 | How far the antenna sticks out from the unit edge into the corridor intersection |
| `module.heightM` | 3.2 | Antenna height (just above the unit roof line; assumption) |
| `module.beams` | `['+lane','-lane','+col','-col']` | Beam directions. Default: both ways down the lane and both ways down the column. **Assumption — confirm with the team** (a corner module could also face only 2 directions, for example `['+lane','+col']`) |
| `module.beamHalfWidthDeg` | 30 | Half-width of each main beam |
| `module.offAxisRangeFactor` | 0.12 | Range outside all beams, as a fraction of R (side lobes) |

**Range by angle:** for a link from module A to module B at angle θ from A's nearest beam direction:
- `|θ| ≤ beamHalfWidthDeg` → range = R.
- Otherwise → range = R × `offAxisRangeFactor`.
- A link is up if the distance ≤ **min(range at A toward B, range at B toward A)**.
- In practice, links go **down a lane corridor** (to the next module in the same lane) or **down a column corridor** (to the next module in the same column). Diagonal links are short side-lobe links.

**Obstruction:** links that follow a corridor are **clear** (the corridors are open). Links that do not follow a corridor multiply the range by `obstructionFactor` (default 0.8) for each placed unit that the line crosses, up to 3 units. Write these assumptions in `ASSUMPTIONS.md`.

**Bases** are omni (range R × `base.rangeFactor`, default 1.5, on a tall mast with no obstruction).

---

## 5. Pricing (fully configurable)

### 5.1 File format (`src/config/pricing.json`, documented in `docs/PRICING_FORMAT.md`)
```json
{
  "verified": false,
  "currency": "USD",
  "presets": {
    "mesh5": {
      "rangeRefM": 300,
      "tiers": [ {"minQty": 1, "unitPrice": 900}, {"minQty": 100, "unitPrice": 780}, {"minQty": 1000, "unitPrice": 650}, {"minQty": 10000, "unitPrice": 540} ],
      "rangeScaling": { "mode": "power", "exponent": 0.5 },
      "rangePricePoints": []
    },
    "halow": { "rangeRefM": 500, "tiers": [ {"minQty":1,"unitPrice":250}, {"minQty":100,"unitPrice":210}, {"minQty":1000,"unitPrice":170}, {"minQty":10000,"unitPrice":140} ], "rangeScaling": {"mode":"power","exponent":0.5}, "rangePricePoints": [] },
    "lora":  { "rangeRefM": 1500, "tiers": [ {"minQty":1,"unitPrice":120}, {"minQty":100,"unitPrice":95}, {"minQty":1000,"unitPrice":75}, {"minQty":10000,"unitPrice":60} ], "rangeScaling": {"mode":"power","exponent":0.5}, "rangePricePoints": [] },
    "ble":   { "rangeRefM": 80, "tiers": [ {"minQty":1,"unitPrice":40}, {"minQty":100,"unitPrice":30}, {"minQty":1000,"unitPrice":22}, {"minQty":10000,"unitPrice":16} ], "rangeScaling": {"mode":"power","exponent":0.5}, "rangePricePoints": [] }
  },
  "perModule": { "cornerBracketAndCable": 35, "antennaSet": 40, "installLabor": 60, "batteryBridge": 80 },
  "base": { "unitPrice": 8000, "powerW": 200 },
  "tempFrontRelay": { "unitPrice": 1500, "powerW": 6, "reusable": true },
  "sparesPct": 5,
  "contingencyPct": 10,
  "tierMode": "allUnits"
}
```
All values above are **placeholders**.

### 5.2 Rules
- **Tier selection:** quantity = all modules of that preset in the design (including spares). `tierMode`:
  - `"allUnits"` (default): every unit gets the price of the highest tier reached.
  - `"incremental"`: each quantity band gets its own price.
- **Range price points (for the team's real data):** if `rangePricePoints` is not empty (for example `[{"rangeM":200,"unitPrice":700},{"rangeM":400,"unitPrice":1100}]`, at the base tier), interpolate linearly in log(range) and **ignore** `rangeScaling`. The tier discounts are applied as ratios of the base tier.
- **Otherwise**, use `rangeScaling`: price at range R = tier price × (R / rangeRefM)^exponent.
- Per module total = radio price + antenna set + corner bracket and cable + install labor (+ battery bridge if on).
- Totals = modules × per-module + bases + temporary front relays (if on) + spares % + contingency %.

### 5.3 UI — pricing editor (`ui/pricing/`)
- A **"Pricing" drawer** with editable tables: tiers per preset, range price points, per-module items (corner bracket, antenna set, labor, battery bridge), temporary relays, base, spares, contingency, tier mode.
- **Import** pricing from JSON or CSV (CSV columns: `preset,minQty,unitPrice,rangeM` — `rangeM` empty = tier row; filled = range price point). **Export** the current pricing as JSON.
- Validate on import (no negative prices, tiers sorted, known presets). Show errors next to the row.
- Save the edited pricing in `localStorage` (try/catch); a "Reset to file defaults" button.
- A tooltip on the capex tile shows the tier that was used for each preset, for example "mesh5: 1,342 modules → tier ≥ 1,000 at $650".

---

## 6. Placement and network engine

### 6.1 Placement specs (user controls, `placement.ts`)
Modules sit on a **regular grid of P3 units**: every N-th unit along each equipped lane, in every M-th lane. Because all modules use the same corner, the modules in the same column positions line up in the column corridors.

| Control | Default | Meaning |
|---|---|---|
| `unitEveryN` | auto | Along a lane, put a module on every N-th unit |
| `laneEveryM` | auto | Put modules in every M-th lane |
| `spacingFactor` | 0.85 | Used by **auto** (separately for both axes): N = floor(R × spacingFactor ÷ 14.2); M = floor(R × spacingFactor ÷ row pitch). Both ≥ 1 |
| `densityBalance` | 1.0 | Optional: multiply only M by this value (0.25–1.0) to make the column spacing shorter than the lane spacing, for more column links |
| `alignAcrossBlocks` | on | Keep the module grid aligned across roads, so the lane and column links continue from block to block |

- **Do not stagger** modules between lanes. Stagger breaks the column links.
- The grid positions are fixed by N and M from the west/south edge of the site; positions that fall on a road move to the nearest unit in the same corridor.

**Expected result:** each module that is not at the site edge has 4 neighbors (2 lane, 2 column). The network is a grid, so it normally passes N-1 without extra hardware. The weak points are the **site edges, corners and the build edge** (§7).

**Auto-tune button:** search over `spacingFactor` (0.4–1.0) and `densityBalance` (0.25–1.0). Select the **cheapest** design that passes N-1, has ≥ 2 disjoint paths for ≥ 99% of sampled modules, and serves ≥ 99% of commissioned units. Show the 3 best designs in a small table; the user clicks one to apply it.

**Unit service rule:** a unit without a module is **served** if a connected module is within R **down the same lane corridor or the same column corridor**, or within the off-axis range in any other direction. A unit with a module is served by itself.

### 6.2 Graph (`graph.ts`)
- Nodes: active modules + bases. Links by §4.3. CSR adjacency, built with the spatial index.
- **Base links:** the base is `omni` with range R × `base.rangeFactor` (default 1.5) and a tall mast (no obstruction).
- Mark each link as `lane`, `column`, `offAxis` or `base` (for drawing and statistics).

### 6.3 Connectivity, resilience, capacity
Same as v1, with these points:
- **Connectivity:** multi-source BFS from bases; hops; units served; latency = hops × `perHopLatencyS` (0.01 s mesh/HaLow/BLE, 0.3 s LoRa).
- **Resilience metric 1 (N-1):** articulation points (iterative Tarjan) on the graph + super-source. Show critical modules (orange ring). Show the worst single failure.
- **Resilience metric 2:** random-failure Monte Carlo (0–50% in 2% steps, 20 trials, background, cancellable); `tolerance95`.
- **Resilience metric 3:** node-disjoint paths to the super-source for 100 sampled modules (max-flow with node splitting), capped at 4.
- **Score:** A = N-1 pass + min paths ≥ 2 + tolerance95 ≥ 10%; B = N-1 pass; C = otherwise.
- **Expected insight to show:** the column beams are what make the network resilient. If the user sets the spacing so that the **column links are out of range** (M × row pitch > R), each lane becomes a **single chain**: almost every module is critical, and the score is C. Show a warning: "Column links out of range: lanes are single chains." With the default spacing, the grid gives score A. Also show a **"Lane beams only"** debug toggle (it turns off the column beams) so the presenter can show why the corner design matters.
- **Capacity:** traffic on the BFS tree; the bottleneck next to the bases. Defaults: unit telemetry 64 B / 10 s (≈ 4 Mbps for 80,000 units), 37 assets × 650 bps, RTK 1.5 kbps, max utilization 0.6. **Expected:** LoRa and BLE overload; HaLow WARNING; 5 GHz mesh OK. Show the message: "Range alone does not select the radio; capacity also does."

### 6.4 Bases
Up to 6 bases. Add, drag, remove, fail. Presets: "1 base (west)", "2 bases (west + east)", "4 bases (corners)", "Center".

---

## 7. Build-edge model (`edge.ts`) — signals near the build front

### 7.1 Zones (for the selected build day)
| Zone | Where | Units | Radios |
|---|---|---|---|
| **Commissioned area** | behind the commission front | commissioned | modules active (P3 power) |
| **Edge zone** | between the commission front and the build front | placed, not commissioned (metal boxes, **no power**) | modules **inactive**, unless the battery bridge is on |
| **Work zone** | from the build front to `frontWorkZoneM` ahead | not placed (piling, trenching, survey) | none, unless temporary front relays are used |

### 7.2 Problems at the edge (the engine must model each one)
1. **No power yet:** modules in the edge zone do not work, so the network ends at the commission front, ≈ 9 days of build behind the real work.
2. **Metal without radios:** placed units in the edge zone obstruct cross-lane links (§4.3 obstruction).
3. **End-of-chain weakness:** modules at the edge have neighbors on only one side, so they have fewer separate paths. The N-1 result for the **whole site** can pass while the **edge** fails.
4. **Direction:** the corner module beams down both lanes and columns, so the last modules beam into the work zone whether the build moves along or across the lanes. But the beams are narrow: points in the work zone that are **between** two corridors get only side-lobe coverage. The engine must calculate this with the antenna model (do not assume full coverage).
5. **Machines and crews are in the edge and work zones.** These zones need the most coverage, and they get the least.

### 7.3 Edge solutions (UI toggles; each adds cost and changes the metrics)
| Toggle | Effect | Cost |
|---|---|---|
| **Battery bridge** (`batteryBridge`) | Modules are bolted on and active from the **placed** day, on battery, until commissioning. The network reaches the build front | `perModule.batteryBridge` for each module in the design (reusable battery packs: option `batteryBridgeReusable`, then the cost is only for the packs in the edge zone at the peak) |
| **Temporary front relays** (`tempFrontRelays`) | Omni battery relays (on tripods or on the Go2/carriers) at spacing R × 0.8 along the build front and in the work zone. They move forward each day | `tempFrontRelay.unitPrice` × the peak number in use (reusable) |
| **Denser edge** (`denserEdge`) | In the last `edgeDenserDepthM` (default 150 m) behind the commission front, use half the spacing (N/2, M/2). Those extra modules stay in place after the front moves on (they are normal corner modules) | normal module cost for the extra modules |

### 7.4 Edge metrics (tiles + chart)
- **Work-zone coverage:** % of sample points (25 m grid) in the edge zone + work zone that reach a connected module/relay within its range (omni-equivalent for machines: use the module's range toward that point).
- **Edge N-1:** the same articulation-point test, but count only units/points in the edge and work zones.
- **Edge max hops / latency** to the base.
- **Edge cost:** the cost added by the edge solutions.
- **Chart "Edge over time":** x = build day, y = work-zone coverage %, with one line per edge solution (none / bridge / temp relays / both).

**Expected (acceptance check):** with no edge solution, work-zone coverage is low; with the battery bridge + temporary relays, it is ≥ 95%. Work-zone coverage is similar for both build directions (because of the column beams); show both in the chart.

---

## 8. Failures and the pre-set scenario

### 8.1 Free failure tools (`failures.ts`)
Click (module or base), area (circle/rectangle), random X%, reset. Tile "Current failures": modules failed, units cut off, modules rerouted. Hover a unit → draw its path to the base; after a failure, the old path is dashed for 3 s.

### 8.2 Pre-set scenario: "Single radio failure — detect and reroute" (`scenarios.ts`, `packetSim.ts`)

**Purpose:** show, step by step, how the system recognizes a failed module and reroutes packets, with no data lost.

**Fixed setup (from `scenarios.ts`; one click loads it):**
- Preset 5 GHz mesh, R = 300 m, the default grid placement (score A), 1 base (west), last build day, seed fixed.
- **Watched source:** a module in the middle of a lane, ≈ 2 km east of the base.
- **Failed module:** the next module on that source's current path to the base, chosen automatically so that it is **not** an articulation point (the reroute must exist). Show its unit id, for example "Module on P3 #41,207".
- The map zooms to a **window of ≈ 800 m × 400 m** around the failure, with the rest of the site dimmed.

**Routing model (simple, configurable, explain it in the UI):**
| Key | Default | Meaning |
|---|---|---|
| `routing.helloIntervalS` | 1.0 | each module sends a small "hello" to its neighbors |
| `routing.missedHellosToDown` | 3 | a neighbor is declared down after 3 missed hellos (→ ≈ 3 s) |
| `routing.localRepair` | true | the upstream neighbor immediately sends to its next-best next hop (from its table), before the full update |
| `routing.updateFloodPerHopS` | 0.02 | route update spreads hop by hop |
| `routing.bufferPackets` | true | modules keep packets in a queue while there is no route |
| `routing.bufferMaxPackets` | 500 | |
| `routing.retransmitTimeoutS` | 0.5 | link-layer retry before a packet is counted as lost (if buffering is off) |

Real mesh protocols work in a similar way (for example, 802.11s or B.A.T.M.A.N. use neighbor hello messages and route updates). The demo uses this simplified model and says so.

**Traffic:** the watched source sends a telemetry packet every 0.2 s (sped up for visibility; label it). Background modules send at the normal rate (not animated).

**Discrete-event simulation (`packetSim.ts`):**
- Events: packet send, hop transmit (per-hop latency), hello send, hello timeout, neighbor down, local repair, route update flood, queue flush, packet delivered.
- Runs on the window graph (≈ 50–200 modules) plus a summary path to the base (outside the window, the path is shown as one long arrow with a hop count).
- Deterministic with the scenario seed.

**Timeline (the scenario player shows these steps; the user can play, pause and step):**
| t (s) | Step | What the UI shows |
|---|---|---|
| 0–5 | **Normal** | Packets (small dots) move along the path to the base. Path highlighted |
| 5.0 | **Failure** | The module turns red ×. Packets reach it and stop |
| 5.0–8.0 | **Detection** | Neighbors show "missed hello 1/3, 2/3, 3/3". Packets wait in the upstream neighbor's **queue** (queue counter grows) |
| ≈ 8.0 | **Declared down** | Event log: "Module #41,207 declared down by 3 neighbors" |
| ≈ 8.0 | **Local repair** | The upstream module sends via its next-best neighbor (normally its **column** neighbor, then along the next equipped lane). The new path is highlighted; the old path is dashed |
| 8.0–8.3 | **Route update** | A ring spreads hop by hop: "Routes updated at N modules" |
| ≈ 8.0–9.0 | **Queue flush** | The queued packets go on the new path; the queue goes back to 0 |
| 9+ | **Recovered** | Normal flow on the new path; **hops +X, latency +Y ms** |
| 10+ | **Maintenance ticket** | "Replace module on P3 #41,207 (block B, lane L, position P). Swap time ≈ 15 min (placeholder)" |

**Scenario KPIs (panel next to the player):**
- Detection time (s) · time to reroute (s) · packets sent / delivered / lost · max queue size · extra hops / extra latency after the reroute · units cut off (expected 0).
- **Toggle "Buffering off"** and replay: packets during the detection window are lost (retransmit timeout), and the KPI shows the number lost. This shows why buffering matters.
- **Toggle "Lane beams only"** and replay: the column beams are off, so the lane is a single chain and the failed module is critical. The UI shows: no alternative route; units cut off; the queue fills and drops. This shows why the corner module beams down the columns too.

**Event log:** time-stamped lines for each step (the same text as in the table).

---

## 9. Engine interface (`engine.ts`)

```ts
interface Params {
  presetId: 'ble'|'lora'|'halow'|'mesh5';
  rangeM: number;
  placement: { unitEveryN: number|'auto'; laneEveryM: number|'auto'; spacingFactor: number;
               densityBalance: number; alignAcrossBlocks: boolean };
  module: { beams: ('+lane'|'-lane'|'+col'|'-col')[]; laneBeamsOnly: boolean };  // laneBeamsOnly = debug toggle
  edge: { batteryBridge: boolean; batteryBridgeReusable: boolean; tempFrontRelays: boolean; denserEdge: boolean };
  buildDay: number; buildOrder: string;
  bases: { id: string; x: number; y: number; failed: boolean }[];
  failedModuleUnitIds: number[];
  pricing: PricingConfig;          // from pricing.json or the editor
}
interface Result {
  modules: { unitId: Int32Array; x: Float32Array; y: Float32Array; kind: Uint8Array /*0 grid,1 denserEdge,2 tempRelay*/;
             active: Uint8Array; powered: Uint8Array /*0 none,1 P3,2 battery*/; connected: Uint8Array;
             hops: Int16Array; critical: Uint8Array; failed: Uint8Array };
  links: { a: Int32Array; b: Int32Array; type: Uint8Array /*0 lane,1 column,2 offAxis,3 base*/; loadBps: Float32Array; bottleneck: Uint8Array };
  unitsServed: Uint8Array;
  zones: { commissionFrontX: number; buildFrontX: number; workZoneEndX: number }; // or polygons for other build orders
  kpis: { modules: number; denserEdgeModules: number; tempRelays: number; laneLinks: number; columnLinks: number;
          densityPct: number; modulesPerAcre: number; equippedLanesPct: number;
          servedPct: number; meanHops: number; maxHops: number; latencyMaxS: number;
          n1Pass: boolean; criticalModules: number; worstFailure: { unitId: number; unitsCut: number } | null;
          tolerance95: number | null; pathsDist: number[]; minPaths: number; score: 'A'|'B'|'C';
          capexUsd: number; capexBreakdown: Record<string, number>; tierUsed: Record<string, string>;
          powerW: number; perAcreUsd: number; perMwUsd: number; pctOfP3Hw: number;
          bottleneckUtil: number; capacityStatus: 'OK'|'WARNING'|'OVERLOADED';
          workZoneCoveragePct: number; edgeN1Pass: boolean; edgeMaxHops: number; edgeCostUsd: number;
          currentCut: number; currentFailed: number };
  warnings: string[];
}
```
Worker messages: `init` → `ready`; `compute(params, reqId)` → `result` then `curve`; `scenario(params, scenarioId, options)` → `scenarioEvents` (the full event list; the UI plays it back). Use transferable typed arrays. Ignore stale `reqId`.

### Performance targets
| Case | Target |
|---|---|
| Site generation (80,000 units) | < 500 ms, once |
| `compute`, R ≥ 150 m | < 200 ms |
| `compute`, BLE 80 m (many modules) | < 700 ms |
| `compute`, R = 30 m | < 2.5 s with a loading indicator |
| Random-failure curve | < 3 s in background |
| Auto-tune search | < 10 s with progress |
| Scenario event generation | < 300 ms; playback at 60 fps |
| Map with 80,000 units | ≥ 50 fps pan/zoom |

Debounce sliders at 100 ms. Show the previous result dimmed while computing.

---

## 10. UI specification

### 10.1 Style
Dark background `#0B0C0E`, panels `#121417`, accent orange `#FF5A1F`, failure red `#E5383B`, healthy teal `#1D9E75`, battery/temporary amber `#EF9F27`, base purple `#534AB7`, text white, labels grey `#8A8F98`. Small uppercase labels with letter spacing. Inter or system font.

### 10.2 Layout (1440×900; must work at 1280×720)
```
┌──────────── Header: title · "Simulated · Illustrative values" · Scenarios ▾ · Pricing · About ────────────┐
│ Controls (300 px)              │ Map (flex)                                  │ Metrics (320 px)          │
│ • Preset (4 buttons)           │ units · modules · links · bases · zones     │ • Modules / density       │
│ • Range slider (log)           │ tools: pan · fail · area · add base         │ • Cost (tier tooltip)     │
│ • Placement specs (§6.1)       │ legend + scale bar                          │ • Power                   │
│   + Auto-tune                  │                                             │ • Resilience A/B/C        │
│ • Edge toggles (§7.3)          │                                             │ • Capacity                │
│ • Build day + play + order     │                                             │ • Build edge              │
│ • Bases presets                │                                             │ • Current failures        │
│ • Failure tools                │                                             │                           │
│ • Save A / Save B              │                                             │                           │
├────────────────────── Bottom tabs: Failure curve · Cost vs range · Edge over time · Compare A/B ─────────────┤
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```
**Scenario mode** replaces the bottom panel with the **scenario player** (play/pause/step, timeline with step markers, event log, scenario KPIs, toggles "Buffering off" and "Failure on a critical module", "Exit scenario").

### 10.3 Map layers (toggles)
1. Units: planned (outline), placed (grey), commissioned (orange). Raster when zoomed out.
2. Zones: edge zone (amber hatch), work zone (light hatch), fronts (dashed lines).
3. Units cut off: red.
4. Links: lane links (thin teal), column links (thin purple), off-axis links (dotted grey), base links (thick). Bottleneck links thicker (orange/red). Sample links when zoomed out.
5. Modules: grid module (teal dot, drawn at the corner of its unit), denser-edge module (teal dot with outline), battery-powered (amber outline), temporary relay (amber triangle), critical (orange ring), failed (red ×), disconnected (hollow red).
6. Antenna beams: for the hovered module, draw its beam wedges (down the lane and down the column), and highlight the two corridors.
7. Bases: purple squares B1…B6 with range circles.
8. Path to base for the hovered unit/module.
9. Scenario overlays: packet dots, queues (number badges), hello timeout counters, update ring.

### 10.4 Metrics tiles
MODULES (total, denser-edge, temporary; lane links, column links) · DENSITY (% of P3 with a module, modules/acre, N and M, spacing in m along lanes and columns) · CAPEX (total, per acre, per MW, % of P3 hardware "rough"; tooltip with breakdown and tiers) · POWER (kW from P3, kW battery) · RESILIENCE (score, N-1, critical modules, worst failure, tolerance95, min paths) · COVERAGE (% served, max hops, max latency) · CAPACITY (status, bottleneck %) · BUILD EDGE (work-zone coverage, edge N-1, edge max hops, edge cost) · CURRENT FAILURES.

### 10.5 Charts
1. **Failure curve** (x = % modules failed, y = % units served; mean + min; tolerance95 marker).
2. **Cost vs range** (one line per preset at the current placement specs; current design marked; precomputed sweep of 12 ranges per preset).
3. **Edge over time** (§7.4).
4. **Compare A/B:** table of all KPIs with differences (green better, red worse), two mini maps, "Load A/B". Saved in `localStorage` (try/catch).

### 10.6 Keyboard shortcuts
Space play/pause · 1–4 preset · F fail tool · A area tool · R reset failures · ←/→ build day · S open scenarios.

---

## 11. Tasks (phases, acceptance criteria)

**[MUST]** needed for the demo · **[SHOULD]** important · **[NICE]** if time permits.

### Phase 0 — Setup [MUST]
- **T0.1** Vite app in `daisy-demo/` with Zustand, Recharts, Vitest, ESLint, Prettier. *Accept:* dev/test/build succeed.
- **T0.2** `defaults.ts`, `presets.ts`, `pricing.json`, `scenarios.ts`; `docs/ASSUMPTIONS.md`, `docs/PRICING_FORMAT.md`. *Accept:* no numeric constants in `src/engine/` except 0, 1, 2 and math constants.
- **T0.3** Layout shell and theme. *Accept:* no page scroll at both sizes.
- **T0.4** `rng.ts`, `spatialIndex.ts` with tests (radius query equals brute force on 10,000 points).

### Phase 1 — Site [MUST]
- **T1.1** `site.ts` with lanes, columns and corridors. *Accept:* count within 2% of target; every unit has a lane id and position; unit x positions are identical from lane to lane (column corridors are straight); blocks are aligned across roads.
- **T1.2** `schedule.ts` with placed/commissioned days and fronts for all build orders. *Accept:* fronts move as expected; the edge zone is ≈ `placeToCommissionDays × unitsPerDay` units.
- **T1.3** Map: unit layer, zones, pan/zoom/fit, scale bar. *Accept:* ≥ 50 fps with 80,000 units.

### Phase 2 — Antennas, placement, graph [MUST]
- **T2.1** `antenna.ts` for the corner module. *Accept:* tests: a lane link at 0.9R is up; a column link at 0.9R is up; a 45° diagonal link at 0.5R is down; with `laneBeamsOnly`, a column link at 0.5R is down.
- **T2.2** `placement.ts` (grid of N × M, auto values, density balance, alignment across blocks). *Accept:* N and M honored; modules in the same column positions share one x value; no unit has two modules; every interior module has 4 neighbors with the defaults.
- **T2.3** `graph.ts` (CSR, link types, bases). *Accept:* edge count equals brute force on a small site.
- **T2.4** `connectivity.ts`. *Accept:* default design serves ≥ 99% of commissioned units on the last day.
- **T2.5** Worker + `engine.ts` + store; module/link/base layers; hover tooltip with the antenna wedge. *Accept:* UI never freezes; updates < 300 ms for R ≥ 150 m.

### Phase 3 — Pricing and controls [MUST]
- **T3.1** `pricing.ts` with tiers (both tier modes), range price points, range scaling, spares, contingency. *Accept:* unit tests for tier boundaries (99/100/999/1000), interpolation, and both modes.
- **T3.2** Pricing drawer: edit, import JSON/CSV with validation, export JSON, reset, localStorage. *Accept:* importing `public/pricing.sample.csv` changes capex at once; invalid rows show errors.
- **T3.3** Preset picker, log range slider with auto preset switch, placement controls. 
- **T3.4** Cost/power/density tiles with the tier tooltip and the placeholder label.
- **T3.5** Cost-vs-range chart.

### Phase 4 — Resilience and capacity [MUST]
- **T4.1** Articulation points, critical modules, worst failure. *Accept:* line graph → n−2 articulation points; cycle → 0. With "Lane beams only" (or M × pitch > R), the score is C and the "single chains" warning shows; with the default grid, score A.
- **T4.2** Random-failure curve (background, cancellable). *Accept:* monotonic mean; tolerance95 shown.
- **T4.3** Disjoint paths on 100 sampled modules. *Accept:* ladder → 2; line → 1.
- **T4.4** Capacity + bottleneck links + message. *Accept:* LoRa/BLE OVERLOADED, mesh OK at defaults.
- **T4.5** Auto-tune (3 best designs table). *Accept:* the chosen design passes all three conditions in §6.1.

### Phase 5 — Build edge [MUST]
- **T5.1** `edge.ts` zones, work-zone sample points, edge metrics.
- **T5.2** Edge toggles (battery bridge, temporary front relays, denser edge) with costs.
- **T5.3** Build-day slider + play; "Edge over time" chart. *Accept:* the expected results in §7.4 hold.

### Phase 6 — Failures and the scenario [MUST]
- **T6.1** Free failure tools, reroute path view, "Current failures" tile. *Accept:* failing a non-critical module cuts off 0 units and the path changes; failing a critical module cuts off units.
- **T6.2** `packetSim.ts` discrete-event simulation. *Accept:* tests: with buffering on, 0 packets lost and all queued packets delivered after the reroute; with buffering off, packets lost ≈ detection time ÷ send interval (± 2); with "Lane beams only", delivery stops and units are cut off.
- **T6.3** Scenario player UI (§8.2): play/pause/step, timeline markers, event log, KPIs, both toggles, zoomed window, maintenance ticket. *Accept:* one click from "Scenarios ▾ → Single radio failure" runs the full timeline at 60 fps.

### Phase 7 — Bases and compare [SHOULD]
- **T7.1** Base editor (add/drag/remove/fail, presets). *Accept:* 2 bases reduce max hops and bottleneck load.
- **T7.2** Compare A/B tab.

### Phase 8 — Polish and checks [MUST for checks, SHOULD for polish]
- **T8.1** [SHOULD] Shortcuts, loading/empty/error states (for example, "No module can reach a base: increase the range or add a base").
- **T8.2** [SHOULD] `docs/DEMO_SCRIPT.md` (§12).
- **T8.3** [NICE] Export KPIs + params as JSON/CSV; static deploy.
- **T8.4** [MUST] Final checks: build and tests pass; no console errors; the demo script runs at 1280×720; all numbers come from the config files; `daisy-demo/README.md` explains how to run on macOS and how to load real pricing.

---

## 12. Demo script (`docs/DEMO_SCRIPT.md`, ≈ 2.5 min)
1. **"First site: 2,000 acres, about 80,000 P3 units."** Full site.
2. **"Modular like the P3: each unit either gets a bolt-on corner module or not. It beams down the lane and down the column."** Hover a module to show its beams and corridors.
3. **"Why both directions matter."** Turn on "Lane beams only": each lane is a single chain, score C, many critical modules. Turn it off: the grid gives score A with the same number of modules.
4. **"Range and pricing drive cost."** Move the range slider from BLE to 5 GHz mesh; show modules, capex with bulk tiers, and the LoRa capacity overload.
5. **"The build edge."** Move the build day. Without edge solutions, the work zone is not covered. Turn on the battery bridge and temporary front relays: coverage ≥ 95%. Show the edge cost.
6. **"One radio fails."** Run the scenario: detection in ≈ 3 s, local repair, queued packets delivered, 0 packets lost, maintenance ticket. Replay with buffering off to show the lost packets.
7. **"Compare."** Design A (cheapest that passes) vs design B (highest resilience).

---

## 13. Agent team split

| Agent | Area | Tasks |
|---|---|---|
| **A — Site, placement, edge** | site, schedule, antenna, placement, edge model | T1.1, T1.2, T2.1, T2.2, T5.1, T5.2 |
| **B — Graph, analysis, packet sim** | graph, connectivity, resilience, capacity, auto-tune, worker, packetSim | T0.4, T2.3, T2.4, T4.1–T4.5, T6.2 |
| **C — Map and interaction** | canvas layers, tools, bases, reroute view, scenario overlays | T0.3, T1.3, T2.5, T6.1, T6.3 (map part), T7.1 |
| **D — Controls, pricing, metrics, charts, docs** | presets, sliders, pricing engine + editor, tiles, charts, scenario panel, compare, docs | T0.1, T0.2, T3.1–T3.5, T5.3, T6.3 (panel part), T7.2, Phase 8 |

**First hour:** agree on `types.ts`, `Params`, `Result`, `PricingConfig`, the scenario event format and the worker messages. Agent B owns these files; changes need a note in `DECISIONS.md`.

**Dependencies:** T0.* → T1.1 → T2.1–T2.3 → T2.4–T2.5 → (Phase 3, 4, 5 in parallel) → Phase 6 → Phase 7–8.

---

## 14. Values to confirm (then change only the config)
1. **Bulk prices for each range** → `pricing.json` (the team is collecting these). Use `rangePricePoints` for the real data.
2. Real unit count, layout and lane direction (`site.*`, `block.*`, `layout.laneAxis`).
3. Mounting position and height of the module on the P3; power available for a module (`presets.*.powerW` limit).
4. Corner module details: which corner, how far it sticks out, its height, **how many beams (4: both ways on both axes, or 2)**, beam width, and the real ranges (`module.*`).
5. Telemetry per P3 (`traffic.*`). This decides HaLow vs 5 GHz mesh.
6. Build order and rate (`build.*`).
9. Is the P3 grid really aligned (same unit positions in every lane), so that the column corridors are straight and open?
7. Number and location of bases.
8. Module swap time for the maintenance ticket.
