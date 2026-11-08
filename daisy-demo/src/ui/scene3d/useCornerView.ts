// The Build tab's visits to a radio's corner in 3D (D120, D121): which radio, the map's view and scene at the
// moment the viewer flew down, and the 3D view's chunk, fetched once on first use (three.js stays out of the
// main bundle). The guided tour and the home screen take the whole app, so either one ends a visit at once.
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { useGuideStore } from '../../state/guide';
import type { Scene } from '../build/scene';
import { getTourSteps } from '../guide/Tour';
import type { Viewport } from '../map/viewport';
import type { SiteView3DProps } from './SiteView3D';

export interface CornerVisit {
  radio: number;
  from: Viewport;
  scene: Scene;
  /** The walkthrough was playing: it plays on when the viewer is back on the map. */
  resume: boolean;
}

type ViewModule = { default: ComponentType<SiteView3DProps> };

let pending: Promise<ViewModule> | null = null;
let loaded: ViewModule | null = null;

/** Fetch the 3D view's chunk once; a failed fetch can be tried again. */
export function loadCornerView(): Promise<ViewModule> {
  pending ??= import('./SiteView3D').then(
    (m) => (loaded = m),
    (err: unknown) => {
      pending = null;
      throw err;
    },
  );
  return pending;
}

export interface CornerVisits {
  visit: CornerVisit | null;
  /** The 3D view, once its chunk is in. */
  View: ComponentType<SiteView3DProps> | null;
  /** A visit is waiting for the chunk. */
  loading: boolean;
  open: (visit: CornerVisit) => void;
  close: () => void;
  prefetch: () => void;
}

export function useCornerView(): CornerVisits {
  const [visit, setVisit] = useState<CornerVisit | null>(null);
  const [View, setView] = useState<ViewModule['default'] | null>(() => loaded?.default ?? null);
  const visitRef = useRef<CornerVisit | null>(null);

  const close = useCallback(() => {
    visitRef.current = null;
    setVisit(null);
  }, []);

  const open = useCallback(
    (v: CornerVisit) => {
      if (visitRef.current) return;
      // Like the brand chip, flying down ends a running tour: its spotlights are on the panels that step aside.
      const guide = useGuideStore.getState();
      if (guide.tourStep !== null) {
        guide.endTour(guide.tourStep >= getTourSteps().length - 1 ? 'done' : 'skipped');
      }
      visitRef.current = v;
      setVisit(v);
      loadCornerView().then(
        (m) => setView(() => m.default),
        (err: unknown) => {
          console.error('The 3D view could not be loaded:', err);
          close();
        },
      );
    },
    [close],
  );

  const prefetch = useCallback(() => {
    loadCornerView().catch(() => {
      // Fetched again on click, which reports a failure.
    });
  }, []);

  // The tour or the home screen over the app: back to the map at once.
  useEffect(
    () =>
      useGuideStore.subscribe((s) => {
        if (visitRef.current && (s.tourStep !== null || s.home !== 'closed')) close();
      }),
    [close],
  );

  return useMemo(
    () => ({ visit, View, loading: visit !== null && View === null, open, close, prefetch }),
    [visit, View, open, close, prefetch],
  );
}
