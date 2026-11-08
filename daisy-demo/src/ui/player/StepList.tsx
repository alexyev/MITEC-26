// Numbered step list (spec 6.5, 7): "Steps, in order" in the control panel. The current step is bright with a
// filled circle, done steps are dimmer and later steps dimmest; clicking a step seeks to it.
import { Section } from '../kit/Section';
import { stepStarts } from './clock';
import type { Player, WalkStep } from './types';

export interface StepListProps {
  player: Player;
  steps: WalkStep[];
  label?: string;
}

export function StepList({ player, steps, label = 'Steps, in order' }: StepListProps) {
  const starts = stepStarts(steps);
  return (
    <Section label={label} data-tour="steps">
      <ol className="steps">
        {steps.map((s, i) => {
          const state =
            i === player.stepIndex ? 'current' : i < player.stepIndex ? 'done' : 'later';
          return (
            <li key={s.id}>
              <button
                type="button"
                className={`step ${state}`}
                aria-current={state === 'current' ? 'step' : undefined}
                onClick={() => player.seek(starts[i])}
              >
                <span className="step-num num" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="step-label">{s.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}
