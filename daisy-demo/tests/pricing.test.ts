import { describe, expect, it, vi } from 'vitest';
import pricingJson from '../src/config/pricing.json';
import { BUILD } from '../src/config/defaults';
import {
  allNetworkCosts,
  loadPricing,
  networkCost,
  PRICING,
  siteLayoutSummary,
  surveyCostUsd,
  validatePricing,
} from '../src/engine/pricing';
import type { Pricing, SiteLayoutSummary } from '../src/engine/pricing';
import { generateSite } from '../src/engine/site';

const pricing = pricingJson as Pricing;

/** The layout of the team's workbook (corner-module-cost-model.xlsx, Inputs B7, B12 to B15, B17). */
const WORKBOOK_LAYOUT: SiteLayoutSummary = {
  units: 23_000,
  unitsPerLaneRow: 260,
  laneRows: 89,
  unitPitchM: 14.2,
  rowPitchM: 22.6,
  unitsPerDay: 200,
};

/** Totals of the workbook's Setup Costs sheet (columns D and M), rounded to the dollar. */
const WORKBOOK_TOTALS: [string, number, number][] = [
  ['bleOffShelf', 1950, 1_040_204],
  ['bleIntegrated', 1950, 615_069],
  ['loraIntegrated', 6, 11_480],
  ['halowIntegrated', 45, 74_616],
  ['halowOffShelf', 45, 98_086],
  ['mesh5Rajant', 144, 634_408],
];

const clone = (): Pricing => structuredClone(pricing);

describe('pricing.json', () => {
  it('is valid and holds the six setups of the workbook, HaLow integrated by default', () => {
    expect(validatePricing(pricing)).toEqual([]);
    expect(PRICING.errors).toEqual([]);
    expect(pricing.setups.map((s) => s.id)).toEqual(WORKBOOK_TOTALS.map(([id]) => id));
    expect(pricing.defaultSetup).toBe('halowIntegrated');
    expect(pricing.verified).toBe(false);
  });
});

describe('networkCost on the workbook layout (golden values)', () => {
  for (const [id, modules, total] of WORKBOOK_TOTALS) {
    it(`${id}: ${modules} modules, $${total.toLocaleString('en-US')}`, () => {
      const cost = networkCost(pricing, WORKBOOK_LAYOUT, id);
      expect(cost.modules).toBe(modules);
      expect(Math.round(cost.totalUsd)).toBe(total);
    });
  }

  it('reproduces the intermediate values of the HaLow integrated row', () => {
    const c = networkCost(pricing, WORKBOOK_LAYOUT);
    expect(c.setupId).toBe('halowIntegrated');
    expect([c.n, c.m, c.gridCols, c.gridRows]).toEqual([29, 18, 9, 5]);
    expect(c.moduleUsd).toBeCloseTo(793.736, 6);
    expect(c.batteryWh).toBeCloseTo(2587.5, 6);
    expect(c.batteryUsd).toBeCloseTo(1228.5, 6);
    expect(c.packs).toBe(17);
    expect(c.batteriesUsd).toBeCloseTo(20_884.5, 6);
    expect(c.modulesUsd).toBeCloseTo(35_718.12, 6);
    expect(c.basesUsd).toBe(8000);
    expect(c.subtotalUsd).toBeCloseTo(64_602.62, 6);
    expect(c.perContainerUsd).toBeCloseTo(3.244175, 5);
    expect(c.perKwhUsd).toBeCloseTo(0.129767, 5);
    expect(c.shareOfP3).toBeCloseTo(0.000432557, 8);
  });

  it('splits the total into subtotal, spares and contingency', () => {
    for (const c of allNetworkCosts(pricing, WORKBOOK_LAYOUT)) {
      expect(c.modulesUsd + c.batteriesUsd + c.basesUsd).toBeCloseTo(c.subtotalUsd, 6);
      expect(c.subtotalUsd + c.sparesUsd + c.contingencyUsd).toBeCloseTo(c.totalUsd, 6);
    }
  });

  it('buys one pack per module when the battery fleet is not reused', () => {
    const p = clone();
    p.battery.reusedFleet = false;
    const c = networkCost(p, WORKBOOK_LAYOUT);
    expect(c.packs).toBe(c.modules);
  });
});

describe('networkCost on the v3 site', () => {
  const layout = siteLayoutSummary(generateSite(), BUILD);

  it('reads the layout from the site model', () => {
    expect(layout).toMatchObject({ units: 23_000, unitsPerLaneRow: 250, laneRows: 92 });
    expect(layout.unitPitchM).toBeCloseTo(14.2, 6);
  });

  it('gives HaLow integrated a 9 x 5 grid of 45 modules for about $74.6k (0.04% of P3 hardware)', () => {
    const c = networkCost(pricing, layout);
    expect([c.gridCols, c.gridRows, c.modules]).toEqual([9, 5, 45]);
    expect(c.packs).toBe(17);
    expect(Math.round(c.totalUsd)).toBe(74_616);
    expect(c.perContainerUsd).toBeCloseTo(3.24, 2);
    expect(c.perKwhUsd).toBeCloseTo(0.13, 2);
    expect(c.shareOfP3 * 100).toBeCloseTo(0.04, 2);
  });

  it('refuses an unknown setup id', () => {
    expect(() => networkCost(pricing, layout, 'nope')).toThrow();
  });
});

describe('surveyCostUsd', () => {
  it('is the 4x4-hours times the hourly cost', () => {
    expect(surveyCostUsd(pricing, 46)).toBeCloseTo(46 * pricing.survey.vehicleHourUsd, 9);
  });
});

describe('validatePricing', () => {
  const errorsAfter = (edit: (p: Pricing & Record<string, unknown>) => void) => {
    const p = clone() as Pricing & Record<string, unknown>;
    edit(p);
    return validatePricing(p);
  };

  it('rejects negative values', () => {
    expect(errorsAfter((p) => (p.setups[3].radioUsd = -1))).toEqual([
      'setups[3].radioUsd must not be negative.',
    ]);
    expect(errorsAfter((p) => (p.base.unitPriceUsd = -8000))).toHaveLength(1);
  });

  it('rejects fractions outside 0 to 1', () => {
    expect(errorsAfter((p) => (p.contingency = 1.5))).toEqual([
      'contingency must be a fraction from 0 to 1.',
    ]);
    expect(errorsAfter((p) => (p.battery.depthOfDischarge = 0))).toHaveLength(1);
    expect(errorsAfter((p) => (p.setups[0].radioTariff = 12.5))).toHaveLength(1);
  });

  it('rejects an unknown default setup and duplicate setup ids', () => {
    expect(errorsAfter((p) => (p.defaultSetup = 'halow'))).toEqual([
      'defaultSetup "halow" is not the id of a setup.',
    ]);
    expect(errorsAfter((p) => (p.setups[1].id = p.setups[0].id))).toHaveLength(1);
  });

  it('rejects missing keys, wrong types, typos and an empty setup list', () => {
    expect(errorsAfter((p) => delete (p.labor as Partial<Pricing['labor']>).burden)).toEqual([
      'labor.burden is missing.',
    ]);
    expect(
      errorsAfter((p) => ((p.battery as Record<string, unknown>).reusedFleet = 1)),
    ).toHaveLength(1);
    expect(errorsAfter((p) => (p.sparesPct = 5))).toEqual(['sparesPct is not a known key.']);
    expect(errorsAfter((p) => (p.setups = []))).toHaveLength(1);
    expect(errorsAfter((p) => (p.setups[2].radiosPerModule = 1.5))).toHaveLength(1);
    expect(validatePricing(null)).toHaveLength(1);
  });

  it('reports the errors of an invalid file on the console when it loads', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const p = clone();
    p.spares = -0.05;
    const loaded = loadPricing(p);
    expect(loaded.errors).toHaveLength(1);
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});
