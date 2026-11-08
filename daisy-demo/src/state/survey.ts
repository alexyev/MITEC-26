// Survey tab state (spec 8.1): the UTV count, the "Your turn" mode and the player time of Send.
// Plans are pure functions of the count, so they are computed once per count and cached.
import { SURVEY } from '../config/survey';
import { unitGridRect } from '../engine/site';
import { planSurvey } from '../engine/survey';
import type { SurveyPlan } from '../engine/survey';
import { create } from 'zustand';
import { getSiteModel } from './model';
import type { YourTurnMode } from '../ui/survey/walkthrough';

const plans = new Map<number, SurveyPlan>();

/** The survey plan for `count` UTVs on the full site, from the base on its pad at the center (D5, D34, D60). */
export function getSurveyPlan(count: number): SurveyPlan {
  let plan = plans.get(count);
  if (!plan) {
    const { site } = getSiteModel();
    plan = planSurvey(unitGridRect(site), site.base, count, SURVEY, site.basePad);
    plans.set(count, plan);
  }
  return plan;
}

interface SurveyState {
  vehicles: number;
  mode: YourTurnMode;
  /** Player time when Send was pressed; a run plays on the player clock, so pause and play work (D21). */
  sentAtT: number;
  /** Change the fleet: re-plans at once and waits for Send. */
  setVehicles: (count: number) => void;
  send: (playerT: number) => void;
  /** The run is over: show its result and unlock the stepper. */
  finish: () => void;
  /** Back to the walkthrough's defaults (Restart, or seeking into the walkthrough). */
  reset: () => void;
}

export const useSurveyStore = create<SurveyState>((set) => ({
  vehicles: SURVEY.defaultVehicles,
  mode: 'result',
  sentAtT: 0,
  setVehicles: (count) =>
    set({ vehicles: Math.min(SURVEY.maxVehicles, Math.max(1, count)), mode: 'planned' }),
  send: (playerT) => set({ mode: 'running', sentAtT: playerT }),
  finish: () => set({ mode: 'result' }),
  reset: () => set({ vehicles: SURVEY.defaultVehicles, mode: 'result', sentAtT: 0 }),
}));
