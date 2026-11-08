// Survey tab (spec 8, T3.4, D60, D61, D81, D82): 4x4s survey the full site on their own strips around the
// built-up base pad, each online over its own Starlink, and each with a drone that follows it and links through
// it; the walkthrough zooms in on one 4x4 so its drone reads at a glance.
// The view is a pure function of the fleet size and the player time (spec rule 6); Send runs on the player clock.
import { useEffect, useMemo, useRef, useState } from 'react';
import { SITE } from '../../config/defaults';
import { SURVEY } from '../../config/survey';
import { PRICING, surveyCost } from '../../engine/pricing';
import { droneFlying, surveyedFraction } from '../../engine/survey';
import { getSiteModel } from '../../state/model';
import { getSurveyPlan, useSurveyStore } from '../../state/survey';
import { HoverCard } from '../kit/HoverCard';
import { prefersReducedMotion } from '../kit/tokens';
import { Kpi } from '../kit/Kpi';
import { Legend } from '../kit/Legend';
import { Panel } from '../kit/Panel';
import { Section } from '../kit/Section';
import { Stepper } from '../kit/Stepper';
import type { HoverCardProps, LegendItem } from '../kit/types';
import { MapView } from '../map/MapView';
import type { MapLayer, MapPointer } from '../map/MapView';
import type { Camera, Viewport } from '../map/viewport';
import { PlayerBar } from '../player/PlayerBar';
import { StepList } from '../player/StepList';
import { stepStarts } from '../player/clock';
import { usePlayer } from '../player/usePlayer';
import { formatHours, formatInt, formatKm, formatPace, formatSharePct } from './format';
import {
  droneMarkers,
  drawCloseUpLabels,
  drawDroneLinks,
  drawDrones,
  drawPaths,
  drawStrips,
  drawSurveyed,
  drawVehicles,
  hitTest,
  vehicleMarkers,
} from './surveyLayers';
import type { SurveyHit } from './surveyLayers';
import { SurveyCostChip } from './SurveyCostChip';
import { surveySteps, walkthroughFrame, yourTurnFrame } from './walkthrough';
import './survey.css';

/** The colors this tab shows, and nothing else (spec 5.1). */
const LEGEND: LegendItem[] = [
  { token: 'work', label: '4x4', shape: 'dot' },
  { token: 'work', label: 'Drone', shape: 'drone' },
  { token: 'work', label: 'Planned path', shape: 'dash' },
  { token: 'data', label: 'Online (Starlink)', shape: 'dot' },
  { token: 'data', label: 'Drone link', shape: 'line' },
  { token: 'done', label: 'Surveyed ground', shape: 'fill' },
  { token: 'unit', label: 'Planned unit', shape: 'square' },
  { token: 'base', label: 'Base · built up', shape: 'pad' },
];

const PCT = 100;

export function SurveyTab() {
  const vehicles = useSurveyStore((s) => s.vehicles);
  const mode = useSurveyStore((s) => s.mode);
  const sentAtT = useSurveyStore((s) => s.sentAtT);
  const { setVehicles, send, finish, reset } = useSurveyStore.getState();

  const walkPlan = getSurveyPlan(SURVEY.defaultVehicles);
  const steps = useMemo(() => surveySteps(walkPlan), [walkPlan]);
  const player = usePlayer(steps, { onRestart: reset });
  const last = steps.length - 1;
  const inYourTurn = player.stepIndex === last;
  const yourTurnStart = stepStarts(steps)[last];

  const plan = inYourTurn ? getSurveyPlan(vehicles) : walkPlan;
  const frame = inYourTurn
    ? yourTurnFrame(plan, mode, player.t - sentAtT)
    : walkthroughFrame(steps, plan, player.t);
  const running = inYourTurn && mode === 'running';

  // Seeking back into the walkthrough puts the inputs back to the walkthrough's defaults (spec 7).
  useEffect(() => {
    if (!inYourTurn) reset();
  }, [inYourTurn, reset]);

  // A run ends when the last 4x4 is back at the base; "Your turn" then waits for the next input.
  useEffect(() => {
    if (running && frame.hours >= plan.finishH) finish();
  }, [running, frame.hours, plan.finishH, finish]);
  useEffect(() => {
    if (inYourTurn && mode !== 'running' && player.playing) player.pause();
  }, [inYourTurn, mode, player]);

  const changeVehicles = (count: number) => {
    player.toYourTurn();
    setVehicles(count);
  };
  const onSend = () => {
    const t0 = inYourTurn ? player.t : yourTurnStart;
    player.toYourTurn();
    send(t0);
    player.play();
  };

  // The close-up (D82) zooms the map; with reduced motion it cuts in and out instead of zooming.
  const close = frame.closeUp;
  const camera: Camera | null = close
    ? {
        target: close.target,
        pxPerM: close.pxPerM,
        blend: prefersReducedMotion() ? Math.round(close.blend) : close.blend,
      }
    : null;

  // Hover (spec 6.6): the pointer comes from the map, the view from its last draw.
  const [pointer, setPointer] = useState<MapPointer | null>(null);
  const viewRef = useRef<Viewport | null>(null);
  const view = viewRef.current;
  const markers = view ? vehicleMarkers(plan, frame.hours, view) : [];
  const drones = view ? droneMarkers(plan, markers, frame.hours, view) : [];
  const hit: SurveyHit =
    pointer && view ? hitTest(plan, markers, view, pointer.sx, pointer.sy, drones) : null;
  const hoveredId = hit?.kind === 'vehicle' ? hit.id : null;
  const hoveredDrone = hit?.kind === 'drone' ? hit.id : null;

  const underlay: MapLayer = (ctx, v, colors) => drawSurveyed(ctx, v, plan, frame.hours, colors);
  const overlay: MapLayer = (ctx, v, colors) => {
    if (frame.showPaths) {
      drawStrips(ctx, v, plan);
      drawPaths(ctx, v, plan, frame.hours, colors);
    }
    const vm = vehicleMarkers(plan, frame.hours, v);
    const dm = droneMarkers(plan, vm, frame.hours, v);
    drawDroneLinks(ctx, vm, dm, colors);
    drawVehicles(ctx, vm, colors, hoveredId);
    drawDrones(ctx, dm, colors, hoveredDrone);
    // The labels fade in only as the zoom lands, once the 4x4 has slowed down near the center.
    if (camera)
      drawCloseUpLabels(ctx, vm, dm, frame.closeUp!.vehicle, labelAlpha(camera.blend), colors);
  };

  const count = plan.vehicles.length;
  const surveyed = surveyedFraction(plan, frame.hours);
  const { pricing, errors } = PRICING;
  const cost = surveyCost(pricing, count, plan.vehicleHours, plan.finishH);
  const model = getSiteModel();

  let card: HoverCardProps | null = null;
  if (pointer && hit?.kind === 'vehicle') {
    const s = markers.find((k) => k.id === hit.id)!.state;
    card = {
      x: pointer.sx,
      y: pointer.sy,
      title: `4x4 #${hit.id + 1}`,
      subtitle: `Online · Starlink · ${activity(s.kind, s.done, frame.hours)}`,
      rows: [
        {
          label: 'Strip progress',
          value: `${formatSharePct(s.stripProgress)}%`,
          pct: s.stripProgress * PCT,
          token: 'work',
        },
        { label: 'Driven', value: `${formatKm(s.km)} km` },
        { label: 'Time left', value: `${formatHours(s.timeLeftH)} h` },
        { label: 'Drone', value: droneFlying(s) ? 'Flying · linked' : 'Docked · linked' },
      ],
    };
  } else if (pointer && hit?.kind === 'drone') {
    const s = markers.find((k) => k.id === hit.id)!.state;
    card = {
      x: pointer.sx,
      y: pointer.sy,
      title: `Drone #${hit.id + 1}`,
      subtitle: `Online · via 4x4 #${hit.id + 1} Starlink · Following`,
      rows: [
        {
          label: 'Strip progress',
          value: `${formatSharePct(s.stripProgress)}%`,
          pct: s.stripProgress * PCT,
          token: 'work',
        },
        { label: 'Link', value: `4x4 #${hit.id + 1}` },
        { label: 'Time left', value: `${formatHours(s.timeLeftH)} h` },
      ],
    };
  } else if (pointer && hit?.kind === 'base') {
    card = {
      x: pointer.sx,
      y: pointer.sy,
      title: 'Base',
      subtitle: 'Online · Starlink backhaul · Built up',
      rows: [
        { label: '4x4s online', value: `${count}/${count}` },
        { label: 'Drones online', value: `${count}/${count}` },
      ],
    };
  }

  const moving = frame.step === 'survey' || running;
  const note = !moving
    ? undefined
    : close
      ? `Up close: 1 s plays ${formatPace(frame.rateHPerS * player.speed)} of work`
      : `Sped up: ${formatPace(frame.rateHPerS * player.speed)} of work plays in 1 s`;
  return (
    <>
      <MapView
        underlay={underlay}
        overlay={overlay}
        onHover={setPointer}
        onView={(v) => (viewRef.current = v)}
        camera={camera}
      />

      <Panel corner="tl" title="Survey">
        <Section label="Fleet">
          <Stepper
            label="4x4s"
            min={1}
            max={SURVEY.maxVehicles}
            value={inYourTurn ? vehicles : SURVEY.defaultVehicles}
            onChange={changeVehicles}
            disabled={running}
          />
          <button type="button" className="survey-send" onClick={onSend} disabled={running}>
            {running ? 'Surveying' : 'Send'}
          </button>
        </Section>
        <StepList player={player} steps={steps} />
      </Panel>

      <Panel corner="tr" title="Full site">
        <Section label="Model">
          <Kpi
            label={`Site · ${formatInt(SITE.areaAcres)} acres`}
            value={formatInt(model.site.count)}
            unit="units"
          />
          <Kpi
            label="Surveyed"
            value={formatSharePct(surveyed)}
            unit="%"
            bar={{ pct: surveyed * PCT, token: 'work' }}
          />
        </Section>
        <Section label="Connect">
          <Kpi label="4x4s online · Starlink" value={`${count}/${count}`} />
          <Kpi label="Drones online · via 4x4" value={`${count}/${count}`} />
          <Kpi
            label="Elapsed"
            value={`${formatHours(frame.hours)} of ${formatHours(plan.finishH)}`}
            unit="h"
          />
        </Section>
      </Panel>

      <SurveyCostChip cost={cost} pricingErrors={errors.length} focus={frame.step === 'done'} />
      <Legend items={LEGEND} />
      <PlayerBar player={player} steps={steps} note={note} />
      {card ? <HoverCard {...card} /> : null}
    </>
  );
}

/** Opacity of the close-up labels: 0 until the zoom is 70% in, then up to 1 when it is all the way in. */
function labelAlpha(blend: number): number {
  const from = 0.7;
  return Math.max(0, (blend - from) / (1 - from));
}

function activity(kind: string, done: boolean, hours: number): string {
  if (kind === 'pass' || kind === 'shift') return 'Surveying';
  if (kind === 'transit') return 'Driving';
  return done || hours > 0 ? 'Back at base' : 'At base';
}
