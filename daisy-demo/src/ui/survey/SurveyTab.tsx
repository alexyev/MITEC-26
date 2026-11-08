// Survey tab (spec 8, T3.4, D60, D61, D81, D82): UTVs survey the full site on their own strips around the
// built-up base pad, each online over its own Starlink, and each with a drone that follows it and links through
// it; the walkthrough zooms in on one UTV so its drone reads at a glance, and the viewer can follow any UTV up
// close (D140-D143). The view is a pure function of the fleet size and the player time (spec rule 6); Send runs
// on the player clock.
import { useEffect, useMemo, useRef, useState } from 'react';
import { SITE } from '../../config/defaults';
import { SURVEY } from '../../config/survey';
import { PRICING, surveyCost } from '../../engine/pricing';
import { droneFlying, surveyedFraction, surveySchedule, vehicleAt } from '../../engine/survey';
import type { VehicleState } from '../../engine/survey';
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
import { stepIndexAt, stepStarts } from '../player/clock';
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
  drawFollowLinks,
  drawSatellite,
  drawVehicles,
  hitTest,
  satelliteAt,
  vehicleMarkers,
} from './surveyLayers';
import type { SurveyHit } from './surveyLayers';
import { SurveyCostChip } from './SurveyCostChip';
import { FollowSection } from './FollowSection';
import {
  exitFollow,
  followBlend,
  followCamera,
  followHoursPerS,
  followTimeScale,
  pulsePhase,
  startFollow,
} from './follow';
import type { Follow } from './follow';
import { utvKitCost } from './utvKit';
import { whyUtv } from './whyUtv';
import { surveySteps, walkthroughFrame, yourTurnFrame } from './walkthrough';
import './survey.css';

/** The colors this tab shows, and nothing else (spec 5.1). */
const LEGEND: LegendItem[] = [
  { token: 'work', label: 'UTV', shape: 'dot' },
  { token: 'work', label: 'Drone', shape: 'drone' },
  { token: 'work', label: 'Planned path', shape: 'dash' },
  { token: 'data', label: 'Online (Starlink)', shape: 'dot' },
  { token: 'data', label: 'Drone link', shape: 'line' },
  { token: 'done', label: 'Surveyed ground', shape: 'fill' },
  { token: 'unit', label: 'P3 unit · planned', shape: 'outline' },
  { token: 'base', label: 'Base · built up', shape: 'pad' },
];

const PCT = 100;

/** The key of the walkthrough close-up's camera move (D82, D141). */
const CLOSE_UP_KEY = 'closeUp';

export function SurveyTab() {
  const vehicles = useSurveyStore((s) => s.vehicles);
  const mode = useSurveyStore((s) => s.mode);
  const sentAtT = useSurveyStore((s) => s.sentAtT);
  const { setVehicles, send, finish, reset } = useSurveyStore.getState();

  const walkPlan = getSurveyPlan(SURVEY.defaultVehicles);
  const why = whyUtv(PRICING.pricing);
  const steps = useMemo(
    () => surveySteps(walkPlan, why.comparison.speedUp),
    [walkPlan, why.comparison.speedUp],
  );
  const last = steps.length - 1;

  // Following a UTV (D140): the ease in and out runs on wall time (`nowMs`), so it also plays while paused.
  const reduced = prefersReducedMotion();
  const [follow, setFollow] = useState<Follow | null>(null);
  const [nowMs, setNowMs] = useState(0);
  const blend = follow ? followBlend(follow, nowMs, reduced) : 0;
  const followRate = followHoursPerS(walkPlan);
  // Up close, the work slows down with the zoom (D142): the player's time scale at walkthrough time `time`.
  const rate = (time: number): number => {
    if (!follow) return 1;
    const hoursPerS =
      stepIndexAt(steps, time) === last
        ? yourTurnFrame(getSurveyPlan(vehicles), mode, time - sentAtT).hoursPerS
        : walkthroughFrame(steps, walkPlan, time).hoursPerS;
    return followTimeScale(hoursPerS, followRate, blend);
  };
  const player = usePlayer(steps, { onRestart: reset, rate });
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

  // A run ends when the last UTV is back at the base; "Your turn" then waits for the next input.
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

  // The close-up (D82) zooms the map; with reduced motion it cuts in and out instead of zooming. Once a follow
  // took over from it, or the viewer moved the map, it stays out until its window is over (D141).
  const [closeUpDismissed, setCloseUpDismissed] = useState(false);
  if (closeUpDismissed && !frame.closeUp) setCloseUpDismissed(false);
  const close = closeUpDismissed ? null : frame.closeUp;
  const closeCamera: Camera | null = close
    ? {
        target: close.target,
        pxPerM: close.pxPerM,
        blend: reduced ? Math.round(close.blend) : close.blend,
        key: CLOSE_UP_KEY,
      }
    : null;

  // The followed UTV; a smaller fleet keeps the camera on its last UTV.
  const count = plan.vehicles.length;
  const followId = follow ? Math.min(follow.vehicle, count - 1) : null;
  const followNow = follow ? { ...follow, vehicle: followId! } : null;
  const followCam = followNow ? followCamera(plan, followNow, frame.hours, blend) : null;
  const camera = followCam ?? closeCamera;

  const followUtv = (id: number) => {
    const at = performance.now();
    const onScreen = followNow
      ? followCamera(plan, followNow, frame.hours, followBlend(followNow, at, reduced))
      : closeCamera;
    if (frame.closeUp) setCloseUpDismissed(true);
    setNowMs(at);
    setFollow(startFollow(followNow, id, at, onScreen, reduced));
  };
  const backToSite = () => {
    if (!followNow || followNow.dir === 'out') return;
    if (frame.closeUp) setCloseUpDismissed(true);
    if (reduced) {
      setFollow(null);
      return;
    }
    const at = performance.now();
    setNowMs(at);
    setFollow(exitFollow(followNow, at, reduced));
  };
  // The viewer panned or zoomed: the view is theirs now, where they left it (D140).
  const onCameraRelease = () => {
    if (frame.closeUp) setCloseUpDismissed(true);
    setFollow(null);
  };

  // Run the ease on animation frames; once an ease out lands, the follow is over.
  useEffect(() => {
    if (!follow || reduced) return;
    const endMs = follow.atMs + follow.durS * 1000;
    let frameId = requestAnimationFrame(function loop(now) {
      setNowMs(now);
      if (now < endMs) frameId = requestAnimationFrame(loop);
      else if (follow.dir === 'out') setFollow(null);
    });
    return () => cancelAnimationFrame(frameId);
  }, [follow, reduced]);

  // Escape goes back to the site.
  const backRef = useRef(backToSite);
  backRef.current = backToSite;
  const followingIn = follow?.dir === 'in';
  useEffect(() => {
    if (!followingIn) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      backRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [followingIn]);

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
  const hitUtv = hoveredId ?? hoveredDrone;
  const followed = followingIn ? followId : null;
  const onTap = (p: MapPointer) => {
    const v = viewRef.current;
    if (!v) return;
    const vm = vehicleMarkers(plan, frame.hours, v);
    const h = hitTest(plan, vm, v, p.sx, p.sy, droneMarkers(plan, vm, frame.hours, v));
    if (h?.kind === 'vehicle' || h?.kind === 'drone') followUtv(h.id);
  };

  const underlay: MapLayer = (ctx, v, colors) => drawSurveyed(ctx, v, plan, frame.hours, colors);
  const overlay: MapLayer = (ctx, v, colors) => {
    if (frame.showPaths) {
      drawStrips(ctx, v, plan);
      drawPaths(ctx, v, plan, frame.hours, colors);
    }
    const vm = vehicleMarkers(plan, frame.hours, v);
    const dm = droneMarkers(plan, vm, frame.hours, v);
    drawDroneLinks(ctx, vm, dm, colors);
    // Following (D143): the Starlink beam to the UTV and the pulses on its drone's link, under the marks.
    const fv = followId === null ? undefined : vm.find((m) => m.id === followId);
    const linkAlpha = labelAlpha(blend);
    if (fv) {
      const fd = dm.find((m) => m.id === followId);
      const phase = reduced ? null : pulsePhase(frame.hours);
      drawFollowLinks(ctx, fv, fd, satelliteAt(v), linkAlpha, phase, colors);
    }
    drawVehicles(ctx, vm, colors, hoveredId);
    drawDrones(ctx, dm, colors, hoveredDrone);
    // The labels fade in only as the zoom lands, once the UTV has slowed down near the center.
    if (fv) {
      drawCloseUpLabels(ctx, vm, dm, fv.id, linkAlpha, colors);
      drawSatellite(ctx, satelliteAt(v), linkAlpha, colors);
    } else if (close && closeCamera) {
      drawCloseUpLabels(ctx, vm, dm, close.vehicle, labelAlpha(closeCamera.blend), colors);
    }
  };

  const surveyed = surveyedFraction(plan, frame.hours);
  const { pricing, errors } = PRICING;
  const cost = surveyCost(pricing, count, plan.vehicleHours, plan.finishH);
  const model = getSiteModel();
  const schedule = surveySchedule(plan);
  const kit = useMemo(() => utvKitCost(pricing), [pricing]);

  let card: HoverCardProps | null = null;
  if (pointer && hit?.kind === 'vehicle') {
    const s = markers.find((k) => k.id === hit.id)!.state;
    card = {
      x: pointer.sx,
      y: pointer.sy,
      title: `UTV #${hit.id + 1}`,
      subtitle: `Online · Starlink · ${activity(s, frame.hours)}`,
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
      hint: hit.id === followed ? undefined : 'Click to follow',
    };
  } else if (pointer && hit?.kind === 'drone') {
    const s = markers.find((k) => k.id === hit.id)!.state;
    card = {
      x: pointer.sx,
      y: pointer.sy,
      title: `Drone #${hit.id + 1}`,
      subtitle: `Online · via UTV #${hit.id + 1} Starlink · Following`,
      rows: [
        {
          label: 'Strip progress',
          value: `${formatSharePct(s.stripProgress)}%`,
          pct: s.stripProgress * PCT,
          token: 'work',
        },
        { label: 'Link', value: `UTV #${hit.id + 1}` },
        { label: 'Time left', value: `${formatHours(s.timeLeftH)} h` },
      ],
      hint: hit.id === followed ? undefined : 'Click to follow its UTV',
    };
  } else if (pointer && hit?.kind === 'base') {
    card = {
      x: pointer.sx,
      y: pointer.sy,
      title: 'Base',
      subtitle: 'Online · Starlink backhaul · Built up',
      rows: [
        { label: 'UTVs online', value: `${count}/${count}` },
        { label: 'Drones online', value: `${count}/${count}` },
      ],
    };
  }

  const moving = frame.step === 'survey' || running;
  // Following, the pace is the eased one the clock runs at (D142).
  const followPace = frame.hoursPerS * followTimeScale(frame.hoursPerS, followRate, blend);
  const note = !moving
    ? undefined
    : follow && blend > 0
      ? `Up close: 1 s plays ${formatPace(followPace * player.speed)} of work`
      : frame.closeUp
        ? `Up close: 1 s plays ${formatPace(frame.rateHPerS * player.speed)} of work`
        : `Sped up: ${formatPace(frame.rateHPerS * player.speed)} of work plays in 1 s`;
  const followState = followed === null ? null : vehicleAt(plan.vehicles[followed], frame.hours);
  return (
    <>
      <MapView
        underlay={underlay}
        overlay={overlay}
        onHover={setPointer}
        onView={(v) => (viewRef.current = v)}
        camera={camera}
        onCameraRelease={onCameraRelease}
        onTap={onTap}
        clickable={hitUtv !== null}
      />

      <Panel corner="tl" title="Survey">
        <Section label="Fleet" data-tour="fleet">
          <Stepper
            label="UTVs"
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
        <FollowSection
          count={count}
          following={
            followed === null || !followState
              ? null
              : {
                  id: followed,
                  state: followState,
                  activity: activity(followState, frame.hours),
                }
          }
          onFollow={followUtv}
          onExit={backToSite}
        />
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
          <Kpi label="UTVs online · Starlink" value={`${count}/${count}`} />
          <Kpi label="Drones online · via UTV" value={`${count}/${count}`} />
          <Kpi
            label="Elapsed"
            value={`${formatHours(frame.hours)} of ${formatHours(plan.finishH)}`}
            unit="h"
            note={workNote(schedule)}
          />
        </Section>
      </Panel>

      <SurveyCostChip
        cost={cost}
        kit={kit}
        why={why}
        pricingErrors={errors.length}
        focus={frame.step === 'done'}
      />
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

function activity(s: VehicleState, hours: number): string {
  if (s.kind === 'pass' || s.kind === 'shift') return 'Surveying';
  if (s.kind === 'transit') return 'Driving';
  if (s.kind === 'stop') return s.stop === 'refuel' ? 'Refueling' : 'Drone battery swap';
  return s.done || hours > 0 ? 'Back at base' : 'At base';
}

/**
 * The survey in field days and where its time goes (D83), for the UTV that finishes last: driving, U-turns,
 * drone battery swaps and refuels add up to its time on site; the base setup comes on top, once a day.
 */
function workNote(schedule: ReturnType<typeof surveySchedule>): string {
  const w = schedule.critical.work;
  // Non-breaking spaces keep each figure with its unit and its words on one line.
  const nb = (text: string) => text.replaceAll(' ', '\u00a0');
  const days = schedule.days === 1 ? '1 field day' : `${formatInt(schedule.days)} field days`;
  const parts = [
    `${formatHours(w.drivingH)} h driving`,
    `${formatHours(w.turnsH)} h turns`,
    `${formatHours(w.swapsH)} h drone swaps`,
  ];
  if (w.refuelsH > 0) parts.push(`${formatHours(w.refuelsH)} h fuel`);
  parts.push(`${formatHours(schedule.setupH)} h base setup`);
  return `${nb(days)}: ${parts.map(nb).join(', ')}`;
}
