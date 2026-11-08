// The guided tour (D91, D92): coach marks on the live app. Each step dims everything but its targets, rings
// them, and sets a callout beside them with what they are and what they mean. Interactive steps move on when
// the viewer does the thing (Next always works too). Enter or Right goes on, Left goes back, Escape exits.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { UI } from '../../config/defaults';
import { TOUR, tourSteps, type TourStep } from '../../config/tour';
import { useBuildStore } from '../../state/build';
import { useGuideStore } from '../../state/guide';
import { useShellStore } from '../../state/store';
import { LegendSwatch } from '../kit/Legend';
import { prefersReducedMotion } from '../kit/tokens';
import { usePlayerCommands } from '../player/commands';
import { tourFacts } from './facts';
import {
  anchorOf,
  dimPath,
  findTarget,
  holeFor,
  mergeHoles,
  placeCallout,
  type Hole,
} from './geometry';
import './guide.css';

/** Elements that keep their own keys: typing, sliders and radio groups (the tabs, the speed). */
const OWN_KEYS =
  'input, textarea, select, [contenteditable="true"], [role="slider"], [role="radiogroup"]';
const FOCUSABLE =
  'a[href], button:not(:disabled), input:not(:disabled), select, textarea, [tabindex]:not([tabindex="-1"])';
/** A dialog over the app (the Alternatives sheet): the tour steps aside until it closes. */
const MODAL = '[aria-modal="true"]';

let cachedSteps: TourStep[] | null = null;
/** The tour's steps with their copy, built once from the code. */
export function getTourSteps(): TourStep[] {
  cachedSteps ??= tourSteps(tourFacts());
  return cachedSteps;
}

export function Tour() {
  const index = useGuideStore((s) => s.tourStep);
  if (index === null) return null;
  return <TourRun index={index} />;
}

function TourRun({ index }: { index: number }) {
  const steps = useMemo(getTourSteps, []);
  const step = steps[Math.min(index, steps.length - 1)];
  const last = index >= steps.length - 1;
  const { goToStep, endTour } = useGuideStore.getState();
  const tab = useShellStore((s) => s.tab);
  const calloutRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const ringRefs = useRef<(SVGRectElement | null)[]>([]);
  const [done, setDone] = useState<number | null>(null);
  const actionDone = done === index;

  // From the store's step, not this render's, so two quick presses never land on the same step.
  const next = () => {
    const at = useGuideStore.getState().tourStep;
    if (at === null) return;
    if (at >= steps.length - 1) endTour('done');
    else goToStep(at + 1);
  };
  const back = () => {
    const at = useGuideStore.getState().tourStep;
    if (at !== null && at > 0) goToStep(at - 1);
  };
  const nextRef = useRef(next);
  nextRef.current = next;
  const backRef = useRef(back);
  backRef.current = back;

  // Entering a step shows its tab.
  useEffect(() => {
    if (useShellStore.getState().tab !== step.tab) useShellStore.getState().setTab(step.tab);
  }, [step]);

  // A step that needs "Your turn" asks the tab's player for it once its tab is showing (D94).
  const onItsTab = tab === step.tab;
  useEffect(() => {
    if (step.toYourTurn && onItsTab) usePlayerCommands.getState().requestYourTurn();
  }, [step, onItsTab]);

  // Focus moves into the callout on every step; ending the tour gives it back to where it was before the
  // tour (read while rendering, before the callout takes focus), else to the tour button.
  const [returnFocus] = useState(() =>
    document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement
      : null,
  );
  useLayoutEffect(() => {
    calloutRef.current?.focus({ preventScroll: true });
  }, [index]);
  useEffect(
    () => () => {
      const to = returnFocus?.isConnected
        ? returnFocus
        : document.querySelector<HTMLElement>('[data-tour="tour"]');
      to?.focus({ preventScroll: true });
    },
    [returnFocus],
  );

  // Interactive steps: watch for the viewer's action, tick it, then move on.
  useEffect(() => {
    const action = step.action;
    if (!action) return;
    const mark = () => setDone(index);
    if (action.kind === 'click') {
      const onClick = (e: MouseEvent) => {
        const els = document.querySelectorAll(`[data-tour="${step.targets[0]}"]`);
        const hit = e.target instanceof Node ? e.target : null;
        if (hit && Array.from(els).some((el) => el.contains(hit))) mark();
      };
      document.addEventListener('click', onClick, true);
      return () => document.removeEventListener('click', onClick, true);
    }
    if (action.kind === 'tab') {
      return useShellStore.subscribe((s) => s.tab === action.tab && mark());
    }
    if (action.kind === 'hover') {
      return useBuildStore.subscribe((s) => s.hover !== null && mark());
    }
    const changes = useBuildStore.getState().userChanges.length;
    return useBuildStore.subscribe((s) => s.userChanges.length !== changes && mark());
  }, [step, index]);

  useEffect(() => {
    if (!actionDone || last) return;
    const timer = window.setTimeout(() => nextRef.current(), TOUR.advanceDelayMs);
    return () => window.clearTimeout(timer);
  }, [actionDone, last]);

  // Keys: on the window in the capture phase, so the player does not also step on Right and Left.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector(MODAL)) return;
      const callout = calloutRef.current;
      const target = e.target instanceof Element ? e.target : null;
      const inCallout = !!(callout && target && callout.contains(target));
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        useGuideStore.getState().endTour('skipped');
      } else if (e.key === 'Tab') {
        if (!callout) return;
        const holes = step.targets.flatMap((t) =>
          Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${t}"]`)),
        );
        const items = [callout, ...holes].flatMap((root) =>
          Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
            (el) => el.tabIndex >= 0 && !el.closest('[inert], [hidden]'),
          ),
        );
        if (items.length === 0) return;
        const at = items.indexOf(document.activeElement as HTMLElement);
        const to =
          at < 0
            ? e.shiftKey
              ? items.length - 1
              : 0
            : (at + (e.shiftKey ? -1 : 1) + items.length) % items.length;
        e.preventDefault();
        items[to].focus();
      } else if (e.key === 'Enter') {
        // Buttons and app controls keep Enter; elsewhere (the callout itself, the page) it goes on.
        if (target?.closest('button, a[href], input, select, textarea') && target !== callout)
          return;
        e.preventDefault();
        e.stopPropagation();
        nextRef.current();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        if (!inCallout && target?.closest(OWN_KEYS)) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'ArrowRight') nextRef.current();
        else backRef.current();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [step]);

  // Geometry on every frame: targets move (panels fold, cards open, the window resizes), so the holes, the
  // rings and the callout follow them, gliding to a new step unless the viewer asked for reduced motion.
  const shownRef = useRef<Hole[]>([]);
  const posRef = useRef<{ left: number; top: number } | null>(null);
  useEffect(() => {
    let frame = 0;
    let lastT = performance.now();
    const loop = (now: number) => {
      const dt = Math.max(0, now - lastT);
      lastT = now;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const reduced = prefersReducedMotion();
      const k = reduced ? 1 : 1 - Math.exp(-dt / TOUR.glideMs);
      const lerp = (a: number, b: number) => a + (b - a) * k;
      const found = step.targets.map((t) => {
        const el = findTarget(t);
        return el ? holeFor(t, el, vw, vh) : null;
      });
      const want: (Hole | null)[] = step.merge
        ? mergeHoles(found.filter((h): h is Hole => h !== null))
        : found;
      const prev = shownRef.current;
      const shown = want.map((h, i) => {
        if (!h) return null;
        const from = prev[i] ?? prev[0];
        if (!from) return h;
        return {
          left: lerp(from.left, h.left),
          top: lerp(from.top, h.top),
          width: lerp(from.width, h.width),
          height: lerp(from.height, h.height),
          radius: lerp(from.radius, h.radius),
        };
      });
      const holes = shown.filter((h): h is Hole => h !== null);
      shownRef.current = holes.length > 0 ? holes : prev;

      const svg = svgRef.current;
      if (svg) {
        svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
        svg.classList.toggle('suspended', !!document.querySelector(MODAL));
      }
      pathRef.current?.setAttribute('d', dimPath(vw, vh, holes));
      ringRefs.current.forEach((ring, i) => {
        const h = shown[i];
        if (!ring) return;
        ring.style.display = h ? '' : 'none';
        if (!h) return;
        ring.setAttribute('x', String(h.left));
        ring.setAttribute('y', String(h.top));
        ring.setAttribute('width', String(h.width));
        ring.setAttribute('height', String(h.height));
        ring.setAttribute('rx', String(h.radius));
      });

      const callout = calloutRef.current;
      if (callout) {
        const anchorEl = step.anchor ? findTarget(step.anchor) : null;
        const anchor =
          (anchorEl && step.anchor ? holeFor(step.anchor, anchorEl, vw, vh) : null) ??
          anchorOf(want);
        const spot = placeCallout(
          anchor,
          want.filter((h): h is Hole => h !== null),
          callout.offsetWidth,
          callout.offsetHeight,
          vw,
          vh,
        );
        const p = posRef.current;
        const pos = p ? { left: lerp(p.left, spot.left), top: lerp(p.top, spot.top) } : spot;
        posRef.current = pos;
        callout.style.transform = `translate(${Math.round(pos.left)}px, ${Math.round(pos.top)}px)`;
        callout.classList.add('placed');
        callout.classList.toggle('suspended', !!document.querySelector(MODAL));
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [step]);

  const action = step.action;
  return (
    <>
      <svg className="tour-dim" ref={svgRef} aria-hidden="true">
        <path ref={pathRef} className="tour-dim-fill" fillRule="evenodd" />
        {(step.merge ? step.targets.slice(0, 1) : step.targets).map((t, i) => (
          <rect
            key={t}
            ref={(el) => {
              ringRefs.current[i] = el;
            }}
            className={action && !actionDone && i === 0 ? 'tour-ring active' : 'tour-ring'}
          />
        ))}
      </svg>
      <div
        className="tour-callout"
        ref={calloutRef}
        role="dialog"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
      >
        <div className="tour-content" key={step.id}>
          <div className="tour-head">
            <span className="label num">
              Step {index + 1} of {steps.length}
            </span>
            <button
              type="button"
              className="tour-skip"
              onClick={() => endTour(last ? 'done' : 'skipped')}
            >
              {last ? 'Close' : 'Skip tour'}
            </button>
          </div>
          <h2 className="tour-title" id="tour-title">
            {step.title}
          </h2>
          <p className="tour-body" id="tour-body">
            {step.body}
          </p>
          {step.swatches ? (
            <ul className="tour-swatches">
              {step.swatches.map((s) => (
                <li key={s.label} className="tour-swatch">
                  <LegendSwatch token={s.token} shape={s.shape} />
                  <span>{s.label}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {action ? (
            <div className={actionDone ? 'tour-action done' : 'tour-action'} aria-live="polite">
              {actionDone ? (
                <Check size={UI.icon.sizePx} strokeWidth={UI.icon.strokeWidth} aria-hidden="true" />
              ) : (
                <span className="tour-action-dot" aria-hidden="true" />
              )}
              <span>{actionDone ? 'Done' : `Try it: ${action.hint}`}</span>
            </div>
          ) : null}
        </div>
        <div className="tour-foot">
          <ol className="tour-dots" aria-hidden="true">
            {steps.map((s, i) => (
              <li
                key={s.id}
                className={
                  i === index ? 'tour-dot current' : i < index ? 'tour-dot done' : 'tour-dot'
                }
              />
            ))}
          </ol>
          <div className="tour-nav">
            {index > 0 ? (
              <button type="button" className="tour-btn" onClick={back}>
                Back
              </button>
            ) : null}
            <button type="button" className="tour-btn primary" onClick={next}>
              {last ? 'Finish' : 'Next'}
              {last ? null : (
                <ArrowRight
                  size={UI.icon.sizePx}
                  strokeWidth={UI.icon.strokeWidth}
                  aria-hidden="true"
                />
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
