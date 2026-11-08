// Full-site radio network cost and survey cost (spec 10): the formulas of the team's cost workbook on any
// site layout, and a validator for pricing.json so a bad edit shows up as a warning instead of a number.
import pricingJson from '../config/pricing.json';
import { UNITS } from '../config/units';
import type { BuildConfig, Site } from './types';

/** One corner-module design: a row of the workbook's bill of materials (Inputs rows 38 to 43). */
export interface RadioSetup {
  id: string;
  label: string;
  rangeM: number;
  radioUsd: number;
  radiosPerModule: number;
  radioTariff: number;
  hostUsd: number;
  hostTariff: number;
  antennaUsd: number;
  antennasPerModule: number;
  enclosureUsd: number;
  enclosureTariff: number;
  bracketUsd: number;
  hardwareUsd: number;
  laborHPerModule: number;
  avgPowerW: number;
}

/** Shape of src/config/pricing.json (documented in docs/PRICING_FORMAT.md). */
export interface Pricing {
  verified: boolean;
  source: string;
  currency: string;
  project: { kwhPerUnit: number; p3UnitPriceUsd: number };
  placement: { spacingFactor: number };
  battery: {
    bridgeDays: number;
    depthOfDischarge: number;
    usdPerKwh: number;
    reusedFleet: boolean;
    fleetSpares: number;
    fleetExtraPacks: number;
    heatOversize: number;
    bmsPremium: number;
    shadedBoxUsd: number;
    groundBoxUsd: number;
    groundBoxFromWh: number;
  };
  module: { sunShieldUsd: number };
  labor: { wageUsdPerH: number; burden: number };
  base: { count: number; unitPriceUsd: number };
  spares: number;
  contingency: number;
  defaultSetup: string;
  setups: RadioSetup[];
  survey: SurveyPricing;
}

/**
 * Survey prices (spec 10.4, D62). A price is shown only when it is sourced: a number that is not listed in
 * `unverified`. `null` means there is no sourced price yet.
 */
export interface SurveyPricing {
  /** One 4x4-hour of survey; the spec's placeholder, listed as unverified. */
  vehicleHourUsd: number | null;
  /** Starlink Mini kit with shipping, and its mounting and power on a 4x4 (workbook Alternatives B59, B62). */
  starlinkKitUsd: number | null;
  starlinkMountUsd: number | null;
  /** Starlink service plan per terminal and month, and the days billed as one month (Alternatives B60, B61). */
  starlinkPlanUsdPerMonth: number | null;
  starlinkBillingDays: number;
  /** One drone that follows a 4x4 (D61). */
  droneUsd: number | null;
  /** Keys whose value is a placeholder, kept in the file but never shown as a cost. */
  unverified: SurveyPriceKey[];
}

export type SurveyPriceKey =
  'vehicleHourUsd' | 'starlinkKitUsd' | 'starlinkMountUsd' | 'starlinkPlanUsdPerMonth' | 'droneUsd';

/** The layout numbers the cost formulas need; they come from the site model and BUILD, not the file. */
export interface SiteLayoutSummary {
  units: number;
  unitsPerLaneRow: number;
  laneRows: number;
  unitPitchM: number;
  rowPitchM: number;
  unitsPerDay: number;
}

export interface NetworkCost {
  setupId: string;
  label: string;
  /** A module on every n-th unit along the lane, in every m-th lane row. */
  n: number;
  m: number;
  /** Module grid: gridCols along the lanes x gridRows across them. */
  gridCols: number;
  gridRows: number;
  modules: number;
  /** Price of one module without its battery, including the sun shield and install labor. */
  moduleUsd: number;
  modulesUsd: number;
  /** Battery packs bought, the size of one pack, and the price of one pack with its heat protection. */
  packs: number;
  batteryWh: number;
  batteryUsd: number;
  batteriesUsd: number;
  basesUsd: number;
  subtotalUsd: number;
  sparesUsd: number;
  contingencyUsd: number;
  totalUsd: number;
  perContainerUsd: number;
  perKwhUsd: number;
  /** Network cost as a fraction of the P3 hardware cost (0.0004 = 0.04%). */
  shareOfP3: number;
  verified: boolean;
}

/** The layout of a generated site, for `networkCost` (lanes along x or y alike). */
export function siteLayoutSummary(
  site: Site,
  build: Pick<BuildConfig, 'unitsPerDay'>,
): SiteLayoutSummary {
  return {
    units: site.count,
    unitsPerLaneRow: site.cols,
    laneRows: site.rows,
    unitPitchM: site.unitPitchM,
    rowPitchM: site.rowPitchM,
    unitsPerDay: build.unitsPerDay,
  };
}

export function findSetup(pricing: Pricing, setupId: string = pricing.defaultSetup): RadioSetup {
  const setup = pricing.setups.find((s) => s.id === setupId);
  if (!setup) throw new Error(`Unknown radio setup: ${setupId}`);
  return setup;
}

/** Cost of the radio network of one setup on a site (spec 10.2, the workbook's Setup Costs sheet). */
export function networkCost(
  pricing: Pricing,
  layout: SiteLayoutSummary,
  setupId: string = pricing.defaultSetup,
): NetworkCost {
  const s = findSetup(pricing, setupId);
  const { battery } = pricing;
  const reach = s.rangeM * pricing.placement.spacingFactor;
  const n = Math.max(1, Math.floor(reach / layout.unitPitchM));
  const m = Math.max(1, Math.floor(reach / layout.rowPitchM));
  const gridCols = Math.ceil(layout.unitsPerLaneRow / n);
  const gridRows = Math.ceil(layout.laneRows / m);
  const modules = gridCols * gridRows;

  const laborUsdPerH = pricing.labor.wageUsdPerH * pricing.labor.burden;
  const moduleUsd =
    s.radioUsd * s.radiosPerModule * (1 + s.radioTariff) +
    s.hostUsd * (1 + s.hostTariff) +
    s.antennaUsd * s.antennasPerModule +
    s.enclosureUsd * (1 + s.enclosureTariff) +
    s.bracketUsd +
    s.hardwareUsd +
    s.laborHPerModule * laborUsdPerH +
    pricing.module.sunShieldUsd;

  const batteryWh =
    ((s.avgPowerW * UNITS.hoursPerDay * battery.bridgeDays) / battery.depthOfDischarge) *
    (1 + battery.heatOversize);
  const batteryUsd =
    (batteryWh / UNITS.whPerKwh) * battery.usdPerKwh * (1 + battery.bmsPremium) +
    (batteryWh < battery.groundBoxFromWh ? battery.shadedBoxUsd : battery.groundBoxUsd);
  // A reused fleet only needs packs for the modules in the edge zone: placed but not yet powered.
  const packs = battery.reusedFleet
    ? Math.min(
        modules,
        Math.ceil(
          ((modules * battery.bridgeDays * layout.unitsPerDay) / layout.units) *
            (1 + battery.fleetSpares),
        ) + battery.fleetExtraPacks,
      )
    : modules;

  const modulesUsd = modules * moduleUsd;
  const batteriesUsd = packs * batteryUsd;
  const basesUsd = pricing.base.count * pricing.base.unitPriceUsd;
  const subtotalUsd = modulesUsd + batteriesUsd + basesUsd;
  const sparesUsd = subtotalUsd * pricing.spares;
  const contingencyUsd = (subtotalUsd + sparesUsd) * pricing.contingency;
  const totalUsd = subtotalUsd * (1 + pricing.spares) * (1 + pricing.contingency);

  return {
    setupId: s.id,
    label: s.label,
    n,
    m,
    gridCols,
    gridRows,
    modules,
    moduleUsd,
    modulesUsd,
    packs,
    batteryWh,
    batteryUsd,
    batteriesUsd,
    basesUsd,
    subtotalUsd,
    sparesUsd,
    contingencyUsd,
    totalUsd,
    perContainerUsd: totalUsd / layout.units,
    perKwhUsd: totalUsd / (layout.units * pricing.project.kwhPerUnit),
    shareOfP3: totalUsd / (layout.units * pricing.project.p3UnitPriceUsd),
    verified: pricing.verified,
  };
}

/** Every setup of the file, in file order (for the "Compare radios" list of spec 10.3). */
export function allNetworkCosts(pricing: Pricing, layout: SiteLayoutSummary): NetworkCost[] {
  return pricing.setups.map((s) => networkCost(pricing, layout, s.id));
}

/** A sourced survey price, or null when the file has none or lists it as unverified. */
export function surveyPrice(pricing: Pricing, key: SurveyPriceKey): number | null {
  const value = pricing.survey[key];
  return value === null || pricing.survey.unverified.includes(key) ? null : value;
}

/** The cost of one survey run (spec 10.4, D62); a part without a sourced price is null. */
export interface SurveyCost {
  vehicles: number;
  vehicleHours: number;
  /** Months of Starlink service billed per terminal: the survey time in billing months, at least 1. */
  starlinkMonths: number;
  /** One Starlink kit and its mounting per 4x4. */
  starlinkHardwareUsd: number | null;
  starlinkServiceUsd: number | null;
  vehicleHoursUsd: number | null;
  dronesUsd: number | null;
  /** Sum of the parts with a sourced price. */
  pricedUsd: number;
  /** True when every part has a sourced price, so `pricedUsd` is the whole survey cost. */
  complete: boolean;
}

/**
 * Survey cost of `vehicles` 4x4s that drive `vehicleHours` in all and finish after `finishH`: the 4x4-hours
 * times the hourly cost, and for each 4x4 a Starlink kit with its mounting, Starlink service for the survey,
 * and a drone.
 */
export function surveyCost(
  pricing: Pricing,
  vehicles: number,
  vehicleHours: number,
  finishH: number,
): SurveyCost {
  const price = (key: SurveyPriceKey) => surveyPrice(pricing, key);
  const months = Math.max(
    1,
    Math.ceil(finishH / (pricing.survey.starlinkBillingDays * UNITS.hoursPerDay)),
  );
  const times = (unit: number | null, n: number): number | null =>
    unit === null ? null : unit * n;
  const kit = price('starlinkKitUsd');
  const mount = price('starlinkMountUsd');
  const parts = {
    starlinkHardwareUsd: kit === null || mount === null ? null : (kit + mount) * vehicles,
    starlinkServiceUsd: times(price('starlinkPlanUsdPerMonth'), vehicles * months),
    vehicleHoursUsd: times(price('vehicleHourUsd'), vehicleHours),
    dronesUsd: times(price('droneUsd'), vehicles),
  };
  const values = Object.values(parts);
  return {
    vehicles,
    vehicleHours,
    starlinkMonths: months,
    ...parts,
    pricedUsd: values.reduce<number>((sum, v) => sum + (v ?? 0), 0),
    complete: values.every((v) => v !== null),
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Value rules: 'usd' and 'amount' are at least 0, 'positive' is above 0, 'fraction' is from 0 to 1,
 * 'share' is above 0 and at most 1, 'count' is a whole number from 0 up; 'usdOrNull' is a price or null (no
 * sourced price yet), and 'surveyKeys' is a list of survey price keys.
 */
type Rule =
  | 'usd'
  | 'usdOrNull'
  | 'amount'
  | 'positive'
  | 'fraction'
  | 'share'
  | 'count'
  | 'bool'
  | 'text'
  | 'surveyKeys';

const SURVEY_PRICE_KEYS: SurveyPriceKey[] = [
  'vehicleHourUsd',
  'starlinkKitUsd',
  'starlinkMountUsd',
  'starlinkPlanUsdPerMonth',
  'droneUsd',
];
type Schema = { [key: string]: Rule | Schema };

const SETUP_SCHEMA: Schema = {
  id: 'text',
  label: 'text',
  rangeM: 'positive',
  radioUsd: 'usd',
  radiosPerModule: 'count',
  radioTariff: 'fraction',
  hostUsd: 'usd',
  hostTariff: 'fraction',
  antennaUsd: 'usd',
  antennasPerModule: 'count',
  enclosureUsd: 'usd',
  enclosureTariff: 'fraction',
  bracketUsd: 'usd',
  hardwareUsd: 'usd',
  laborHPerModule: 'amount',
  avgPowerW: 'amount',
};

const PRICING_SCHEMA: Schema = {
  verified: 'bool',
  source: 'text',
  currency: 'text',
  project: { kwhPerUnit: 'positive', p3UnitPriceUsd: 'positive' },
  placement: { spacingFactor: 'share' },
  battery: {
    bridgeDays: 'amount',
    depthOfDischarge: 'share',
    usdPerKwh: 'usd',
    reusedFleet: 'bool',
    fleetSpares: 'fraction',
    fleetExtraPacks: 'count',
    heatOversize: 'fraction',
    bmsPremium: 'fraction',
    shadedBoxUsd: 'usd',
    groundBoxUsd: 'usd',
    groundBoxFromWh: 'amount',
  },
  module: { sunShieldUsd: 'usd' },
  labor: { wageUsdPerH: 'usd', burden: 'amount' },
  base: { count: 'count', unitPriceUsd: 'usd' },
  spares: 'fraction',
  contingency: 'fraction',
  defaultSetup: 'text',
  survey: {
    vehicleHourUsd: 'usdOrNull',
    starlinkKitUsd: 'usdOrNull',
    starlinkMountUsd: 'usdOrNull',
    starlinkPlanUsdPerMonth: 'usdOrNull',
    starlinkBillingDays: 'positive',
    droneUsd: 'usdOrNull',
    unverified: 'surveyKeys',
  },
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkRule(path: string, rule: Rule, value: unknown, errors: string[]): void {
  if (rule === 'bool') {
    if (typeof value !== 'boolean') errors.push(`${path} must be true or false.`);
    return;
  }
  if (rule === 'text') {
    if (typeof value !== 'string' || value.trim() === '') errors.push(`${path} must be a text.`);
    return;
  }
  if (rule === 'surveyKeys') {
    const known = (k: unknown) => SURVEY_PRICE_KEYS.includes(k as SurveyPriceKey);
    if (!Array.isArray(value) || !value.every(known))
      errors.push(`${path} must be a list of survey price keys.`);
    return;
  }
  if (rule === 'usdOrNull' && value === null) return;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push(`${path} must be a number.`);
    return;
  }
  if (rule === 'positive' && value <= 0) errors.push(`${path} must be above 0.`);
  else if (rule === 'fraction' && (value < 0 || value > 1))
    errors.push(`${path} must be a fraction from 0 to 1.`);
  else if (rule === 'share' && (value <= 0 || value > 1))
    errors.push(`${path} must be a fraction above 0 and at most 1.`);
  else if (rule === 'count' && (value < 0 || !Number.isInteger(value)))
    errors.push(`${path} must be a whole number, 0 or more.`);
  else if (value < 0) errors.push(`${path} must not be negative.`);
}

function checkSchema(path: string, schema: Schema, value: unknown, errors: string[]): void {
  if (!isObject(value)) {
    errors.push(`${path || 'The pricing file'} must be an object.`);
    return;
  }
  const at = (key: string) => (path ? `${path}.${key}` : key);
  for (const [key, rule] of Object.entries(schema)) {
    if (!(key in value)) errors.push(`${at(key)} is missing.`);
    else if (typeof rule === 'string') checkRule(at(key), rule, value[key], errors);
    else checkSchema(at(key), rule, value[key], errors);
  }
  for (const key of Object.keys(value)) {
    if (!(key in schema) && !(path === '' && key === 'setups'))
      errors.push(`${at(key)} is not a known key.`);
  }
}

/** Errors in a pricing file, as readable lines; an empty list means the file is valid. */
export function validatePricing(raw: unknown): string[] {
  const errors: string[] = [];
  checkSchema('', PRICING_SCHEMA, raw, errors);
  if (!isObject(raw)) return errors;
  const setups = raw.setups;
  if (!Array.isArray(setups) || setups.length === 0) {
    errors.push('setups must be a list with at least one setup.');
    return errors;
  }
  const ids = new Set<string>();
  setups.forEach((setup: unknown, i) => {
    checkSchema(`setups[${i}]`, SETUP_SCHEMA, setup, errors);
    const id = isObject(setup) ? setup.id : undefined;
    if (typeof id === 'string') {
      if (ids.has(id)) errors.push(`setups[${i}].id "${id}" is used twice.`);
      ids.add(id);
    }
  });
  if (typeof raw.defaultSetup === 'string' && !ids.has(raw.defaultSetup)) {
    errors.push(`defaultSetup "${raw.defaultSetup}" is not the id of a setup.`);
  }
  return errors;
}

export interface LoadedPricing {
  pricing: Pricing;
  /** Validation errors; when not empty the cost numbers are not trustworthy and the UI shows a warning. */
  errors: string[];
}

/** Validates a pricing file and reports its errors on the console (spec 10.1). */
export function loadPricing(raw: unknown): LoadedPricing {
  const errors = validatePricing(raw);
  if (errors.length > 0) console.error(`pricing.json is not valid:\n- ${errors.join('\n- ')}`);
  return { pricing: raw as Pricing, errors };
}

/** The shipped pricing file, validated once when the app loads. */
export const PRICING: LoadedPricing = loadPricing(pricingJson);
