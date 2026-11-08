# Pricing file format

The pricing file is `src/config/pricing.json`.
It holds every price and cost assumption of the demo, and its keys mirror the Inputs sheet of the team's cost workbook, `research/corner-module-cost-model.xlsx`.
To take new numbers from the workbook, copy each value from the cell listed below into its key.
The workbook itself is not part of the app.

`src/engine/pricing.ts` applies the workbook's formulas (the Setup Costs sheet) to the demo's site layout.
The layout values (units, units per lane row, lane rows, the two pitches, units per day) come from the site model and `BUILD`, not from this file.

All values are the team's estimates, not supplier quotes.
While `verified` is `false`, the numbers are the team's estimates; the demo shows them without an estimate label (D53).

## Keys

### Top level

| Key            | Workbook cell  | Meaning                                                                                               |
| -------------- | -------------- | ----------------------------------------------------------------------------------------------------- |
| `verified`     | -              | `false` until the team has supplier quotes; then set it to `true` and the estimate chip goes away.    |
| `source`       | -              | Where the numbers come from, for example "Team estimate, Nov 7 2026 (corner-module-cost-model.xlsx)". |
| `currency`     | -              | Currency code. All values are USD.                                                                    |
| `spares`       | Inputs!B32     | Spares as a fraction of the subtotal (0.05 = 5%).                                                     |
| `contingency`  | Inputs!B33     | Contingency as a fraction of the subtotal with spares.                                                |
| `defaultSetup` | -              | `id` of the setup the demo shows: `halowIntegrated`, the workbook's recommendation.                   |
| `setups`       | Inputs!A38:O43 | One entry per row of the corner-module bill of materials (below).                                     |

### `project`, `placement`, `module`, `labor`, `base`

| Key                       | Workbook cell | Meaning                                                   |
| ------------------------- | ------------- | --------------------------------------------------------- |
| `project.kwhPerUnit`      | Inputs!B8     | Storage per P3 unit in kWh, for the cost per kWh.         |
| `project.p3UnitPriceUsd`  | Inputs!B9     | P3 hardware price per unit, for the share of P3 hardware. |
| `placement.spacingFactor` | Inputs!B16    | Module spacing as a fraction of the radio range.          |
| `module.sunShieldUsd`     | Inputs!B27    | Sun shield over each module's enclosure.                  |
| `labor.wageUsdPerH`       | Inputs!B28    | Electrician wage per hour.                                |
| `labor.burden`            | Inputs!B29    | Labor burden multiplier (benefits, insurance, overhead).  |
| `base.count`              | Inputs!B30    | Number of site bases (mast, radio, Starlink).             |
| `base.unitPriceUsd`       | Inputs!B31    | Price of one base.                                        |

### `battery`

| Key                        | Workbook cell                  | Meaning                                                                                                   |
| -------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `battery.bridgeDays`       | Inputs!B18                     | Days a module runs on its battery before its P3 is commissioned.                                          |
| `battery.depthOfDischarge` | Inputs!B19                     | Usable fraction of the pack (above 0, at most 1).                                                         |
| `battery.usdPerKwh`        | Inputs!B20                     | Pack price per kWh.                                                                                       |
| `battery.reusedFleet`      | Inputs!B21                     | `true` (the workbook's 1): a fleet of packs moves with the build front; `false` (0): one pack per module. |
| `battery.fleetSpares`      | Inputs!B22                     | Spare packs in the reused fleet, as a fraction.                                                           |
| `battery.fleetExtraPacks`  | Setup Costs!H5:H10, the `+2`   | Packs added to the reused fleet on top of the spares.                                                     |
| `battery.heatOversize`     | Inputs!B23                     | Pack oversize for capacity loss in the heat.                                                              |
| `battery.bmsPremium`       | Inputs!B24                     | Price premium of a temperature-protected BMS.                                                             |
| `battery.shadedBoxUsd`     | Inputs!B25                     | Shaded, vented box for a pack below `groundBoxFromWh`.                                                    |
| `battery.groundBoxUsd`     | Inputs!B26                     | Shaded box on the ground for a pack of `groundBoxFromWh` or more.                                         |
| `battery.groundBoxFromWh`  | Setup Costs!G5:G10, the `1000` | Pack size in Wh from which the pack sits on the ground.                                                   |

### `setups[]` (one per row 38 to 43 of the Inputs sheet)

| Key                 | Column | Meaning                                                  |
| ------------------- | ------ | -------------------------------------------------------- |
| `id`                | -      | Short id, used by `defaultSetup`.                        |
| `label`             | A      | Name shown in the demo.                                  |
| `rangeM`            | B      | Reliable range in meters.                                |
| `radioUsd`          | C      | Price per radio.                                         |
| `radiosPerModule`   | D      | Radios per module (a whole number).                      |
| `radioTariff`       | E      | Tariff on the radio, as a fraction.                      |
| `hostUsd`           | F      | Host or carrier board.                                   |
| `hostTariff`        | G      | Tariff on the host.                                      |
| `antennaUsd`        | H      | Price per antenna.                                       |
| `antennasPerModule` | I      | Antennas per module (a whole number).                    |
| `enclosureUsd`      | J      | Enclosure.                                               |
| `enclosureTariff`   | K      | Tariff on the enclosure.                                 |
| `bracketUsd`        | L      | Corner arm bracket.                                      |
| `hardwareUsd`       | M      | Mounting hardware.                                       |
| `laborHPerModule`   | N      | Install hours per module.                                |
| `avgPowerW`         | O      | Average power per module in watts, for the battery size. |

The setup ids are `bleOffShelf`, `bleIntegrated`, `loraIntegrated`, `halowIntegrated`, `halowOffShelf` and `mesh5Rajant`, in workbook order.

### `survey`

| Key                     | Workbook cell           | Meaning                                                |
| ----------------------- | ----------------------- | ------------------------------------------------------ |
| `survey.vehicleHourUsd` | not in the workbook yet | Cost of one 4x4-hour of survey; a placeholder of $150. |

### Inputs cells that are not in the file

| Cell       | Why                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| B5, B6, B7 | Site area, aspect and unit count come from `SITE` in `src/config/defaults.ts`.                          |
| B12 to B15 | Lane rows, units per lane row and both pitches come from the generated site.                            |
| B17        | Units placed per day come from `BUILD.unitsPerDay`.                                                     |
| B10, B11   | Cycles per year and project life are only for the per-kWh-delivered view, which the demo does not show. |
| B34        | The loaded labor rate is computed: wage x burden.                                                       |
| P38:Q43    | The telemetry note and the sources stay in the workbook.                                                |

## Formulas (spec section 10.2)

For a setup on a site:

1. `N = max(1, floor(rangeM x spacingFactor / unit pitch))` and `M = max(1, floor(rangeM x spacingFactor / lane pitch))`: a module on every N-th unit along the lane, in every M-th lane row.
2. `modules = ceil(units per lane row / N) x ceil(lane rows / M)`.
3. Module price = radios x (1 + tariff) + host x (1 + tariff) + antennas + enclosure x (1 + tariff) + bracket + hardware + labor hours x wage x burden + sun shield.
4. Pack size in Wh = `avgPowerW x 24 x bridgeDays / depthOfDischarge x (1 + heatOversize)`.
5. Pack price = `Wh / 1000 x usdPerKwh x (1 + bmsPremium)` + the shaded box (below `groundBoxFromWh`) or the ground box.
6. Packs = with a reused fleet, `min(modules, ceil(modules x bridgeDays x units per day / units x (1 + fleetSpares)) + fleetExtraPacks)`; otherwise one per module.
7. Subtotal = modules x module price + packs x pack price + bases x base price; total = subtotal x (1 + spares) x (1 + contingency).
8. Per container = total / units; per kWh of storage = total / (units x kwhPerUnit); share of P3 hardware = total / (units x p3UnitPriceUsd).

With the workbook's own layout (260 units per lane row, 89 lane rows, 14.2 m and 22.6 m pitch) these formulas give the workbook's totals to the dollar; `tests/pricing.test.ts` checks all six setups.

## Validation

The demo validates the file when it loads.
Errors go to the console and show as a warning in the cost section.
The file is not valid when:

- a key is missing, has the wrong type, or is not a known key (which catches typos);
- a price, count or amount is negative, or a count is not a whole number;
- a fraction (tariffs, spares, contingency, battery fractions) is outside 0 to 1, or `depthOfDischarge` or `spacingFactor` is 0;
- `rangeM`, `kwhPerUnit` or `p3UnitPriceUsd` is not above 0;
- `setups` is empty, two setups share an `id`, or `defaultSetup` is not the `id` of a setup.
