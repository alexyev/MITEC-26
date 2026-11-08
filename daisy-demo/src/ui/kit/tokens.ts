// Story colors for canvas code (spec 5.2, 13.1): map code reads every color from src/ui/tokens.css
// through these helpers, so tokens.css stays the only place with color values and font sizes.
import type { ColorToken } from './types';

export const COLOR_TOKENS: readonly ColorToken[] = [
  'signal',
  'data',
  'fail',
  'work',
  'unit',
  'done',
  'base',
];

/** The CSS variable of a story color, for inline styles: `var(--c-signal)`. */
export function tokenVar(token: ColorToken): string {
  return `var(--c-${token})`;
}

/** Map variants of the story colors in tokens.css (alpha only; same hue and meaning). */
export interface MapColors extends Record<ColorToken, string> {
  signalFill: string;
  signalLink: string;
  dataRoute: string;
  unitPlanned: string;
  workPath: string;
  ground: string;
  outline: string;
  halo: string;
}

/** Read one CSS variable from `el` (the document root by default). */
export function cssVar(name: string, el: Element = document.documentElement): string {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

/** Read the story colors and their map variants once, for a canvas render loop. */
export function readColorTokens(el: Element = document.documentElement): MapColors {
  const css = getComputedStyle(el);
  const v = (name: string) => css.getPropertyValue(name).trim();
  const base = Object.fromEntries(COLOR_TOKENS.map((t) => [t, v(`--c-${t}`)])) as Record<
    ColorToken,
    string
  >;
  return {
    ...base,
    signalFill: v('--c-signal-fill'),
    signalLink: v('--c-signal-link'),
    dataRoute: v('--c-data-route'),
    unitPlanned: v('--c-unit-planned'),
    workPath: v('--c-work-path'),
    ground: v('--c-map-bg'),
    outline: v('--c-map-outline'),
    halo: v('--c-map-halo'),
  };
}

export type FontSizeToken = 11 | 12 | 13 | 14 | 16 | 20;

/** A canvas font string from the type tokens, for example `canvasFont(11, 600)` for map labels. */
export function canvasFont(
  size: FontSizeToken,
  weight = 500,
  el: Element = document.documentElement,
) {
  const css = getComputedStyle(el);
  return `${weight} ${css.getPropertyValue(`--fs-${size}`).trim()} ${css.getPropertyValue('--font-sans').trim()}`;
}

/** True when the viewer asked for reduced motion (spec 6.7): no fades on the map. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}
