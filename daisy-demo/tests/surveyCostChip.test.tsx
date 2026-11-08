// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SURVEY_ALTERNATIVES } from '../src/config/survey';
import { PRICING, surveyCost } from '../src/engine/pricing';
import type { Pricing } from '../src/engine/pricing';
import { getSurveyPlan } from '../src/state/survey';
import { SurveyCostChip, surveyCostRows, unpricedText } from '../src/ui/survey/SurveyCostChip';
import { surveyAlternatives } from '../src/ui/survey/surveyAlternatives';
import { utvKitCost } from '../src/ui/survey/utvKit';
import { CAPTAIN_ESTIMATE_USD, LIDAR_GRADES, UTV_KIT } from '../src/config/utvKit';

// D63: the survey cost is a quiet chip in the Build tab's pattern (D54), with the alternatives behind it.
afterEach(cleanup);

const plan = getSurveyPlan(3);
const cost = surveyCost(PRICING.pricing, 3, plan.vehicleHours, plan.finishH);
const kit = utvKitCost(PRICING.pricing);

function renderChip(focus = false) {
  return render(
    <div className="shell">
      <SurveyCostChip cost={cost} kit={kit} pricingErrors={0} focus={focus} />
    </div>,
  );
}

describe('SurveyCostChip (D63)', () => {
  it('shows only the sourced Starlink cost until it is opened', () => {
    renderChip();
    const chip = screen.getByRole('button', { name: /Survey connectivity/ });
    expect(chip.textContent).toContain('$3.15k');
    expect(chip.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Starlink kits')).toBeNull();
    fireEvent.click(chip);
    expect(chip.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Starlink kits')).toBeTruthy();
    expect(screen.getByText('Starlink service')).toBeTruthy();
  });

  it("opens by itself during the walkthrough's Done step", () => {
    renderChip(true);
    expect(screen.getByText('Starlink kits')).toBeTruthy();
  });

  it('never shows a placeholder as a cost, nor a "to confirm" or estimate label', () => {
    renderChip(true);
    const card = screen.getByRole('region', { name: 'Survey cost' });
    const text = card.textContent ?? '';
    // The unverified $150 hourly rate never appears, alone or multiplied out.
    expect(text).not.toContain('$150');
    expect(text).not.toContain('$6.9');
    expect(text.toLowerCase()).not.toContain('to confirm');
    expect(text.toLowerCase()).not.toContain('estimate');
    expect(text).toContain('Without the UTV hire: no sourced hourly rate yet');
  });

  it('opens the alternatives: every survey approach with its trade-off, only ours priced', () => {
    renderChip(true);
    fireEvent.click(screen.getByRole('button', { name: 'Compare alternatives' }));
    const sheet = screen.getByRole('dialog', { name: 'Alternatives' });
    const text = sheet.textContent ?? '';
    for (const a of SURVEY_ALTERNATIVES) {
      expect(text).toContain(a.label);
      expect(text).toContain(a.verdict);
    }
    expect(text).toContain('Ours');
    expect(text.match(/\$/g)).toHaveLength(1);
    expect(text).not.toContain('Starlink on every machine');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('survey cost rows and alternatives', () => {
  it('list only the parts with a sourced price, which add up to the figure', () => {
    const rows = surveyCostRows(cost);
    expect(rows.map((r) => r.label)).toEqual(['Starlink kits', 'Starlink service']);
    expect(rows.reduce((s, r) => s + r.usd, 0)).toBe(cost.pricedUsd);
  });

  it('price the UTVs and drones too, and drop the note, once their prices are sourced', () => {
    const p = structuredClone(PRICING.pricing) as Pricing;
    p.survey.unverified = [];
    p.survey.droneUsd = 2000;
    const full = surveyCost(p, 3, plan.vehicleHours, plan.finishH);
    expect(surveyCostRows(full).map((r) => r.label)).toEqual([
      'UTV hire',
      'Drones',
      'Starlink kits',
      'Starlink service',
    ]);
    expect(unpricedText(full)).toBeNull();
    const ours = surveyAlternatives(full).find((r) => r.ours);
    expect(ours).toMatchObject({ totalUsd: full.pricedUsd, costNote: undefined });
  });

  it('give every approach other than ours no cost, since no source prices them', () => {
    const rows = surveyAlternatives(cost);
    expect(rows.map((r) => r.id)).toEqual([
      'ours',
      'gpsCrew',
      'droneOnly',
      'contractor',
      'quadruped',
    ]);
    expect(rows[0]).toMatchObject({
      ours: true,
      totalUsd: cost.pricedUsd,
      costNote: 'Starlink only',
    });
    for (const r of rows.slice(1)) expect(r.totalUsd).toBeNull();
  });
});

describe('the survey UTV, all in (D84)', () => {
  it('prices every part with a source, and leaves the unpriced integration out of the total', () => {
    for (const p of UTV_KIT) expect(p.source.length).toBeGreaterThan(0);
    expect(kit.rows.map((r) => r.id)).toEqual([
      'utv',
      'lidar',
      'rtk',
      'compute',
      'starlink',
      'drone',
      'integration',
    ]);
    expect(kit.unpriced.map((r) => r.id)).toEqual(['integration']);
    // Ranger XP 1000 $22,594, 2 x $4,500 lidar, $1,023 RTK, $3,258 compute, $799 Starlink, $24,989 drone.
    expect(kit.totalUsd).toBe(22_594 + 9_000 + 1_023 + 3_258 + 799 + 24_989);
    expect(kit.groundUsd).toBe(kit.totalUsd - 24_989);
    expect(kit.serviceUsdPerMonth).toBe(250);
  });

  it("answers the captain's $50k: the ground kit fits under it, the drone does not", () => {
    expect(kit.groundUsd).toBeLessThan(CAPTAIN_ESTIMATE_USD);
    expect(kit.totalUsd).toBeGreaterThan(CAPTAIN_ESTIMATE_USD);
    // Survey-grade lidar alone, front and back, is over $50k.
    const slam = LIDAR_GRADES.find((g) => g.id === 'slam')!;
    expect(slam.lowUsd * slam.count).toBeGreaterThan(CAPTAIN_ESTIMATE_USD);
  });

  it('opens the survey UTV sheet from the cost card, with the drawing, the parts and the grades', () => {
    renderChip(true);
    fireEvent.click(screen.getByRole('button', { name: /One survey UTV, all in/ }));
    const sheet = screen.getByRole('dialog', { name: 'The survey UTV' });
    expect(sheet.querySelector('svg[role=img]')).toBeTruthy();
    for (const label of [
      'Lidar · front',
      'Lidar · back',
      'RTK GNSS',
      'Starlink Mini',
      'Rugged compute',
      'Drone dock',
    ])
      expect(sheet.textContent).toContain(label);
    expect(sheet.textContent).toContain('$61.7k');
    expect(sheet.textContent).toContain('No public price');
    expect(sheet.textContent).toContain('Mobile mapping system');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'The survey UTV' })).toBeNull();
  });
});
