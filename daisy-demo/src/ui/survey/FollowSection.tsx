// The "Up close" section of the Survey panel (D140, D143): follow a UTV, switch to another, and go back to the
// site; while following, the chain that carries its drone's data: Starlink to the UTV to the drone, live.
import { Focus, Maximize2 } from 'lucide-react';
import { UI } from '../../config/defaults';
import { droneFlying } from '../../engine/survey';
import type { VehicleState } from '../../engine/survey';
import { Section } from '../kit/Section';
import { Segmented } from '../kit/Segmented';
import { formatSharePct } from './format';

export interface FollowSectionProps {
  /** UTVs in the plan on the map. */
  count: number;
  /** The followed UTV (0-based) and its state now, or null when not following. */
  following: { id: number; state: VehicleState; activity: string } | null;
  onFollow: (id: number) => void;
  onExit: () => void;
}

const ICON = {
  size: UI.icon.sizePx,
  strokeWidth: UI.icon.strokeWidth,
  'aria-hidden': true,
} as const;

export function FollowSection({ count, following, onFollow, onExit }: FollowSectionProps) {
  if (!following) {
    return (
      <Section label="Up close" data-tour="follow">
        <button type="button" className="survey-quiet-btn" onClick={() => onFollow(0)}>
          <Focus {...ICON} />
          Follow a UTV
        </button>
        <p className="survey-follow-hint">Or click a UTV on the map.</p>
      </Section>
    );
  }

  const { id, state, activity } = following;
  const n = id + 1;
  const flying = droneFlying(state);
  const options = Array.from({ length: count }, (_, i) => ({
    value: String(i),
    label: `#${i + 1}`,
    title: `UTV #${i + 1}`,
  }));
  const progress = state.kind === 'base' ? '' : ` · ${formatSharePct(state.stripProgress)}%`;
  return (
    <Section
      label="Up close"
      data-tour="follow"
      aside={<span className="survey-follow-key">Esc</span>}
    >
      <Segmented
        options={options}
        value={String(id)}
        onChange={(v) => onFollow(Number(v))}
        ariaLabel="UTV to follow"
      />
      <ol className="link-chain" aria-label={`How Drone #${n} stays online`}>
        <li className="link-node">
          <SatelliteGlyph />
          <span className="link-name">Starlink</span>
          <span className="link-status">Online</span>
        </li>
        <li className="link-edge starlink" aria-hidden="true" />
        <li className="link-node">
          <UtvGlyph />
          <span className="link-name">UTV #{n}</span>
          <span className="link-status">
            {activity}
            {progress}
          </span>
        </li>
        <li className="link-edge drone" aria-hidden="true" />
        <li className="link-node">
          <DroneGlyph />
          <span className="link-name">Drone #{n}</span>
          <span className="link-status">{flying ? 'Flying · via UTV' : 'Docked on UTV'}</span>
        </li>
      </ol>
      <p className="survey-follow-hint">
        The drone is online through its UTV, the UTV through Starlink.
      </p>
      <button type="button" className="survey-quiet-btn" onClick={onExit}>
        <Maximize2 {...ICON} />
        Back to site
      </button>
    </Section>
  );
}

/** The satellite as the map draws it (D143): a body between two solar wings, with a blue light. */
function SatelliteGlyph() {
  return (
    <svg className="link-glyph" viewBox="0 0 16 12" aria-hidden="true">
      <g className="glyph-neutral">
        <rect x="6" y="4" width="4" height="4" />
        <rect x="0.5" y="4.25" width="4.5" height="3.5" />
        <rect x="11" y="4.25" width="4.5" height="3.5" />
      </g>
      <circle cx="8" cy="6" r="1" className="glyph-data" />
    </svg>
  );
}

/** A UTV as the map draws it: an amber dot with its blue online dot. */
function UtvGlyph() {
  return (
    <svg className="link-glyph" viewBox="0 0 16 12" aria-hidden="true">
      <circle cx="7" cy="7" r="3.5" className="glyph-work" />
      <circle cx="11" cy="3" r="2" className="glyph-halo" />
      <circle cx="11" cy="3" r="1.5" className="glyph-data" />
    </svg>
  );
}

/** A drone as the map and the legend draw it: crossed arms, a small body and four rotor rings. */
function DroneGlyph() {
  return (
    <svg className="link-glyph" viewBox="0 0 16 12" aria-hidden="true">
      <g className="glyph-drone">
        <path d="M4.5 2.5 L11.5 9.5 M11.5 2.5 L4.5 9.5" />
        <circle cx="4.5" cy="2.5" r="1.9" />
        <circle cx="11.5" cy="2.5" r="1.9" />
        <circle cx="11.5" cy="9.5" r="1.9" />
        <circle cx="4.5" cy="9.5" r="1.9" />
      </g>
      <circle cx="8" cy="6" r="1.4" className="glyph-work" />
    </svg>
  );
}
