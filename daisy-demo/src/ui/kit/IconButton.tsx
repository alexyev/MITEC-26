// Icon-only button (spec 6.5, 6.8): 32 px, quiet by default, light fill when primary; always labelled.
import type { LucideIcon } from 'lucide-react';
import { UI } from '../../config/defaults';

export interface IconButtonProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  primary?: boolean;
  /** Small (24 px) variant for title rows. */
  small?: boolean;
  disabled?: boolean;
  pressed?: boolean;
}

export function IconButton({
  icon: Icon,
  label,
  onClick,
  primary,
  small,
  disabled,
  pressed,
}: IconButtonProps) {
  const cls = ['icon-btn', primary ? 'primary' : 'quiet', small ? 'small' : ''].filter(Boolean);
  return (
    <button
      type="button"
      className={cls.join(' ')}
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      aria-pressed={pressed}
    >
      <Icon size={UI.icon.sizePx} strokeWidth={UI.icon.strokeWidth} aria-hidden="true" />
    </button>
  );
}
