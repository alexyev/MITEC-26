import { describe, expect, it } from 'vitest';
import { BUILD, SITE } from '../src/config/defaults';
import { SETUP_TRADEOFFS } from '../src/config/alternatives';
import { alternativeCosts } from '../src/engine/alternatives';
import { networkCost, PRICING, siteLayoutSummary } from '../src/engine/pricing';
import { getSiteModel } from '../src/state/model';

// D54: the Alternatives comparison computes the cost workbook's Alternatives sheet on the generated site.
const { pricing } = PRICING;

describe('alternative costs (D54)', () => {
  it('reproduces the workbook totals on its own site: 2,000 acres, 23,000 units, 200 a day', () => {
    const c = alternativeCosts(pricing, {
      areaM2: SITE.areaAcres * 4046.86,
      units: 23000,
      unitsPerDay: 200,
    });
    expect(c.masts).toBe(58);
    expect(c.rajantMastsUsd).toBeCloseTo(723311.6132, 2);
    expect(c.halowMastsUsd).toBeCloseTo(597349.3592, 2);
    expect(c.privateLteUsd).toBeCloseTo(469123.6, 2);
    expect(c.starlinkPerMachineUsd).toBeCloseTo(33641.3, 2);
  });

  it('costs the same on the generated site, which has the same area, units and build rate', () => {
    const site = getSiteModel().site;
    const c = alternativeCosts(pricing, {
      areaM2: site.widthM * site.heightM,
      units: site.count,
      unitsPerDay: BUILD.unitsPerDay,
    });
    expect(c.masts).toBe(58);
    expect(c.halowMastsUsd).toBeGreaterThan(
      networkCost(pricing, siteLayoutSummary(site, BUILD)).totalUsd * 5,
    );
  });

  it('has a trade-off line for every radio setup in the pricing file', () => {
    for (const s of pricing.setups) expect(SETUP_TRADEOFFS[s.id]).toBeTruthy();
  });
});
