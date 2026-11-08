// Legend card (spec 5.1, 6.2): bottom right; each story color the tab shows, with its shape and a one- or
// two-word meaning. Failure is a cross, so the story does not depend on telling red from green.
import { Panel } from './Panel';
import { tokenVar } from './tokens';
import type { LegendItem, LegendProps } from './types';

/** A 16 x 12 swatch in the item's shape, drawn in its story color (or the map variant it names). */
export function LegendSwatch({
  token,
  shape,
  colorVar,
}: Pick<LegendItem, 'token' | 'shape' | 'colorVar'>) {
  const c = colorVar ? `var(${colorVar})` : tokenVar(token);
  const area = `var(--c-${token}-area, ${c})`;
  const edge = `var(--c-${token}-edge, transparent)`;
  let mark;
  switch (shape) {
    case 'dot':
      mark = <circle cx="8" cy="6" r="3.5" fill={c} />;
      break;
    case 'circle':
      mark = <circle cx="8" cy="6" r="5" fill={area} stroke={c} strokeWidth="1" />;
      break;
    case 'ring':
      mark = <circle cx="8" cy="6" r="4" fill="none" stroke={c} strokeWidth="1.5" />;
      break;
    case 'line':
      mark = <line x1="1" y1="6" x2="15" y2="6" stroke={c} strokeWidth="2" strokeLinecap="round" />;
      break;
    case 'dash':
      mark = (
        <line x1="1" y1="6" x2="15" y2="6" stroke={c} strokeWidth="2" strokeDasharray="3 2.5" />
      );
      break;
    case 'cross':
      mark = (
        <path
          d="M4.5 2.5 L11.5 9.5 M11.5 2.5 L4.5 9.5"
          stroke={c}
          strokeWidth="2"
          strokeLinecap="round"
        />
      );
      break;
    case 'square':
      mark = <rect x="4" y="2" width="8" height="8" rx="1" fill={c} />;
      break;
    case 'drone':
      // Crossed arms, a small body and four rotor rings, as the survey map draws a drone.
      mark = (
        <g stroke={c} strokeWidth="1.1" fill="none">
          <path d="M4.5 2.5 L11.5 9.5 M11.5 2.5 L4.5 9.5" />
          <circle cx="4.5" cy="2.5" r="1.9" />
          <circle cx="11.5" cy="2.5" r="1.9" />
          <circle cx="11.5" cy="9.5" r="1.9" />
          <circle cx="4.5" cy="9.5" r="1.9" />
          <circle cx="8" cy="6" r="1.4" fill={c} stroke="none" />
        </g>
      );
      break;
    case 'pad':
      // The built-up base pad (D81): a hatched, outlined area with the base marker at its center.
      mark = (
        <g>
          <rect
            x="1.5"
            y="1.5"
            width="13"
            height="9"
            rx="2"
            fill="var(--c-pad-fill)"
            stroke="var(--c-pad-edge)"
            strokeWidth="1"
          />
          <path
            d="M2 6 L6.5 1.5 M2 10.5 L11 1.5 M5.5 10.5 L14.5 1.5 M10 10.5 L14.5 6"
            stroke="var(--c-pad-hatch)"
            strokeWidth="1"
          />
          <rect x="6" y="4" width="4" height="4" rx="0.75" fill={c} />
        </g>
      );
      break;
    case 'fill':
      mark = (
        <rect
          x="1.5"
          y="1.5"
          width="13"
          height="9"
          rx="2"
          fill={area}
          stroke={edge}
          strokeWidth="1"
        />
      );
      break;
  }
  return (
    <svg className="legend-swatch" width="16" height="12" viewBox="0 0 16 12" aria-hidden="true">
      {mark}
    </svg>
  );
}

export function Legend({ items, title = 'Legend' }: LegendProps) {
  return (
    <Panel corner="br" title={title} className="legend">
      <ul className="legend-list">
        {items.map((item) => (
          <li key={`${item.token}-${item.shape}-${item.label}`} className="legend-item">
            <LegendSwatch token={item.token} shape={item.shape} colorVar={item.colorVar} />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
