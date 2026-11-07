# Exowatt — Company, Site Construction, Robots, and How Our Solution Applies

**Team:** MITEC Hack '26 (4 people) · **Date:** Nov 7, 2026
**Related document:** `research/offgrid-connectivity-research.md` (industry methods and solution concepts)

> **Important:** Exowatt has published **very little** about how it builds sites or which robots it uses. This document clearly separates three types of information:
> - **[Public]** — from a published source (link given).
> - **[Video]** — from the Exowatt challenge video and document.
> - **[Inference]** — our own conclusion. Confirm it with the Exowatt mentors.

---

## 1. Company snapshot

| Item | Data | Type |
|---|---|---|
| Founded | 2023, Miami, Florida. Incubated by Atomic (venture studio) | [Public] ([Contrary](https://research.contrary.com/company/exowatt), [Wikipedia](https://en.wikipedia.org/wiki/Exowatt)) |
| CEO | **Hannan Happi** — mechanical engineer (GE, Siemens, Tesla). Co-founded **Volansi, a drone company** (sold to Sierra Nevada in 2022) | [Public] ([Contrary](https://research.contrary.com/company/exowatt)) |
| Chairman | Jack Abraham (founder of Atomic) | [Public] |
| Funding | $20M seed, Apr 2024 (a16z, Sam Altman) · $70M Series A, Apr 2025 (Felicis; $35M equity + $35M debt) · $50M extension, Nov 2025. Total ≈ **$140M** | [Public] ([Contrary](https://research.contrary.com/company/exowatt), [DCD](https://www.datacenterdynamics.com/en/news/exowatt-raises-70m-in-series-a-funding-touts-90gwh-pipeline-from-data-center-market/), [Exowatt](https://www.exowatt.com/news/www-exowatt-com-news-series-a-additional-50m-press-release)) |
| Employees | ≈ 96 | [Public] ([Contrary](https://research.contrary.com/company/exowatt)) |
| Customers | AI data centers and hyperscalers. Reported backlog > **90 GWh**, but much of it is preliminary agreements. No customer or site has been named publicly | [Public] ([Contrary](https://research.contrary.com/company/exowatt), [Latitude Media](https://www.latitudemedia.com/news/exowatt-is-embracing-a-new-business-model/)) |
| Manufacturing | Factory-built in container form. **11-acre Austin, TX campus** (48,000 sq ft office + manufacturing), opened Mar 2026 | [Public] ([Business Wire](https://www.businesswire.com/news/home/20260318523897/en/Exowatt-Expands-to-Austin-as-AI-Driven-Power-Demand-Reshapes-U.S.-Energy-Infrastructure)) |
| Software | A **digital twin** for monitoring and predictive maintenance, made with **NVIDIA and AWS** | [Public] ([Contrary](https://research.contrary.com/company/exowatt)) |

### ExoRise — the business that makes our challenge real

- In **January 2026**, Exowatt launched **ExoRise**. ExoRise supplies **powered land** for hyperscale data centers: land, P3 power with storage, and modular data-center shells. ([Utility Dive](https://www.utilitydive.com/news/sam-altman-backed-exowatt-launches-arm-to-power-data-centers-with-renewable/810727/), [ESG Today](https://www.esgtoday.com/exowatt-launches-land-and-clean-energy-solutions-business-for-hyperscale-data-centers/))
- The sites are **behind-the-meter and off-grid**, in the US Southwest: **New Mexico, West Texas, Arizona and Nevada**. [Public]
- The **first ExoRise pilot is planned for the end of 2026**. [Public]
- **Conclusion:** Exowatt now **builds its own sites** on remote land. Thus, connectivity during construction is **their own problem**, not a customer's problem. This is why they set this challenge. [Inference]

---

## 2. The P3 unit — what we must know for the network design

| Property | Value | Type |
|---|---|---|
| Size | Footprint of a **40 ft (12 m) shipping container** | [Public] ([New Equipment](https://www.newequipment.com/55325167)) |
| How it works | **Fresnel lenses that track the sun** focus light → **thermal battery** (sand/slag-type materials, no moving parts in the cell) → air moves heat to a **Stirling-type heat engine** → electricity and heat | [Public] ([Contrary](https://research.contrary.com/company/exowatt)) |
| Storage temperature | 500–800 °C ([Parallax](https://parallax.industries/articles/exowatt-exowatts-p3-claim-under-4-cents-per-kwh-289)); ≈ 1,000 °C ([Contrary](https://research.contrary.com/company/exowatt)). The sources do not agree | [Public] |
| Output | Base module ≈ **25 kWh electrical output**, 150 kWh thermal storage. Up to 24 h of dispatch | [Public] ([Parallax](https://parallax.industries/articles/exowatt-exowatts-p3-claim-under-4-cents-per-kwh-289)) |
| Module price | ≈ $7.5k for a standard 25 kWh module | [Public] ([Contrary](https://research.contrary.com/company/exowatt)) |
| Land | ≈ **1 acre per MWh** of dispatchable capacity. An old calculator gave up to **1,123 acres** for 50 MW over 24 h | [Public] ([Parallax](https://parallax.industries/articles/exowatt-exowatts-p3-claim-under-4-cents-per-kwh-289), [Latitude Media](https://www.latitudemedia.com/news/exowatt-is-embracing-a-new-business-model/)) |
| Maintenance | Periodic service of the generator and the **tracking mechanisms** | [Public] ([Contrary](https://research.contrary.com/company/exowatt)) |

**What this means for our design:**
1. **Each unit is a metal box.** Metal blocks radio signals. Rows of installed units make "radio shadows". The radio model must include this. [Inference]
2. **Each unit makes electricity** and stays in position for decades. A small relay can get power from it. [Inference]
3. **Sites are very large.** A 1,100-acre site is approximately 4.5 km². This is too large for Bluetooth and for one base station. [Inference from Public data]
4. **Each unit has moving parts (trackers) and a heat engine.** After construction, the units need monitoring. The same network can send this data to Exowatt's digital twin. [Inference]
5. **Unit count:** The video shows ≈ 2,200 units on build day 200. If "25 kWh" is per unit per day, a 50 MW × 24 h site (1,200 MWh) needs many more units. **Ask the mentors** for a typical site size. [Inference]

---

## 3. How Exowatt installs a site

### 3.1 What is public

Exowatt has **not published** a construction method. A job posting for **Manager, Field Operations** gives these facts ([The Ladders](https://www.theladders.com/job/manager-field-operations-exowatt-miami-fl_87189967)):

- Field Operations covers: **pre-contract site visits, permitting, delivery, startup, commissioning, and field service**.
- Site readiness includes **civil work, electrical work, interconnection, permitting and access logistics**.
- Work is done by **Exowatt field service technicians and third-party partners**.
- At this time, **no one person owns end-to-end deployment**. The work is spread across teams "on an ad hoc basis".
- Exowatt expects **2–3 deployments in the next 12–18 months**.

**Conclusion:** Exowatt's deployment process is **new and not yet standard**. A tool that coordinates assets and tracks the status of each unit has real value for them now. [Inference]

### 3.2 Construction sequence from the challenge video [Video]

| Step | Work | Assets in the video | Data that must move |
|---|---|---|---|
| 1. Survey | Map the land, mark positions | Aerial drones, quadruped robot (**"GO2"**) | Maps (large), positions |
| 2. Foundations | Drive piles for each unit | **Pile rig** | Positions with high accuracy (RTK), "pile N done" |
| 3. Trenches | Dig trenches for cables | **Trencher / excavator** | Path, progress, safety zones |
| 4. Delivery | Bring units on trucks and site carriers | **Trucks, carriers** | Route, location, delivery status |
| 5. Placement | Lift each unit onto its foundation | **Cranes**, crews | Lift zone safety, unit ID, position |
| 6. Connection and commissioning | Connect cables, test, start the unit | **Crews** | Task status, test results |
| 7. Operation | Units run "from first light to long after dark" | — | Unit health, tracker status |

The video shows that all of these work **at the same time**, and the **build front moves across the site**. The work also continues at night ("around the clock").

---

## 4. Which robots Exowatt uses

### 4.1 What we know

- **Exowatt has not publicly named its construction robots.** No published article or press release that we found mentions robots. [Public: absence]
- **The challenge video shows:** aerial drones; a quadruped robot labeled **"GO2"** (it looks like a **Unitree Go2**); and pile rigs, trenchers, cranes and carriers that appear to work autonomously or semi-autonomously. [Video]
- **The CEO co-founded a drone company (Volansi).** Thus, drones are probably an important part of their plans. [Inference]

### 4.2 Robots that the solar construction industry uses now (likely partners or examples)

| Company | Robot | What it does | Relevance to Exowatt |
|---|---|---|---|
| **Built Robotics** | RPD 35 autonomous pile driver; "Exosystem" autonomy kit for excavators, bulldozers, loaders (Level 4 autonomy) | RPD 35: survey, distribution, driving and inspection of piles; > 300 piles/day with a crew of 2; **RTK GPS**; works at night. **$75M contract with Blattner (Jul 2026)** after 7 solar projects > 1 GW | Pile rig and trencher in the video. Needs **RTK correction data** over the network |
| **Maximo (AES)** | Module-installation robot | > 1 module/minute; 100 MW installed at Bellefield, CA; fleet of 4 robots in parallel; built with **AWS and NVIDIA Isaac Sim** | Shows robot **fleets** on solar sites, and the same NVIDIA/AWS tools as Exowatt's digital twin |
| **Gritt** | Robotics on standard construction equipment | Places and assembles solar arrays, concrete, rebar | Example of retrofit autonomy |
| **Unitree** | Go2 quadruped | Survey and inspection platform | Shown in the video |

Sources: [Equipment Journal](https://www.equipmentjournal.com/tech-news/built-robotics-develops-the-1st-fully-autonomous-solar-piling-system/), [The Robot Report](https://www.therobotreport.com/blattner-awards-built-robotics-75m-contract-meet-energy-demands/), [PV Tech — Maximo](https://www.pv-tech.org/youre-going-to-see-a-lot-more-of-these-maximo-on-robotic-installation-utility-scale-solar-projects/), [PV Tech — Gritt](https://www.pv-tech.org/burns-mcdonnell-gritt-partner-on-ai-powered-solar-construction/).

**Notes:**
- These robots come from **different vendors**, with **different radios and software**. A good solution must connect **mixed fleets** through a common gateway on each machine. It must not require one vendor. [Inference]
- None of these sources describes how the fleets communicate on site. This is a gap that our solution can fill. [Public: absence]
- Other startups also build off-grid power plants for data centers with robot fleets. For example, a company named TAR posted a robotics job for automated racking, module placement and civil works "across hundreds of acres of West Texas", with ROS 2 and fleet coordination ([Built In](https://www.builtinaustin.com/job/founding-robotics-engineer/10494537)). **TAR is not Exowatt.** It shows that this problem is common in the industry.

---

## 5. How our solution applies to Exowatt

Our recommended design (from the connectivity research): **a network that grows with the build**, with layered radios, message priorities, offline-safe coordination and local safety. The specific Exowatt applications are below.

### 5.1 Each commissioned P3 becomes a relay

- Step 6 in the sequence (commissioning) is the point where a unit makes power. At this step, the crew **activates a small relay on the unit** (or the relay is installed in the factory in Austin). [Inference]
- Thus, **the network follows the build front automatically**. This solves the failure in the video (6 of 37 assets online when the build moves past the base station).
- **Put the antenna outside the metal container**, for example on the lens/tracker frame, which is the highest point. [Inference — ask mentors]
- **Not all units need a relay.** The planner selects 1 unit in each N units to reach 95% coverage at the lowest cost.

### 5.2 Robots drop temporary relays at the build front

- Before units are commissioned, the front has no powered units. The GO2 or a carrier **drops battery relays** at the front, as the DARPA SubT winners did. When the next row is commissioned, the robot collects the temporary relay and moves it forward. [Inference]

### 5.3 The construction network becomes the operations network

- After construction, the same relays send **unit health data** (tracker position, heat engine status, battery temperature) to the base, then over Starlink or fiber to **Exowatt's NVIDIA/AWS digital twin**. [Inference]
- **Pitch point:** "The network has a cost for construction, but it is not a sunk cost. It becomes the monitoring network for 30 years."

### 5.4 Our site twin connects to their "build in software first" process

- Exowatt says: *"We build every site in software before we build it in the field."* [Video]
- Our planner uses **their site layout and build schedule** as input. For each build day, it gives: where to put relays, predicted coverage, and the cost. This is the **Model** part of the challenge.

### 5.5 Message priorities for Exowatt's specific work

| Priority | Exowatt example |
|---|---|
| P0 — Safety | **Crane lift zone:** a person or robot enters the area under a container that is lifted. **Concentrated-sunlight zone:** a person or robot moves near the focus area of an active unit [Inference — ask mentors if this hazard is real]. E-stop. |
| P1 — Position and precision | **RTK corrections** for the pile rig and the crane (each unit must go on its foundation correctly). Positions of all assets. |
| P2 — Task status | "Pile 1,204 done", "Unit 0815 placed", "Unit 0815 commissioned". This gives Field Operations the **end-to-end status** that they do not have now. |
| P3 — Bulk | Drone survey maps, GO2 inspection photos, logs. Sent when the link is good, or carried by a drone (data mule). |

### 5.6 Site conditions to include

- **Desert heat and dust** in NM, TX, AZ and NV. Dust storms add radio loss and can cover equipment. Use these conditions in the stress test. [Inference]
- **Night work.** Drones and robots work after dark. Relays on units that store energy still have power at night. Relays that use small solar panels do not have this advantage. [Inference]
- **Data-center shell on the same land (ExoRise).** The site base can be at the future data-center location. Starlink is the backhaul during construction, and fiber can replace it later. [Inference]

---

## 6. Changes to our demo

1. **Unit geometry:** Model each P3 as a 12 m × 2.4 m metal block, in rows with roads (as in the video).
2. **Build sequence:** Simulate steps 1–6 with the build front that moves each day.
3. **Relay rule:** "A commissioned unit can host a relay" + "robots drop temporary relays at the front".
4. **Two scenarios side by side:**
   - **Exowatt today (video):** 1 base station → assets go offline as the build moves.
   - **Our design:** coverage stays ≥ 95% on all build days.
5. **Stress tests specific to Exowatt:** a relay unit is shut down for maintenance; a dust storm; a crane blocks a link; Starlink fails at night.
6. **Field Operations view:** a table of unit status (piled → placed → connected → commissioned) that still updates during link failures (store-and-forward).

---

## 7. Questions for the Exowatt mentors (updated)

1. Where will the first ExoRise pilot be, and how many acres and units will it have?
2. Is "25 kWh" per unit per day? How many units does a typical site have?
3. Which robots and machines do you use now? Which vendors (for example, Built Robotics, Unitree)? Which radios do they have?
4. Can a commissioned P3 supply a few watts to a relay? Can we put an antenna on the lens or tracker frame? Can the factory install a relay?
5. Are the focus areas of the Fresnel lenses a hazard to people or robots near the unit?
6. How do you lift and place each unit (crane type, accuracy needed)? Do you use RTK?
7. Do you want the construction network to stay for operations and send data to your digital twin?
8. What safety latency and budget are acceptable?

---

## Sources

- [Contrary Research — Exowatt](https://research.contrary.com/company/exowatt)
- [Wikipedia — Exowatt](https://en.wikipedia.org/wiki/Exowatt)
- [Latitude Media — Exowatt is embracing a new business model](https://www.latitudemedia.com/news/exowatt-is-embracing-a-new-business-model/)
- [Utility Dive — Exowatt launches ExoRise](https://www.utilitydive.com/news/sam-altman-backed-exowatt-launches-arm-to-power-data-centers-with-renewable/810727/)
- [ESG Today — Exowatt launches land and clean energy business](https://www.esgtoday.com/exowatt-launches-land-and-clean-energy-solutions-business-for-hyperscale-data-centers/)
- [Business Wire — Exowatt expands to Austin (Mar 2026)](https://www.businesswire.com/news/home/20260318523897/en/Exowatt-Expands-to-Austin-as-AI-Driven-Power-Demand-Reshapes-U.S.-Energy-Infrastructure)
- [DCD — Exowatt raises $70M Series A](https://www.datacenterdynamics.com/en/news/exowatt-raises-70m-in-series-a-funding-touts-90gwh-pipeline-from-data-center-market/)
- [Exowatt — Additional $50M](https://www.exowatt.com/news/www-exowatt-com-news-series-a-additional-50m-press-release)
- [Parallax — Examining the claim at the heart of Exowatt's P3](https://parallax.industries/articles/exowatt-exowatts-p3-claim-under-4-cents-per-kwh-289)
- [New Equipment Digest — Exowatt P3](https://www.newequipment.com/55325167)
- [The Ladders — Exowatt Manager, Field Operations](https://www.theladders.com/job/manager-field-operations-exowatt-miami-fl_87189967)
- [Equipment Journal — Built Robotics autonomous solar piling](https://www.equipmentjournal.com/tech-news/built-robotics-develops-the-1st-fully-autonomous-solar-piling-system/)
- [The Robot Report — Blattner awards Built Robotics $75M contract](https://www.therobotreport.com/blattner-awards-built-robotics-75m-contract-meet-energy-demands/)
- [PV Tech — Maximo robotic installation](https://www.pv-tech.org/youre-going-to-see-a-lot-more-of-these-maximo-on-robotic-installation-utility-scale-solar-projects/)
- [PV Tech — Burns & McDonnell and Gritt](https://www.pv-tech.org/burns-mcdonnell-gritt-partner-on-ai-powered-solar-construction/)
- [Built In — TAR Founding Robotics Engineer (not Exowatt)](https://www.builtinaustin.com/job/founding-robotics-engineer/10494537)
- Exowatt challenge document and challenge video (MITEC Hack '26)
