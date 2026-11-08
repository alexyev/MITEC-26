import { describe, expect, it } from 'vitest';
import { ROUTING } from '../src/config/defaults';
import { PLAY, PLAY_WALK } from '../src/config/play';
import { failedAt, simulate } from '../src/engine/packetSim';
import { cellRadioId } from '../src/engine/playModel';
import { PLAY_GRAPH, PLAY_MODEL, PLAY_TIMELINE, simAt, useBuildStore } from '../src/state/build';
import { sceneAt } from '../src/ui/build/scene';

const tl = PLAY_TIMELINE;
const start = (id: string) => tl.starts[tl.steps.findIndex((s) => s.id === id)];
const scene = (t: number) => sceneAt(PLAY_MODEL, PLAY_GRAPH, tl, simAt([], t).result, t);
const label = (id: number) => (id === PLAY_GRAPH.baseId ? 'base' : PLAY_MODEL.radios[id].label);

describe('Build & failure walkthrough (T4.4)', () => {
  it('has the steps of spec 9.8 and ends with an open "Your turn"', () => {
    expect(tl.steps.map((s) => s.id)).toEqual([
      'section',
      'build',
      'coverage',
      'data',
      'failure',
      'detection',
      'reroute',
      'recovered',
      'your-turn',
    ]);
    expect(tl.steps[tl.steps.length - 1].durationS).toBe(Infinity);
    for (const s of tl.steps) expect(s.caption.length).toBeLessThanOrEqual(90);
  });

  it('puts the failure, the missed hellos and the detection on step boundaries', () => {
    expect(start('failure')).toBeCloseTo(tl.failS, 9);
    const lastHello = tl.failS - PLAY.preset.failAfterHelloS;
    expect(start('detection')).toBeCloseTo(lastHello + ROUTING.helloIntervalS, 9);
    expect(start('reroute')).toBeCloseTo(tl.detectS, 9);
    expect(start('recovered') - start('reroute')).toBeCloseTo(PLAY_WALK.rerouteS, 9);
    expect(tl.failS - tl.dataStartS).toBeGreaterThanOrEqual(PLAY_WALK.dataS);
    expect(tl.failS - tl.dataStartS).toBeLessThan(PLAY_WALK.dataS + ROUTING.helloIntervalS + 0.1);
  });
});

describe('sceneAt (T4.4)', () => {
  it('builds from the base outward and covers the whole section by the coverage step', () => {
    const first = scene(tl.buildStartS - 0.01);
    expect(first.unitPlaced.every((p) => p === 0)).toBe(true);
    expect(first.network.coverage).toBeGreaterThan(0);
    const covered = scene(start('coverage'));
    expect(covered.network.connectedRadios).toBe(PLAY_MODEL.radios.length);
    expect(covered.network.coverage).toBe(1);
    expect(covered.packets).toHaveLength(0);
  });

  it('shows data on the watched route before the failure', () => {
    const s = scene(start('data') + 2);
    expect(s.packets.length).toBeGreaterThan(5);
    expect(s.routes[0].map(label)).toEqual(['C8-2', 'C7-2', 'C6-2', 'C5-2', 'base']);
    expect(s.latest).toBeNull();
  });

  it('fails the radio, queues at its upstream neighbor, then reroutes with a ticket', () => {
    const failed = cellRadioId(PLAY_MODEL, 6, 2);
    const upstream = cellRadioId(PLAY_MODEL, 7, 2);
    const atFail = scene(start('failure'));
    expect(atFail.failed[failed]).toBe(1);
    expect(atFail.network.coverage).toBeLessThan(1);
    expect(atFail.network.coverage * 100).toBeGreaterThan(PLAY.coverageTargetPct);

    const detecting = scene(start('reroute') - 0.01);
    expect(detecting.latest?.missedHellos).toBe(ROUTING.missedHellosToDown - 1);
    expect(detecting.queues.find((q) => q.node === upstream)?.count).toBeGreaterThan(0);
    expect(detecting.ticket).toBeNull();

    const recovered = scene(start('recovered') + 0.01);
    expect(recovered.oldRoutes.length).toBeGreaterThan(0);
    expect(recovered.routes[0].map(label)).toEqual([
      'C8-2',
      'C7-2',
      'C7-3',
      'C6-3',
      'C5-3',
      'C4-3',
      'base',
    ]);
    expect(recovered.watchedExtraHops).toBe(2);
    expect(recovered.ticket?.radio).toBe(failed);
    expect(recovered.stats?.lost).toBe(0);
  });
});

describe('build store (T4.4)', () => {
  it('fails and repairs radios in "Your turn" and replays to the same result', () => {
    const store = useBuildStore.getState();
    store.resetInputs();
    const radio = cellRadioId(PLAY_MODEL, 2, 1);
    const t0 = tl.yourTurnS + 1;
    store.toggleRadio(radio, t0);
    const t1 = t0 + 10;
    expect(failedAt(simAt(useBuildStore.getState().userChanges, t1).result, t1)[radio]).toBe(1);
    useBuildStore.getState().repairAll(t1);
    const changes = useBuildStore.getState().userChanges;
    // Both the walkthrough's radio and the user's radio get a repair.
    expect(
      changes
        .filter((c) => c.kind === 'repair')
        .map((c) => c.radio)
        .sort(),
    ).toEqual([radio, tl.failedRadio].sort((a, b) => a - b));
    const t2 = t1 + 5;
    const live = simAt(changes, t2).result;
    expect(failedAt(live, t2).every((f) => f === 0)).toBe(true);
    const pure = simulate({
      graph: PLAY_GRAPH,
      startS: tl.dataStartS,
      endS: t2,
      changes: [{ tS: tl.failS, radio: tl.failedRadio, kind: 'fail' }, ...changes],
    });
    expect(live.events.filter((e) => e.tS <= t2)).toEqual(pure.events);
    useBuildStore.getState().resetInputs();
  });
});
