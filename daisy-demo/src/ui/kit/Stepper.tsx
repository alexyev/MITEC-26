// Stepper (spec 6.5): the label, then minus, value and plus, 32 px high; the value stays within min and max.
import { useId } from 'react';
import { Minus, Plus } from 'lucide-react';
import { IconButton } from './IconButton';
import type { StepperProps } from './types';

export function Stepper({ min, max, value, onChange, label, disabled }: StepperProps) {
  const id = useId();
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  return (
    <div className="stepper-row" role="group" aria-labelledby={id}>
      <span className="stepper-label" id={id}>
        {label}
      </span>
      <div className={disabled ? 'stepper disabled' : 'stepper'}>
        <IconButton
          icon={Minus}
          label={`Fewer ${label}`}
          onClick={() => set(value - 1)}
          disabled={disabled || value <= min}
        />
        <output className="stepper-value num" aria-live="polite">
          {value}
        </output>
        <IconButton
          icon={Plus}
          label={`More ${label}`}
          onClick={() => set(value + 1)}
          disabled={disabled || value >= max}
        />
      </div>
    </div>
  );
}
