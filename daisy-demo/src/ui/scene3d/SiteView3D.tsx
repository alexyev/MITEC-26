// The 3D view of a radio's corner (D120 to D126), loaded only when the viewer first asks for it. It opens on
// the pose that shows the site exactly as the Build map does, crossfades in over the map, flies down and
// around to the side of the module, and lets the viewer look around; Back to map flies the same way up and
// crossfades back to the map. Under reduced motion both ways are cuts.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { MODULE, UI } from '../../config/defaults';
import { SCENE3D } from '../../config/scene3d';
import type { Graph } from '../../engine/network';
import type { PlayModel } from '../../engine/playModel';
import type { Scene } from '../build/scene';
import { prefersReducedMotion } from '../kit/tokens';
import type { Viewport } from '../map/viewport';
import { cornerFacts } from './cornerFacts';
import { landingPose, poseFromViewport } from './pose';
import { CornerView, type FramePoints, type ScreenPoint } from './view';
import './scene3d.css';

export interface SiteView3DProps {
  model: PlayModel;
  graph: Graph;
  /** The map's scene when the viewer flew down: what is built, and each radio's state. */
  scene: Scene;
  radio: number;
  /** The Build map's viewport then, where the flight starts. */
  from: Viewport;
  /** The Build map's viewport for a canvas of this size, where the flight back ends. */
  mapViewport: (width: number, height: number) => Viewport;
  onExit: () => void;
}

/**
 * `loading` while the scene is built and compiled, `in` while it fades in and flies down, `landed` once the
 * viewer can look around, `out` while it flies back up, `leaving` while it fades back to the map.
 */
type Phase = 'loading' | 'in' | 'landed' | 'out' | 'leaving';

const SHELL_CLASS = 'scene-3d';

function place(el: HTMLElement | null, p: ScreenPoint): void {
  if (!el) return;
  el.style.transform = `translate(${Math.round(p.sx)}px, ${Math.round(p.sy)}px)`;
  el.style.visibility = p.visible ? '' : 'hidden';
}

export default function SiteView3D({
  model,
  graph,
  scene,
  radio,
  from,
  mapViewport,
  onExit,
}: SiteView3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const moduleRef = useRef<HTMLDivElement>(null);
  const beamRefs = useRef<(HTMLDivElement | null)[]>([]);
  const backRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const calloutRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<CornerView | null>(null);
  const phaseRef = useRef<Phase>('loading');
  const [phase, setPhaseState] = useState<Phase>('loading');
  const [noWebGL, setNoWebGL] = useState(false);
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;
  const facts = useMemo(
    () => cornerFacts(model, graph, scene, radio),
    [model, graph, scene, radio],
  );
  const beamsOn = facts.status === 'online' || facts.status === 'cutOff';

  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const shell = host.closest('.shell');
    const reduced = prefersReducedMotion();
    let view: CornerView | null = null;
    let observer: ResizeObserver | null = null;
    let cancelled = false;

    const mount = () => {
      let v: CornerView;
      try {
        v = new CornerView(canvas, { model, scene, radio, facts }, (pts: FramePoints) => {
          place(moduleRef.current, pts.module);
          pts.beams.forEach((p, i) => place(beamRefs.current[i] ?? null, p));
        });
      } catch (err) {
        console.warn('The 3D view needs WebGL:', err);
        setNoWebGL(true);
        shell?.classList.add(SHELL_CLASS);
        setPhase('landed');
        return;
      }
      view = v;
      viewRef.current = v;
      const size = () => {
        const r = host.getBoundingClientRect();
        v.resize(r.width || from.width, r.height || from.height);
        const box = calloutRef.current;
        if (box) v.setCalloutSize(box.offsetWidth, box.offsetHeight);
        // Offsets, not the box on screen: the card slides in with a transform.
        const card = cardRef.current;
        v.setLabelAvoid(
          card
            ? {
                left: card.offsetLeft,
                top: card.offsetTop,
                right: card.offsetLeft + card.offsetWidth,
                bottom: card.offsetTop + card.offsetHeight,
              }
            : null,
        );
      };
      size();
      observer = new ResizeObserver(size);
      observer.observe(host);
      const start = poseFromViewport(from, SCENE3D.camera.fovDeg);
      const landing = landingPose(v.antenna);
      v.setPose(start);
      v.compile().then(() => {
        if (cancelled) return;
        shell?.classList.add(SHELL_CLASS);
        if (reduced) {
          v.setPose(landing);
          v.land();
          setPhase('landed');
          return;
        }
        setPhase('in');
        v.fly(start, landing, SCENE3D.motion.flyInMs).then(() => {
          if (cancelled || phaseRef.current !== 'in') return;
          v.land();
          setPhase('landed');
        });
      });
    };

    // Built on the next frame: a mount that is undone at once (React's strict mode) never makes a renderer.
    const frame = requestAnimationFrame(mount);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      view?.dispose();
      viewRef.current = null;
      shell?.classList.remove(SHELL_CLASS);
    };
    // Built once per visit: the inputs are the map's state when the viewer flew down.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard focus moves to Back to map once the view is up.
  const up = phase === 'in' || phase === 'landed';
  useEffect(() => {
    if (up) backRef.current?.focus({ preventScroll: true });
  }, [up]);

  const back = useCallback(() => {
    const p = phaseRef.current;
    if (p === 'out' || p === 'leaving') return;
    const view = viewRef.current;
    const host = hostRef.current;
    const shell = host?.closest('.shell');
    const leave = () => {
      shell?.classList.remove(SHELL_CLASS);
      setPhase('leaving');
      const ms = prefersReducedMotion() ? 0 : SCENE3D.motion.crossfadeMs;
      window.setTimeout(() => onExitRef.current(), ms);
    };
    if (!view || !host || prefersReducedMotion() || p === 'loading') {
      leave();
      return;
    }
    setPhase('out');
    view.release();
    const r = host.getBoundingClientRect();
    const to = poseFromViewport(
      mapViewport(r.width || from.width, r.height || from.height),
      SCENE3D.camera.fovDeg,
    );
    view.fly(to, view.currentPose(), SCENE3D.motion.flyOutMs, true).then(() => {
      if (viewRef.current === view) leave();
    });
  }, [from, mapViewport, setPhase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [back]);

  const shown = phase === 'in' || phase === 'landed' || phase === 'out';
  const className = ['scene3d', shown ? 'shown' : '', phase === 'landed' ? 'landed' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className} ref={hostRef} data-phase={phase}>
      <canvas
        ref={canvasRef}
        className="scene3d-canvas"
        aria-label={`3D view of radio ${facts.label}'s corner module on P3 #${facts.unitNumber}: drag to look around`}
      />
      {noWebGL ? null : (
        <div className="scene3d-labels" aria-hidden="true">
          <div className="scene3d-callout" ref={moduleRef}>
            <span className="scene3d-callout-line" />
            <div
              className="scene3d-callout-box"
              ref={calloutRef}
              style={{ left: SCENE3D.callout.dxPx, bottom: SCENE3D.callout.dyPx }}
            >
              <div className="scene3d-callout-title">4-beam corner module</div>
              <div className="scene3d-callout-sub">
                Radio {facts.label} · {facts.statusLine}
              </div>
            </div>
          </div>
          {facts.beams.map((b, i) => (
            <div
              key={b.key}
              className={beamsOn ? 'scene3d-beam' : 'scene3d-beam off'}
              ref={(el) => {
                beamRefs.current[i] = el;
              }}
            >
              <span className="scene3d-beam-dot" />
              <span className="scene3d-beam-pill">
                <span className="scene3d-beam-title">{b.title}</span>
                <span className="scene3d-beam-detail">{b.detail}</span>
              </span>
            </div>
          ))}
        </div>
      )}
      <section className="scene3d-card" aria-label={`Radio ${facts.label} in 3D`} ref={cardRef}>
        <button type="button" className="scene3d-back" onClick={back} ref={backRef}>
          <ArrowLeft size={UI.icon.sizePx} strokeWidth={UI.icon.strokeWidth} aria-hidden="true" />
          Back to map
        </button>
        <h2 className="scene3d-title">Radio {facts.label} · corner module</h2>
        {noWebGL ? (
          <p className="scene3d-text">
            The 3D view needs WebGL, which this browser has turned off or does not support.
          </p>
        ) : (
          <p className="scene3d-text">
            Bolted to the north-east corner of P3 #{facts.unitNumber}, antennas {MODULE.heightM} m
            up. Two look down the lane and two down the column, one to each neighbor radio, so data
            can go around a failed radio in any direction.
          </p>
        )}
      </section>
      {noWebGL ? null : (
        <div className="scene3d-hint" aria-hidden="true">
          Drag to look around · Scroll to zoom · Esc for the map
        </div>
      )}
    </div>
  );
}
