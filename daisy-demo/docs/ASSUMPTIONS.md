# Assumptions

All numbers in this demo are placeholders until the team confirms them (spec section 14).
Every number lives in `src/config/defaults.ts`, `src/config/presets.ts` or `src/config/pricing.json`.
The main view says "Simulated · Illustrative values".

## Site and layout (spec section 3)

- The site is 2,000 acres with aspect ratio 2.0, so 4,023 m by 2,012 m.
- The target is 80,000 units: 2,000 acres x 1 MWh per acre / 25 kWh per unit.
  Change it when the reps answer.
- A unit footprint is 12.2 m x 2.44 m (a 40 ft container).
  The unit height of 2.9 m is an assumption.
- The gap between units in a lane is 2.0 m, so the unit pitch along a lane is 14.2 m.
- A block has 20 units per lane and 20 lanes.
  Roads are 10 m wide, between blocks in both directions.
  The edge margin is 20 m.
- The units in every lane are aligned, so the 2 m gaps line up from lane to lane and form straight, open column corridors.
  Open question 9 in the spec asks whether the real P3 grid is aligned like this.
- Lanes run east-west (`layout.laneAxis = 'EW'`) by default.
- World frame: x grows east, y grows north.
  South is the low y side of the site.

## Build schedule (spec section 3.4)

- 200 units per day, so about 400 build days for 80,000 units.
- A unit is commissioned 9 days after it is placed.
- Machines and crews work in a zone of 300 m ahead of the build front.
- Day numbers start at 1.
  A unit placed on day d is counted as placed on day d and commissioned on day d + 9.

## Radio presets (spec section 4.1)

- BLE, LoRa, Wi-Fi HaLow and 5 GHz mesh values (range, slider limits, data rate, power) are placeholders.
- Per-hop latency is 0.01 s, except 0.3 s for LoRa.
- The global range slider runs from 30 m to 4,000 m on a log scale.

## Corner module and antenna (spec section 4.3)

- There is one module design.
  It sits at the NE corner of the P3, sticks out 0.5 m, and has its antenna at 3.2 m.
- The default has 4 beams: both ways down the lane and both ways down the column.
  This is an assumption.
  A corner module could also face only two directions.
- Each beam has a half-width of 30 degrees.
  Outside all beams the range is 12% of R (side lobes).
- A link is up if the distance is at most the minimum of the range at A toward B and the range at B toward A.
- Links that follow a corridor are clear.
  Links that do not follow a corridor multiply the range by 0.8 for each placed unit the line crosses, up to 3 units.
- Bases are omni, with range R x 1.5, on a tall mast with no obstruction.

## Traffic and capacity (spec section 6.3)

- Unit telemetry is 64 bytes every 10 s, about 4 Mbps for 80,000 units.
- Each of 37 assets sends 650 bps.
  RTK correction data is 1.5 kbps.
- Maximum link utilization is 0.6.
- The demo shows the message "Range alone does not select the radio; capacity also does."

## Build edge (spec section 7)

- Modules in the edge zone have no power unless the battery bridge is on.
- The denser edge uses half the spacing in the last 150 m behind the commission front.
- Temporary front relays are spaced at R x 0.8 and are reusable.
- Work-zone coverage is sampled on a 25 m grid.

## Failure scenario (spec section 8.2)

- The routing model is simplified: neighbor hellos every 1 s, a neighbor is down after 3 missed hellos, local repair at once, then a route update flood at 0.02 s per hop.
  Real mesh protocols (for example 802.11s or B.A.T.M.A.N.) work in a similar way, but the demo does not model them exactly.
- The watched source sends a packet every 0.2 s.
  This is sped up for visibility.
- The maintenance swap time of 15 minutes is a placeholder.

## Pricing (spec section 5)

- All prices are placeholders while `pricing.verified = false`.
  The cost panel shows "Placeholder prices - verify before pitch" until then.
- See `PRICING_FORMAT.md` for the file format.
