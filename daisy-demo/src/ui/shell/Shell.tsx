// The shell (spec 6.2): the map stage under a floating layout. The top row holds the brand chip, the tab switch
// and the honesty badge; the dock slots hold the tab's panels, map tools, legend and player; the credit sits
// at the very bottom center, under the player.
import { useState } from 'react';
import type { ReactNode } from 'react';
import { UI } from '../../config/defaults';
import { TABS, useShellStore } from '../../state/store';
import { Chip } from '../kit/Chip';
import { DockContext } from '../kit/dock';
import type { DockSlot, DockSlots } from '../kit/dock';
import { Segmented } from '../kit/Segmented';

const SLOTS: DockSlot[] = ['tl', 'tr', 'tools', 'br', 'player', 'float'];

/** One stable ref callback per slot; the slots mount once with the shell. */
function useSlotRefs() {
  const [slots, setSlots] = useState<DockSlots>({});
  const [refs] = useState(
    () =>
      Object.fromEntries(
        SLOTS.map((slot) => [
          slot,
          (el: HTMLElement | null) => setSlots((s) => (s[slot] === el ? s : { ...s, [slot]: el })),
        ]),
      ) as Record<DockSlot, (el: HTMLElement | null) => void>,
  );
  return { slots, refs };
}

export function Shell({ children }: { children: ReactNode }) {
  const tab = useShellStore((s) => s.tab);
  const setTab = useShellStore((s) => s.setTab);
  const { slots, refs } = useSlotRefs();

  return (
    <DockContext.Provider value={slots}>
      <div className="shell">
        <main className="stage" aria-label="Map">
          {children}
        </main>
        <div className="overlay">
          <div className="top-left">
            <div className="brand">{UI.brand}</div>
          </div>
          <div className="top-center">
            <Segmented options={TABS} value={tab} onChange={setTab} ariaLabel="View" />
          </div>
          <div className="top-right">
            <Chip text="Simulated · Illustrative values" />
          </div>
          <div className="dock dock-left" ref={refs.tl} />
          <div className="dock dock-right">
            <div className="dock-slot dock-tr" ref={refs.tr} />
            <div className="dock-foot">
              <div className="dock-slot dock-tools" ref={refs.tools} />
              <div className="dock-slot dock-br" ref={refs.br} />
            </div>
          </div>
          <div className="dock dock-bottom">
            <div className="dock-slot dock-player" ref={refs.player} />
            <a className="credit" href={UI.credit.url} target="_blank" rel="noopener noreferrer">
              {UI.credit.label}
            </a>
          </div>
        </div>
        <div className="float-layer" ref={refs.float} />
      </div>
    </DockContext.Provider>
  );
}
