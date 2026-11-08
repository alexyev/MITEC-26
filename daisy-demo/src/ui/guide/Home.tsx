// The home screen (D90, D130): a short, calm page over the already-loaded map, which shows through blurred
// and dimmed, with the daisy on the right. "Open the demo" leaves it with a same-page transition into the
// map, then the tour starts unless this viewer already finished or skipped it; the brand chip at the top
// left reopens it.
import { useEffect, useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import { HOME } from '../../config/tour';
import { UI } from '../../config/defaults';
import { skipTourFromHome, useGuideStore } from '../../state/guide';
import { prefersReducedMotion } from '../kit/tokens';
import { Daisy, DaisyBurst } from './Daisy';
import { tourFacts } from './facts';
import './guide.css';

/** Keys the player listens to on the window; the map behind the home screen must not react to them. */
const PLAYER_KEYS = new Set([' ', 'ArrowLeft', 'ArrowRight']);

export function Home() {
  const phase = useGuideStore((s) => s.home);
  if (phase === 'closed') return null;
  return <HomeScreen />;
}

function HomeScreen() {
  const phase = useGuideStore((s) => s.home);
  const seen = useGuideStore((s) => s.seen);
  const { leaveHome, homeLeft, homeShown } = useGuideStore.getState();
  const rootRef = useRef<HTMLDivElement>(null);
  const f = tourFacts();

  // Reopening: the first frame paints it transparent, the next fades it in.
  useEffect(() => {
    if (phase !== 'opening') return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(homeShown);
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [phase, homeShown]);

  // Leaving: the map comes into focus while the page fades; then the tour, if asked for, starts.
  useEffect(() => {
    if (phase !== 'closing') return;
    const ms = prefersReducedMotion() ? HOME.reducedTransitionMs : HOME.transitionMs;
    const timer = window.setTimeout(homeLeft, ms);
    return () => window.clearTimeout(timer);
  }, [phase, homeLeft]);

  useEffect(() => {
    // The page takes focus (not its first button, so no focus ring greets the viewer); Tab reaches the actions.
    if (phase === 'open') rootRef.current?.focus({ preventScroll: true });
  }, [phase]);

  useEffect(() => {
    if (phase !== 'open') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        leaveHome('map');
      } else if (PLAYER_KEYS.has(e.key)) {
        // Buttons still take Space natively; only the player behind the page is kept out.
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [phase, leaveHome]);

  return (
    <div
      className="home"
      ref={rootRef}
      tabIndex={-1}
      data-phase={phase}
      role="dialog"
      aria-modal="true"
      aria-labelledby="home-title"
      aria-describedby="home-lede"
    >
      <div className="home-column">
        <h1 className="home-title" id="home-title">
          {UI.brand}
        </h1>
        <p className="home-lede" id="home-lede">
          A {f.acres}-acre site holds {f.units} P3 units, and every machine that surveys and builds
          it needs a link. {f.vehicle}s with lidar and drones survey the ground over Starlink. Then
          the name: the radios on the units are <strong>daisy-chained</strong>, each passing data to
          the next, unit to unit, back to the base, so the network grows with the build.
        </p>
        <div className="home-actions">
          <button
            type="button"
            className="home-btn primary"
            onClick={() => leaveHome(seen ? 'map' : 'tour')}
          >
            Open the demo
            <ArrowRight
              size={UI.icon.sizePx}
              strokeWidth={UI.icon.strokeWidth}
              aria-hidden="true"
            />
          </button>
          {seen ? (
            <button type="button" className="home-btn" onClick={() => leaveHome('tour')}>
              Take the tour
            </button>
          ) : (
            <button type="button" className="home-btn quiet" onClick={skipTourFromHome}>
              Skip the tour
            </button>
          )}
        </div>
      </div>
      <div className="home-art">
        <DaisyBurst />
        <Daisy />
      </div>
      <footer className="home-foot">
        <a className="credit" href={UI.credit.url} target="_blank" rel="noopener noreferrer">
          {UI.credit.label}
        </a>
      </footer>
    </div>
  );
}
