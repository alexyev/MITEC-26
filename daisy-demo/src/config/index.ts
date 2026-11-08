// Barrel for the config layer: typed access to defaults, presets, scenarios and the pricing file.
// pricing.json is the file the team edits; PRICING_DEFAULTS is its typed view.
import pricingJson from './pricing.json';
import type { Pricing } from '../engine/pricing';

export * from './defaults';
export * from './presets';
export * from './scenarios';
export const PRICING_DEFAULTS = pricingJson as Pricing;
