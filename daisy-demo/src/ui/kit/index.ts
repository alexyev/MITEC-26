// The kit (spec 6, 13.1): the small set of components both tabs are built from.
// Panels, the legend, hover cards and the player render into the shell's dock slots (see dock.tsx).
export { Chip } from './Chip';
export { DockContext, DockPortal } from './dock';
export type { DockSlot, DockSlots } from './dock';
export { HoverCard, placeHoverCard } from './HoverCard';
export { IconButton } from './IconButton';
export type { IconButtonProps } from './IconButton';
export { InlineBar } from './InlineBar';
export { Kpi } from './Kpi';
export { Legend, LegendSwatch } from './Legend';
export { Panel } from './Panel';
export { Section } from './Section';
export { Segmented } from './Segmented';
export { Stepper } from './Stepper';
export {
  COLOR_TOKENS,
  canvasFont,
  cssVar,
  prefersReducedMotion,
  readColorTokens,
  tokenVar,
} from './tokens';
export type { FontSizeToken, MapColors } from './tokens';
export type {
  ChipProps,
  ColorToken,
  Corner,
  HoverCardProps,
  HoverCardRow,
  InlineBarProps,
  KpiProps,
  LegendItem,
  LegendProps,
  PanelProps,
  SectionProps,
  SegmentedOption,
  SegmentedProps,
  StepperProps,
} from './types';
