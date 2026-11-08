// Number formats of the Build & failure tab (spec 6.4): at most 3 significant digits in readouts.
import { PERCENT } from '../../config/play';

/** A share of a whole (0.000468) as a percentage with two decimals ("0.05%"). */
export function formatShare(share: number): string {
  return `${(share * PERCENT.scale).toFixed(PERCENT.shareDecimals)}%`;
}

/** Seconds with at most 3 significant digits ("2.95"). */
export const formatSeconds = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 3 }).format;

/** Counts with thousands separators ("1,275"). */
export const formatCount = new Intl.NumberFormat('en-US').format;
