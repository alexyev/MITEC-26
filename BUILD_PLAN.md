# BUILD_PLAN.md — Exowatt Off-Grid Site Twin (MITEC Hack '26)

> **For the coding agent:** This file is the full specification and task list. Read all of this file before you write code. Then read these context files:
> - `research/exowatt-challenge-brief.md` — the challenge prompt and what the challenge video shows
> - `research/offgrid-connectivity-research.md` — industry methods and our solution concepts
> - `research/exowatt-company-research.md` — Exowatt, the P3 unit, how sites are built, how our solution applies
>
> Do the tasks in the order of the phases. Each task has acceptance criteria. Do not start a phase until the previous phase passes its checkpoint.

---

## 0. Goal and story

### 0.1 What we build

A **browser app (React + TypeScript)** that simulates the construction of an Exowatt P3 site and shows how robots, machines and crews stay connected. The app has three parts, in the same order as the Exowatt challenge video:

1. **MODEL** — The site and how it changes as the build moves forward (build day, units deployed, assets tracked).
2. **CONNECT** — Our network keeps all assets connected and coordinated (links up, assets online, updates on time).
3. **STRESS-TEST** — What happens when links fail, and what the solution costs (assets online, safety latency, hardware cost, power, site coverage against a 95% target).

### 0.2 The demo story (the app must support this sequence)

1. **Baseline ("Exowatt today"):** 1 base station. As the build front moves east, assets go offline. The video shows 30/30 online at 315 units, 6/37 at 1,406 units and 3/37 at 1,668 units. Our baseline must show the same type of failure (the exact numbers can be different).
2. **Our design ("Build-Front Mesh"):**
   - Each commissioned P3 unit can host a powered relay.
   - Robots drop temporary battery relays at the build front.
   - Each asset has several radios (multi-bearer).
   - Messages have priorities (safety first).
   - Assets use store-and-forward when offline.
   - Safety works locally (V2V and BLE proximity), without the base station.
   - Coverage stays ≥ 95% on all build days.
3. **Stress-test:** The presenter clicks failure buttons (relay fails, dust storm, crane blocks a link, Starlink down at night). The app shows the drop in coverage, the recovery (for example, a drone flies to the dead zone as an aerial relay), and the cost and power totals.

### 0.3 Pitch sentence (show in the app header or "About" panel)

*"The network grows with the build: every P3 we commission becomes a powered relay, robots drop temporary relays at the build front, and every machine keeps working safely when its link fails."*

### 0.4 Honesty rules for the UI

- Show the label **"Simulated · Illustrative values"** on all dashboards (as the Exowatt video does).
- Keep **all numeric assumptions in one config file** (`src/config/defaults.ts`). Do not put magic numbers in other files.
- Do not show facts about Exowatt that are not in the research files.

---

## 1. Tech stack and project rules

| Item | Choice |
|---|---|
| Build tool | **Vite** (React + TypeScript template) |
| Language | **TypeScript**, `strict: true` |
| UI | **React 18** |
| State | **Zustand** |
| Map rendering | **HTML Canvas 2D** (not SVG — there are 2,000+ units). Use an offscreen canvas for the static unit layer |
| Charts | **Recharts** |
| Styling | **CSS modules** or plain CSS with CSS variables (no heavy UI kit) |
| Tests | **Vitest** |
| Lint/format | ESLint + Prettier |
| Simulation | Pure TypeScript in `src/sim/`, with **no React imports**. Deterministic with a seeded random number generator |
| Heavy computation | Run the day-level precompute in a **Web Worker** if it takes more than ~300 ms on the main thread |
| Platform | macOS. Node 20+ (with `nvm`). Commands: `npm install`, `npm run dev`, `npm test`, `npm run build` |
| Deploy (optional) | Static build to GitHub Pages or Vercel |

**Rules for the agent:**
1. Make small commits with clear messages after each task that passes its tests.
2. Run `npm test` and `npm run build` before each commit. Do not commit code that does not build.
3. Use the same seed to always get the same results (`seed` in config).
4. Use **meters** for all distances, **seconds** for time, **dBm/dB** for radio, **USD** for cost, **watts** for power.
5. Add a short comment at the top of each `src/sim/` file that tells what the file does.
6. If a requirement is not clear, use the simplest method that satisfies the acceptance criteria. Write the decision in `docs/DECISIONS.md`.

---

## 2. Repository structure (target)

```
MITEC-26/
├── BUILD_PLAN.md                 ← this file
├── README.md                     ← how to run, team roles, demo script
├── research/                     ← context documents (do not change)
├── docs/
│   ├── ARCHITECTURE.md
│   ├── ASSUMPTIONS.md            ← all assumptions, with values and sources
│   ├── DECISIONS.md
│   └── DEMO_SCRIPT.md
├── web/                          ← the Vite app
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── config/
│   │   │   ├── defaults.ts       ← ALL numbers
│   │   │   └── scenarios.ts      ← baseline, meshOnly, ourDesign + failure presets
│   │   ├── sim/
│   │   │   ├── rng.ts
│   │   │   ├── geometry.ts
│   │   │   ├── site.ts           ← unit layout
│   │   │   ├── schedule.ts       ← build schedule and stages
│   │   │   ├── assets.ts         ← asset types, task assignment, movement
│   │   │   ├── radio.ts          ← bearers, path loss, link budget
│   │   │   ├── obstruction.ts    ← metal-unit shadowing, spatial index
│   │   │   ├── topology.ts       ← link graph per tick
│   │   │   ├── routing.ts        ← multi-bearer routing to base
│   │   │   ├── messages.ts       ← message classes, queues, store-and-forward
│   │   │   ├── safety.ts         ← proximity, geofences, degraded mode
│   │   │   ├── planner.ts        ← relay placement (greedy, N-1 option)
│   │   │   ├── failures.ts       ← failure injection and recovery actions
│   │   │   ├── metrics.ts        ← all KPIs
│   │   │   ├── cost.ts           ← hardware cost and power
│   │   │   ├── dayModel.ts       ← day-level precompute (all build days)
│   │   │   ├── tickModel.ts      ← live tick simulation for one day
│   │   │   └── types.ts
│   │   ├── worker/
│   │   │   └── sim.worker.ts
│   │   ├── state/
│   │   │   └── store.ts          ← Zustand store
│   │   ├── ui/
│   │   │   ├── layout/           ← Header, Sidebar, RightPanel, BottomPanel
│   │   │   ├── map/              ← SiteCanvas, layers, pan/zoom, hover tooltip
│   │   │   ├── kpi/              ← KpiTile, KpiPanel
│   │   │   ├── charts/           ← CoverageChart, OnlineChart, LatencyChart
│   │   │   ├── controls/         ← DaySlider, PlayControls, ScenarioPicker, FailureButtons, LayerToggles
│   │   │   ├── fieldops/         ← UnitStatusTable, AssetTable
│   │   │   ├── story/            ← StoryMode stepper (Model → Connect → Stress-test)
│   │   │   └── compare/          ← side-by-side baseline vs our design
│   │   └── styles/
│   │       └── theme.css
│   └── tests/                    ← Vitest tests (or co-located *.test.ts)
└── hardware/                     ← optional LoRa/BLE demo (Phase 7)
```

---

## 3. Domain model (types)

Put these in `src/sim/types.ts`. Names can change, but keep the information.

```ts
type Vec2 = { x: number; y: number };            // meters; x = east, y = north

type UnitStage = 'planned' | 'surveyed' | 'piled' | 'trenched' | 'placed' | 'commissioned';

interface P3Unit {
  id: string;            // "U0001"
  blockId: string;
  row: number; col: number;
  center: Vec2;
  widthM: number;        // 12.2 (40 ft)
  depthM: number;        // 2.44
  heightM: number;       // ~2.9 container + frame
  seq: number;           // build order index
  stageDay: Record<UnitStage, number>; // day each stage is reached
  hostsRelay?: boolean;  // set by planner
}

type AssetType = 'drone' | 'go2' | 'pileRig' | 'trencher' | 'excavator' | 'crane' | 'carrier' | 'crew';

type BearerId = 'mesh' | 'lora' | 'ble' | 'v2v';

interface Asset {
  id: string;            // "CRANE-2"
  type: AssetType;
  pos: Vec2;
  heading: number;
  speedMps: number;
  antennaHeightM: number;
  radios: BearerId[];
  canRelay: boolean;     // asset radios forward traffic for others
  task?: { kind: string; unitId?: string; target?: Vec2; status: 'idle'|'moving'|'working'|'done' };
  mode: 'normal' | 'degraded' | 'stopped';
  lastHeartbeatOkAt: number;
}

type NodeKind = 'base' | 'fixedRelay' | 'tempRelay' | 'aerialRelay' | 'asset';

interface RadioNode {
  id: string; kind: NodeKind; pos: Vec2; antennaHeightM: number;
  radios: BearerId[]; powered: 'grid'|'p3'|'battery'|'vehicle';
  batteryWh?: number; up: boolean;
}

interface Link { a: string; b: string; bearer: BearerId; rssiDbm: number; marginDb: number; capacityBps: number; up: boolean }

type Priority = 0 | 1 | 2 | 3;   // P0 safety, P1 position/RTK, P2 task status, P3 bulk

interface Message {
  id: string; src: string; dst: string | 'base' | 'broadcastLocal';
  priority: Priority; bytes: number; createdAt: number; deadlineS: number;
  deliveredAt?: number; dropped?: boolean; viaMule?: string; hops?: number;
}

interface DaySnapshot {
  day: number;
  unitsByStage: Record<UnitStage, number>;
  buildFrontX: number;
  relays: RadioNode[];
  coveragePct: number;           // work-area coverage
  coveragePctNminus1: number;    // worst case after any single relay fails
  assetsOnline: number; assetsTotal: number;
  costUsd: number; powerW: number;
}

interface TickMetrics {
  t: number;
  assetsOnline: number;
  linksUp: number;
  updatesOnTimePct: number;       // P1 delivered within deadline (rolling 60 s)
  safetyLatencyP95S: number;      // P0
  queuedMessages: number;
  coveragePct: number;
}
```

---

## 4. Default configuration (`src/config/defaults.ts`)

Put **all** these values in one exported object. Each value has a comment with the source or "assumption". Copy the table into `docs/ASSUMPTIONS.md`.

### 4.1 Site

| Key | Default | Note |
|---|---|---|
| `seed` | 42 | |
| `unit.widthM`, `depthM`, `heightM` | 12.2, 2.44, 2.9 | 40 ft container footprint (public). Height is an assumption |
| `site.blocksX`, `blocksY` | 6, 4 | assumption |
| `site.rowsPerBlock`, `unitsPerRow` | 10, 10 | → 100 units/block, **2,400 units** total |
| `site.rowPitchM` | 8 | row spacing (assumption — lens/tracker clearance) |
| `site.unitGapM` | 2 | gap between units in a row |
| `site.roadWidthM` | 15 | roads between blocks |
| `site.baseOffsetM` | 80 | site base west of the first block, at middle y |
| `build.unitsPerDay` | 12 | → ~200 build days (video shows day 200, 2,204 units) |
| `build.order` | `'westToEast'` | block columns west → east, rows south → north in each column |
| `build.stageLagDays` | survey −10, pile 0, trench +3, place +6, commission +9 | relative to the piling day of the unit |

### 4.2 Assets (total **37**, same as the video)

| Type | Count | Speed m/s | Antenna m | Radios | Can relay | Work zone |
|---|---|---|---|---|---|---|
| drone | 2 | 10 | 40 (flight) | mesh, lora | yes | survey ahead of front (+0…+300 m); also aerial relay on demand |
| go2 | 1 | 1.5 | 0.6 | mesh, lora, ble | yes | survey ahead of front; drops temp relays |
| pileRig | 3 | 1.0 | 4 | mesh, lora, v2v | yes | at the front (units being piled) |
| trencher | 2 | 0.8 | 3 | mesh, lora, v2v | yes | units in `trench` stage |
| excavator | 1 | 0.8 | 3 | mesh, lora, v2v | yes | civil work near the front |
| crane | 3 | 0.5 | 30 (boom) | mesh, lora, v2v | yes | units in `place` stage |
| carrier | 5 | 5 | 3 | mesh, lora, v2v | yes | shuttle base ↔ placement zone (data mules) |
| crew | 20 | 1.2 | 1.5 | ble, lora (badge) + mesh (phone, optional) | no | units in `place`/`commission` stage, in groups of 2–4 |

### 4.3 Radio bearers

The link is up if `rssi ≥ sensitivity + fadeMarginDb`.
`rssi = txPowerDbm + txGainDbi + rxGainDbi − PL(d) − obstructionLoss − weatherLoss`
`PL(d) = PL0 + 10·n·log10(d / d0)`, with `d0 = 1 m`.

| Key | mesh (HaLow/5 GHz-type mesh) | lora | ble | v2v |
|---|---|---|---|---|
| `txPowerDbm` | 24 | 20 | 8 | 20 |
| `gainDbi` (each side) | 3 | 2 | 0 | 3 |
| `sensitivityDbm` | −92 | −130 | −100 (coded PHY) | −95 |
| `pl0Db` (at 1 m) | 40 | 32 | 40 | 40 |
| `exponent n` | 2.8 | 2.6 | 3.0 | 2.8 |
| `fadeMarginDb` | 10 | 10 | 10 | 10 |
| `perUnitObstructionDb` | 6 | 3 | 10 | 6 |
| `maxObstructionDb` | 40 | 25 | 40 | 40 |
| `capacityBps` (per link) | 4,000,000 | 5,000 | 100,000 | 1,000,000 |
| `maxRangeM` (hard cap) | 3,000 | 8,000 | 400 | 500 |
| use | backbone, task data, RTK, bulk | P0/P1 heartbeat, small positions | people ↔ nearby machine | machine ↔ machine safety |

**Calibration task (Phase 1):** Change these values so that, with no obstruction, mesh reaches ~1–1.5 km, LoRa ~3–5 km, BLE ~150–300 m and V2V ~300–500 m. Write the final values in `docs/ASSUMPTIONS.md`. Research basis: BLE coded PHY reached ~1.3 km in an ideal line-of-sight test (Nordic). HaLow had a record of 16 km in Joshua Tree, but "a few hundred meters" is typical in industry. LoRa reaches "several km". We use conservative values because the site is a field of metal units.

**Obstruction rule:** Count the installed units (stage ≥ `placed`) that the straight segment between the two antennas crosses.
- If both antennas are **below** `unit.heightM + 0.5`, apply the full `perUnitObstructionDb` for each unit.
- If one antenna is **above** that height, apply 30% of it.
- If one antenna is a **drone in flight** (≥ 20 m), apply 0.
- Clamp the total to `maxObstructionDb`.

**Weather:** `dustStorm` adds `+0.4` to the exponent `n` and `+6 dB` of loss for mesh and BLE, `+2 dB` for LoRa.

### 4.4 Network nodes

| Key | Default | Note |
|---|---|---|
| `base.radios` | mesh, lora | at site base, antenna 15 m mast |
| `base.backhaul` | `'starlink'` | latency 0.04 s; can fail |
| `fixedRelay.antennaHeightM` | 4.5 | on the lens/tracker frame above the unit |
| `fixedRelay.radios` | mesh, lora, ble | powered by the P3 unit, available only when the host unit is `commissioned` |
| `tempRelay.antennaHeightM` | 2.0 | tripod/mast dropped by GO2 or carrier |
| `tempRelay.radios` | mesh, lora | |
| `tempRelay.batteryWh` / `drawW` | 200 / 6 | → ~33 h; must be replaced or moved |
| `tempRelay.maxActive` | 8 | |
| `aerialRelay.altitudeM` | 60 | drone hover relay used during recovery |
| `aerialRelay.enduranceS` | 1,800 | 30 min (tethered option = unlimited) |
| `aerialRelay.dispatchDelayS` | 120 | detection + takeoff time |

### 4.5 Messages

| Priority | Class | Bytes | Rate / trigger | Deadline | Bearer order |
|---|---|---|---|---|---|
| P0 | heartbeat, E-stop, proximity, geofence | 32 | heartbeat 1 Hz per machine; events | 1.0 s | **send on all** available bearers; local V2V/BLE for proximity |
| P1 | position; RTK corrections from base | 64 / 300 | position 1 Hz per asset; RTK 1 Hz to pileRig and crane | 2.0 s | mesh → lora (LoRa at reduced rate: 1 position / 10 s) |
| P2 | task status ("U0815 placed") | 128 | event | 60 s | mesh → lora → store-and-forward |
| P3 | survey map tile, photo, log | 2,000,000 | drones/GO2: 1 per 5 min | 3,600 s | mesh only, or carried by a mule |

**Capacity rule (simple):** For each link and each tick, the offered bytes are served in priority order (P0 first). If the link is full, lower-priority messages stay in the queue. Queues have TTL = deadline × 10, except P2, which never expires.

### 4.6 Safety

| Key | Default |
|---|---|
| `safety.proximityRadiusM` | 15 (person ↔ moving machine) |
| `safety.craneLiftZoneRadiusM` | 20 (around a crane in the `lifting` state) |
| `safety.lensHazardRadiusM` | 5 around commissioned units (flag `enabled: false` by default — "ask mentors") |
| `safety.heartbeatLossToDegradedS` | 3 |
| `safety.heartbeatLossToStopS` | 10 |
| `safety.degradedSpeedFactor` | 0.3 |
| `safety.localDetectLatencyS` | 0.2 (V2V/BLE local path, no base needed) |

### 4.7 Cost and power (placeholders — the team will update)

| Item | Unit cost USD | Power W | Note |
|---|---|---|---|
| `fixedRelay` | 900 | 8 | from the P3 unit |
| `tempRelay` | 1,500 | 6 | battery + mast |
| `assetRadioKit` (mesh + LoRa) | 1,200 | 10 | per machine/robot |
| `crewBadge` (BLE + LoRa) | 120 | 0.2 | |
| `baseStation` (mesh + LoRa + mast) | 6,000 | 60 | |
| `starlink` | 2,500 | 75 | ×2 for redundancy |
| `aerialRelayKit` | 4,000 | 0 (drone battery) | |
| `rtkBase` | 3,000 | 10 | |

Show the label **"Placeholder prices — update before the pitch"** in the cost panel until a flag `costVerified` is set to `true`.

### 4.8 Scenarios (`src/config/scenarios.ts`)

| Scenario | Description |
|---|---|
| `baseline` | **"Exowatt today (video)"**: 1 base station (mesh + LoRa disabled; mesh only, star topology). Assets do **not** relay. No temp or fixed relays. No store-and-forward. No local V2V safety (safety messages must go through the base) |
| `meshOnly` | Same as baseline, but assets can relay for each other (ad hoc mesh). Shows that moving relays are not sufficient |
| `ourDesign` | Full design: fixed relays on commissioned units (planner), temp relays at the front, all bearers, priorities, store-and-forward, data mules, local safety, aerial relay recovery |

---

## 5. Algorithms (specification)

### 5.1 Site layout (`site.ts`)
- Make blocks in a grid. In each block, make rows of units. Rows are east–west. Use the dimensions from config.
- Put the site base west of block column 0, at the middle of the site in y.
- Assign `seq` by `build.order`.
- **Output:** `P3Unit[]`, site bounds, road polygons (for drawing), base position.

### 5.2 Build schedule (`schedule.ts`)
- The piling day of a unit = `floor(seq / unitsPerDay)`. The other stage days = piling day + `stageLagDays[stage]` (clamped to ≥ 0).
- `stageOf(unit, day)` returns the highest stage reached.
- `buildFrontX(day)` = max x of units piled on that day (or the mean x of today's piles).
- **Work area for coverage** on a day = the union of rectangles around units in stages surveyed…commissioned that are **not** yet commissioned for more than 5 days, plus a 50 m margin, plus the roads between the base and the front. (Simple version: the bounding box from the site base to `buildFrontX + 300 m` over the full site height.) Sample it with a **grid of points every 25 m**.

### 5.3 Assets and movement (`assets.ts`)
- Create 37 assets from config.
- **Task assignment each tick or each minute:**
  - Survey assets go to random points in the zone ahead of the front.
  - Pile rigs go to the next unit to pile and "work" for `pileWorkS` (default 600 s).
  - Trenchers and the excavator move along the rows in the `trench` stage.
  - Cranes go to units in the `place` stage. They have a `lifting` sub-state for 300 s (this sets the crane lift zone).
  - Carriers shuttle between the base and the active crane. Carriers are **data mules**.
  - Crews walk in groups to units in the place/commission stage.
- **Movement:** straight-line motion toward the target at `speedMps`, with small random jitter. Use roads when possible (optional; straight lines are acceptable).
- In `degraded` mode, the speed is multiplied by `degradedSpeedFactor`. In `stopped` mode, the speed is 0.

### 5.4 Obstruction (`obstruction.ts`)
- Build a **uniform grid spatial index** (cell 20 m) of installed unit rectangles for the current day.
- `countCrossed(a, b, day)` uses a grid traversal (DDA) and a segment–AABB test. Cache results per tick for static pairs (base, relays).
- **Performance target:** 10,000 queries in < 50 ms.

### 5.5 Topology and routing (`topology.ts`, `routing.ts`)
- Each tick, compute the links between all node pairs for each shared bearer (≈ 37 assets + ≤ 60 relays + base → < 10,000 pairs; this is acceptable). Use a range pre-filter (`maxRangeM`).
- **Online definition:** An asset is **online** if it has a path to the base on **mesh or LoRa**, and relaying is allowed only at nodes with `canRelay` or relay nodes. A path can change bearer at a node that has both radios.
- **Routing:** Dijkstra from the base on the multi-bearer graph. Edge cost = `1 + (20 / max(marginDb, 1))`. Keep the next hop per node for each priority class:
  - P0/P1 can use mesh or LoRa (LoRa only if the message fits the LoRa rate rule).
  - P2 prefers mesh, then LoRa.
  - P3 uses only mesh.
- **Latency model:** per hop = `bytes*8 / capacityBps + 0.01 s` processing, + queue wait. Backhaul (Starlink) latency applies only to messages going to the cloud (not modeled on site, except the "Cloud sync" indicator).

### 5.6 Messages, store-and-forward and mules (`messages.ts`)
- Each asset creates messages by the rates in 4.5.
- If no route exists, the message waits in the **local queue** of the asset (store-and-forward).
- **Data mule:** If a carrier or drone has a direct link to a disconnected asset, it copies that asset's P2/P3 queue (up to `muleBufferBytes` = 500 MB). When the mule is online, it delivers the queue. Mark the messages with `viaMule`.
- The order of service on each link: P0 → P1 → P2 → P3.
- **Metrics hooks:** for each delivered message, record `deliveredAt − createdAt` by priority.

### 5.7 Safety (`safety.ts`)
- **Proximity:** For each crew member within `proximityRadiusM` of a moving machine:
  - **ourDesign:** a P0 alert is delivered **locally** if they share BLE or V2V and the link is up. Latency = `localDetectLatencyS`.
  - **baseline:** the alert must go asset → base → machine. If no route exists, the alert is **missed** (count it).
- **Crane lift zone:** same logic for any crew or GO2 inside the lift radius while a crane is `lifting`.
- **Heartbeat loss:** If a machine has no P0 heartbeat path to the base and no local link for `heartbeatLossToDegradedS`, its mode is `degraded`. After `heartbeatLossToStopS`, the mode is `stopped`. When the link returns, the mode returns to `normal`. Count **machine-minutes stopped** (a productivity cost).
- **Safety latency KPI:** p95 of P0 delivery latency over the last 60 s. A missed alert counts as latency = 10 s (cap) for the p95 calculation, and it increments `missedSafetyAlerts`.

### 5.8 Relay planner (`planner.ts`)
Run it once per build day (day-level model).

- **Candidates:**
  - (a) commissioned units → **fixed relays** (permanent; after the planner selects a fixed relay, keep it on all later days);
  - (b) points at the build front (every 50 m along `buildFrontX + 30 m`) → **temp relays** (at most `tempRelay.maxActive`; re-plan each day; temp relays that are no longer needed are "picked up").
- **Coverage of a sample point:** The point is covered if a test node at height 1.5 m with mesh radio has a path to the base (direct, or through relays, using relay-to-relay links).
- **Greedy algorithm:**
  1. Start with the base + the fixed relays that are already selected.
  2. While coverage < `targetCoveragePct` (95), add the candidate with the **highest gain in covered points per USD**.
  3. Stop when there is no gain.
- **N-1 option (`plannerResilience: 'n-1'`):** After the greedy step, for each relay compute the coverage without it. If it is < target, add relays near the lost area until the worst case is ≥ target (or the budget is used). Show `coveragePctNminus1` on the dashboard.
- **Determinism:** If gains are equal, select the lower x, then the lower y.
- **Performance target:** All 200 days in < 3 s in a worker. Use incremental updates (only the front changes much each day).

### 5.9 Failures and recovery (`failures.ts`)

| Failure (button) | Effect | Recovery in ourDesign |
|---|---|---|
| **Fail relay** (random or click on map) | relay `up = false` | Routing reroutes automatically. If coverage < target for more than `dispatchDelayS`, dispatch the nearest drone as an **aerial relay** above the dead zone |
| **Dust storm** (duration 30 min) | weather loss (see 4.3) | LoRa keeps P0/P1. P3 is queued. Optional: the planner adds temp relays |
| **Crane blocks link** | +20 dB on links that pass within 15 m of a lifting crane | Reroute |
| **Mesh jammed / bearer outage** | disable the mesh bearer in a selected circle (radius 300 m) | LoRa + BLE keep safety and positions; P2 is queued |
| **Starlink down (night)** | backhaul down | On-site operation continues. "Cloud sync" turns red. Queue size for the cloud increases. When it returns, the backlog is sent |
| **Temp relay battery empty** | relay down at battery = 0 | GO2 task: replace the relay (travel time) |
| **Reset** | clear all failures | |

All failures are written to the **event log** with the time.

### 5.10 Metrics (`metrics.ts`) — the KPIs in the video

| KPI | Definition |
|---|---|
| Build day | current day |
| Units deployed | units with stage ≥ `placed` |
| Assets tracked | 37 |
| Links up | number of up links in the current topology (between infrastructure nodes, and between assets and infrastructure) |
| Assets online | `online / total` (red if < total) |
| Updates on time | % of P1 messages delivered before their deadline (rolling 60 s) |
| Safety latency | p95 P0 latency (rolling 60 s), in seconds |
| Missed safety alerts | count |
| Site coverage | % of work-area sample points covered (target line at 95%) |
| Coverage N-1 | worst case after any single relay failure |
| Hardware cost | sum from `cost.ts` for active hardware |
| Power | sum of the power draw of active hardware (show "from P3" and "battery/generator" separately) |
| Machine-minutes stopped | from the safety model |
| Queued messages / MB | total in all queues |

### 5.11 Two simulation levels

- **Day-level model (`dayModel.ts`):** For each build day 0…N, compute `DaySnapshot` (stages, relays from the planner, coverage, N-1 coverage, static "assets online" using representative positions, cost, power). It must be fast. It feeds the day slider and the charts "per build day".
- **Tick model (`tickModel.ts`):** For the selected day, run a live simulation with `dt = 1 s` (UI speed ×1, ×10, ×60). It moves assets, computes topology, routes messages, applies safety and failures, and outputs `TickMetrics` for the KPI tiles and the live charts.

---

## 6. UI specification

### 6.1 Visual style (copy the look of the Exowatt video)
- Dark background `#0B0C0E`, panels `#121417`, grid lines `#1E2126`.
- Accent orange `#FF5A1F`. Red for failure/no link `#E5383B`. White text, grey labels `#8A8F98`.
- Uppercase small labels with letter spacing (for example, `SITE TWIN · SIMULATED`, `UNITS DEPLOYED`).
- Large numeric values in KPI tiles. Red value if bad.
- Font: Inter (Google Fonts) or the system font.
- Units on the map: small orange/grey rectangles. Planned units: dark outline. Placed: grey. Commissioned: orange.

### 6.2 Layout (desktop 1440×900 first; it must work at 1280×720 for a projector)
- **Header:** title "Exowatt Site Twin — Off-Grid Connectivity", the scenario picker, the story-mode stepper (01 MODEL · 02 CONNECT · 03 STRESS-TEST), and "About".
- **Left sidebar:** day slider (0…N) + play/pause + speed, layer toggles, failure buttons, planner options (target %, N-1 on/off, max temp relays).
- **Center:** the map canvas.
- **Right panel:** KPI tiles (by stage, the same metrics as the video), the event log.
- **Bottom panel (tabs):** Coverage vs build day (with the 95% target line and the N-1 line); assets online vs time; safety latency vs time; Field Ops table.

### 6.3 Map canvas (`ui/map/`)
- Pan (drag) and zoom (wheel), "fit site" button.
- **Layers (toggles):**
  1. units (colored by stage);
  2. roads;
  3. work area and coverage heat (covered = transparent, not covered = red hatch, as in the video);
  4. links (thin lines; orange = mesh, cyan = LoRa, purple = BLE/V2V; red dashed = failed);
  5. relays (white triangles = fixed, hollow triangles = temp, diamond = aerial);
  6. assets (dots with labels such as `CRANE-2`; red ring + `NO LINK` label when offline; grey when stopped);
  7. range circles of relays (faint);
  8. safety zones (crane lift circles, proximity events as flashes).
- **Hover tooltip:** for a unit (id, stage, relay?), for an asset (type, task, mode, bearer, hops, queue size), for a relay (power source, battery, links).
- **Click a relay** when the "Fail relay" tool is active → that relay fails.
- **Performance:** Draw the static units once per day on an offscreen canvas. Draw dynamic layers each frame. 60 fps with 2,400 units and 37 assets.

### 6.4 KPI panel by story stage
- **01 MODEL:** Build day · Units deployed · Assets tracked · Units by stage (small bars).
- **02 CONNECT:** Links up · Assets online · Updates on time · Coverage.
- **03 STRESS-TEST:** Assets online · Safety latency · Missed safety alerts · Hardware cost · Power · Coverage N-1.

### 6.5 Compare mode (`ui/compare/`)
- Split the screen into two maps with the same day and time: **left = baseline**, **right = ourDesign**, with KPI tiles under each. This is the most important view for the judges.

### 6.6 Story mode (`ui/story/`)
A stepper that sets the app state for each demo step (see `docs/DEMO_SCRIPT.md`):
1. "The build front moves past the network" — baseline, day 26 → play to day 140 (assets go offline).
2. "Machines drop offline" — baseline, day 140, show red `NO LINK` labels.
3. "The network grows with the build" — switch to ourDesign, same day; relays appear on commissioned units; coverage ≥ 95%.
4. "Every machine stays coordinated" — tick play; updates on time ~99%.
5. "Stress-test" — fail a relay → coverage drops → aerial relay recovers; dust storm → LoRa keeps safety; show cost and power.
6. "Construction network → operations network" — final day; all relays on units; text: "The same relays send unit health data to the digital twin for 30 years."

### 6.7 Field Ops panel (`ui/fieldops/`)
- **Unit status table:** counts and a searchable list (piled → placed → commissioned), with "last update received" time. During failures, updates arrive late through store-and-forward. Show the delay.
- **Asset table:** id, type, task, mode, online?, bearer, queue size.

### 6.8 Export
- Button "Export metrics": downloads `metrics_<scenario>.csv` (per build day) and `tick_<scenario>_day<N>.json`. The pitch slides use these.

---

## 7. Task list (phases, tasks, acceptance criteria)

Priority labels: **[MUST]** = needed for the demo · **[SHOULD]** = important · **[NICE]** = if time permits.

### Phase 0 — Setup [MUST]
- **T0.1** Make `web/` with Vite React-TS. Add Zustand, Recharts, Vitest, ESLint, Prettier. Scripts: `dev`, `build`, `test`, `lint`.
  *Accept:* `npm run dev` shows a page. `npm test` runs one sample test. `npm run build` succeeds.
- **T0.2** Make `theme.css` with the CSS variables from 6.1 and the base layout (header, left, center, right, bottom) with empty placeholder panels.
  *Accept:* The layout matches 6.2 at 1440×900 and 1280×720 with no page scroll.
- **T0.3** Make `src/config/defaults.ts` with all values from Section 4, and `docs/ASSUMPTIONS.md` with the same table.
  *Accept:* No numeric constants in `src/sim/` except 0, 1 and math constants.
- **T0.4** Make `rng.ts` (seeded, for example mulberry32) and `geometry.ts` (Vec2 ops, segment–AABB intersection, distance).
  *Accept:* Unit tests for intersection and RNG determinism.

**Checkpoint 0:** The app runs, the tests pass, and the config exists.

### Phase 1 — Model the site [MUST]
- **T1.1** `site.ts`: generate the layout (2,400 units) and the base position.
  *Accept:* Test: unit count = blocksX × blocksY × rowsPerBlock × unitsPerRow; no units overlap.
- **T1.2** `schedule.ts`: stage days, `stageOf`, `buildFrontX`, work-area sample points.
  *Accept:* Test: on day 0, 12 units are piled; the front x increases with the day; the last unit is commissioned on day ≈ 200 + 9.
- **T1.3** Map canvas: draw units by stage for the selected day, roads, the base. Pan, zoom, fit.
  *Accept:* The slider changes the day, and the colors change correctly. 60 fps.
- **T1.4** Day slider + KPI tiles for MODEL (build day, units deployed, assets tracked, units by stage).
  *Accept:* The values agree with the schedule.
- **T1.5** `radio.ts`: link budget for each bearer. **Calibration**: add a test that prints the free-space range of each bearer, and change the config so the ranges are in the targets in 4.3.
  *Accept:* The test asserts each range is in its target band.
- **T1.6** `obstruction.ts`: spatial index + `countCrossed` + height rules.
  *Accept:* Tests: a segment across one row of 10 placed units counts 10; a drone endpoint gives 0 dB; performance test 10,000 queries < 50 ms.

**Checkpoint 1:** The map shows the site growing day by day. The radio math is tested.

### Phase 2 — Assets and connectivity [MUST]
- **T2.1** `assets.ts`: create 37 assets; task assignment by work zone; movement.
  *Accept:* In tick play, assets move to the correct zones near the front. Cranes enter the `lifting` state.
- **T2.2** `topology.ts`: links per tick for all bearers.
  *Accept:* Links layer is drawn. A test: two nodes at 100 m with no obstruction have a mesh link; at 5 km they do not.
- **T2.3** `routing.ts`: multi-bearer Dijkstra to the base; `online` flag per asset; hops; next hop per priority.
  *Accept:* Tests on a small hand-made graph (bearer change at a dual-radio node; no relaying through `canRelay = false` nodes).
- **T2.4** Asset layer on the map with `NO LINK` labels and red rings for offline assets. KPI "Assets online" and "Links up".
  *Accept:* In the **baseline** scenario, the assets online count decreases as the day increases (qualitatively the same as the video: almost all online in the first ~30 days, and most offline after ~day 120). Change only `defaults.ts` values to get this, and write the change in `ASSUMPTIONS.md`.
- **T2.5** `meshOnly` scenario: assets relay for each other.
  *Accept:* Better than baseline but still < 95% coverage on late days.

**Checkpoint 2:** Baseline failure is visible and matches the story.

### Phase 3 — Our design: planner and relays [MUST]
- **T3.1** `planner.ts` greedy algorithm with fixed relays on commissioned units and temp relays at the front.
  *Accept:* In `ourDesign`, coverage ≥ 95% on ≥ 95% of build days. Fixed relays are never removed. The number of temp relays ≤ max.
- **T3.2** `dayModel.ts`: precompute all days (in a Web Worker if > 300 ms).
  *Accept:* All days computed in < 3 s. The UI does not freeze.
- **T3.3** Relay layer and range circles on the map. Tooltip for relays (power source, links).
  *Accept:* Relays appear on orange (commissioned) units and at the front.
- **T3.4** Coverage heat layer (red hatch on uncovered sample points).
  *Accept:* Baseline late days are mostly red. ourDesign is mostly clear.
- **T3.5** Coverage vs build day chart with the 95% target line, for the active scenario (and the baseline as a dashed line).
  *Accept:* The chart updates when the scenario changes.

**Checkpoint 3:** Baseline vs ourDesign difference is clear on the map and the chart.

### Phase 4 — Messages, safety, live KPIs [MUST]
- **T4.1** `messages.ts`: generation, priority service, queues, store-and-forward, TTL.
  *Accept:* Tests: when a link is full, P0 is delivered before P3; queued P2 is delivered after the route returns.
- **T4.2** `tickModel.ts`: dt = 1 s loop; play/pause; speed ×1/×10/×60; runs in the worker or with `requestAnimationFrame` batching.
  *Accept:* ×60 speed stays smooth.
- **T4.3** KPIs: updates on time, safety latency p95, queued messages. Live line charts (last 10 minutes).
  *Accept:* ourDesign: updates on time ≥ 98% in normal conditions. Baseline: much lower on late days.
- **T4.4** `safety.ts`: proximity, crane lift zone, heartbeat loss → degraded/stopped, missed alerts, machine-minutes stopped.
  *Accept:* Baseline late day: missed safety alerts > 0 and machines stop often. ourDesign: missed alerts ≈ 0, safety latency ≈ 0.2 s (local).
- **T4.5** Data mules (carriers, drones).
  *Accept:* An asset in a dead zone gets its P2 queue delivered when a carrier passes near. Event log shows "Queue carried by CARRIER-3".

**Checkpoint 4:** CONNECT view works with live numbers.

### Phase 5 — Stress-test, cost and power [MUST]
- **T5.1** `failures.ts` with all buttons in 5.9 and the event log.
  *Accept:* Each button changes the map and the KPIs within 2 s of sim time. Reset restores the normal state.
- **T5.2** Aerial relay recovery.
  *Accept:* After "Fail relay", coverage drops, then after `dispatchDelayS` a drone flies to the dead zone and coverage returns to ≥ target. The coverage chart shows the drop and the recovery (as in the video chart: 100% → 84% → back above 95%).
- **T5.3** N-1 planner option and the "Coverage N-1" KPI.
  *Accept:* With N-1 on, a single relay failure keeps coverage ≥ 95% (with more relays and more cost — show the trade-off).
- **T5.4** `cost.ts` and the cost/power panel (with the "placeholder prices" label). Show power from P3 vs battery.
  *Accept:* Totals change with the number of relays and with N-1.
- **T5.5** STRESS-TEST KPI tiles.
  *Accept:* All tiles in 6.4 show live values.

**Checkpoint 5:** The full demo story (Section 0.2) can be shown.

### Phase 6 — Demo polish [SHOULD]
- **T6.1** Compare mode (6.5). *Accept:* Two maps in sync; independent KPIs.
- **T6.2** Story mode stepper (6.6) and `docs/DEMO_SCRIPT.md` with the spoken lines for each step (3 minutes total). *Accept:* Each step sets the state with one click.
- **T6.3** Field Ops panel (6.7). *Accept:* Unit updates show a delay during failures.
- **T6.4** Export CSV/JSON (6.8). *Accept:* Files download and open in a spreadsheet.
- **T6.5** "About" modal: the pitch sentence, the three ideas, and the assumptions link. Visible "Simulated · Illustrative values" label on all views.
- **T6.6** Tooltips and labels clean-up; keyboard shortcuts: Space = play/pause, ←/→ = day, 1/2/3 = story stage, F = fail random relay, R = reset.
- **T6.7** Loading state while the worker precomputes.

### Phase 7 — Optional extras [NICE]
- **T7.1** Static deploy (GitHub Pages or Vercel) and a link in `README.md`.
- **T7.2** `hardware/`: a Python script for 3 Meshtastic/LoRa nodes that sends a position + heartbeat, and shows rerouting or store-and-forward when one node is switched off. Include a README with steps on macOS.
- **T7.3** Scenario editor: change site size, build rate and asset counts in the UI (for mentor questions such as "what if the site is 2× larger?").
- **T7.4** Night mode toggle (darker map; Starlink failure at night preset).
- **T7.5** "Operations mode" after the last build day: unit health messages (tracker, heat engine) from all units through the fixed relays.
- **T7.6** Record a 60-second backup video of the demo (screen recording) in case of Wi-Fi problems at the event.

### Phase 8 — Documentation and final checks [MUST]
- **T8.1** `README.md`: what it is, how to run on macOS (`nvm install 20`, `cd web`, `npm install`, `npm run dev`), team roles, folder map, demo script link.
- **T8.2** `docs/ARCHITECTURE.md`: a diagram (Mermaid) of sim modules → worker → store → UI, and of the network layers (base/Starlink, fixed relays, temp relays, assets, badges).
- **T8.3** `docs/ASSUMPTIONS.md` up to date, with sources from `research/`.
- **T8.4** Final check list:
  - `npm run build` succeeds; `npm test` passes; no console errors.
  - The demo story runs end to end at 1280×720.
  - The baseline shows the video's failure. ourDesign keeps coverage ≥ 95%.
  - Each failure button works, and Reset works.
  - All numbers come from `defaults.ts`.

---

## 8. Suggested split for 4 people (so the work runs in parallel)

| Person | Area | Phases/tasks |
|---|---|---|
| A | Site + schedule + assets (MODEL) | T1.1, T1.2, T2.1, T6.3 |
| B | Radio + obstruction + routing + planner (CONNECT core) | T1.5, T1.6, T2.2, T2.3, T3.1, T3.2, T5.3 |
| C | UI: map, layers, KPI, charts, compare, story | T0.2, T1.3, T1.4, T2.4, T3.3–T3.5, T4.3, T6.1, T6.2 |
| D | Messages, safety, failures, cost, docs, pitch, hardware | T4.1, T4.4, T4.5, T5.1, T5.2, T5.4, T7.2, Phase 8 |

**Interface contracts to agree first (hour 0–1):** the `types.ts` file, `DaySnapshot`, `TickMetrics`, and the worker message format:
- `{type: 'precompute', scenario, config}` → `{type: 'days', snapshots}`
- `{type: 'tick', n}` → `{type: 'state', assets, links, relays, metrics, events}`

---

## 9. Definition of done (for the demo)

1. A judge can see, in under 3 minutes, Model → Connect → Stress-test.
2. Baseline vs ourDesign is shown side by side, with a clear difference in assets online and coverage.
3. One failure is injected live, and the recovery is visible.
4. Cost and power totals are visible, and they change with the design options.
5. The app runs offline from a local build (no network needed at the event).

---

## 10. Open questions for Exowatt mentors (update `defaults.ts` after the answers)

1. Typical site size (acres, number of units) and build rate (units/day)?
2. Is "25 kWh" per unit per day?
3. Which robots and machines, from which vendors, and which radios do they have now?
4. Can a commissioned P3 power a small relay? Can an antenna go on the lens/tracker frame? Can the factory install it?
5. Are the lens focus areas a hazard for people or robots?
6. How are units lifted and placed (crane type, accuracy, RTK)?
7. Should the construction network stay for operations and feed the digital twin?
8. Acceptable safety latency and network budget per site?
