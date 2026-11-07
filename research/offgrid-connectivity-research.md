# Off-Grid Connectivity for Robot-Assisted Energy Deployment — Research and Solution Options

**Team:** MITEC Hack '26 (4 people) · **Challenge:** Exowatt · **Date:** Nov 7, 2026

> **Purpose of this document:** It tells how industry connects machines today on sites with no fiber and no cell coverage. It examines our two first ideas (Bluetooth, and "every device can reroute"). It gives solution options and a 24-hour build plan that agrees with the three parts in the Exowatt video: **Model, Connect, Stress-test**.

---

## 1. The problem in one page

- Exowatt P3 units are modular. Each unit has the footprint of a 40 ft shipping container and supplies up to 24 h of dispatchable power and heat. One site can have **thousands** of units.
- Good sites are in deserts, **far from fiber and outside cell coverage**.
- During construction, these assets work at the same time: drones, a quadruped survey robot (GO2), pile rigs, trenchers, cranes, carriers and crews.
- Each asset must share 3 types of data: **position, task status and safety information**.
- The site **changes every day**. The video shows this failure: with 1 base station, all 30 of 30 assets are online at 315 units. When the build front moves past the radio coverage, only **6 of 37** are online at 1,406 units, and only **3 of 37** at 1,668 units.

**What Exowatt shows as "good" (illustrative values from the video):**

| Part | Question | Metrics they show |
|---|---|---|
| 01 Model | How does the site change as the build moves forward? | Build day, units deployed, assets tracked |
| 02 Connect | Are all robots, machines and people connected and coordinated? | Links up, assets online (37/37), updates on time (99%) |
| 03 Stress-test | What happens when links fail, and what does the solution cost? | Assets online (35/37), **safety latency (2.4 s)**, **hardware cost ($41k)**, **power (1.7 kW)**, site coverage against a **95% target** (falls to 84% when one relay fails) |

**Conclusion:** The judges want a design, a simulated "site twin" that proves it, and honest numbers about failure and cost. Exowatt says: *"We build every site in software before we build it in the field."* Our demo must do the same.

---

## 2. How industry solves this today

### 2.1 Open-pit mining — the closest match

Mines have the same problem: large off-grid areas, heavy autonomous machines, and a layout that changes every day as the pit moves.

- **Self-healing mesh where each vehicle is a node.** Rajant "Kinetic Mesh" networks are certified for **Komatsu FrontRunner** autonomous haulage and for Epiroc autonomous drills. Caterpillar completed validation of Rajant radios with **Cat MineStar Command** for hauling. Each node has **several radios on different frequencies**. Traffic goes through moving vehicles, and the routing protocol (InstaMesh) selects the best path as the topology changes. Thus, each truck extends the network. ([Rajant/Caterpillar](https://rajant.com/blog/caterpillar-validates-rajant-wireless-solution-with-cat-minestar-command-for-hauling/), [Rajant/Komatsu](https://rajant.com/blog/rajant-achieves-certification-for-komatsus-frontrunner-autonomous-haulage-solution-ahs/), [Metal Tech News](https://metaltechnews.com/story/2022/07/27/mining-tech/rajant-wireless-tech-for-komatsu-haul-trucks/1020.html))
- **Safety does not depend on the main network.** Mining collision-avoidance systems use **vehicle-to-vehicle (V2V)** radio links. Each machine calculates its own stopping distance from the speed and position of other machines. The alerts have 3 levels (awareness → advisory → urgent), and the system can stop the machine. The applicable standard is **ISO 21815**. If the network delay is near 1 s, the machine must stop **locally**. ([Mining Technology / TORSA](https://www.mining-technology.com/sponsored/a-high-tech-solution-thats-driving-collision-avoidance/))
- **Utilities and heavy industry also use private LTE** (for example, in the CBRS band in the US) as a managed network that they own. ([Black & Veatch](https://www.bv.com/perspectives/utility-private-lte-the-backbone-of-a-resilient-responsive-and-safer-grid))

### 2.2 Robots in communication-denied areas — DARPA Subterranean Challenge

Team CERBERUS won the DARPA SubT Challenge underground, where no GPS or cell signal is available. Their method applies directly to our problem ([CERBERUS paper, arXiv 2207.04914](https://arxiv.org/pdf/2207.04914)):

- **Robots carry mesh radios** (Rajant DX2, 5.8 GHz). Each robot is a mesh node and a Wi-Fi access point.
- **Robots drop "breadcrumb" relays.** Each carrier robot holds up to 4 relays (245 g, 2 h battery each) and drops them to extend the network. A human selected the drop locations because radio propagation was hard to predict.
- **Robots continue to work when offline.** Localization and mapping run on the robot. If a robot loses the link, a "Wi-Fi Safety" behavior moves it back along its path until the link returns. Data collected offline is **stored and sent later**.
- **Only important data goes on the radio.** Heartbeat, telemetry, detections and map pieces always go. Camera streams go only from the robot that the operator selects. The system integrates only map pieces that arrived complete.

### 2.3 Drones and military robots — MANET radios

- Silvus StreamCaster and Doodle Labs Mesh Rider radios make **mobile ad-hoc networks (MANET)**. These networks connect and repair themselves automatically, and they are used on drones and ground robots. Team CoSTAR (NASA JPL) used Silvus radios in DARPA SubT. ([Doodle Labs](https://doodlelabs.com/smart-radio), [Silvus/CoSTAR](https://iconnect007.com/article/121814/silvus-technologies-radios-used-by-team-costar-in-darpa-subterranean-challenge/121817/flex))

### 2.4 Construction sites today

- The usual method is: **Starlink for the internet connection**, a router and Wi-Fi access points on the site, and a 4G/5G backup link where coverage exists. Starlink latency is typically **25–50 ms**. Starlink has limits: the dish needs a clear view of the sky, and **cranes and steel structures can block it**. ([Active Digital](https://www.activedigital.co.uk/insights/connectivity/starlink-construction-sites/))
- **Solar construction robots need a data link too.** The Built Robotics RPD 35 autonomous pile driver uses **RTK GPS**, installs more than 300 piles per day with a crew of two, and can work at night. ([Equipment Journal](https://www.equipmentjournal.com/tech-news/built-robotics-develops-the-1st-fully-autonomous-solar-piling-system/)) RTK needs a correction stream from a base station. Thus, connectivity is necessary for **precision**, not only for coordination.

### 2.5 Software for bad links — what robot teams use

- At the Indy Autonomous Challenge, standard ROS 2 (DDS) discovery traffic was "extremely problematic" over Wi-Fi. Teams kept DDS **local on each vehicle** and used **Zenoh** across the radio, with UDP (not TCP), a list of permitted topics, and **rate limits for each topic** (position at 10 Hz, emergency stop at 20 Hz). ([Zenoh blog](https://zenoh.io/blog/2021-09-28-iac-experiences-from-the-trenches/))
- **Delay-tolerant networking (DTN)** and "data mules" (moving robots that carry data between disconnected groups) are a known research area for robots that are disconnected. ([JPL poster](https://www.jpl.nasa.gov/site/research/media/posters/2019/R16059p.pdf), [arXiv](https://arxiv.org/pdf/2003.13813))

**Lessons from industry:**
1. Make **each machine a relay** (mesh), and do not use one tower.
2. Use **more than one radio type** (different ranges and frequencies).
3. **Safety must work locally**, without the backhaul.
4. **Robots must continue safely when offline** and synchronize later.
5. **Send only the data that is necessary**, with priorities.
6. **Plan where relays go**, because coverage is hard to predict.

---

## 3. Examination of our first ideas

### 3.1 Idea A: Bluetooth instead of cell towers

**Data:**
- In a Nordic Semiconductor test outdoors with good line of sight, Bluetooth LE had a range of approximately **650 m** at 1 Mbps. With "Coded PHY" (long-range mode), the range was approximately **1.3 km**, but only at **125 kbps**. ([Nordic](https://blog.nordicsemi.com/getconnected/tested-by-nordic-bluetooth-long-range)) These are best-case results.
- Bluetooth uses the **2.4 GHz band**, which is crowded. Outdoor links can have interference and frequent dropouts. ([mfgrobots](https://www.mfgrobots.com/Article/iiot/iot/4219.html))
- A P3 site is a **field of metal containers and mirrors**. Metal blocks and reflects 2.4 GHz signals. The real range will be much less than the test range.
- Bluetooth Mesh uses **managed flooding**: each message is retransmitted by many nodes. This works for a small number of nodes. With many assets that send positions many times each second, flooding uses all the available airtime.

**Verdict:** Bluetooth is **not a good backbone** for a site that is several kilometers wide. It is **a good local layer**:
- Worker badges or phones that send short-range BLE beacons ("a person is near this machine").
- A connection from a worker phone to the nearest relay.
- Fixed BLE beacons on installed P3 rows to help position people and robots locally.

**Recommendation:** Keep Bluetooth in the design, but use it only for the **last 10–50 m** (people and proximity). Use a long-range radio for the backbone.

### 3.2 Idea B: "Enable everything, so if one link fails, the data goes another way"

**This idea is correct, and industry uses it.** It is the same principle as Rajant Kinetic Mesh in mines and MANET radios on drones. It also includes **multi-bearer** routing: if radio 1 fails, the message goes on radio 2.

**Problems to solve:**
1. **Moving relays go away.** If a crane is a relay and it moves, the crew behind it loses the link. The network must also have **fixed relays** at the correct locations.
2. **Flooding costs airtime.** If each node retransmits each message, the network fails at scale. Use **routing with message priorities**, not flooding of all data.
3. **The build front moves.** Relays must **advance with the build**, as the CERBERUS breadcrumbs did.
4. **Failure is not optional.** Some links will fail. The design must show **what the system does during a failure** (Stress-test), not only how it prevents failure.

---

## 4. Radio options

| Technology | Range (from sources) | Data rate | Good for | Not good for |
|---|---|---|---|---|
| **Bluetooth LE / Coded PHY** | ~650 m (1M) / ~1.3 km (Coded), line of sight, best case | 1 Mbps / 125 kbps | Badges, phones, proximity, local beacons | Site backbone, many nodes |
| **LoRa (for example, Meshtastic)** | "Several km" | Low. Payload is a maximum of 239 bytes per packet | Small safety heartbeats and positions over long distance, very low power | Video, maps, large task data |
| **Wi-Fi HaLow (802.11ah, ~900 MHz)** | Record of **16 km** at 2 Mbps (Joshua Tree, line of sight). Typical industrial: "a few hundred meters" | Up to 7.8 Mbps (2 MHz channel) | Medium data over long range with Wi-Fi/IP tools | New technology, few vendors |
| **5 GHz Wi-Fi mesh / MANET (Rajant, Silvus, Doodle Labs)** | Shorter per hop, extended by hops | High (video possible) | Autonomous machines, robot telemetry, RTK, video | Cost and power per node |
| **Private LTE / CBRS** | Large cell, managed | High | A planned network that the owner controls | Needs a tower, spectrum, setup time |
| **Starlink** | Satellite | High, 25–50 ms latency | **Backhaul** to the internet and the Exowatt cloud | On-site links; sky view blocked by cranes |
| **UWB** | Short | — | Accurate proximity and ranging (person ↔ machine) | Site-wide links |

Sources: [Nordic](https://blog.nordicsemi.com/getconnected/tested-by-nordic-bluetooth-long-range), [Meshtastic](https://meshtastic.org/docs/overview/), [eeNews Europe](https://www.eenewseurope.com/en/halow-hits-record-16km-wifi-distance-at-900mhz), [imec](https://www.imec-int.com/en/articles/wi-fi-halow-promising-connectivity-technology-large-scale-industrial-iot-deployments), [Active Digital](https://www.activedigital.co.uk/insights/connectivity/starlink-construction-sites/), [Mining Technology](https://www.mining-technology.com/sponsored/a-high-tech-solution-thats-driving-collision-avoidance/).

**Conclusion:** No single radio is sufficient. The best design uses **layers**: a small, robust layer for safety; a medium layer for task data; a local layer for people; and a satellite link for the cloud.

---

## 5. Solution concepts

### Concept 1 — "The network grows with the build" (relays on installed P3 units) ⭐ strongest Exowatt-specific idea

**Key observation:** The installed P3 units **make power** and **stay in position**. Each installed row can hold a small relay node that gets power from the unit. The network then **grows at the same rate as the build** and does not stay behind it. This solves the failure that the video shows (Stage 02: the build front moves past the network).

- The digital twin knows the build schedule. It **predicts the coverage for each future build day** and tells the crew or a robot where to put the next relay.
- At the build front, before units are installed, **robots carry and drop temporary relays** (for example, the GO2 or the carrier), as CERBERUS did. Later, a permanent relay on the P3 row replaces each temporary relay.
- After construction, the same relays are used for **operation and maintenance** of the site.

### Concept 2 — Layered multi-bearer mesh with message priorities

Each asset has 2 or more radios. A small "router" agent on each asset selects the bearer for each message:

| Priority | Message | Size and rate | Bearer order |
|---|---|---|---|
| P0 — Safety | E-stop, "person near machine", geofence violation | Very small, event + heartbeat 1–5 Hz | V2V local + LoRa + mesh (send on **all**) |
| P1 — Position | Position, heading, speed | Small, 1–10 Hz | Mesh → LoRa (reduced rate) |
| P2 — Task status | Task start/complete, pile N installed | Small, event | Mesh → store-and-forward |
| P3 — Bulk | Survey maps, photos, logs | Large | Mesh when available, or carried by a data mule; Starlink to the cloud |

The key rule: **when the link quality decreases, the system drops bulk data first and keeps safety data.**

### Concept 3 — Coordination that tolerates disconnection (local-first)

- Each asset keeps a **local copy of the site plan and its task list**. It continues to work when offline (as CERBERUS robots did).
- Task status uses data structures that merge without conflict (**CRDTs**, or a log with a sequence number for each asset). When a link returns, the data synchronizes automatically.
- **Data mules:** drones and carriers already move across the site. They carry queued messages between disconnected zones.
- **Safe degraded mode:** If a robot loses the P0 heartbeat for more than T seconds, it slows down, then stops or moves back to the last point with a good link. Machines with human operators get a warning on the display.

### Concept 4 — Safety independent of the network

- Use **direct V2V** and short-range BLE/UWB between people and machines, as mining collision-avoidance systems do (ISO 21815).
- The machine stops **locally**. It does not wait for the base station.
- This is how we get a low **safety latency** number in the Stress-test (the video uses 2.4 s as an example; local V2V can be much faster).

### Concept 5 — Aerial relay (option)

- A drone, possibly tethered to a vehicle for power, can hover over a dead zone as a temporary relay when a fixed relay fails. This is a good Stress-test response: "relay R3 failed → drone relay is in position in 4 minutes → coverage goes back above 95%."

### Recommended combination

**Concepts 1 + 2 + 3 + 4**, with Concept 5 as a recovery action in the stress test. Name idea: **"Breadcrumb"** or **"Build-Front Mesh"**.

One sentence for the pitch: *"The network grows with the build: every P3 we install becomes a powered relay, robots drop temporary relays at the build front, and every machine keeps working safely when its link fails."*

---

## 6. What we build in 24 hours

The judges cannot visit a desert site. The video tells us what they expect: a **simulated site twin** with metrics. Our main deliverable is a simulator and dashboard. A small hardware demo is optional.

### 6.1 Simulator (the core)

1. **Site model:** A grid of P3 units (for example, 2,000+ units in blocks with roads), a site base, and a build schedule (units installed per day, build-front position).
2. **Assets:** Approximately 37 assets (pile rigs, trenchers, cranes, carriers, crews, GO2, drones). Each asset has a task and a path that moves with the build front.
3. **Radio model:** For each radio type, a log-distance path-loss model plus an extra loss for each row of installed metal units between two nodes. A link is "up" if the received signal is above the sensitivity. *(The model is simple, but it shows the effect of the site.)*
4. **Routing:** Shortest path on the graph of links, weighted by link quality, for each bearer. Fallback to the next bearer. Queue for store-and-forward.
5. **Relay planner:** For each build day, a greedy algorithm adds relays (on installed P3 rows, or dropped by a robot at the front) until coverage ≥ 95%.
6. **Failure injection:** Disable a relay, a bearer, or Starlink. Add a dust storm (more path loss). Add a crane that blocks a link.
7. **Metrics (the same as the video):** assets online, coverage %, updates on time %, safety latency (P0), number of relays, **hardware cost**, **power**.

### 6.2 Dashboard

- A top-down map of the site, with a time slider for build day. Show assets, links, relays and dead zones (red).
- A metrics panel and a coverage chart against the 95% target.
- Buttons: "Fail relay", "Fail backhaul", "Dust storm". Comparison of **"1 base station" (Exowatt's failure case)** against **"our design"**.

### 6.3 Optional hardware demo (if time permits)

- 3 LoRa boards (for example, with Meshtastic firmware) or 3 ESP32 boards: node A → B → C. Disconnect B. Show that the message goes another way (direct A → C at a lower rate, or a different bearer), or show that it is queued and delivered when B returns.
- Alternative with no hardware: 3 laptops or phones on BLE + Wi-Fi with a small router script that shows bearer fallback.

### 6.4 Suggested stack

- **Simulator:** Python (NumPy + NetworkX) or TypeScript, run in the browser for an easy demo.
- **Dashboard:** React + a canvas/SVG map (or deck.gl), and a chart library.
- Keep it in **one repository** (`MITEC-26`) with folders `sim/`, `web/`, `hardware/`, `pitch/`.

### 6.5 Roles for 4 people

| Person | Responsibility |
|---|---|
| 1 | Site model + build schedule + asset movement (Model) |
| 2 | Radio model + routing + relay planner (Connect) |
| 3 | Dashboard + failure buttons + charts (Stress-test display) |
| 4 | Cost and power model, hardware demo, pitch deck, and contact with Exowatt mentors |

### 6.6 Timeline (24 h)

| Hours | Work |
|---|---|
| 0–2 | Agree on the design and the data format between simulator and dashboard. Ask mentors the questions in Section 8. |
| 2–8 | Build the site model, radio model, and a first map. |
| 8–14 | Routing, relay planner, metrics. Connect the simulator to the dashboard. |
| 14–18 | Failure injection and comparison "1 base station vs our design". Hardware demo. |
| 18–21 | Cost/power numbers, pitch, demo script. |
| 21–24 | Test the demo, record a backup video, rest. |

---

## 7. Cost and power model (to complete)

Exowatt asks "what does it cost?" We must show a cost and power total for the design. **All values below are placeholders. Get real prices before the pitch.**

| Item | Quantity (example) | Unit cost | Unit power | Notes |
|---|---|---|---|---|
| Mesh relay on P3 row | 1 per N rows | TBD | TBD | Power from the P3 unit |
| Temporary relay (robot-dropped, battery) | 6–10 | TBD | TBD | Reused as the front moves |
| Radio kit on each asset (mesh + LoRa) | ~37 | TBD | TBD | |
| Worker badge (BLE/UWB + LoRa) | per worker | TBD | Battery | |
| Starlink terminal at site base (+ backup) | 1–2 | See [Active Digital](https://www.activedigital.co.uk/insights/connectivity/starlink-construction-sites/) | TBD | Put it away from cranes |
| RTK base station | 1 | TBD | TBD | Corrections go over the mesh |

**Strong point for the pitch:** The relays on P3 rows use power from the site itself. Thus, the network needs **almost no extra generators** as it grows.

---

## 8. Questions to ask Exowatt mentors

1. What is the typical site size (km², units) and build rate (units per day)?
2. Which robots and machines do you use or plan to use, and which radios do they have now?
3. Is there any connectivity on the site today (Starlink, private LTE, handheld radios)?
4. Can a relay get power from an installed P3 unit? Can we put an antenna on the unit frame?
5. Which data has the most importance: safety, RTK corrections, task status, or survey data?
6. What safety latency is acceptable to you?
7. Is there a budget target for the network per site?

---

## 9. Risks and limits

- Our radio model is simplified. Real metal reflections and desert heat effects are not modeled exactly. We must say this clearly.
- Spectrum rules: LoRa and HaLow in the US use unlicensed sub-GHz bands with power and dwell-time limits. Private LTE needs a CBRS license (or similar).
- Range numbers from records (16 km HaLow, 1.3 km BLE) are **best cases** with line of sight. Do not use them as typical values.
- Some sources in this document are from vendors (Rajant, TORSA, Doodle Labs, Silvus). Their claims are not independent tests.

---

## Sources

- [Rajant — Caterpillar validates Rajant wireless with Cat MineStar Command for hauling](https://rajant.com/blog/caterpillar-validates-rajant-wireless-solution-with-cat-minestar-command-for-hauling/)
- [Rajant — Certification for Komatsu FrontRunner AHS](https://rajant.com/blog/rajant-achieves-certification-for-komatsus-frontrunner-autonomous-haulage-solution-ahs/)
- [Metal Tech News — Rajant wireless tech for Komatsu haul trucks](https://metaltechnews.com/story/2022/07/27/mining-tech/rajant-wireless-tech-for-komatsu-haul-trucks/1020.html)
- [Mining Technology (TORSA, sponsored) — Collision avoidance](https://www.mining-technology.com/sponsored/a-high-tech-solution-thats-driving-collision-avoidance/)
- [Black & Veatch — Utility private LTE](https://www.bv.com/perspectives/utility-private-lte-the-backbone-of-a-resilient-responsive-and-safer-grid)
- [Team CERBERUS — DARPA SubT technical overview (arXiv 2207.04914)](https://arxiv.org/pdf/2207.04914)
- [Doodle Labs — Mesh Rider radios](https://doodlelabs.com/smart-radio)
- [Silvus radios used by Team CoSTAR in DARPA SubT](https://iconnect007.com/article/121814/silvus-technologies-radios-used-by-team-costar-in-darpa-subterranean-challenge/121817/flex)
- [Active Digital — Starlink for construction sites](https://www.activedigital.co.uk/insights/connectivity/starlink-construction-sites/)
- [Equipment Journal — Built Robotics autonomous solar piling system](https://www.equipmentjournal.com/tech-news/built-robotics-develops-the-1st-fully-autonomous-solar-piling-system/)
- [Zenoh — Experiences from the Indy Autonomous Challenge](https://zenoh.io/blog/2021-09-28-iac-experiences-from-the-trenches/)
- [NASA JPL — DTN for multi-robot (poster)](https://www.jpl.nasa.gov/site/research/media/posters/2019/R16059p.pdf)
- [PDRA middleware for mobile robotic networks (arXiv 2003.13813)](https://arxiv.org/pdf/2003.13813)
- [Nordic Semiconductor — Tested by Nordic: Bluetooth Long Range](https://blog.nordicsemi.com/getconnected/tested-by-nordic-bluetooth-long-range)
- [mfgrobots — Bluetooth sensor network range limits](https://www.mfgrobots.com/Article/iiot/iot/4219.html)
- [Meshtastic — Mesh algorithm overview](https://meshtastic.org/docs/overview/)
- [eeNews Europe — HaLow 16 km record](https://www.eenewseurope.com/en/halow-hits-record-16km-wifi-distance-at-900mhz)
- [imec — Wi-Fi HaLow for industrial IoT](https://www.imec-int.com/en/articles/wi-fi-halow-promising-connectivity-technology-large-scale-industrial-iot-deployments)
- [New Equipment Digest — Exowatt P3](https://www.newequipment.com/55325167)
- Exowatt challenge document and challenge video (MITEC Hack '26)
