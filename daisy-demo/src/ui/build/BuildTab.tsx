// Build & failure tab (spec 9): the play model built from the center out, its coverage and traffic, one radio
// failure with detection and reroute, then "Your turn", where any radio can be failed and repaired.
import { useCallback, useMemo, useState } from 'react';
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
import { unitStatusAt } from '../../engine/playModel';
import { BuildMap } from './BuildMap';
import { BuildReadout } from './BuildReadout';
import { CostChip } from './CostChip';
import type { BuildHit } from './draw';
import { sceneAt, type Scene } from './scene';
import { SLOWED_STEPS } from './walkthrough';
import './build.css';

const LEGEND: LegendItem[] = [
  { token: 'signal', label: 'Radio signal', shape: 'circle' },
  { token: 'data', label: 'Data and its route', shape: 'line' },
  { token: 'fail', label: 'Failed radio', shape: 'cross' },
  { token: 'fail', label: 'Cut off or no link', shape: 'ring' },
  { token: 'work', label: 'Work in progress', shape: 'dot' },
  { token: 'unit', label: 'P3 unit', shape: 'square' },
  { token: 'base', label: 'Base', shape: 'square' },
];

const steps = PLAY_TIMELINE.steps;

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
    return m ? machineCard(m, pointer) : null;
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

/** The hover card of a frontier machine: what it is, its phase and task, and whether it has a link (D51). */
function machineCard(m: Machine, pointer: Pointer): HoverCardProps {
  const phases = PLAY_MODEL.config.frontierPhases;
  const kind = PLAY_MODEL.config.equipment.kinds[m.glyph];
  const via =
    m.coveredBy === PLAY_GRAPH.baseId
      ? 'the base'
      : `radio ${PLAY_MODEL.radios[m.coveredBy]?.label}`;
  return {
    ...pointer,
    title: kind.name,
    subtitle: m.online ? `Online · via ${via}` : 'Offline · no coverage, stopped',
    rows: [
      {
        label: 'Phase',
        value: `${phases[m.phase].label} · ${m.phase + 1}/${phases.length}`,
        pct: ((m.phase + 1) / phases.length) * 100,
        token: 'work',
      },
      { label: 'Task', value: m.online ? kind.task : 'Waiting for a link' },
    ],
  };
}

/** The hover card of a unit: planned for a later stage, the phase its stage is in, or live (D51). */
function unitCard(unitId: number, scene: Scene, pointer: Pointer): HoverCardProps {
  const unit = PLAY_MODEL.units[unitId];
  const phases = PLAY_MODEL.config.frontierPhases;
  const stages = PLAY_MODEL.stages.length;
  const status = unitStatusAt(PLAY_MODEL, unitId, scene.buildS);
  let subtitle: string;
  if (status.kind === 'planned') subtitle = `Planned · stage ${unit.stage + 1} of ${stages}`;
  else if (status.kind === 'live') subtitle = 'Live · powered';
  else {
    const p = phases[status.phase];
    subtitle = `${p.label} · ${status.done ? 'done here' : `${p.equipment.toLowerCase()} on the way`}`;
  }
  return {
    ...pointer,
    title: `P3 #${(unitId + 1).toLocaleString('en-US')}`,
    subtitle,
    rows:
      status.kind === 'work'
        ? [
            { label: 'Stage', value: `${unit.stage + 1} of ${stages}` },
            {
              label: 'Phase',
              value: `${status.phase + 1} of ${phases.length}`,
              pct: ((status.phase + (status.done ? 1 : 0)) / phases.length) * 100,
              token: 'work',
            },
          ]
        : [],
  };
}

export function BuildTab() {
  const resetInputs = useBuildStore((s) => s.resetInputs);
  const player = usePlayer(steps, { onRestart: resetInputs });
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

  const card = hover ? hoverCardFor(hover, scene, userChanges, t, pointer) : null;
  const anyFailed = scene.failed.some((f, i) => f === 1 && i < PLAY_MODEL.radios.length);
  const stepId = steps[player.stepIndex]?.id ?? '';

  return (
    <>
      <BuildMap
        model={PLAY_MODEL}
        graph={PLAY_GRAPH}
        scene={scene}
        hover={hover}
        onHover={onHover}
        onClickRadio={onClickRadio}
      />
      <Panel corner="tl" title="Build & failure">
        <Section label="Try it">
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
