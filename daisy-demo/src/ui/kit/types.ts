// Shared kit contract (spec 13.1): the story colors, legend items and the props of every kit component.
// Minimum props as in the spec; optional props are extras that the tabs may use.
import type { ReactNode } from 'react';

export type ColorToken = 'signal' | 'data' | 'fail' | 'work' | 'unit' | 'done' | 'base';
export interface LegendItem {
  token: ColorToken;
  label: string;
  shape: 'dot' | 'circle' | 'line' | 'dash' | 'cross' | 'ring' | 'square' | 'fill' | 'drone' | 'pad';
  /** A map variant of the token to draw with instead, as a CSS variable (for example '--c-old-route'). */
  colorVar?: string;
}

/** Corner of the screen a floating panel docks to (spec 6.2). */
export type Corner = 'tl' | 'tr' | 'br';

/** <Panel title? onMinimize? corner />: a floating glass card that minimizes into a chip in its corner. */
export interface PanelProps {
  corner: Corner;
  title?: string;
  /** Called after the panel folds into its chip or opens again (`true` when minimized). */
  onMinimize?: (minimized: boolean) => void;
  /** Text of the chip while minimized; defaults to `title`. */
  chipLabel?: string;
  /** Accessible name when there is no title. */
  ariaLabel?: string;
  /** Right side of the title row, before the minimize button (for example a chip). */
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/** <Section label>: a block of a panel with an 11 px uppercase label; sections are split by hairlines. */
export interface SectionProps {
  label: string;
  /** Right side of the label row (for example the estimate chip). */
  aside?: ReactNode;
  children?: ReactNode;
}

/** <Segmented options value onChange />: a pill track with a raised selected segment (spec 6.5). */
export interface SegmentedOption<V extends string = string> {
  value: V;
  label: string;
  /** Tooltip and accessible name when the label alone is terse (for example "1×"). */
  title?: string;
}
export interface SegmentedProps<V extends string = string> {
  options: SegmentedOption<V>[];
  value: V;
  onChange: (value: V) => void;
  ariaLabel?: string;
  /** 'compact' sits flat inside a panel, 28 px high (the player bar's speed control). */
  size?: 'default' | 'compact';
}

/** <Stepper min max value onChange label />: minus, value, plus (spec 6.5). */
export interface StepperProps {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  label: string;
  /** Locks the stepper, for example while the 4x4s are driving. */
  disabled?: boolean;
}

/** <InlineBar pct token />: a small bar for a share, 48 x 4 px by default (spec 6.6). */
export interface InlineBarProps {
  /** 0 to 100. */
  pct: number;
  token: ColorToken;
  /** A tick at this percentage, for example the 95% coverage target. */
  targetPct?: number;
  /** Width in px; the bar fills its row when 'fill'. */
  width?: number | 'fill';
}

/** <Chip text />: 11 px uppercase on a hairline pill (spec 6.5). */
export interface ChipProps {
  text: string;
  title?: string;
}

/** <Kpi label value unit? bar? />: one readout row; `headline` sets the value in 20 px (spec 6.4). */
export interface KpiProps {
  label: string;
  value: string;
  unit?: string;
  bar?: { pct: number; token: ColorToken; targetPct?: number };
  headline?: boolean;
  /** A short line under the row in `--text-3`, for example "Target 95%". */
  note?: string;
}

/** <HoverCard x y title subtitle rows hint? />: the card next to the pointer (spec 6.6). */
export interface HoverCardRow {
  label: string;
  value: string;
  pct?: number;
  token?: ColorToken;
}
export interface HoverCardProps {
  /** Pointer position in px, relative to the map (the viewport). */
  x: number;
  y: number;
  title: string;
  subtitle: string;
  rows: HoverCardRow[];
  /** What a click does, for example "Click to fail". */
  hint?: string;
}

/** <Legend items />: the meanings of the colors visible in the current tab (spec 5.1). */
export interface LegendProps {
  items: LegendItem[];
  title?: string;
}
