// Costs of the alternatives to our design (D54): the cost workbook's Alternatives sheet, computed on the
// generated site with the pricing file's base, labor, radio and contingency inputs.
import { MASTS, PRIVATE_LTE } from '../config/alternatives';
import { findSetup, type Pricing } from './pricing';

/** What the alternatives need to know about the site. */
export interface AlternativeSite {
  areaM2: number;
}

export interface AlternativeCosts {
  /** Masts on the two-path triangle grid. */
  masts: number;
  /** A1: Rajant mesh on solar masts; A2: our HaLow radio on the same masts. */
  rajantMastsUsd: number;
  halowMastsUsd: number;
  /** C: private LTE (CBRS) with towers. */
  privateLteUsd: number;
}

export function alternativeCosts(
  pricing: Pricing,
  site: AlternativeSite,
  masts: typeof MASTS = MASTS,
): AlternativeCosts {
  const labor = pricing.labor.wageUsdPerH * pricing.labor.burden;
  const bases = pricing.base.count * pricing.base.unitPriceUsd;
  const withContingency = (usd: number) => usd * (1 + pricing.contingency);
  const count = Math.ceil(
    (site.areaM2 / (masts.triangleArea * masts.rangeM ** 2)) * masts.edgeFactor,
  );
  const perMast =
    masts.poleUsd +
    masts.solarKitUsd +
    masts.antennasUsd +
    masts.laborHPerMast * labor +
    masts.equipmentUsd +
    masts.relocationsPerMast * masts.relocationUsd;
  const rajant = findSetup(pricing, 'mesh5Rajant');
  const halow = findSetup(pricing);
  const lte = PRIVATE_LTE;
  return {
    masts: count,
    rajantMastsUsd: withContingency(count * (perMast + rajant.radioUsd) + masts.surveyUsd + bases),
    halowMastsUsd: withContingency(
      count * (perMast + halow.radioUsd + halow.hostUsd) + masts.surveyUsd + bases,
    ),
    privateLteUsd: withContingency(
      lte.networkUsd +
        lte.devicesUsd +
        lte.firstYearUsd +
        lte.towers * (masts.poleUsd + masts.solarKitUsd),
    ),
  };
}
