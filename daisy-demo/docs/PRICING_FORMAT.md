# Pricing file format

The pricing file is `src/config/pricing.json`.
The Pricing drawer can import the same JSON, or a CSV, and export the current pricing as JSON.
All values in the file shipped with the demo are placeholders.

## JSON

```json
{
  "verified": false,
  "currency": "USD",
  "presets": {
    "mesh5": { "rangeRefM": 300, "tiers": [], "rangeScaling": {}, "rangePricePoints": [] }
  },
  "perModule": {},
  "base": {},
  "tempFrontRelay": {},
  "sparesPct": 5,
  "contingencyPct": 10,
  "tierMode": "allUnits"
}
```

| Field                           | Meaning                                                                                                                                                                                             |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `verified`                      | `false` shows "Placeholder prices - verify before pitch" in the cost panel. Set `true` when the team confirms the prices.                                                                           |
| `currency`                      | Currency code. All engine values are USD.                                                                                                                                                           |
| `presets.<id>`                  | One entry per radio preset: `ble`, `lora`, `halow`, `mesh5`.                                                                                                                                        |
| `presets.<id>.rangeRefM`        | Range in meters at which the tier prices are valid.                                                                                                                                                 |
| `presets.<id>.tiers`            | Bulk tiers `{ "minQty", "unitPrice" }`, sorted by `minQty`. The first tier starts at 1.                                                                                                             |
| `presets.<id>.rangeScaling`     | `{ "mode": "power", "exponent": e }`. Price at range R = tier price x (R / rangeRefM)^e.                                                                                                            |
| `presets.<id>.rangePricePoints` | Optional real data `{ "rangeM", "unitPrice" }` at the base tier. If not empty, interpolate linearly in log(range) and ignore `rangeScaling`. Tier discounts are applied as ratios of the base tier. |
| `perModule`                     | Cost per module: `cornerBracketAndCable`, `antennaSet`, `installLabor`, `batteryBridge`.                                                                                                            |
| `base`                          | Site base: `unitPrice` and `powerW`.                                                                                                                                                                |
| `tempFrontRelay`                | Temporary front relay: `unitPrice`, `powerW`, `reusable`.                                                                                                                                           |
| `sparesPct`                     | Spares as a percentage of the module count.                                                                                                                                                         |
| `contingencyPct`                | Contingency as a percentage of the total.                                                                                                                                                           |
| `tierMode`                      | `"allUnits"`: every unit gets the price of the highest tier reached. `"incremental"`: each quantity band gets its own price.                                                                        |

## Tier selection

The quantity is all modules of that preset in the design, including spares.
Per module total = radio price + antenna set + corner bracket and cable + install labor (+ battery bridge if on).
Totals = modules x per-module + bases + temporary front relays (if on) + spares % + contingency %.

## CSV

Columns: `preset,minQty,unitPrice,rangeM`.
An empty `rangeM` means a tier row.
A filled `rangeM` means a range price point.

```csv
preset,minQty,unitPrice,rangeM
mesh5,1,900,
mesh5,100,780,
mesh5,,700,200
mesh5,,1100,400
```

## Validation on import

- No negative prices.
- Tiers sorted by `minQty`.
- Known presets only.
- Errors are shown next to the row.
