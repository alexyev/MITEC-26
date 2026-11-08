// The Build map's "Take me there" pin (D121): above the featured radio, it flies the camera down to that
// radio's corner module in 3D. Hovering or focusing it starts fetching the 3D view's chunk.
import { LoaderCircle, Rotate3d } from 'lucide-react';
import { UI } from '../../config/defaults';
import { PLAY_VIEW } from '../../config/play';
import { CORNER_PIN } from '../../config/cornerPin';
import './pin.css';

export interface TakeMeTherePinProps {
  /** The radio on the map, in map pixels. */
  x: number;
  y: number;
  label: string;
  loading: boolean;
  onClick: () => void;
  /** The viewer is about to click: fetch the 3D view now. */
  onIntent: () => void;
}

export function TakeMeTherePin({ x, y, label, loading, onClick, onIntent }: TakeMeTherePinProps) {
  const stemFrom = PLAY_VIEW.hoverRingPx + 1;
  const gap = CORNER_PIN.gapPx;
  const Icon = loading ? LoaderCircle : Rotate3d;
  return (
    <div className="scene-pin" style={{ left: Math.round(x), top: Math.round(y) }}>
      <span className="scene-pin-stem" style={{ bottom: stemFrom, height: gap - stemFrom }} />
      <button
        type="button"
        className="scene-pin-btn"
        style={{ bottom: gap }}
        onClick={onClick}
        onPointerEnter={onIntent}
        onFocus={onIntent}
        aria-busy={loading}
        aria-label={`Take me there: radio ${label}'s corner module in 3D`}
        title={`Radio ${label} in 3D`}
      >
        <Icon size={UI.icon.sizePx} strokeWidth={UI.icon.strokeWidth} aria-hidden="true" />
        Take me there
      </button>
    </div>
  );
}
