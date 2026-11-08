// Open state of a tab's cost card (D54, D63), kept in the panel store with the other panels (D160): it starts
// folded into its chip, the guided tour can open it, and each tab remembers it while the viewer is away.
// The walkthrough still opens it by itself on its cost step and folds it after (spec 10.3); a click decides
// until the walkthrough's step changes again. Escape and a click elsewhere close it, except a click in the
// tour's callout, whose step may be spotlighting it.
import { useEffect, useRef, type RefObject } from 'react';
import { usePanelOpen } from '../../state/panels';
import type { TabId } from '../../state/store';

/** Clicks here leave an open card open: the tour's callout talks about it. */
const KEEPS_OPEN = '.tour-callout';

export function useCostCard(
  tab: TabId,
  focus: boolean,
  rootRef: RefObject<HTMLElement | null>,
  /** A sheet opened from the card is up: the sheet owns Escape and clicks until it closes. */
  sheetOpen: boolean,
): [boolean, (open: boolean) => void] {
  const [open, setOpen] = usePanelOpen(tab, 'cost');

  // Follow the walkthrough's focus when it changes (and when a tab mounts on its cost step), never at rest.
  const followed = useRef(false);
  useEffect(() => {
    if (focus === followed.current) return;
    followed.current = focus;
    setOpen(focus);
  }, [focus, setOpen]);

  useEffect(() => {
    if (!open || sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (target && (rootRef.current?.contains(target) || target.closest(KEEPS_OPEN))) return;
      setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [open, sheetOpen, setOpen, rootRef]);

  return [open, setOpen];
}
