// The daisy on the home screen (D130): five outlined petals around a filled center, drawn after the
// captain's reference. The background stays transparent, and the colors come from tokens.css through
// guide.css. The whole flower sits in one group that turns slowly about its center. Petals are listed clockwise from the upper left, the order they bloom in.
import type { CSSProperties } from 'react';

/** Petal directions in degrees, clockwise from +x (SVG y points down): one petal points straight down. */
const PETAL_ANGLES = [234, 306, 18, 90, 162];

/** In view-box units: each petal runs from the center out to `2 * PETAL.rx`. */
const PETAL = { rx: 20, ry: 7.6 };
const CENTER_R = 10;

/**
 * The mini daisies that bloom around the big one as it pops in (D130). Fixed values, so nothing shifts and every
 * replay is the same: the angle (degrees, clockwise from +x) and distance (in daisy widths) of the spot each one
 * drifts to, its size (daisy widths), spin (degrees), and delay (ms) after the big flower starts.
 */
const BURST = [
  { angle: 205, dist: 0.62, size: 0.15, spin: -50, delay: 700 },
  { angle: 250, dist: 0.7, size: 0.1, spin: 70, delay: 800 },
  { angle: 292, dist: 0.64, size: 0.17, spin: -30, delay: 740 },
  { angle: 335, dist: 0.72, size: 0.11, spin: 60, delay: 880 },
  { angle: 15, dist: 0.66, size: 0.16, spin: -70, delay: 760 },
  { angle: 55, dist: 0.72, size: 0.12, spin: 45, delay: 900 },
  { angle: 105, dist: 0.64, size: 0.17, spin: -40, delay: 820 },
  { angle: 150, dist: 0.7, size: 0.11, spin: 80, delay: 960 },
];

/** A ring of mini daisies behind the big one: each blooms outward from the center and fades away. */
export function DaisyBurst() {
  return (
    <div className="daisy-burst" aria-hidden="true">
      {BURST.map((b) => {
        const rad = (b.angle * Math.PI) / 180;
        return (
          <span
            key={b.angle}
            className="daisy-burst-item"
            style={
              {
                '--x': (Math.cos(rad) * b.dist).toFixed(3),
                '--y': (Math.sin(rad) * b.dist).toFixed(3),
                '--s': b.size,
                '--r': `${b.spin}deg`,
                '--d': `${b.delay}ms`,
              } as CSSProperties
            }
          >
            <Daisy className="daisy-mini" />
          </span>
        );
      })}
    </div>
  );
}

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
