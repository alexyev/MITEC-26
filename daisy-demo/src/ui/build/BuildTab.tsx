// Build & failure tab (spec 9, D70): the play model built from the center out, a radio failure mid-build traced
// through a frontier robot's data, the rest of the build, then "Your turn", where any radio can fail.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { UI } from '../../config/defaults';
import { forwardedAt, hopsAt, queueAt, type SimChange } from '../../engine/packetSim';
import { PRICING } from '../../engine/pricing';
import {
  ALTERNATIVES,
  FULL_SITE_COST,
  PLAY_GRAPH,
  PLAY_MODEL,
  PLAY_TIMELINE,
  failedIntent,
  simAt,
  useBuildStore,
} from '../../state/build';
import { HoverCard } from '../kit/HoverCard';
import { Legend } from '../kit/Legend';
import { Panel } from '../kit/Panel';
import { Section } from '../kit/Section';
import type { HoverCardProps, LegendItem } from '../kit/types';
import { PlayerBar } from '../player/PlayerBar';
import { StepList } from '../player/StepList';
import { usePlayer } from '../player/usePlayer';
import type { Machine } from '../../engine/machines';
import { RadioBuild, UnitState, unitStatusAt } from '../../engine/playModel';
import type { Viewport } from '../map/viewport';
import { featuredRadio } from '../scene3d/featured';
import { useCornerView } from '../scene3d/useCornerView';
import { BuildMap, fitWithCoverage, type BuildMapPin } from './BuildMap';
import { BuildReadout } from './BuildReadout';
import { CostChip } from './CostChip';
import type { BuildHit } from './draw';
import { sceneAt, type RobotView, type Scene } from './scene';
import { SLOWED_STEPS } from './walkthrough';
import './build.css';

/**
 * The colors this tab shows (spec 5.1), in 7 rows so the readout with its STRESS-TEST fits beside the legend at
 * 1280 x 720 (D72): the P3 units' row replaced the base's, which the first caption and its hover card name (D100).
 */
const LEGEND: LegendItem[] = [
  { token: 'signal', label: 'Radio signal', shape: 'circle' },
  { token: 'data', label: 'Data and its route', shape: 'line' },
  { token: 'data', label: 'Route before reroute', shape: 'dash', colorVar: '--c-old-route' },
  { token: 'fail', label: 'Failed radio', shape: 'cross' },
  { token: 'fail', label: 'Cut off or no link', shape: 'ring' },
  { token: 'work', label: 'Work in progress', shape: 'dot' },
  { token: 'unit', label: 'P3 unit: planned to live', shape: 'states' },
];

const steps = PLAY_TIMELINE.steps;

/** The radio the "Take me there" pin flies to (D121). */
const FEATURED_RADIO = featuredRadio(PLAY_MODEL);
const mapViewport = (w: number, h: number) => fitWithCoverage(PLAY_MODEL, w, h);

interface Pointer {
  x: number;
  y: number;
}

/** The hover card of a radio, the base, a machine or a unit (spec 6.6). */
function hoverCardFor(
  hit: BuildHit,
  scene: Scene,
  user: SimChange[],
  t: number,
  pointer: Pointer,
): HoverCardProps | null {
  if (hit.kind === 'unit') return unitCard(hit.id, scene, pointer);
  if (hit.kind === 'machine') {
    const m = scene.machines[hit.id];
    return m ? machineCard(m, scene.robot?.index === hit.id ? scene.robot : null, pointer) : null;
  }
  const id = hit.id;
  const live = simAt(user, t);
  const sim = live.result;
  const net = scene.network;
  const maxHops = Math.max(1, ...Array.from(net.routing.hops));
  if (id === PLAY_GRAPH.baseId) {
    return {
      ...pointer,
      title: 'Base',
      subtitle: 'Online · Starlink backhaul',
      rows: [
        {
          label: 'Radios connected',
          value: `${net.connectedRadios}/${PLAY_MODEL.radios.length}`,
          pct: (net.connectedRadios / PLAY_MODEL.radios.length) * 100,
          token: 'signal',
        },
        {
          label: 'Packets delivered',
          value: (scene.stats?.delivered ?? 0).toLocaleString('en-US'),
        },
      ],
    };
  }
  const radio = PLAY_MODEL.radios[id];
  const failed = scene.failed[id] === 1;
  const hops = scene.traffic ? hopsAt(sim, id, t) : net.routing.hops[id];
  const queue = scene.traffic ? queueAt(sim, id, t) : 0;
  let subtitle: string;
  if (failed) subtitle = 'Failed · no signal';
  else if (scene.radioBuild[id] !== 2) subtitle = 'Waiting for power · not on yet';
  else if (net.cutOff[id]) subtitle = 'Cut off · no route to the base';
  else
    subtitle = `Online · ${net.routing.hops[id]} ${net.routing.hops[id] === 1 ? 'hop' : 'hops'} to base`;
  const rows: HoverCardProps['rows'] = failed
    ? []
    : [
        {
          label: 'Hops',
          value: hops >= 0 ? String(hops) : '-',
          pct: hops >= 0 ? (hops / maxHops) * 100 : 0,
          token: 'data',
        },
        {
          label: 'Queue',
          value: String(queue),
          pct: (queue / Math.max(1, scene.stats?.largestQueue ?? 0)) * 100,
          token: 'data',
        },
        {
          label: 'Packets forwarded',
          value: (scene.traffic ? forwardedAt(sim, id, t) : 0).toLocaleString('en-US'),
        },
      ];
  const isDown = failedIntent(user, live, t)[id] === 1;
  return {
    ...pointer,
    title: `Radio ${radio.label}`,
    subtitle,
    rows,
    hint: isDown ? 'Click to repair' : 'Click to fail',
  };
}

const nodeName = (id: number) =>
  id === PLAY_GRAPH.baseId ? 'the base' : `radio ${PLAY_MODEL.radios[id]?.label}`;

/**
 * The hover card of a frontier machine: what it is, its phase and task, and whether it has a link (D51). The
 * robot that sends its data (D70) also shows the radio its packets go through, its hops and its packets.
 */
function machineCard(m: Machine, robot: RobotView | null, pointer: Pointer): HoverCardProps {
  const phases = PLAY_MODEL.config.frontierPhases;
  const kind = PLAY_MODEL.config.equipment.kinds[m.glyph];
  let subtitle = m.online
    ? `Online · via ${nodeName(m.coveredBy)}`
    : 'Offline · no coverage, stopped';
  if (robot && m.online) {
    subtitle =
      robot.uplink >= 0
        ? `Online · sending via ${nodeName(robot.uplink)}`
        : 'Online · finding a radio';
  }
  const rows: HoverCardProps['rows'] = [
    {
      label: 'Phase',
      value: `${phases[m.phase].label} · ${m.phase + 1}/${phases.length}`,
      pct: ((m.phase + 1) / phases.length) * 100,
      token: 'work',
    },
    { label: 'Task', value: m.online ? kind.task : 'Waiting for a link' },
  ];
  if (robot) {
    rows.push(
      { label: 'Hops to base', value: robot.hops >= 0 ? String(robot.hops) : '-' },
      { label: 'Packets sent', value: robot.sent.toLocaleString('en-US') },
    );
  }
  return { ...pointer, title: kind.name, subtitle, rows };
}

/** A unit's build state as its hover card names it (D102). */
const UNIT_STATE_LABEL: Record<UnitState, string> = {
  [UnitState.Planned]: 'Planned',
  [UnitState.Placed]: 'Placed',
  [UnitState.Commissioned]: 'Commissioned',
  [UnitState.Live]: 'Live',
};

/**
 * The hover card of a unit: its build state on an orange bar (D102), then planned for a later stage, the
 * phase its stage is in, or live (D51).
 */
function unitCard(unitId: number, scene: Scene, pointer: Pointer): HoverCardProps {
  const unit = PLAY_MODEL.units[unitId];
  const phases = PLAY_MODEL.config.frontierPhases;
  const stages = PLAY_MODEL.stages.length;
  const status = unitStatusAt(PLAY_MODEL, unitId, scene.buildS);
  const state = scene.unitState[unitId] as UnitState;
  let subtitle: string;
  if (status.kind === 'planned') subtitle = `Planned · stage ${unit.stage + 1} of ${stages}`;
  else if (status.kind === 'live') subtitle = 'Live · powered';
  else {
    const p = phases[status.phase];
    subtitle = `${p.label} · ${status.done ? 'done here' : `${p.equipment.toLowerCase()} on the way`}`;
  }
  const stateRow: HoverCardProps['rows'][number] = {
    label: 'State',
    value: UNIT_STATE_LABEL[state],
    pct: (state / UnitState.Live) * 100,
    token: 'unit',
  };
  return {
    ...pointer,
    title: `P3 #${(unitId + 1).toLocaleString('en-US')}`,
    subtitle,
    rows:
      status.kind === 'work'
        ? [
            stateRow,
            { label: 'Stage', value: `${unit.stage + 1} of ${stages}` },
            {
              label: 'Phase',
              value: `${status.phase + 1} of ${phases.length}`,
              pct: ((status.phase + (status.done ? 1 : 0)) / phases.length) * 100,
              token: 'work',
            },
          ]
        : [stateRow],
  };
}

export function BuildTab() {
  const resetInputs = useBuildStore((s) => s.resetInputs);
  const corner = useCornerView();
  // While the 3D view is up, Space and the arrows belong to it, not to the walkthrough underneath.
  const player = usePlayer(steps, { onRestart: resetInputs, keyboard: corner.visit === null });
  const userChanges = useBuildStore((s) => s.userChanges);
  const hover = useBuildStore((s) => s.hover);
  const setHover = useBuildStore((s) => s.setHover);
  const toggleRadio = useBuildStore((s) => s.toggleRadio);
  const repairAll = useBuildStore((s) => s.repairAll);
  const [pointer, setPointer] = useState<Pointer>({ x: 0, y: 0 });
  const t = player.t;

  const scene = useMemo(() => {
    const sim = simAt(userChanges, t);
    return sceneAt(PLAY_MODEL, PLAY_GRAPH, PLAY_TIMELINE, sim.result, t);
  }, [userChanges, t]);

  /** User input pauses the walkthrough and jumps to "Your turn", which then keeps running (D21). */
  const interactAt = useCallback((): number => {
    const at = Math.max(player.t, PLAY_TIMELINE.yourTurnS);
    player.toYourTurn();
    player.play();
    return at;
  }, [player]);

  const onClickRadio = useCallback(
    (radio: number) => toggleRadio(radio, interactAt()),
    [toggleRadio, interactAt],
  );
  const onReset = useCallback(() => repairAll(interactAt()), [repairAll, interactAt]);
  const onHover = useCallback(
    (hit: BuildHit | null, x: number, y: number) => {
      setHover(hit);
      setPointer({ x, y });
    },
    [setHover],
  );

  // Flying down to a radio's corner (D120): the walkthrough pauses where it is, and plays on afterwards.
  const openCorner = useCallback(
    (from: Viewport) => {
      setHover(null);
      corner.open({ radio: FEATURED_RADIO, from, scene, resume: player.playing });
      player.pause();
    },
    [corner, scene, player, setHover],
  );
  const lastVisit = useRef(corner.visit);
  useEffect(() => {
    const was = lastVisit.current;
    lastVisit.current = corner.visit;
    if (was && !corner.visit && was.resume) player.play();
  }, [corner.visit, player]);

  // "Take me there" is offered once its radio is built and steps aside while that radio is failed: the 3D view
  // is there to show its four beams, and a failed radio's labels need the space above it.
  const offer: BuildMapPin | null =
    FEATURED_RADIO >= 0 &&
    scene.radioBuild[FEATURED_RADIO] !== RadioBuild.None &&
    scene.failed[FEATURED_RADIO] !== 1 &&
    (corner.visit === null || corner.loading)
      ? {
          radio: FEATURED_RADIO,
          loading: corner.loading,
          onOpen: openCorner,
          onIntent: corner.prefetch,
        }
      : null;
  // Where: the pin on the radio while the walkthrough plays, then, once it has reached "Your turn", the
  // call to action under the tab switch instead. One button at a time, never two with the same name.
  const atEnd = steps[player.stepIndex]?.id === 'your-turn';
  const pin = atEnd ? null : offer;
  const cta = atEnd ? offer : null;

  const card = hover ? hoverCardFor(hover, scene, userChanges, t, pointer) : null;
  const anyFailed = scene.failed.some((f, i) => f === 1 && i < PLAY_MODEL.radios.length);
  const stepId = steps[player.stepIndex]?.id ?? '';

  // "Your turn" has no end, but its traffic does (D103): once a click has played out, or right away when there
  // is nothing to play, the player pauses, so the bar never says playing over a still map.
  const settled = stepId === 'your-turn' && t >= scene.settleS;
  useEffect(() => {
    if (settled && player.playing) player.pause();
  }, [settled, player]);

  return (
    <>
      <BuildMap
        model={PLAY_MODEL}
        graph={PLAY_GRAPH}
        scene={scene}
        hover={hover}
        onHover={onHover}
        onClickRadio={onClickRadio}
        pin={pin}
        cta={cta}
      />
      {corner.visit && corner.View ? (
        <corner.View
          model={PLAY_MODEL}
          graph={PLAY_GRAPH}
          scene={corner.visit.scene}
          radio={corner.visit.radio}
          from={corner.visit.from}
          mapViewport={mapViewport}
          onExit={corner.close}
        />
      ) : null}
      <Panel corner="tl" title="Build & failure">
        <Section label="Try it" data-tour="try-it">
          <p className="build-hint">Click a radio to fail it. Click it again to repair it.</p>
          <button type="button" className="build-btn" onClick={onReset} disabled={!anyFailed}>
            <RotateCcw size={UI.icon.sizePx} strokeWidth={UI.icon.strokeWidth} aria-hidden="true" />
            Reset
          </button>
        </Section>
        <StepList player={player} steps={steps} />
      </Panel>
      <BuildReadout model={PLAY_MODEL} scene={scene} />
      <CostChip
        cost={FULL_SITE_COST}
        pricingErrors={PRICING.errors.length}
        alternatives={ALTERNATIVES}
        focus={stepId === 'cost'}
      />
      <Legend items={LEGEND} />
      <PlayerBar
        player={player}
        steps={steps}
        note={SLOWED_STEPS.has(stepId) ? 'Packets slowed for visibility' : undefined}
      />
      {card ? <HoverCard {...card} /> : null}
    </>
  );
}
