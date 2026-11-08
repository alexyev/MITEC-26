// Survey walkthrough (spec 7, 8.5): the steps with their captions, and what the map shows at player time t.
// Pure functions of the plan and t (spec rule 6), so seeking and stepping back show the right state.
import { SURVEY, SURVEY_WALK } from '../../config/survey';
import type { SurveyPlan } from '../../engine/survey';
import type { WalkStep } from '../player/types';
import { formatInt } from './format';

export type SurveyStepId = 'site' | 'paths' | 'survey' | 'done' | 'yourTurn';

/** The five steps of the Survey tab; the Survey step lasts the survey time at the playback rate. */
export function surveySteps(plan: SurveyPlan): WalkStep[] {
  const count = plan.vehicles.length;
  const fleet = `${count} 4x4${count === 1 ? '' : 's'}`;
  const steps: (WalkStep & { id: SurveyStepId })[] = [
    {
      id: 'site',
      label: 'Site',
      caption: '2,000 acres and 23,000 P3 units to place. First, 4x4s survey the ground.',
      durationS: SURVEY_WALK.siteS,
    },
    {
      id: 'paths',
      label: 'Paths',
      caption: 'Each 4x4 gets its own strip; the paths stop at the base pad, never cross it.',
      durationS: SURVEY_WALK.pathsS,
    },
    {
      id: 'survey',
      label: 'Survey',
      caption: 'Each 4x4 carries Starlink and a drone that follows it, online through the 4x4.',
      durationS: plan.finishH / plan.config.playbackHoursPerS,
    },
    {
      id: 'done',
      label: 'Done',
      caption: `Done in ${formatInt(plan.finishH)} h with ${fleet}. More 4x4s finish sooner in the same 4x4-hours.`,
      durationS: SURVEY_WALK.doneS,
    },
    {
      id: 'yourTurn',
      label: 'Your turn',
      caption: 'Your turn: change the number of 4x4s and press Send.',
      durationS: Infinity,
    },
  ];
  return steps;
}

/** Start time of every step in seconds. */
export function stepStarts(steps: WalkStep[]): number[] {
  const starts: number[] = [];
  let t = 0;
  for (const step of steps) {
    starts.push(t);
    t += step.durationS;
  }
  return starts;
}

/** What the survey map and readout show at a moment. */
export interface SurveyFrame {
  step: SurveyStepId;
  /** The planned paths (dashed amber) are on the map. */
  showPaths: boolean;
  /** Survey hours since Send, 0 to the plan's finish. */
  hours: number;
}

/** The walkthrough frame at player time `t` (every step but "Your turn"). */
export function walkthroughFrame(steps: WalkStep[], plan: SurveyPlan, t: number): SurveyFrame {
  const starts = stepStarts(steps);
  let index = 0;
  while (index + 1 < steps.length && t >= starts[index + 1]) index++;
  const step = steps[index].id as SurveyStepId;
  const surveyStart = starts[steps.findIndex((s) => s.id === 'survey')];
  // From the Done step on, the run is over exactly: rounding in the step starts must not leave a 4x4 short of
  // the base, where it would still show as driving with its drone in the air.
  const hours =
    step === 'done' || step === 'yourTurn'
      ? plan.finishH
      : Math.min(plan.finishH, Math.max(0, (t - surveyStart) * plan.config.playbackHoursPerS));
  return { step, showPaths: step !== 'site', hours };
}

/** Mode of the "Your turn" step: the finished survey, a new plan waiting for Send, or a run. */
export type YourTurnMode = 'result' | 'planned' | 'running';

/** The "Your turn" frame: a run plays at the walkthrough's rate from the moment Send was pressed. */
export function yourTurnFrame(
  plan: SurveyPlan,
  mode: YourTurnMode,
  secondsSinceSend: number,
): SurveyFrame {
  const hours =
    mode === 'result'
      ? plan.finishH
      : mode === 'planned'
        ? 0
        : Math.min(plan.finishH, Math.max(0, secondsSinceSend * plan.config.playbackHoursPerS));
  return { step: 'yourTurn', showPaths: true, hours };
}

/** The fleet size of the walkthrough and of Restart. */
export const WALKTHROUGH_VEHICLES = SURVEY.defaultVehicles;
