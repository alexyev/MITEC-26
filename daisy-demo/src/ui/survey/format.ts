// Number formats of the survey readouts (spec 6.4): thousands separators and at most 3 significant digits.

const LOCALE = 'en-US';
const SIGNIFICANT = 3;
const THOUSAND = 1_000;
const MILLION = 1_000_000;

/** At most 3 significant digits, without trailing zeros: 74616 -> "74,600", 6.90 -> "6.9". */
export function sig3(value: number): string {
  if (!Number.isFinite(value)) return '-';
  return Number(value.toPrecision(SIGNIFICANT)).toLocaleString(LOCALE);
}

/** Money in USD: $74.6k, $1.04M, $150. */
export function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '-';
  if (Math.abs(value) >= MILLION) return `$${sig3(value / MILLION)}M`;
  if (Math.abs(value) >= THOUSAND) return `$${sig3(value / THOUSAND)}k`;
  return `$${sig3(value)}`;
}

/** Hours with one decimal: 15.3, 7.9, 46.0. */
export function formatHours(hours: number): string {
  return Number.isFinite(hours) ? Math.max(0, hours).toFixed(1) : '-';
}

/** Distance in km: one decimal below 100 km, whole km above. */
export function formatKm(km: number): string {
  const decimalsBelow = 100;
  return km < decimalsBelow ? km.toFixed(1) : Math.round(km).toLocaleString(LOCALE);
}

/** A ratio as "6.4×": two significant digits. */
export function formatTimes(ratio: number): string {
  return `${Number(ratio.toPrecision(2)).toLocaleString(LOCALE)}×`;
}

/** A whole number with thousands separators: 23,000. */
export function formatInt(value: number): string {
  return Math.round(value).toLocaleString(LOCALE);
}

/** A share (0 to 1) as a whole percent, rounded down so 100% means done. */
export function formatSharePct(share: number): string {
  const pct = 100;
  // The epsilon keeps 0.29 at 29 rather than 28 (0.29 * 100 = 28.999...).
  const epsilon = 1e-9;
  return `${Math.floor(Math.min(1, Math.max(0, share)) * pct + epsilon)}`;
}

/** Work time per second of playback, from hours: "2 h", "15 min", "11 s" (at most 2 significant digits). */
export function formatPace(hours: number): string {
  const minutesPerHour = 60;
  const secondsPerMinute = 60;
  const two = (v: number) => Number(v.toPrecision(2)).toLocaleString(LOCALE);
  if (hours >= 1) return `${two(hours)} h`;
  const minutes = hours * minutesPerHour;
  if (minutes >= 1) return `${two(minutes)} min`;
  return `${two(minutes * secondsPerMinute)} s`;
}
