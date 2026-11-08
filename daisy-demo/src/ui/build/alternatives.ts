// Rows of the Alternatives comparison (D54): every radio setup of the pricing file costed on the generated site,
// and other ways to connect the site with a one-line verdict. A cost shows only where a source gives one.
import { EXOWATT_EXAMPLE, EXOWATT_TODAY, SETUP_TRADEOFFS } from '../../config/alternatives';
import { BUILD } from '../../config/defaults';
import { alternativeCosts } from '../../engine/alternatives';
import { networkCost, siteLayoutSummary, type Pricing } from '../../engine/pricing';
import type { Site } from '../../engine/types';
import { formatUsd } from '../survey/format';

const count = new Intl.NumberFormat('en-US').format;

export interface SetupRow {
  id: string;
  label: string;
  modules: number;
  totalUsd: number;
  tradeoff: string;
  ours: boolean;
}

export interface SolutionRow {
  id: string;
  label: string;
  /** Up-front cost on this site, or null when no source gives one. */
  totalUsd: number | null;
  /** Shown under the cost when the figure is not for this site. */
  costNote?: string;
  verdict: string;
  ours?: boolean;
}

export interface Alternatives {
  setups: SetupRow[];
  solutions: SolutionRow[];
}

export function buildAlternatives(pricing: Pricing, site: Site): Alternatives {
  const layout = siteLayoutSummary(site, BUILD);
  const setups: SetupRow[] = pricing.setups.map((s) => {
    const c = networkCost(pricing, layout, s.id);
    return {
      id: s.id,
      label: s.label,
      modules: c.modules,
      totalUsd: c.totalUsd,
      tradeoff: SETUP_TRADEOFFS[s.id] ?? '',
      ours: s.id === pricing.defaultSetup,
    };
  });
  const ours = setups.find((s) => s.ours);
  const oursUsd = ours?.totalUsd ?? NaN;
  const times = (usd: number) => `about ${Math.round(usd / oursUsd)}x our cost`;

  const alt = alternativeCosts(pricing, {
    areaM2: site.widthM * site.heightM,
    units: site.count,
    unitsPerDay: BUILD.unitsPerDay,
  });
  const { early, later } = EXOWATT_TODAY;
  const solutions: SolutionRow[] = [
    {
      id: 'corner',
      label: 'Corner modules on the P3 units',
      totalUsd: oursUsd,
      verdict: 'Ours: grows with the build, and the units power it once they run.',
      ours: true,
    },
    {
      id: 'oneBase',
      label: 'One site base',
      totalUsd: null,
      verdict: `Exowatt today: ${early.online}/${early.assets} online at ${count(early.units)} units, ${later.online}/${later.assets} at ${count(later.units)}.`,
    },
    {
      id: 'exowattRelays',
      label: 'Relay masts along the roads',
      totalUsd: EXOWATT_EXAMPLE.hardwareUsd,
      costNote: 'Exowatt example',
      verdict: `${EXOWATT_EXAMPLE.powerKw} kW of masts; one relay down leaves ${EXOWATT_EXAMPLE.coverageAfterFailurePct}% coverage, under the 95% target.`,
    },
    {
      id: 'halowMasts',
      label: `HaLow on ${alt.masts} solar masts`,
      totalUsd: alt.halowMastsUsd,
      verdict: `Our radio on masts: ${times(alt.halowMastsUsd)}, and masts must move with the build.`,
    },
    {
      id: 'rajantMasts',
      label: `Rajant mesh on ${alt.masts} solar masts`,
      totalUsd: alt.rajantMastsUsd,
      verdict: `The mining approach: ${times(alt.rajantMastsUsd)}, with the same moving masts.`,
    },
    {
      id: 'privateLte',
      label: 'Private LTE (CBRS) towers',
      totalUsd: alt.privateLteUsd,
      verdict: `A managed network at ${times(alt.privateLteUsd)}: yearly fees, and LTE devices on everything.`,
    },
    {
      id: 'starlinkMachines',
      label: 'Starlink on every machine',
      totalUsd: alt.starlinkPerMachineUsd,
      verdict: 'Cheaper, but only machines: no crews, no P3 units, no local safety link.',
    },
    {
      id: 'starlinkWifi',
      label: 'Starlink and Wi-Fi access points',
      totalUsd: null,
      verdict: 'The usual site setup: cranes block the dish, and the access points need power.',
    },
  ];
  return { setups, solutions };
}

/** "$80.6k", or nothing for an option without a sourced cost. */
export function costText(usd: number | null): string {
  return usd === null ? '' : formatUsd(usd);
}
