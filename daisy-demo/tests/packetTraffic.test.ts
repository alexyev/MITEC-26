import { describe, expect, it } from 'vitest';
import { PLAY } from '../src/config/play';
import { buildGraph } from '../src/engine/network';
import { createSim, packetsAt, presetFailS, simulate, statsAt } from '../src/engine/packetSim';
import type { SimChange } from '../src/engine/packetSim';
import { buildPlayModel, cellRadioId } from '../src/engine/playModel';
import {
  PLAY_GRAPH,
  PLAY_MODEL,
  PLAY_TIMELINE,
  simAt,
  useBuildStore,
} from '../src/state/build';
import { sceneAt } from '../src/ui/build/scene';

// D103: the radios' traffic runs only while a story plays out (the walkthrough's robot data, or a click in
// "Your turn"), so the packets stop when the visualization does.

const model = buildPlayModel();
const graph = buildGraph(model);
const tl = PLAY_TIMELINE;
/** Longest a packet can take to reach the base once the traffic stops: every hop of the longest route. */
const DRAIN_S = PLAY.maxPacketHops * PLAY.hopS;

const sendsIn = (times: number[], from: number, to: number) =>
  times.filter((t) => t >= from && t < to).length;

describe('traffic windows (engine)', () => {
  it('sends only inside the windows, then goes quiet with no packet in flight', () => {
    const sim = simulate({ graph, startS: 0, endS: 120, trafficUntilS: 10, changes: [] });
    expect(sim.sentTimes.length).toBeGreaterThan(0);
    expect(Math.max(...sim.sentTimes)).toBeLessThan(10);
    expect(sim.quietFromS).toBeGreaterThanOrEqual(Math.max(...sim.sentTimes));
    expect(sim.quietFromS).toBeLessThan(10 + DRAIN_S);
    for (let t = sim.quietFromS; t <= 120; t += 0.5) expect(packetsAt(sim, t)).toEqual([]);
    expect(statsAt(sim, 120).queued).toBe(0);
    expect(statsAt(sim, 120).delivered).toBe(sim.sentTimes.length);
  });

  it('keeps the default of a network that always sends', () => {
    const sim = simulate({ graph, startS: 0, endS: 60, changes: [] });
    expect(sendsIn(sim.sentTimes, 59, 60)).toBe(model.radios.length);
    expect(sim.quietFromS).toBe(Infinity);
  });

  it('wakes a bounded burst for a change with trafficS, and the live click matches the replay', () => {
    const radio = cellRadioId(model, 4, 2);
    const failS = presetFailS(graph, radio, 30);
    const live = createSim({ graph, startS: 0, endS: Infinity, trafficUntilS: 5, changes: [] });
    for (let t = 0; t <= failS; t += 1 / 60) live.advanceTo(t);
    expect(live.result.quietFromS).toBeLessThan(failS);
    const click: SimChange = { tS: failS, radio, kind: 'fail', trafficS: PLAY.clickTrafficS };
    const applied = live.addChange(click);
    for (let t = failS; t <= failS + 60; t += 1 / 60) live.advanceTo(t);
    const sim = live.result;
    // Every connected radio sends in the burst; nothing is sent outside the two windows.
    expect(sendsIn(sim.sentTimes, applied.tS, applied.tS + PLAY.clickTrafficS)).toBeGreaterThan(
      model.radios.length * (PLAY.clickTrafficS - 1),
    );
    expect(sendsIn(sim.sentTimes, 5, applied.tS)).toBe(0);
    expect(sendsIn(sim.sentTimes, applied.tS + PLAY.clickTrafficS, Infinity)).toBe(0);
    // The failure is detected inside the burst, the traffic drains, and the network goes quiet.
    expect(sim.failures[0].detectS as number).toBeLessThan(applied.tS + PLAY.clickTrafficS);
    expect(sim.quietFromS).toBeLessThan(applied.tS + PLAY.clickTrafficS + DRAIN_S);
    for (let t = sim.quietFromS; t <= failS + 60; t += 0.5) expect(packetsAt(sim, t)).toEqual([]);
    const pure = simulate({
      graph,
      startS: 0,
      endS: live.frontierS(),
      trafficUntilS: 5,
      changes: sim.changes,
    });
    expect(sim.events).toEqual(pure.events);
  });
});

describe('Build & failure traffic (D103)', () => {
  const scene = (user: SimChange[], t: number) =>
    sceneAt(PLAY_MODEL, PLAY_GRAPH, tl, simAt(user, t).result, t);

  it('stops sending when the robot data step ends, and never sends after the walkthrough', () => {
    const sim = simAt([], tl.yourTurnS + 600).result;
    expect(sendsIn(sim.sentTimes, tl.holdS, tl.resumeS)).toBeGreaterThan(0);
    expect(sendsIn(sim.sentTimes, tl.resumeS, Infinity)).toBe(0);
    expect(sim.quietFromS).toBeLessThan(tl.yourTurnS);
    // "Your turn" opens on a still map: settled from its first frame, with no packet for ten minutes.
    expect(scene([], tl.yourTurnS).settleS).toBeLessThanOrEqual(tl.yourTurnS);
    const sent = statsAt(sim, tl.yourTurnS).sent;
    for (let t = tl.yourTurnS; t <= tl.yourTurnS + 600; t += 0.25) {
      const s = scene([], t);
      expect(s.packets).toEqual([]);
      expect(s.stats?.sent).toBe(sent);
    }
  });

  it('holds the packets still while the clock stands (paused at a data step)', () => {
    const t = tl.detectS + 0.4;
    const a = scene([], t);
    expect(a.packets.length).toBeGreaterThan(0);
    // The view is a function of t only: the same t gives the same packets, however much wall time passes.
    simAt([], t + 5);
    const b = scene([], t);
    expect(b.packets).toEqual(a.packets);
    expect(b.stats).toEqual(a.stats);
  });

  it('plays a click in "Your turn" as a burst that settles to zero, also after Reset', () => {
    const store = useBuildStore.getState();
    store.resetInputs();
    const radio = cellRadioId(PLAY_MODEL, 6, 2);
    const t0 = tl.yourTurnS + 2;
    store.toggleRadio(radio, t0);
    const failed = useBuildStore.getState().userChanges;
    expect(failed[0].trafficS).toBe(PLAY.clickTrafficS);
    // Traffic during the burst, then nothing at all from the settle time on.
    const during = scene(failed, t0 + 1);
    expect(during.packets.length).toBeGreaterThan(0);
    const settled = scene(failed, t0 + 120).settleS;
    expect(settled).toBeGreaterThan(t0 + PLAY.clickTrafficS);
    expect(settled).toBeLessThan(t0 + PLAY.clickTrafficS + DRAIN_S + 5);
    const sent = scene(failed, settled).stats?.sent;
    for (let t = settled; t <= settled + 300; t += 0.25) {
      const s = scene(failed, t);
      expect(s.packets).toEqual([]);
      expect(s.stats?.sent).toBe(sent);
    }

    const t1 = settled + 10;
    useBuildStore.getState().repairAll(t1);
    const repaired = useBuildStore.getState().userChanges;
    const again = scene(repaired, t1 + 120).settleS;
    expect(scene(repaired, t1 + 1).packets.length).toBeGreaterThan(0);
    expect(again).toBeLessThan(t1 + PLAY.clickTrafficS + DRAIN_S + 5);
    for (let t = again; t <= again + 60; t += 0.25) expect(scene(repaired, t).packets).toEqual([]);
    expect(scene(repaired, again).stats?.queued).toBe(0);
    useBuildStore.getState().resetInputs();
  });
});
