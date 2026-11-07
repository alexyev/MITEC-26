# Autonomous 4x4 Lidar Survey of a 2,000-acre Site: Resolution, Speed, Method, Hardware and Cost

**Team:** MITEC Hack '26 · **Date:** Nov 7, 2026
**Files:**
- `research/survey/survey_tradeoffs.xlsx`: the trade-off spreadsheet. All values are live formulas. Change the yellow cells on `Inputs`.
- `research/survey/survey_model.py`: reproduces every number in this document (`python3 research/survey/survey_model.py`).
- `research/survey/build_xlsx.py`: regenerates the spreadsheet.

> **How prices and specs were checked.** This session's network policy blocked direct downloads from vendor sites (riegl.com, starlink.com, polaris.com and others). I took each figure from web-search results for the linked vendor or reseller page, as of 2026-11-07. Every price below has a label:
> - **Listed:** a price shown on a vendor or reseller page.
> - **Press:** a list price reported in trade press.
> - **Estimate:** a budget number for a quote-only item. The basis is stated, and some bases are weak.
>
> Survey-grade lidar, inertial navigation (INS) and autonomy hardware is sold **by quote only**. Do not sign anything against these numbers until you have quotes.

---

## 0. Short answers

| Question | Answer |
|---|---|
| Is 1 mm² resolution reasonable? | **No. It is about 30x finer than the system can measure, and the job does not need it.** At 1 mm spacing the site is 8.09 × 10¹² points (≥ 243 TB as LAS). Survey-grade single-shot range noise is 3 mm. Beam-spread growth alone is 1.25 mm at 2.5 m. Post-processed vertical georeferencing error is 30 mm RMS. So 1 mm sampling records noise, not ground (§2). |
| What resolution should we use? | **Ground point spacing ≤ 5 cm (≥ 400 pts/m²), a 10 cm bare-earth grid (DTM), and vertical RMSE ≤ 5 cm.** Check it with ≥ 30 RTK checkpoints (ASPRS Ed. 2). This meets USGS QL0 accuracy (5 cm). It also supports earthwork design against a ±0.1 ft (±3 cm) grading tolerance. **Check finished grades with RTK rovers or machine control, not with the topo survey** (§2.3). |
| Scan range that meets a given resolution | For a survey-grade line scanner (RIEGL VUX-1HA) at 2.5 m height: **1 mm** holds only within **2.5 m to each side** at the best-coverage setting. The absolute maximum is **5.8 m (6.3 m slant range)** at the slowest mirror speed, and then the vehicle moves at 2 cm/s. **5 cm** holds out to **21.7 m**; occlusion limits it to about 15 m in practice. With spinning automotive lidars (Ouster, Hesai), 1 mm angular sampling holds only within **0.16–0.33 m** of the sensor (§3). |
| How fast, and how much area per hour (one vehicle, 2 scanners) | **1 mm:** 0.23 km/h, 0.28 acre/h, about **10,400 field hours** (1,222 working days). **1 cm:** 15 km/h, 26.6 acre/h, 111 h (13 days). **5 cm:** 15 km/h, 30 m swath, **111 acre/h, 26 h (3.1 days)** (§4). |
| Is SLAM the best method? | **No, not as the main method.** On open desert with a clear sky, the standard method uses **GNSS/INS direct georeferencing** (PPK against a local base station) plus strip adjustment between overlapping passes. Lidar SLAM gives no absolute coordinates, it drifts, and it degrades on flat, featureless ground. Use SLAM only as a helper. **Aerial (drone) lidar is the better primary method for this job.** It covers the site in about 3–4 flights and costs about **6–16x less** than one ground vehicle (§6). |
| Starlink | Fine for supervision, telemetry, QA thumbnails and finished deliverables. **It cannot carry the raw data.** One vehicle produces about **480 Mbps** of points, against **8–25 Mbps** Starlink upload. Ship raw data on drives (§7). |
| Fuel or electric | **Gasoline (or diesel).** An electric Ranger XP Kinetic Ultimate (29.8 kWh) lasts about **4.7 h** at survey speed with a 0.53 kW sensor load, and the site has no grid power to recharge it (§8). |
| Hardware cost per vehicle | **Tier E (engineering grade, recommended if ground-based): about $266k. Tier S (survey-grade RIEGL VMX-2HA): about $761k.** The autonomy kit is about $100k of each. Shared GNSS base and rover: $6k. Drone alternative: about $47k total (§9). |

---

## 1. Constants and site

| Quantity | Value | Source |
|---|---|---|
| 1 acre | 4,046.856 4224 m² (exact, international acre) | NIST SP 811 / Handbook 44 |
| Site area A | 2,000 × 4,046.856 4224 = **8,093,712.8 m² = 8.094 km²** | computed |
| Points needed at 1 point per s × s cell | A / s² | definition of "s² resolution" |

"1 mm² resolution" here means **one measured point per 1 mm × 1 mm cell**: point spacing s = 1 mm, density ρ = 1/s² = 10⁶ pts/m².

---

## 2. Is 1 mm reasonable? No.

### 2.1 Point count and volume (lower bound: no oversampling, no overlap)

| Spacing s | Density | Points for the site | LAS 1.4 PDRF 6 (30 B/pt) |
|---|---|---|---|
| 1 mm | 1,000,000 /m² | 8.09 × 10¹² | **242.8 TB** |
| 1 cm | 10,000 /m² | 8.09 × 10¹⁰ | 2.43 TB |
| 5 cm | 400 /m² | 3.24 × 10⁹ | 0.10 TB |
| 10 cm | 100 /m² | 8.09 × 10⁸ | 0.02 TB |

Calculation for 1 mm: 8,093,712.8 m² ÷ (0.001 m)² = 8.094 × 10¹² points. Multiplied by 30 B, that is 2.428 × 10¹⁴ B = 242.8 TB.

A real scanner oversamples near the vehicle. The model in §4 logs **6.36 × 10¹³ points (≈ 1.9 PB)** for the 1 mm case.

### 2.2 Physical limits: "resolution" is not "accuracy"

Reference sensor: **RIEGL VUX-1HA** (datasheet): accuracy 5 mm, precision 3 mm (1σ), beam divergence 0.5 mrad. Reference trajectory: **Applanix POS LV 610/620**, post-processed (PP), RMS values: X/Y 0.020 m, Z 0.030 m, roll/pitch 0.0025°, heading 0.015°.

| Error source | Size | Calculation |
|---|---|---|
| Beam footprint growth (divergence only; the exit beam diameter adds to it) | +1.25 mm at 2.5 m, +5 mm at 10 m, +7.5 mm at 15 m | 0.5 mrad × r |
| Single-shot range noise | 3 mm (1σ) | datasheet |
| Roll/pitch error projected onto the ground | 0.13 mm at 3 m, 0.65 mm at 15 m | 0.0025° = 43.6 µrad; × r |
| Heading error projected onto the ground | 0.79 mm at 3 m, 3.9 mm at 15 m | 0.015° = 262 µrad; × r |
| GNSS/INS vertical position | **30 mm RMS** | POS LV PP spec |
| **Total vertical (root-sum-square)** | **≈ 30 mm** | √(30² + 3² + 0.65²) = 30.2 mm |

**Conclusion.** The laser spot is wider than 1 mm everywhere beyond about 2 m. Each shot has 3 mm of noise. Absolute height is known only to about 3 cm. A 1 mm grid would sample the noise roughly 3 times over per noise width, and the absolute accuracy roughly 30 times over.

Also, the ground itself does not hold still at the 1 mm scale:
- The survey vehicle's own tires rut the soil.
- Wind moves sand ripples.
- Brush moves in the wind.
- Grading then moves earth at the decimeter scale.

### 2.3 What the work needs

| Requirement | Value | Source |
|---|---|---|
| Single-axis-tracker grading tolerance (typical) | ±0.1 ft (±3.05 cm); N–S slope 10–15 %, E–W 5 % | EPCLAND guide (secondary; check against the tracker or P3 installation manual) |
| USGS 3DEP QL0 (best standard aerial class) | ≥ 8 pts/m², ≤ 0.35 m spacing, RMSEz ≤ 5 cm | USGS Lidar Base Specification tables |
| USGS QL1 | ≥ 8 pts/m², RMSEz ≤ 10 cm | same |
| ASPRS Positional Accuracy Standards Ed. 2 (2023) | ≥ 30 checkpoints; checkpoints 3x more accurate than the product; ground control points 2x | ASPRS / FGDC summary |

**Recommendation:**
1. **Design topography:** raw ground spacing ≤ 5 cm (≥ 400 pts/m²), which is about 50x denser than QL0. Ground-classified DTM on a 10 cm grid. Vertical RMSEz ≤ 5 cm.
2. **Verification:** ≥ 30 checkpoints. Per ASPRS Ed. 2, a 5 cm product needs checkpoints at ≤ 1.7 cm RMSE. An Emlid RS3 RTK spec is 14 mm + 1 ppm vertical, which gives about 18 mm at 4 km. That is borderline, so use averaged or static occupations for checkpoints.
3. **Construction:** check the ±3 cm finish grade with RTK rovers or machine control (1–2 cm), not with the topo survey.
4. **Exowatt-specific:** get the P3 foundation flatness and slope tolerances from Exowatt. If any feature needs better than about 2 cm, scan only that feature (for example, each foundation pad) at 5–10 mm with a terrestrial scanner. Do not scan the whole 2,000 acres at that density.

---

## 3. Scanning geometry and usable range

### 3.1 Model (profile/line scanner, e.g. VUX-1HA; the VMX-2HA carries two)

Symbols:
- N = measurements per second per scanner (1.0 × 10⁶, datasheet)
- k = number of scanners (2)
- f = scan-line rate (10–250 lines/s, datasheet)
- h = scanner height (2.5 m, **assumption**)
- d = lateral ground offset from the vehicle track
- v = vehicle speed

1. Angular step between shots: **Δα = 2πf / N**
2. A ground point at offset d satisfies d = h·tan α, so dd/dα = h·sec²α = (h² + d²)/h. The cross-track spacing is therefore **s_c(d) = (h² + d²)/h · Δα**
3. Along-track spacing (the scan lines of the k scanners interleave): **s_a = v / (k·f)**
4. Largest offset that still meets spacing s: set s_c(d) = s, which gives **d_max = √(s·h/Δα − h²)**. If h·Δα > s, even the point straight below the scanner fails, and the setting is infeasible.
5. Coverage rate: **C = 2·min(d_max, d_cap)·min(s·k·f, v_cap)**

**Best line rate (no caps).** Choose f to maximize C:
- C = 2sk·√(a·f − h²f²), with a = s·h·N/(2π)
- This is maximal at f* = a/(2h²) = **s·N/(4πh)**
- At f*, **d_max = h**, so the swath is 2h
- **C\* = k·N·s²/(2π)**

So, without caps, coverage scales with **s²**. Halving the spacing cuts the area rate by 4x.

### 3.2 Usable range for a given resolution

**Line scanner on the ground (h = 2.5 m, 2 × VUX-1HA)**, from `Resolution_Tradeoff`:

| s | Best-coverage setting: lateral reach each side (slant) | Absolute maximum reach | Speed at that setting |
|---|---|---|---|
| 1 mm | 2.5 m (3.5 m) | 5.79 m (6.31 m), at f = 10 Hz | 0.23 km/h; 0.07 km/h at the maximum-reach setting |
| 5 mm | 2.5 m (3.5 m) | — | 5.7 km/h |
| 1 cm | 3.6 m (4.4 m), speed-capped | — | 15 km/h |
| 2 cm | 8.4 m (8.7 m) | — | 15 km/h |
| 5 cm | 21.7 m available; **15 m used** (occlusion cap) | — | 15 km/h |

**Best case for angular sampling only**: the beam hits the surface square-on, and r = s / Δθ (`Sensor_Bounds`):

| Sensor (angular step) | r where step = 1 mm | r where step = 5 cm |
|---|---|---|
| VUX-1HA at 250 Hz (1.571 mrad) | 0.64 m | 31.8 m |
| VUX-1HA at 10 Hz (0.063 mrad) | 15.9 m | 796 m |
| Ouster OS1-128, horizontal (360°/2048 = 3.07 mrad) | 0.33 m | 16.3 m |
| Ouster OS1-128, vertical (45°/128 = 6.14 mrad) | 0.16 m | 8.1 m |
| Hesai XT32, horizontal (0.18° = 3.14 mrad) | 0.32 m | 15.9 m |

**Conclusion:** spinning automotive lidars cannot do 1 mm at any useful range. A survey line scanner can do it only within a few meters and at walking pace or slower.

---

## 4. Speed and area rate

### 4.1 Per vehicle (2 × VUX-1HA, h = 2.5 m)

Assumptions:
- Speed cap v_cap = 15 km/h
- Reach cap d_cap = 15 m each side
- 20 % side overlap
- 15 % turn/transit time
- 10 h/day
- 85 % availability

Field hours = A / (C·(1 − 0.20)·(1 − 0.15)). Days = hours / (10 × 0.85).

| s | f [Hz] | Swath [m] | v [km/h] | C [m²/s] | **acre/h** | Field h (1 veh) | **Days (1 veh)** | Raw LAS [TB] |
|---|---|---|---|---|---|---|---|---|
| 1 mm | 31.8 | 5.0 | 0.229 | 0.318 | **0.28** | 10,387 | **1,222** | 1,907 |
| 2 mm | 63.7 | 5.0 | 0.917 | 1.27 | 1.13 | 2,597 | 306 | 477 |
| 5 mm | 159 | 5.0 | 5.73 | 7.96 | 7.08 | 415 | 49 | 76 |
| 1 cm | 208 | 7.2 | 15 | 29.9 | **26.6** | 111 | **13.0** | 20.3 |
| 2 cm | 104 | 16.8 | 15 | 69.8 | 62.1 | 47 | 5.6 | 8.7 |
| 3 cm | 69 | 25.7 | 15 | 107 | 95.4 | 31 | 3.6 | 5.7 |
| **5 cm** | 42 | 30.0 | 15 | 125 | **111.2** | **26.4** | **3.1** | 4.9 |
| ≥ 5 cm | — | 30.0 | 15 | 125 | 111.2 | 26.4 | 3.1 | 4.9 |

**Worked example, 1 mm:**
- f* = 0.001 × 10⁶ / (4π × 2.5) = 31.8 Hz
- Δα = 2π × 31.8 / 10⁶ = 0.200 mrad
- d_max = √(0.001 × 2.5 / 0.0002 − 6.25) = √6.25 = 2.5 m
- v = 0.001 × 2 × 31.8 = 0.0637 m/s = 0.229 km/h
- C = 5.0 × 0.0637 = 0.318 m²/s. This matches C\* = 2 × 10⁶ × 10⁻⁶ / (2π) = 0.318.
- Hours = 8,093,712.8 / (0.318 × 0.8 × 0.85) / 3600 = **10,387 h**
- Days = 10,387 / 8.5 = **1,222 days**

**Worked example, 5 cm:**
- The speed cap binds: f = 4.167 / (0.05 × 2) = 41.7 Hz
- Δα = 0.262 mrad
- d_max = √(0.05 × 2.5 / 0.000262 − 6.25) = 21.7 m, so the 15 m reach cap applies
- C = 30 × 4.167 = 125 m²/s
- Hours = 8,093,712.8 / (125 × 0.68) / 3600 = **26.4 h**
- Line length = A / (30 × 0.8) = **337 km**

**Does a cheaper spinning lidar keep up at 5 cm?** Example: Ouster OS1-128 at 15 km/h. About 37 of its downward beams hit the ground within 15 m (from −22.5° to −9.5°, at 0.35° spacing). Each beam crosses a given lateral line twice per 0.417 m of travel. That gives about 74 samples per 0.417 m, or about 6 mm average along-track spacing. The azimuth step at 15 m slant is 3.07 mrad × 15.2 m = 4.7 cm. **So at ≥ 5 cm, survey speed is limited by the vehicle and by occlusion, not by the sensor.** Sensor grade then changes **accuracy**, not coverage rate.

### 4.2 Speed–resolution trade-off

The finest worst-case spacing across a swath of half-width d at speed v occurs when the along-track and cross-track spacings are equal:

- **s = √(2π·v·(h² + d²) / (k·N·h))**, at line rate f = √(v·N·h / (2π·k·(h² + d²))), clipped to 10–250 Hz

Values (`Speed_Tradeoff`, in mm):

| v \ half-swath d | 1 m | 2.5 m | 5 m | 10 m | 15 m | 20 m |
|---|---|---|---|---|---|---|
| 1 km/h | 1.6 | 2.1 | 3.3 | 6.1 | 9.0 | 11.9 |
| 5 km/h | 3.6 | 4.7 | 7.4 | 13.6 | 20.1 | 26.6 |
| 10 km/h | 5.6 | 6.6 | 10.4 | 19.3 | 28.4 | 37.7 |
| 15 km/h | 8.3 | 8.3 | 12.8 | 23.6 | **34.8** | 46.1 |
| 25 km/h | 13.9 | 13.9 | 16.5 | 30.5 | 44.9 | 59.5 |

The **absolute speed limit** for spacing s is the zero-width swath case: **v_max = k·N·s² / (2π·h)**.
- 1 mm: 0.46 km/h
- 5 mm: 11.5 km/h
- 1 cm: 45.8 km/h

The area-optimal speed is v_max / 2.

**Three regimes**, for 2 × VUX-1HA, h = 2.5 m, v_cap = 15 km/h, d_cap = 15 m:
1. **s < 8.1 mm, sensor-limited:** C = kNs²/(2π) ∝ s². The crossover is s = √(4πh·v_cap/(kN)) = √(4π × 2.5 × 4.167 / (2 × 10⁶)) = 8.1 mm.
2. **8.1 mm < s < 34.8 mm, speed-limited:** the swath grows roughly in proportion to s.
3. **s > 34.8 mm, speed- and reach-limited:** C stays at 125 m²/s (111 acre/h). A coarser spec buys nothing more.

### 4.3 Lower bound for any sensor

C ≤ N_ground·s² is a hard limit: each ground return fills a separate s × s cell. Assume half of all returns hit the ground (half of a 360° scan points at the sky). Then the minimum scan time for 2,000 acres at 1 mm is:
- 2 × VUX-1HA: **2,248 h**
- OS1-128: **1,715 h**
- XT32: **7,026 h**

No ground sensor makes 1 mm over 2,000 acres practical.

---

## 5. Fleet scaling (calendar days; `Fleet` sheet)

| s \ vehicles | 1 | 2 | 3 | 5 | 10 | 20 |
|---|---|---|---|---|---|---|
| 1 mm | 1,222 | 611 | 407 | 244 | 122 | 61 |
| 5 mm | 48.9 | 24.4 | 16.3 | 9.8 | 4.9 | 2.4 |
| 1 cm | 13.0 | 6.5 | 4.3 | 2.6 | 1.3 | 0.65 |
| **5 cm** | **3.1** | **1.6** | 1.0 | 0.6 | 0.3 | 0.16 |
| Capex Tier E | $272k | $538k | $805k | $1.34M | $2.67M | $5.33M |
| Capex Tier S | $767k | $1.53M | $2.29M | $3.81M | $7.62M | $15.2M |

Capex = n × per-vehicle cost + $6k shared GNSS. The schedule scales linearly in n, assuming the vehicles do not interfere with each other.

**Conclusion:** for the recommended 5 cm spec, **one vehicle finishes in about 3 working days**. A second vehicle is for redundancy, not throughput. At 1 mm, even **20 Tier S vehicles ($15.2M)** need 61 days, and the data is still not meaningful (§2.2).

---

## 6. Method: SLAM, GNSS/INS, or aerial?

| Method | Absolute coordinates | Works on flat open desert | Throughput for 2,000 ac at 5 cm | Notes |
|---|---|---|---|---|
| Lidar(-inertial) SLAM only | **No.** It builds a local frame and must be tied to GNSS anyway | **Poorly.** Flat, featureless ground leaves the scan-matching problem under-constrained, so the solution drifts (Zhang, Kaess & Singh, ICRA 2016, on degeneracy) | as §4 | Built for places with no GNSS (mines, buildings, forests) |
| **GNSS/INS direct georeferencing (PPK) + strip adjustment** | **Yes:** 2 cm H / 3 cm V (POS LV PP spec) | **Yes.** Open sky is ideal for GNSS | as §4 (26 h, 1 vehicle) | Industry standard for vehicle mobile mapping. Needs a local base station (no CORS network nearby) |
| **Aerial lidar (UAV)** | Yes: 4 cm V at 150 m (DJI L2, reseller spec) | Yes. Sees over the brush instead of through its side | 2.5 km²/flight → **3.24 flights** for 8.09 km² at the published 150 m / 15 m/s / 20 % setting. 5 cm spacing needs ≥ 3.7 h of laser time (240k pts/s), so fly lower and slower | **About 6–16x cheaper than one ground vehicle** ($47k vs $272k–$767k) |

**Recommendation:**
1. **Primary topographic survey: UAV lidar plus ≥ 30 RTK checkpoints.**
2. If the project needs autonomous ground vehicles anyway (for example, repeated progress surveys during the build, or the challenge's robot-fleet concept), use **GNSS/INS + PPK as the primary method** and SLAM only as a helper (bridging GNSS outages, local obstacle maps for autonomy).
3. The autonomy stack should **follow paths with RTK GNSS and use lidar to detect obstacles**. This is how Dataspeed's NavRoute runs on a Polaris Ranger (Purdue project report). It should not depend on a SLAM map.

**Procurement risk for UAVs:** on 23 Dec 2025 the FCC added DJI and other foreign-made drones to its Covered List. **New** models cannot get authorization. Models authorized before that date (the M350 RTK and L2) remain legal to sell and use. There is still supply and repair risk. A non-DJI path exists: Emesent Hovermap ST-X "Astro Kit", $26,000 reseller price, which mounts on a Freefly Astro. The drone is priced separately.

---

## 7. Data and Starlink

| Quantity | Value | Calculation |
|---|---|---|
| Raw point stream, 1 vehicle (2 × 1 MHz) | **480 Mbps** | 2 × 10⁶ pts/s × 30 B × 8 |
| Starlink upload, Mobile Priority / Roam | 8–25 / 2–10 Mbps | Starlink specification document DOC-1525-57370-71 |
| Raw stream ÷ uplink | **60x** at 8 Mbps | |
| Raw LAS for 5 cm survey | 4.9 TB → 56 days at 8 Mbps, 18 days at 25 Mbps | §4 table |
| Raw LAS for 1 mm survey | 1,907 TB → **22,072 days (60 years)** at 8 Mbps | |
| 10 cm DTM (float32) | 8.09 × 10⁸ cells × 4 B = **3.24 GB → 0.9 h** at 8 Mbps | |

**Design:**
1. Log raw data to removable SSDs and carry the drives to the office.
2. Over Starlink, send telemetry, remote supervision and remote operation, coverage maps, decimated QA clouds, and the final DTM and contours.
3. LAZ compression (lossless) shrinks LAS to roughly 7–20 % of original size (Isenburg, PE&RS 2013). That is still 4–10x too much for the uplink at 5 cm.
4. One Starlink on each vehicle is acceptable. A second terminal per vehicle buys link redundancy, not throughput that matters for raw data.
5. For a fleet, put Starlink at a base trailer and run a local site radio. See `offgrid-connectivity-research.md`.

---

## 8. Fuel or electric

**Energy model for the electric option** (Polaris Ranger XP Kinetic Ultimate):
- 29.8 kWh pack, 80 mi rated range at 25 mph with 250 lb cargo (Polaris), so 29.8 / 128.7 km = **0.2315 kWh/km**
- +30 % for rough terrain and payload (**assumption**): 0.301 kWh/km
- At 15 km/h with a 0.53 kW electrical payload (**assumption**: ~250 W lidar system + 130 W Thor + 100 W Starlink + 50 W misc): 0.301 × 15 + 0.53 = **5.04 kWh per hour**
- Usable pack 80 %: 23.8 kWh / 5.04 = **4.7 h per charge**

The 5 cm survey needs 26.4 field hours, which is **about 6 charges**. The site has no grid power, so each charge needs a generator or a PV + battery trailer.

**Recommendation: gasoline Polaris Ranger XP 1000.** Refueling takes minutes, and this is the base vehicle that the Dataspeed by-wire kit targets. The payload runs from a separate LiFePO4 battery charged through a DC-DC charger:
- 5.3 kWh per 10 h day
- the 2.56 kWh battery is recharged while driving, through the Orion XS: 50 A × 12.8–14.2 V ≈ 0.64–0.71 kW

Choose electric only if the site already has a charging trailer. It costs **$37,499 + $1,195 destination** (Ultimate trim) against **$21,799** for the gasoline XP 1000 base trim. Dataspeed's published kit is for the gasoline XP1000 NorthStar.

---

## 9. Hardware and cost (per vehicle unless stated; `Costs` sheet)

### 9.1 Common to both tiers

| Item | Qty | Unit USD | Type | Link | Note |
|---|---|---|---|---|---|
| Polaris RANGER XP 1000 (gasoline), base trim | 1 | 21,799 | Listed | [polaris.com](https://www.polaris.com/en-us/off-road/ranger/) | 2027 MY starting MSRP. The NorthStar (cab) trim costs more, plus destination |
| Dataspeed driverless kit for Ranger XP1000 NorthStar | 1 | 100,000 | Press | [Farmers Weekly](https://www.fwi.co.uk/machinery/atvs/dataspeed-develops-driverless-system-for-polaris-utvs), [Dataspeed](https://www.dataspeedinc.com/) | List price reported about 2 years ago. Confirm the scope (wireless e-stop, obstacle lidar, whether the vehicle is included) |
| Starlink Performance Gen 3 kit (KVH-supplied, flat mount + router) | 1 | 2,049 | Listed | [GPS4US](https://www.gps4us.com/KVH-Starlink-Performance-Gen-3-Kit-%2D-Flat-Mount-w-and-o-Router--P368962.html) | Rated for in-motion use. 75–100 W. Reseller range $1,849–$2,049 |
| Starlink Mini (redundant link) | 1 | 599 | Listed | [starlink.com](https://www.starlink.com/mini-product-us), [Notebookcheck](https://www.notebookcheck.net/Starlink-Mini-price-cut-SpaceX-drops-cost-by-up-to-40-in-US-and-Canada.1131098.0.html) | Prices found ranged $249–$599; the upper value is used. 25–40 W |
| NVIDIA Jetson AGX Thor Developer Kit | 1 | 3,499 | Listed | [Hackster](https://www.hackster.io/news/nvidia-tells-resellers-to-open-jetson-agx-thor-developer-kit-orders-at-3-499-06e8cbf52441) | 40–130 W. A dev kit, not ruggedized |
| Victron LiFePO4 12.8 V / 200 Ah | 1 | 1,409.30 | Listed | [Off Grid Source](https://offgridsource.com/products/victron-lithium-ng-battery-12-8v-200-ah) | 2.56 kWh, for the payload only |
| Victron Orion XS 12/12-50A DC-DC charger | 1 | 386 | Listed | [Wind & Solar](https://windandsolar.com/products/victron-energy-orion-xs-1212-50a-dc-dc-battery-charger) | Street price about $328–$338 |
| Mast, mounts, wiring, enclosures, integration labor | 1 | 15,000 | Estimate | — | **Assumption** |
| Removable SSDs for physical data transfer | 1 | 1,500 | Estimate | — | **Assumption** |

### 9.2 Tier-specific

| Tier | Item | Unit USD | Type | Link | Basis / confidence |
|---|---|---|---|---|---|
| **S** | RIEGL VMX-2HA (2 × VUX-1HA + IMU/GNSS) | 600,000 | Estimate | [RIEGL](https://www.riegl.com/en-austria/products/detail/riegl-vmx-2ha) | Quote only. Secondary cost guides give about $250k–$750k and $400k–$1.2M for high-end vehicle MLS ([Swyvl](https://swyvl.io/blog/3d-mapping-cost-guide/), [Accio](https://www.accio.com/business/lidar-mobile-mapping-system)). Mid value used. **Low confidence** |
| **S** | Processing software, annual | 15,000 | Estimate | same guides | $2k–$15k/yr; upper value used |
| **E** | Ouster OS1-128 Rev 7 | 20,000 | Listed | [RobotShop EU](https://eu.robotshop.com/products/general-laser-ouster-os1-128-rev-7-mid-range-lidar-sensor) | €18,634 including tax; the 2019 US launch list price was $18,000. Ouster is a US company (NYSE: OUST) |
| **E** | Applanix POS LV (dual-GNSS INS + POSPac) | 85,000 | Estimate | [Applanix](https://applanix.trimble.com/en/products/hardware/applanix-pos-lv) | Quote only. The only public figure is a forum post: a POS LV 220 bought new for $85k (about 2017) ([link](https://www.thephotoforum.com/threads/applanix-pos-lv-for-sale.423288/)). The 610/620 used for the §2.2 accuracy figures will cost more. **Low confidence** |
| **E** | INS + lidar georeferencing software, annual | 15,000 | Estimate | [Swyvl](https://swyvl.io/blog/3d-mapping-cost-guide/) | |

### 9.3 Totals

| | Per vehicle | 1 vehicle + shared | 2 vehicles + shared |
|---|---|---|---|
| **Tier E** (OS1-128 + POS LV), engineering grade | **$266,241** | $272,239 | $538,481 |
| **Tier S** (VMX-2HA), survey grade | **$761,241** | $767,239 | $1,528,481 |
| Shared: 2 × Emlid Reach RS3 (base + checkpoint rover) | — | $5,998 ([Advexure](https://advexure.com/products/emlid-reach-rs3)) | — |
| Starlink service | $175/month per terminal (Roam; reported $165–$175, [Starlink CIS](https://www.starlink.com/public-files/CIS_Roam_March2025.pdf)) | | |
| **UAV alternative:** DJI M350 RTK + Zenmuse L2 + Care Basic bundle | — | **$47,035** ($41,037 [BuyDirectNY](https://buydirectny.com/products/dji-matrice-350-rtk-drone-combo-zenmuse-l2-lidar-care-basic) + shared GNSS) | — |

**Notes on the costs:**
1. Autonomy (about $100k) is **38 %** of a Tier E vehicle. For a single 3-day survey, a human driver costs far less than autonomy. Autonomy pays only if the vehicles are reused, for example for weekly as-built or progress surveys over the build.
2. Suppliers rejected on trust or compliance grounds:
   - **Hesai** is on the US DoD Section 1260H list (January 2024). Its XT32 specs are good: ±1 cm accuracy, 0.5 cm precision.
   - **DJI** is on the same list, and the FCC Covered List risk above also applies.
   - Livox and other low-cost lidars are not survey grade.

---

## 10. Recommended plan

1. **Spec:** ≤ 5 cm raw ground spacing, 10 cm DTM, RMSEz ≤ 5 cm, ≥ 30 checkpoints. Confirm against the Exowatt P3 foundation tolerance and the earthwork engineer's requirement.
2. **Primary capture:** UAV lidar. Three to four flights at the published setting, or more flights lower and slower to reach ≥ 400 pts/m². RTK/PPK runs against a local Emlid RS3 base. The site measures about 4 km × 2 km, so baselines are ≤ about 4.5 km, adding about 4.5 mm at 1 ppm.
3. **Ground vehicles (only if required):**
   - 1–2 Tier E gasoline Rangers with Dataspeed by-wire
   - GNSS/INS PPK as the primary method; SLAM only as a helper
   - 15 km/h, 30 m swath, 20 % overlap, about 337 km of lines
   - 26 field hours for one vehicle
4. **Starlink:** supervision and deliverables only. Raw data travels on drives.
5. **Quotes to request:** RIEGL (VMX-2HA), Trimble Applanix (POS LV 220/620), Dataspeed (Ranger kit scope), Ouster (OS1-128 volume price), Starlink (Mobile Priority plan pricing).

## 11. Assumptions to check (all editable in `Inputs`)

| Assumption | Value | Effect if wrong |
|---|---|---|
| Scanner height | 2.5 m | Sets reach at fine spacing (d_max = h at the optimum) |
| Survey speed cap | 15 km/h | Sets throughput for s ≥ 8 mm. Rough ground may force 8–10 km/h, giving +50–90 % time |
| Usable reach | 15 m each side | Sets throughput for s ≥ 35 mm. Dense brush shrinks it |
| Overlap / turn time | 20 % / 15 % | Multiply time by 1/(0.8 × 0.85) = 1.47 |
| Hours/day, availability | 10 h, 85 % | Calendar days only |
| Payload power | 0.53 kW | EV runtime, aux battery size |
| VMX-2HA price | $600k | Tier S capex. Range $250k–$1.2M |

## Sources

- RIEGL VUX-1HA datasheet (1 MHz, 10–250 scans/s, 5 mm accuracy, 3 mm precision, 0.5 mrad): [rieglusa.com PDF](https://www.rieglusa.com/wp-content/uploads/vux-1ha-datasheet1.pdf), [VUX-1HA-22 page](https://www.riegl.com/en-uk/products/detail/riegl-vux-1ha-22)
- RIEGL VMX-2HA: [riegl.com](https://www.riegl.com/en-austria/products/detail/riegl-vmx-2ha), [DirectIndustry](https://www.directindustry.com/prod/riegl-lms/product-15822-1937833.html)
- Applanix POS LV accuracy (PP: 0.020 m X/Y, 0.030 m Z, 0.0025° roll/pitch, 0.015° heading): [Applanix](https://applanix.trimble.com/en/products/hardware/applanix-pos-lv), [datasheet](https://www.unmannedsystemstechnology.com/wp-content/uploads/2025/06/Applanix-POS-LV_Datasheet.pdf)
- ASPRS Positional Accuracy Standards Ed. 2: [LIDAR Magazine](https://lidarmag.com/2023/10/06/the-asprs-positional-accuracy-standards-edition-2/), [ASPRS PE&RS](https://www.asprs.org/wp-content/uploads/2024/03/October2023_HLA-Positional_Accuracy_Standards.pdf), [FGDC](https://www.fgdc.gov/organization/working-groups-subcommittees/fgcs/meetings/feb-2023/8-standards-for-gcps-for-geospatial-data-and-dual.pdf)
- USGS 3DEP quality levels: [USGS tables](https://www.usgs.gov/ngp-standards-and-specifications/lidar-base-specification-tables), [USGS QLs](https://www.usgs.gov/3d-elevation-program/topographic-data-quality-levels-qls)
- Grading tolerances (secondary): [EPCLAND](https://epcland.com/earthwork-optimization-solar-farms/), [PV Tech](https://www.pv-tech.org/terrain-following-trackers-helping-boost-pv-project-viability/)
- Starlink specifications and plans: [DOC-1525-57370-71](https://starlink.com/legal/documents/DOC-1525-57370-71), [Performance kit comparison](https://www.starlink.com/support/article/4a1b39b5-c299-93c6-0551-90ba52531d5e), [Roam CIS](https://www.starlink.com/public-files/CIS_Roam_March2025.pdf)
- Polaris Ranger XP Kinetic: [Polaris trims](https://www.polaris.com/en-us/off-road/ranger/models/ranger-xp-kinetic/compare-trims/), [ATV.com 2027 Ultimate](https://www.atv.com/specs/polaris/utility/2027/ranger-xp-kinetic/ultimate/detail.html)
- Dataspeed Polaris kit: [Farmers Weekly](https://www.fwi.co.uk/machinery/atvs/dataspeed-develops-driverless-system-for-polaris-utvs), [Purdue NavRoute project](https://digitwin2024.polytechnic.purdue.edu/ABE/academics/seniorprojects/2025/Autonomous%20Polaris%20Ranger%20Mower.pdf)
- Jetson AGX Thor: [Hackster](https://www.hackster.io/news/nvidia-tells-resellers-to-open-jetson-agx-thor-developer-kit-orders-at-3-499-06e8cbf52441), [heise](https://heise.de/-10622015)
- Emlid Reach RS3: [Advexure](https://advexure.com/products/emlid-reach-rs3)
- Ouster OS1: [RobotShop](https://eu.robotshop.com/products/general-laser-ouster-os1-128-rev-7-mid-range-lidar-sensor), [Clearpath spec](https://store.clearpathrobotics.com/products/os1-rev-7), [GeoWeek 2019 price](https://www.geoweeknews.com/?p=34311)
- Hesai XT32 specs: [Hesai](https://hesaitech.com/?p=712)
- DJI L2: [DroneDJ price](https://dronedj.com/2023/10/10/dji-zenmuse-l2-lidar-price/), [Dronefly](https://dronefly.com/products/dji-zenmuse-l2); FCC Covered List: [Tom's Guide](https://www.tomsguide.com/cameras-photography/drones/us-bans-foreign-made-drones-including-those-by-dji-heres-what-this-means-for-you), [UAV Coach](https://uavcoach.com/dji-ban/)
- Emesent Hovermap ST-X: [Advexure Astro kit](https://acceptance.reach.dog/shop/advexure/products/emesent-hovermap-st-x-astro-kit), [Emesent](https://emesent.com/emesent-product/hovermap-series/)
- Victron: [battery](https://offgridsource.com/products/victron-lithium-ng-battery-12-8v-200-ah), [Orion XS](https://windandsolar.com/products/victron-energy-orion-xs-1212-50a-dc-dc-battery-charger)
- MLS cost guides (secondary, low confidence): [Swyvl](https://swyvl.io/blog/3d-mapping-cost-guide/), [Accio](https://www.accio.com/business/lidar-mobile-mapping-system), [GeoWeek MLS overview](https://www.geoweeknews.com/articles/mobile-mapping-lidar-software-hardware-trimble-leica-riegl/)
- Lidar SLAM degeneracy: J. Zhang, M. Kaess, S. Singh, "On Degeneracy of Optimization-based State Estimation Problems," ICRA 2016.
- LAS 1.4 point formats (PDRF 6 = 30 B): ASPRS LAS 1.4 R15 specification. LAZ ratios: M. Isenburg, "LASzip: lossless compression of LiDAR data," PE&RS 79(2), 2013.
