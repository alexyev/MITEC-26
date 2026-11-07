# Submarine-Style Low-Frequency Links (ELF/VLF) and the Site Data Budget

**Team:** MITEC Hack '26 · **Date:** Nov 7, 2026
**Question:** Can we use the ELF/VLF methods from submarines on Exowatt sites? How much data do the robots actually need?

> **Important:** Exowatt has not published its data rates. The budget in Section 2 is **our engineering estimate**. It uses the message model in `BUILD_PLAN.md` and public data about autonomous machines. Confirm it with the mentors.

---

## 1. What submarines do

| Band | Frequency | Data rate | Antenna (transmitter) | Direction |
|---|---|---|---|---|
| **ELF** | 76 Hz (US Project ELF), 82 Hz (Russia ZEVS) | **A few characters per minute** (≈ 0.4 bps) | 52 km wire (Michigan); ZEVS electrodes 60 km apart; needs its own power plant | One-way, shore → submarine |
| **VLF** | 3–30 kHz | **≈ 300 bps**, no voice | Very large shore stations; the submarine trails a long wire | One-way, shore → submarine |

Source: [Wikipedia — Communication with submarines](https://en.wikipedia.org/wiki/Communication_with_submarines).

**Why submarines use it:** ELF/VLF goes **through seawater** (ELF: hundreds of meters; VLF: about 30 m). Higher frequencies do not.

**How submarines use it — the important lesson:** The low-rate channel carries only **short coded orders**. ELF was used as a "bell ringer": it tells the submarine to come near the surface, where it can use a high-rate link. The messages use strong error correction (64-symbol Reed–Solomon code).

### The industrial version: mine "through-the-earth" (TTE) radios

| System | Frequency | Data rate | Range | Antenna | Power |
|---|---|---|---|---|---|
| Vital Alert CanaryComm-IS | **1–9 kHz (VLF), unlicensed** | **Up to 1 kbps**, full duplex; voice 800 bps; text | > 300 m through rock | Loop antenna | 12 V battery, > 48 h transmitting |
| NIOSH rotating-magnet beacon (research) | ≈ 10 Hz | Morse-type (very slow) | ≈ 400 ft tested | Rotating magnets | No electrical power |

Sources: [Vital Alert product sheet](https://vitalalert.com/wp-content/uploads/2016/05/CanaryCommIS_ProductSheet_Release1.pdf), [NIOSH/CDC report](https://stacks.cdc.gov/view/cdc/218968/cdc_218968_DS1.pdf).

NIOSH also found that a **codebook** of the 3,500 most common words/phrases (under 12 bits each) can send about 99.5% of messages. A 100-character sentence then needs approximately 180 bits, not 800 bits. ([NIOSH/CDC](https://stacks.cdc.gov/view/cdc/218968/cdc_218968_DS1.pdf))

---

## 2. How much data do Exowatt's robots need?

### 2.1 The key fact: autonomous machines do not get their control loop over the radio

- Built Robotics machines have **Level 4 autonomy**: the operator is not in the cab, and the machine runs its own control on board. ([The Robot Report](https://www.therobotreport.com/blattner-awards-built-robotics-75m-contract-meet-energy-demands/))
- Thus, the network carries **supervisory data**: missions, status, position, safety and RTK corrections. It does **not** carry the steering and valve commands.
- **Teleoperation is different.** Remote driving with video needs Full-HD H.265 streams and about 40–65 ms glass-to-glass latency ([Soliton](https://solitonsystems.com/low-latency-video/remote-operation/remote-operation-of-machinery)). Mining autonomy vendors talk about less than 10–50 ms for control paths ([Skillings](https://www.skillings.net/autonomous-mining-has-a-network-problem/)). **No low-frequency link can carry this.**

### 2.2 Data budget for the whole site (37 assets, 17 machines/robots)

| Data | Size | Rate | Total |
|---|---|---|---|
| **Up:** P0 heartbeat, 17 machines | 32 B | 1 Hz | 4.4 kbps |
| **Up:** P1 position, 37 assets | 64 B | 1 Hz | 18.9 kbps |
| **Up:** P1 position, reduced mode | 24 B | 1 per 10 s | 0.7 kbps |
| **Up:** P2 task status | 128 B | 1 per min per asset | 0.6 kbps |
| **Down:** missions/commands, 17 machines | 200 B (8 B with a codebook) | 1 per min | 0.45 kbps (0.02 kbps with a codebook) |
| **Down:** zone stop / all stop / mode | 4 B code | event | ≈ 0.03 kbps |
| **Down:** RTK corrections (broadcast, one stream for all) | — | 1 Hz (machine control often 5–10 Hz) | ≈ 1–2 kbps *(estimate)* |
| **Up:** drone/GO2 survey maps, photos | MB | per few minutes | Mbps peaks (mesh only) |
| **Teleoperation video** (if used) | — | continuous | Mbps per camera (mesh/LTE only) |

RTK rates: [Carlson](https://help.carlsonsw.com/en/navigation/gnss-basics/rtk-corrections/rkt-corrections.html). The RTK bandwidth value is our estimate, because the sources do not give one.

**Totals:**
- **Uplink**, full supervisory data: **≈ 24 kbps**. With reduced positions: **≈ 6 kbps**.
- **Downlink**, commands and safety: **< 0.5 kbps**, and **≈ 0.05 kbps with a codebook**.
- **Downlink**, with RTK: **≈ 2 kbps**.

### 2.3 What fits on a VLF link (300 bps–1 kbps)?

| Data | Fits? |
|---|---|
| Zone stop / all stop / resume (64-bit frame: airtime 0.21 s at 300 bps, 0.06 s at 1 kbps) | ✅ Yes |
| Time/heartbeat beacon from the base | ✅ Yes |
| Missions with a codebook | ✅ Yes |
| "Move to the nearest relay and synchronize" (the bell-ringer order) | ✅ Yes |
| RTK corrections | ❌ No (1–2 kbps or more) |
| Positions of all assets (uplink) | ❌ No (6–24 kbps, and each asset needs a transmitter) |
| Maps, photos, video | ❌ No |

ELF (≈ 0.4 bps) is too slow even for a stop order: one 64-bit frame takes approximately 2.7 minutes.

---

## 3. Does low frequency make sense on a desert surface?

**Advantages:**
- Low frequencies do not need line of sight. They go around obstacles, such as rows of metal units and cranes.
- Dust and heat have almost no effect.
- One transmitter at the base can reach the full site, so the system does not depend on the mesh.

**Disadvantages:**
- **Antennas.** A quarter-wave antenna is ≈ 7.5 km at 10 kHz, and ≈ 990 km at 76 Hz. Small systems use magnetic **loop antennas**, which have short range. The range on a site that is several km wide, with thousands of metal units, must be tested.
- **Noise.** VLF has strong natural noise from lightning (sferics).
- **Direction.** It is good for one-way broadcast. Uplink from 37 assets is much harder, as it is for submarines.
- **The problem is different.** Submarines need **penetration**. Our site needs **range around obstacles**. LoRa at 915 MHz already gives low-rate, long-range links with an antenna of a few centimeters.

**Conclusion:** Use the submarine **architecture**, not necessarily the submarine **frequency**.

---

## 4. Adaptation for Exowatt: the "Bell-Ringer" safety broadcast channel

A one-way, low-rate channel from the site base to all machines. It is independent of the mesh, and it has priority over all other data.

1. **Always-on beacon:** The base sends a short signed beacon each second (time + site mode). If a machine does not receive the beacon for T seconds, it goes into degraded mode. This gives the machine a "network is alive" signal even when the mesh fails.
2. **Codebook orders** (12-bit codes, as in the NIOSH study): `ZONE_STOP(zone)`, `ALL_STOP`, `RESUME`, `RETURN_TO_BASE`, `HOLD_LIFT`, `STORM_MODE`.
3. **"Surface to sync"** (as the ELF bell ringer does): `GO_TO_RELAY(asset_id)` tells an offline robot to move to the nearest relay, synchronize its full queue on the mesh, and then continue.
4. **Strong error correction** and repetition, because each order is short and important.

**Hardware options:**

| Option | For | Against |
|---|---|---|
| **A. LoRa broadcast (915 MHz, slowest data rate)** | Cheap, small antennas, already in our design | Needs line of sight more than VLF; shares band with the LoRa uplink |
| **B. VLF/LF magnetic loop** (for example, a TTE-type radio or a loop at the site base) | Goes around metal; independent band; robust to dust | Large loops, range not known on a site, natural noise; check FCC rules (VLF below 9 kHz is not allocated; Vital Alert calls 1–9 kHz unlicensed) |
| **C. Both** (recommended for the pitch) | Two independent broadcast paths for safety | More cost |

**Pitch point:** *"Like a submarine, every machine always has a slow but unbreakable channel for the orders that matter, and it uses the fast mesh for everything else."*

---

## 5. Changes for `BUILD_PLAN.md` (if the team agrees)

1. Add a bearer `bell` (broadcast-only, base → all): 300 bps, site-wide range, obstruction loss = 0 dB, natural noise ignored. A `bellReliability` value in config (for example, 0.99 per frame).
2. Send P0 broadcast orders (`ZONE_STOP`, `ALL_STOP`, beacon) on `bell` **and** on the mesh/LoRa.
3. Add the `GO_TO_RELAY` behavior: an offline asset with full queues moves to the nearest relay, synchronizes, and goes back to its task. Count the time lost.
4. Add a stress test "Mesh down site-wide": positions stop, but stop orders still arrive through `bell` with ≈ 0.2 s airtime.
5. Add a KPI "Data budget": current uplink and downlink bps per bearer against the capacity of each bearer.

---

## Sources

- [Wikipedia — Communication with submarines](https://en.wikipedia.org/wiki/Communication_with_submarines)
- [Wikipedia — Project Sanguine / ELF](https://en.wikipedia.org/wiki/Project_Sanguine)
- [Vital Alert — CanaryComm-IS product sheet](https://vitalalert.com/wp-content/uploads/2016/05/CanaryCommIS_ProductSheet_Release1.pdf)
- [NIOSH/CDC — Through-the-earth communication report](https://stacks.cdc.gov/view/cdc/218968/cdc_218968_DS1.pdf)
- [The Robot Report — Blattner and Built Robotics (Level 4 autonomy)](https://www.therobotreport.com/blattner-awards-built-robotics-75m-contract-meet-energy-demands/)
- [Soliton — Remote operation of machinery (latency)](https://solitonsystems.com/low-latency-video/remote-operation/remote-operation-of-machinery)
- [Skillings — Autonomous mining has a network problem](https://www.skillings.net/autonomous-mining-has-a-network-problem/)
- [Carlson — RTK correction formats and update rates](https://help.carlsonsw.com/en/navigation/gnss-basics/rtk-corrections/rkt-corrections.html)
