// The Build tab's "Take me there" call to action: once the walkthrough has ended, a pill at top center, just
// under the tab switch, says where to go next. Same action as the pin on the map (D121): fly down to the
// featured radio's corner module in 3D.
import { LoaderCircle, Rotate3d } from 'lucide-react';
import { UI } from '../../config/defaults';
import './cta.css';

export interface TakeMeThereCtaProps {
  label: string;
  loading: boolean;
  onClick: () => void;
  /** The viewer is about to click: fetch the 3D view now. */
  onIntent: () => void;
}

export function TakeMeThereCta({ label, loading, onClick, onIntent }: TakeMeThereCtaProps) {
  const Icon = loading ? LoaderCircle : Rotate3d;
  return (
    <div className="scene-cta">
      <button
        type="button"
        className="scene-cta-btn"
        data-tour="take-me-there"
        onClick={onClick}
        onPointerEnter={onIntent}
        onFocus={onIntent}
        aria-busy={loading}
        aria-label={`Take me there: radio ${label}'s corner module in 3D`}
      >
        <Icon size={UI.icon.sizePx} strokeWidth={UI.icon.strokeWidth} aria-hidden="true" />
        Take me there
      </button>
    </div>
  );
}
