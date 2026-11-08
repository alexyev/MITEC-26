// Build & failure tab (spec 9): the play model built from the center out, its coverage and traffic, one radio
// failure with detection and reroute, then "Your turn", where any radio can be failed and repaired.
import { useCallback, useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { UI } from '../../config/defaults';
import { forwardedAt, hopsAt, queueAt, type SimChange } from '../../engine/packetSim';
import {
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
import { BuildMap } from './BuildMap';
import { BuildReadout } from './BuildReadout';
import { sceneAt, type Scene } from './scene';
import { SLOWED_STEPS } from './walkthrough';
import './build.css';

const LEGEND: LegendItem[] = [
  { token: 'signal', label: 'Radio signal', shape: 'circle' },
  { token: 'data', label: 'Data and its route', shape: 'line' },
  { token: 'fail', label: 'Failed radio', shape: 'cross' },
  { token: 'fail', label: 'Cut off', shape: 'ring' },
  { token: 'work', label: 'Radio not on yet', shape: 'dot' },
  { token: 'unit', label: 'P3 unit', shape: 'square' },
  { token: 'base', label: 'Base', shape: 'square' },
];

const steps = PLAY_TIMELINE.steps;

interface Pointer {
  x: number;
  y: number;
}

/** The hover card of a radio or the base (spec 6.6). */
function hoverCardFor(
  id: number,
  scene: Scene,
  user: SimChange[],
  t: number,
  pointer: Pointer,
): HoverCardProps {
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
  else if (scene.radioBuild[id] !== 2) subtitle = 'Waiting for power';
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
    (id: number | null, x: number, y: number) => {
      setHover(id);
      setPointer({ x, y });
    },
    [setHover],
  );

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
      <Legend items={LEGEND} />
      <PlayerBar
        player={player}
        steps={steps}
        note={SLOWED_STEPS.has(stepId) ? 'Packets slowed for visibility' : undefined}
      />
      {hover !== null ? (
        <HoverCard {...hoverCardFor(hover, scene, userChanges, t, pointer)} />
      ) : null}
    </>
  );
}
