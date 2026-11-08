// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { Palette } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UI } from '../src/config/defaults';
import {
  Chip,
  DockContext,
  HoverCard,
  InlineBar,
  Kpi,
  Legend,
  Panel,
  Section,
  Segmented,
  Stepper,
  placeHoverCard,
  tokenVar,
} from '../src/ui/kit';
import type { LegendItem } from '../src/ui/kit';

// T2.1: a render test for every kit component (spec 13.1).
afterEach(cleanup);

describe('Panel', () => {
  it('renders its title and content, and folds into a chip and back', () => {
    const onMinimize = vi.fn();
    render(
      <Panel corner="tl" title="Survey" onMinimize={onMinimize}>
        <p>Inputs</p>
      </Panel>,
    );
    expect(screen.getByRole('heading', { name: 'Survey' })).toBeTruthy();
    expect(screen.getByText('Inputs')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Minimize Survey' }));
    expect(onMinimize).toHaveBeenLastCalledWith(true);
    expect(screen.queryByText('Inputs')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show Survey' }));
    expect(onMinimize).toHaveBeenLastCalledWith(false);
    expect(screen.getByText('Inputs')).toBeTruthy();
  });

  it('can be controlled from outside, with a chip that reads as something that opens (D160, D161)', () => {
    function Controlled() {
      const [minimized, setMinimized] = useState(true);
      return (
        <Panel
          corner="br"
          title="Legend"
          chipIcon={Palette}
          minimized={minimized}
          onMinimize={setMinimized}
        >
          <p>Colors</p>
        </Panel>
      );
    }
    render(<Controlled />);
    expect(screen.queryByText('Colors')).toBeNull();
    const chip = screen.getByRole('button', { name: 'Show Legend' });
    expect(chip.getAttribute('aria-expanded')).toBe('false');
    expect(chip.textContent).toBe('Legend');
    // The panel's icon, then its name, then a chevron: up, since a bottom panel opens upward.
    const icons = chip.querySelectorAll('svg[aria-hidden="true"]');
    expect([...icons].map((svg) => svg.getAttribute('class'))).toEqual([
      expect.stringContaining('panel-chip-icon'),
      expect.stringContaining('lucide-chevron-up'),
    ]);
    fireEvent.click(chip);
    expect(screen.getByText('Colors')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Minimize Legend' }));
    expect(screen.queryByText('Colors')).toBeNull();
  });

  it('renders into its dock slot inside a shell', () => {
    const slot = document.createElement('div');
    document.body.append(slot);
    render(
      <DockContext.Provider value={{ tr: slot }}>
        <Panel corner="tr" title="Readout">
          numbers
        </Panel>
      </DockContext.Provider>,
    );
    expect(slot.textContent).toContain('numbers');
    slot.remove();
  });

  it('renders nothing until its slot exists', () => {
    const { container } = render(
      <DockContext.Provider value={{}}>
        <Panel corner="tr" title="Readout">
          numbers
        </Panel>
      </DockContext.Provider>,
    );
    expect(container.textContent).toBe('');
  });
});

describe('Section', () => {
  it('shows its label and aside', () => {
    render(
      <Section label="Cost" aside={<Chip text="Team estimate · not quotes" />}>
        rows
      </Section>,
    );
    expect(screen.getByRole('heading', { name: 'Cost' })).toBeTruthy();
    expect(screen.getByText('Team estimate · not quotes').className).toBe('chip');
  });
});

describe('Segmented', () => {
  function Harness() {
    const [v, setV] = useState<'survey' | 'build'>('survey');
    return (
      <Segmented
        ariaLabel="View"
        value={v}
        onChange={setV}
        options={[
          { value: 'survey', label: 'Survey' },
          { value: 'build', label: 'Build & failure' },
        ]}
      />
    );
  }

  it('selects on click, with only the selected segment in the tab order', () => {
    render(<Harness />);
    const [a, b] = screen.getAllByRole('radio');
    expect(a.getAttribute('aria-checked')).toBe('true');
    expect(b.tabIndex).toBe(-1);
    fireEvent.click(b);
    expect(b.getAttribute('aria-checked')).toBe('true');
    expect(b.tabIndex).toBe(0);
  });

  it('moves the selection with the arrow keys and keeps them from the window', () => {
    const onWindowKey = vi.fn();
    window.addEventListener('keydown', onWindowKey);
    render(<Harness />);
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowRight' });
    expect(screen.getAllByRole('radio')[1].getAttribute('aria-checked')).toBe('true');
    expect(onWindowKey).not.toHaveBeenCalled();
    window.removeEventListener('keydown', onWindowKey);
  });
});

describe('Stepper', () => {
  it('steps within min and max and locks when disabled', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <Stepper min={1} max={8} value={8} onChange={onChange} label="UTVs" />,
    );
    expect(screen.getByText('8')).toBeTruthy();
    const more = screen.getByRole('button', { name: 'More UTVs' }) as HTMLButtonElement;
    expect(more.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Fewer UTVs' }));
    expect(onChange).toHaveBeenCalledWith(7);
    rerender(<Stepper min={1} max={8} value={3} onChange={onChange} label="UTVs" disabled />);
    expect((screen.getByRole('button', { name: 'Fewer UTVs' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});

describe('InlineBar and Kpi', () => {
  it('fills the bar in the story color, clamped, with a target tick', () => {
    const { container } = render(<InlineBar pct={140} token="signal" targetPct={95} />);
    const fill = container.querySelector('.inline-bar-fill') as HTMLElement;
    expect(fill.style.width).toBe('100%');
    expect(fill.style.background).toBe(tokenVar('signal'));
    expect((container.querySelector('.inline-bar-target') as HTMLElement).style.left).toBe('95%');
  });

  it('shows the label, the value with its unit, a bar and a note', () => {
    const { container } = render(
      <Kpi
        label="Coverage"
        value="97.2"
        unit="%"
        bar={{ pct: 97.2, token: 'signal', targetPct: 95 }}
        note="Target 95%"
      />,
    );
    expect(screen.getByText('Coverage')).toBeTruthy();
    expect(container.querySelector('.kpi-value')?.textContent).toBe('97.2%');
    expect(container.querySelector('.inline-bar.fill')).toBeTruthy();
    expect(screen.getByText('Target 95%')).toBeTruthy();
  });

  it('sets a headline value', () => {
    const { container } = render(<Kpi label="Total" value="$74.6k" headline />);
    expect(container.querySelector('.kpi.headline')).toBeTruthy();
  });
});

describe('HoverCard', () => {
  it('renders the title, subtitle, rows and hint', () => {
    render(
      <HoverCard
        x={100}
        y={100}
        title="Radio C6-2"
        subtitle="Online · 3 hops to base"
        rows={[
          { label: 'Hops', value: '3', pct: 30, token: 'data' },
          { label: 'Queue', value: '12' },
        ]}
        hint="Click to fail"
      />,
    );
    expect(screen.getByRole('tooltip').textContent).toContain('Radio C6-2');
    expect(screen.getByText('Online · 3 hops to base')).toBeTruthy();
    expect(screen.getAllByText(/Hops|Queue/)).toHaveLength(2);
    expect(screen.getByText('Click to fail')).toBeTruthy();
  });

  it('sits right of and below the pointer, and flips to stay inside the map', () => {
    const { offsetPx: o, edgePx: e } = UI.hoverCard;
    expect(placeHoverCard(100, 100, 260, 120, 1280, 720)).toEqual({ left: 100 + o, top: 100 + o });
    expect(placeHoverCard(1200, 100, 260, 120, 1280, 720)).toEqual({
      left: 1200 - o - 260,
      top: 100 + o,
    });
    expect(placeHoverCard(100, 700, 260, 120, 1280, 720)).toEqual({
      left: 100 + o,
      top: 700 - o - 120,
    });
    expect(placeHoverCard(2, 2, 260, 120, 200, 100)).toEqual({ left: e, top: e });
  });

  it('never covers a panel: it takes the first corner around the pointer that clears them all', () => {
    const o = UI.hoverCard.offsetPx;
    const readout = { left: 1104, top: 76, width: 320, height: 420 };
    const player = { left: 440, top: 738, width: 560, height: 130 };
    // Right of the pointer would run under the readout card, so the card goes left.
    expect(placeHoverCard(1000, 200, 260, 120, 1440, 900, [readout])).toEqual({
      left: 1000 - o - 260,
      top: 200 + o,
    });
    // Below the pointer would cover the player bar, so the card goes above.
    expect(placeHoverCard(600, 700, 260, 120, 1440, 900, [player])).toEqual({
      left: 600 + o,
      top: 700 - o - 120,
    });
    // Nowhere is clear: the corner that covers the least.
    const wall = { left: 0, top: 0, width: 1440, height: 400 };
    expect(placeHoverCard(600, 380, 260, 120, 1440, 900, [wall])).toEqual({
      left: 600 + o,
      top: 380 + o,
    });
  });
});

describe('Legend', () => {
  it('lists every item with a swatch of its shape and color', () => {
    const items: LegendItem[] = [
      { token: 'signal', label: 'Radio signal', shape: 'circle' },
      { token: 'data', label: 'Data', shape: 'dot' },
      { token: 'fail', label: 'Failed radio', shape: 'cross' },
      { token: 'fail', label: 'Cut off', shape: 'ring' },
      { token: 'work', label: 'UTV path', shape: 'dash' },
      { token: 'signal', label: 'Link', shape: 'line' },
      { token: 'base', label: 'Base', shape: 'square' },
      { token: 'done', label: 'Surveyed', shape: 'fill' },
      { token: 'work', label: 'Drone', shape: 'drone' },
    ];
    const { container } = render(<Legend items={items} />);
    expect(screen.getByRole('heading', { name: 'Legend' })).toBeTruthy();
    expect(container.querySelectorAll('.legend-item')).toHaveLength(items.length);
    expect(container.querySelectorAll('svg.legend-swatch')).toHaveLength(items.length);
    expect(container.querySelector('svg.legend-swatch path')?.getAttribute('stroke')).toBe(
      tokenVar('fail'),
    );
  });
});
