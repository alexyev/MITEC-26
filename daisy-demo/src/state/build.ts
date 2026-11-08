// State of the Build & failure tab (spec 9.6, 13.1): the user's failures and repairs, the hovered node, and
// the live packet simulation that plays them back. The view is a pure function of these inputs and `t`.
import { create } from 'zustand';
import { BUILD } from '../config/defaults';
import { networkCost, PRICING, siteLayoutSummary, type NetworkCost } from '../engine/pricing';
import { getSiteModel } from './model';
import { buildGraph, type Graph } from '../engine/network';
import { createSim, failedAt, type LiveSim, type SimChange } from '../engine/packetSim';
import { buildPlayModel, type PlayModel } from '../engine/playModel';
import { buildTimeline, type BuildTimeline } from '../ui/build/walkthrough';
import { buildAlternatives, type Alternatives } from '../ui/build/alternatives';
import { sameHit, type BuildHit } from '../ui/build/draw';

/** The play model, its network graph and the walkthrough timing never change while the app runs. */
export const PLAY_MODEL: PlayModel = buildPlayModel();
export const PLAY_GRAPH: Graph = buildGraph(PLAY_MODEL);

/**
 * The full-site cost of the default radio design (spec 10.3), from pricing.ts on the generated site;
 * null when the pricing file cannot be costed. The play model's grid is this design's grid (D50).
 */
export const FULL_SITE_COST: NetworkCost | null = (() => {
  try {
    return networkCost(PRICING.pricing, siteLayoutSummary(getSiteModel().site, BUILD));
  } catch (err) {
    console.error('The full-site radio network cannot be costed:', err);
    return null;
  }
})();

/** The Alternatives comparison on the generated site (D54); null when the pricing file cannot be costed. */
export const ALTERNATIVES: Alternatives | null = (() => {
  if (!FULL_SITE_COST) return null;
  try {
    return buildAlternatives(PRICING.pricing, getSiteModel().site);
  } catch (err) {
    console.error('The alternatives cannot be costed:', err);
    return null;
  }
})();

export const PLAY_TIMELINE: BuildTimeline = buildTimeline(PLAY_MODEL, PLAY_GRAPH, FULL_SITE_COST);

/**
 * The live simulation for one list of changes. It advances with the player; seeking back, or a click
 * before a later change, replays from the start (D45).
 */
class SimRunner {
  private sim: LiveSim;
  private key = '';

  constructor(private timeline: BuildTimeline) {
    this.sim = this.fresh([]);
  }

  private presetChanges(): SimChange[] {
    return [{ tS: this.timeline.failS, radio: this.timeline.failedRadio, kind: 'fail' }];
  }

  private fresh(user: SimChange[]): LiveSim {
    this.key = keyOf(user);
    return createSim({
      graph: PLAY_GRAPH,
      startS: this.timeline.dataStartS,
      endS: Infinity,
      changes: [...this.presetChanges(), ...user],
    });
  }

  /** The simulation with exactly these user changes, advanced to `t`. */
  at(user: SimChange[], t: number): LiveSim {
    const key = keyOf(user);
    if (key !== this.key || t < this.sim.frontierS()) this.sim = this.fresh(user);
    this.sim.advanceTo(t);
    return this.sim;
  }

  /** The live simulation already holds these changes (applied with `addChange`): no replay needed. */
  adopt(user: SimChange[]): void {
    this.key = keyOf(user);
  }
}

function keyOf(changes: SimChange[]): string {
  return changes.map((c) => `${c.kind}:${c.radio}@${c.tS}`).join('|');
}

const runner = new SimRunner(PLAY_TIMELINE);

/** The simulation for the current inputs at time t (advances it; deterministic). */
export function simAt(user: SimChange[], t: number): LiveSim {
  return runner.at(user, t);
}

interface BuildState {
  /** Failures and repairs the user made, in time order (spec 9.6). */
  userChanges: SimChange[];
  /** The radio, base, machine or unit under the pointer, or null. */
  hover: BuildHit | null;
  setHover: (hit: BuildHit | null) => void;
  /** Fail an alive radio, or repair a failed one, at time t. */
  toggleRadio: (radio: number, t: number) => void;
  /** Repair every failed radio at time t. */
  repairAll: (t: number) => void;
  /** Back to the walkthrough's defaults (Restart). */
  resetInputs: () => void;
}

/** A radio counts as failed while it is down, or while a fail of it is waiting to happen. */
function intendsFailed(user: SimChange[], sim: LiveSim, radio: number, t: number): boolean {
  const own = user.filter((c) => c.radio === radio);
  const lastUser = own[own.length - 1];
  if (lastUser?.kind === 'repair') return false;
  if (lastUser?.kind === 'fail') return true;
  return failedAt(sim.result, t)[radio] === 1;
}

/** Keep the changes up to t: a click after seeking back forks the timeline. */
function upTo(user: SimChange[], t: number): SimChange[] {
  return user.filter((c) => c.tS <= t);
}

export const useBuildStore = create<BuildState>((set, get) => ({
  userChanges: [],
  hover: null,
  setHover: (hover) => {
    if (!sameHit(get().hover, hover)) set({ hover });
  },
  toggleRadio: (radio, t) => {
    const kept = upTo(get().userChanges, t);
    const sim = simAt(kept, t);
    const kind = intendsFailed(kept, sim, radio, t) ? 'repair' : 'fail';
    const next = [...kept, sim.addChange({ tS: t, radio, kind })];
    runner.adopt(next);
    set({ userChanges: next });
  },
  repairAll: (t) => {
    const kept = upTo(get().userChanges, t);
    const sim = simAt(kept, t);
    const next = [...kept];
    for (let r = 0; r < PLAY_MODEL.radios.length; r++) {
      if (intendsFailed(next, sim, r, t))
        next.push(sim.addChange({ tS: t, radio: r, kind: 'repair' }));
    }
    runner.adopt(next);
    set({ userChanges: next });
  },
  resetInputs: () => set({ userChanges: [], hover: null }),
}));

/** Radios that are failed or about to fail, for the Reset button and the hover hint. */
export function failedIntent(user: SimChange[], sim: LiveSim, t: number): Uint8Array {
  const out = new Uint8Array(PLAY_MODEL.radios.length);
  for (let r = 0; r < out.length; r++) out[r] = intendsFailed(user, sim, r, t) ? 1 : 0;
  return out;
}
