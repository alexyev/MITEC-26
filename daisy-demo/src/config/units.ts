// Unit conversions shared by the engine (spec section 1, rule 1). They live here because src/engine/
// allows no numeric literals other than 0, 1 and 2 (decision D7).

export const UNITS = {
  mPerKm: 1000,
  whPerKwh: 1000,
  hoursPerDay: 24,
  minPerH: 60,
};
