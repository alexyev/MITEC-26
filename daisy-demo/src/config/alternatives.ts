// Alternatives comparison of the Build & failure tab (D54): the inputs of the team's cost workbook
// (corner-module-cost-model.xlsx, "Alternatives" sheet, Nov 7 2026) and the challenge brief's example numbers.
// Every cost shown is computed from these on the generated site; an option without a sourced cost shows none.

/** Where the numbers come from, for the footnote. */
export const ALTERNATIVES_SOURCES = {
  workbook: "the team's cost workbook (Setup Costs and Alternatives sheets)",
  brief: "Exowatt's challenge brief and video",
  research: "the team's off-grid connectivity research",
};

/** One-line trade-off of every radio setup in pricing.json, against the data the site must carry. */
export const SETUP_TRADEOFFS: Record<string, string> = {
  bleOffShelf: 'Short range: thousands of modules, and too little capacity for task data.',
  bleIntegrated: 'Cheaper antennas, same problem: thousands of modules that overload.',
  loraIntegrated: 'Cheapest, but too little data for task traffic: a safety layer at most.',
  halowIntegrated: 'Our design: medium data over long range, on standard Wi-Fi tools.',
  halowOffShelf: 'The same network with off-the-shelf antennas: only the price goes up.',
  mesh5Rajant: 'Proven in mines and fast enough for video, at a multiple of the cost.',
};

/**
 * Relay masts with solar power over the whole site, on a triangle grid where every point reaches two masts
 * (workbook A1 with Rajant mesh radios, A2 with the HaLow radio of our design). Cells B16 to B27.
 */
export const MASTS = {
  rangeM: 500,
  /** The workbook's edge factor for two-path coverage (57 relays at 500 m in its lattice check). */
  edgeFactor: 1.55,
  /** A triangle grid has one mast per (sqrt 3 / 2) r^2 of ground; the workbook writes it as 2 / sqrt 3. */
  triangleArea: Math.sqrt(3) / 2,
  poleUsd: 3400,
  solarKitUsd: 3096,
  antennasUsd: 200,
  laborHPerMast: 8,
  equipmentUsd: 500,
  relocationsPerMast: 0.5,
  relocationUsd: 1500,
  surveyUsd: 20000,
};

/** Private LTE (CBRS) with towers and solar power (workbook C, cells B49 to B53). */
export const PRIVATE_LTE = {
  networkUsd: 209500,
  devicesUsd: 142000,
  firstYearUsd: 36000,
  towers: 6,
};

/** The challenge brief's own illustrative design: relay nodes on masts along the roads (STRESS-TEST frame). */
export const EXOWATT_EXAMPLE = {
  hardwareUsd: 41000,
  powerKw: 1.7,
  coverageAfterFailurePct: 84,
};

/** Exowatt today, from the challenge video: one site base, and assets online as the build moves past it. */
export const EXOWATT_TODAY = {
  early: { units: 315, online: 30, assets: 30 },
  later: { units: 1668, online: 3, assets: 37 },
};
