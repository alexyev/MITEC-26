// The daisy on the home screen (D130): five outlined petals around a filled center, drawn after the
// captain's reference. The background stays transparent, and the colors come from tokens.css through
// guide.css. The whole flower sits in one group that turns slowly about its center. Petals are listed clockwise from the upper left, the order they bloom in.
import type { CSSProperties } from 'react';

/** Petal directions in degrees, clockwise from +x (SVG y points down): one petal points straight down. */
const PETAL_ANGLES = [234, 306, 18, 90, 162];

/** In view-box units: each petal runs from the center out to `2 * PETAL.rx`. */
const PETAL = { rx: 20, ry: 7.6 };
const CENTER_R = 10;

export function Daisy({ className }: { className?: string }) {
  return (
    <svg
      className={className ? `daisy ${className}` : 'daisy'}
      viewBox="-50 -50 100 100"
      aria-hidden="true"
      focusable="false"
    >
      <g className="daisy-spin">
        {PETAL_ANGLES.map((angle, i) => (
          <g key={angle} transform={`rotate(${angle})`}>
            <ellipse
              className="daisy-petal"
              style={{ '--i': i } as CSSProperties}
              cx={PETAL.rx}
              cy={0}
              rx={PETAL.rx}
              ry={PETAL.ry}
            />
          </g>
        ))}
        <circle className="daisy-center" r={CENTER_R} />
      </g>
    </svg>
  );
}
