// Build & failure tab, stub of T2.2: the 540-unit play-model section as planned units, with the base and its
// coverage circle. Worker C replaces this file with the build and failure walkthrough (T4.4, spec 9).
import { useEffect, useRef } from 'react';
import { MAP, SITE, UI } from '../../config/defaults';
import { Legend } from '../kit/Legend';
import { Panel } from '../kit/Panel';
import { readColorTokens } from '../kit/tokens';
import type { LegendItem } from '../kit/types';
import { fitViewport, worldToScreen } from '../map/viewport';
import { PlayerBar } from '../player/PlayerBar';
import { StepList } from '../player/StepList';
import type { WalkStep } from '../player/types';
import { usePlayer } from '../player/usePlayer';

const STEPS: WalkStep[] = [
  {
    id: 'section',
    label: 'Section',
    caption: 'A small section of the site. The base at the center links to Starlink.',
    durationS: UI.buildStub.introS,
  },
  {
    id: 'your-turn',
    label: 'Your turn',
    caption: 'The build from the center out and the radio failure join this view next.',
    durationS: Infinity,
  },
];

const LEGEND: LegendItem[] = [
  { token: 'unit', label: 'Planned unit', shape: 'square' },
  { token: 'base', label: 'Base', shape: 'square' },
  { token: 'signal', label: 'Radio signal', shape: 'circle' },
];

/** The section in meters: unit columns along the lane (x) and lane rows (y), the base at the center. */
function sectionGeometry() {
  const { unitCols, laneRows, rowPitchM } = UI.buildStub;
  const pitchX = SITE.unitWidthM + SITE.unitGapM;
  const widthM = unitCols * pitchX - SITE.unitGapM;
  const heightM = (laneRows - 1) * rowPitchM + SITE.unitDepthM;
  return { unitCols, laneRows, rowPitchM, pitchX, widthM, heightM };
}

function SectionMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!container || !canvas || !ctx) return;
    const colors = readColorTokens(container);
    const g = sectionGeometry();

    const draw = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const v = fitViewport(g.widthM, g.heightM, rect.width, rect.height, UI.mapFitPaddingPx);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);

      // Coverage of the base: one translucent circle (spec 5.1).
      const c = worldToScreen(v, g.widthM / 2, g.heightM / 2);
      ctx.fillStyle = colors.signalFill;
      ctx.beginPath();
      ctx.arc(c.sx, c.sy, UI.buildStub.coverageRadiusM * v.scale, 0, Math.PI * 2);
      ctx.fill();

      // Planned units at low alpha; at this scale a unit is a few pixels deep, so it is filled, not outlined.
      ctx.fillStyle = colors.unitPlanned;
      ctx.beginPath();
      for (let row = 0; row < g.laneRows; row++) {
        for (let col = 0; col < g.unitCols; col++) {
          const p = worldToScreen(v, col * g.pitchX, row * g.rowPitchM + SITE.unitDepthM);
          ctx.rect(p.sx, p.sy, SITE.unitWidthM * v.scale, SITE.unitDepthM * v.scale);
        }
      }
      ctx.fill();

      // The base: a white square on a dark halo.
      const r = MAP.baseMarkerPx;
      ctx.fillStyle = colors.base;
      ctx.strokeStyle = colors.halo;
      ctx.lineWidth = MAP.baseHaloPx;
      ctx.beginPath();
      ctx.roundRect(c.sx - r, c.sy - r, 2 * r, 2 * r, MAP.baseCornerPx);
      ctx.stroke();
      ctx.fill();
    };

    const observer = new ResizeObserver(draw);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="map" ref={containerRef}>
      <canvas ref={canvasRef} className="map-canvas static" aria-label="Play-model section" />
    </div>
  );
}

export function BuildTab() {
  const player = usePlayer(STEPS);
  return (
    <>
      <SectionMap />
      <Panel corner="tl" title="Build & failure">
        <StepList player={player} steps={STEPS} />
      </Panel>
      <Legend items={LEGEND} />
      <PlayerBar player={player} steps={STEPS} />
    </>
  );
}
