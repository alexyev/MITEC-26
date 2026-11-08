// The survey UTV's kit as rows with prices (D84): the parts in config/utvKit.ts, and the Starlink Mini with its
// mount from the cost workbook (pricing.json). A part without a sourced price keeps a null and shows no figure.
import { KIT_LIDAR, LIDAR_GRADES, UTV_KIT } from '../../config/utvKit';
import type { LidarGrade } from '../../config/utvKit';
import { surveyPrice } from '../../engine/pricing';
import type { Pricing } from '../../engine/pricing';

export interface KitRow {
  id: string;
  label: string;
  detail: string;
  /** All units of the part, in USD, or null without a sourced price. */
  usd: number | null;
  source: string;
}

export interface UtvKitCost {
  rows: KitRow[];
  /** Sum of the priced rows. */
  totalUsd: number;
  /** The drone with its lidar, and everything else (the UTV and its ground kit). */
  droneUsd: number;
  groundUsd: number;
  /** Rows without a sourced price, left out of the total. */
  unpriced: KitRow[];
  /** Starlink service per month, on top of the purchase, or null. */
  serviceUsdPerMonth: number | null;
  grade: LidarGrade;
}

const WORKBOOK = "the team's cost workbook (Alternatives sheet: Starlink kit and mounting)";

export function utvKitCost(pricing: Pricing): UtvKitCost {
  const rows: KitRow[] = UTV_KIT.map((p) => ({
    id: p.id,
    label: p.label,
    detail: p.detail,
    usd: p.unitUsd === null ? null : p.unitUsd * p.count,
    source: p.source,
  }));
  const kit = surveyPrice(pricing, 'starlinkKitUsd');
  const mount = surveyPrice(pricing, 'starlinkMountUsd');
  const starlink: KitRow = {
    id: 'starlink',
    label: 'Starlink Mini',
    detail: 'kit, mounting and power',
    usd: kit !== null && mount !== null ? kit + mount : null,
    source: WORKBOOK,
  };
  // The Starlink Mini sits with the other parts on the UTV, before the drone.
  const at = rows.findIndex((r) => r.id === 'drone');
  rows.splice(at < 0 ? rows.length : at, 0, starlink);
  const priced = rows.filter((r) => r.usd !== null);
  const totalUsd = priced.reduce((s, r) => s + (r.usd ?? 0), 0);
  const droneUsd = rows.find((r) => r.id === 'drone')?.usd ?? 0;
  return {
    rows,
    totalUsd,
    droneUsd,
    groundUsd: totalUsd - droneUsd,
    unpriced: rows.filter((r) => r.usd === null),
    serviceUsdPerMonth: surveyPrice(pricing, 'starlinkPlanUsdPerMonth'),
    grade: LIDAR_GRADES.find((g) => g.id === KIT_LIDAR)!,
  };
}

/** What front and back lidar of a grade costs: a pair of scanners, or one system that covers both. */
export function gradeCost(g: LidarGrade): { lowUsd: number; highUsd: number } {
  return { lowUsd: g.lowUsd * g.count, highUsd: g.highUsd * g.count };
}
