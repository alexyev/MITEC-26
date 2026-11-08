// The shell (spec 6.2): the map stage under a floating layout. The top row holds the brand chip, the tab switch
// and a slot for a tab's compact top-right element (the honesty badge was removed, D53); the dock slots hold
// the tab's panels, map tools, legend and player; the credit sits at the very bottom center, under the player.
// The brand chip reopens the home screen and the ? button beside it replays the guided tour (D90, D91); the
// home screen and the tour are layered over the shell, and the app behind the home screen is inert.
import { useEffect, useRef, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import type { ReactNode } from 'react';
import { UI } from '../../config/defaults';
import { TABS, useShellStore } from '../../state/store';
import { DockContext } from '../kit/dock';
import type { DockSlot, DockSlots } from '../kit/dock';
import { Segmented } from '../kit/Segmented';
import { useGuideStore } from '../../state/guide';
import { Daisy } from '../guide/Daisy';
import { Home } from '../guide/Home';
import { Tour, getTourSteps } from '../guide/Tour';

const SLOTS: DockSlot[] = ['top', 'tl', 'tr', 'tools', 'br', 'player', 'float'];

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
  const home = useGuideStore((s) => s.home);
  const appRef = useRef<HTMLDivElement>(null);

  // While the home screen is up, the app behind it takes no focus, clicks or screen-reader reading.
  const behindHome = home === 'open' || home === 'opening';
  useEffect(() => {
    for (const el of appRef.current?.querySelectorAll<HTMLElement>(
      '.stage, .overlay, .float-layer',
    ) ?? []) {
      el.inert = behindHome;
    }
  }, [behindHome]);

  const reopenHome = () => {
    const { tourStep, endTour, openHome } = useGuideStore.getState();
    if (tourStep !== null) endTour(tourStep >= getTourSteps().length - 1 ? 'done' : 'skipped');
    openHome();
  };

  return (
    <DockContext.Provider value={slots}>
      <div className="shell" data-home={home} ref={appRef}>
        <main className="stage" aria-label="Map" data-tour="map">
          {children}
        </main>
        <div className="overlay">
          <div className="top-left">
            <button
              type="button"
              className="brand"
              data-tour="brand"
              onClick={reopenHome}
              aria-label={`${UI.brand}: home`}
              title="Home"
            >
              <Daisy className="daisy-logo" />
              {UI.brand}
            </button>
            <button
              type="button"
              className="brand-btn"
              data-tour="tour"
              onClick={() => useGuideStore.getState().startTour()}
              aria-label="Take the tour"
              title="Take the tour"
            >
              <CircleHelp
                size={UI.icon.sizePx}
                strokeWidth={UI.icon.strokeWidth}
                aria-hidden="true"
              />
            </button>
          </div>
          <div className="top-center">
            <Segmented
              options={TABS}
              value={tab}
              onChange={setTab}
              ariaLabel="View"
              data-tour="tabs"
            />
          </div>
          <div className="top-right" ref={refs.top} />
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
        <Tour />
        <Home />
      </div>
    </DockContext.Provider>
  );
}
