// Dock slots of the floating layout (spec 6.2): the shell owns the slots, and kit components render into
// them through portals, so a tab can nest its panels anywhere and they still never overlap.
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * tl: control panel · tr: readout card · tools: map tools above the legend · br: legend ·
 * player: player bar · float: hover cards over everything.
 */
export type DockSlot = 'tl' | 'tr' | 'tools' | 'br' | 'player' | 'float';

export type DockSlots = Partial<Record<DockSlot, HTMLElement | null>>;

/** `undefined` outside a shell (tests, isolated renders): components then render in place. */
export const DockContext = createContext<DockSlots | undefined>(undefined);

/** Render `children` into a dock slot of the shell, or in place when there is no shell. */
export function DockPortal({ slot, children }: { slot: DockSlot; children: ReactNode }) {
  const slots = useContext(DockContext);
  if (slots === undefined) return <>{children}</>;
  const target = slots[slot];
  return target ? createPortal(children, target) : null;
}
