// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PRICING } from '../src/engine/pricing';
import { ALTERNATIVES, FULL_SITE_COST } from '../src/state/build';
import { CostChip } from '../src/ui/build/CostChip';

// D54: the cost is a quiet chip that opens a card on demand, and the card opens the Alternatives sheet.
afterEach(cleanup);

function renderChip(focus = false) {
  return render(
    <div className="shell">
      <CostChip cost={FULL_SITE_COST} pricingErrors={0} alternatives={ALTERNATIVES} focus={focus} />
    </div>,
  );
}

describe('CostChip (D54)', () => {
  it('shows only the total until it is opened', () => {
    renderChip();
    const chip = screen.getByRole('button', { name: /Network cost/ });
    expect(chip.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Per container')).toBeNull();
    fireEvent.click(chip);
    expect(chip.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Per container')).toBeTruthy();
    expect(screen.getByText('Batteries')).toBeTruthy();
  });

  it("opens by itself during the walkthrough's cost step", () => {
    renderChip(true);
    expect(screen.getByText('Share of P3 hardware')).toBeTruthy();
  });

  it('opens the Alternatives sheet with every radio setup and the other ways, ours marked', () => {
    renderChip(true);
    fireEvent.click(screen.getByRole('button', { name: 'Compare alternatives' }));
    const sheet = screen.getByRole('dialog', { name: 'Alternatives' });
    for (const s of PRICING.pricing.setups) expect(sheet.textContent).toContain(s.label);
    expect(sheet.textContent).toContain('One site base');
    expect(sheet.textContent).toContain('Private LTE (CBRS) towers');
    expect(sheet.querySelectorAll('.alts-row.ours')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Close alternatives' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows no estimate chip and no "to confirm" labels (D53)', () => {
    const { container } = renderChip(true);
    fireEvent.click(screen.getByRole('button', { name: 'Compare alternatives' }));
    const text = (container.ownerDocument.body.textContent ?? '').toLowerCase();
    expect(text).not.toContain('to confirm');
    expect(text).not.toContain('not quotes');
    expect(text).not.toContain('estimate');
  });
});

describe('CostChip links', () => {
  it('names the setup HaLow with a help link, and links the proven-technology note, both in new tabs', () => {
    renderChip(true);
    expect(screen.queryByText(/integrated antennas/)).toBeNull();
    const help = screen.getByRole('link', { name: 'What is HaLow?' });
    expect(help.getAttribute('href')).toBe('https://en.wikipedia.org/wiki/IEEE_802.11ah');
    expect(help.getAttribute('target')).toBe('_blank');
    const proven = screen.getByRole('link', { name: /Proven technology/ });
    expect(proven.getAttribute('href')).toBe('https://rajant.com/markets/mining/');
    expect(proven.getAttribute('target')).toBe('_blank');
    expect(proven.getAttribute('rel')).toContain('noopener');
  });
});
