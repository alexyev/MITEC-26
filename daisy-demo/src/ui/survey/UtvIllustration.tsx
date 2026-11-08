// The survey UTV (D84): a side view of a utility UTV of the Polaris Ranger class, about 80 units to the meter,
// fitted with lidar front and back, an RTK GNSS antenna and a Starlink Mini on the roof, a rugged computer and the
// drone's dock in the bed, and its lidar drone lifting off. Line art in the map's colors from survey.css.

/** One labeled part: where the leader starts on the drawing, where it ends, and how the label is anchored. */
interface Callout {
  label: string;
  from: [number, number];
  to: [number, number];
  anchor: 'start' | 'middle' | 'end';
}

const CALLOUTS: Callout[] = [
  { label: 'Lidar drone', from: [204, 32], to: [150, 24], anchor: 'end' },
  { label: 'Drone dock', from: [210, 115], to: [150, 72], anchor: 'end' },
  { label: 'Lidar · back', from: [181, 132], to: [150, 118], anchor: 'end' },
  { label: 'RTK GNSS', from: [331, 38], to: [300, 16], anchor: 'end' },
  { label: 'Starlink Mini', from: [368, 49], to: [404, 16], anchor: 'start' },
  { label: 'Lidar · front', from: [471, 132], to: [500, 118], anchor: 'start' },
  { label: 'Rugged compute', from: [282, 150], to: [282, 234], anchor: 'middle' },
];

/** Space between a leader's end and its label, in viewBox units. */
const GAP = 5;
/** Baseline offset that centers an 11 px label on its leader's end. */
const MID = 4;
/** Baseline of a label under its leader. */
const BELOW = 14;

const WHEELS = [245, 413];

export function UtvIllustration() {
  return (
    <svg className="utv-art" viewBox="0 0 600 252" role="img" aria-labelledby="utv-art-title">
      <title id="utv-art-title">
        A survey UTV with lidar front and back, an RTK GNSS antenna and a Starlink Mini on its roof,
        a rugged computer and a drone dock in its bed, and its lidar drone lifting off.
      </title>
      <defs>
        <linearGradient id="utv-fan-front" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" className="utv-fan-near" />
          <stop offset="1" className="utv-fan-far" />
        </linearGradient>
        <linearGradient id="utv-fan-back" x1="1" x2="0" y1="0" y2="0">
          <stop offset="0" className="utv-fan-near" />
          <stop offset="1" className="utv-fan-far" />
        </linearGradient>
      </defs>

      {/* Lidar scan fans to the ground, front and back, with a few beams. */}
      <path d="M474 140 L600 150 L600 210 L540 210 Z" fill="url(#utv-fan-front)" />
      <path d="M180 140 L40 150 L40 210 L118 210 Z" fill="url(#utv-fan-back)" />
      <path
        className="utv-beam"
        d="M474 140 L600 168 M474 140 L578 210 M180 140 L40 172 M180 140 L72 210"
      />

      <path className="utv-ground" d="M24 210.5 H600" />

      {/* The drone lifting off its dock: its path down, rotors, arms, body and lidar. */}
      <path className="utv-guide" d="M232 46 V110" />
      <g transform="translate(232 32)">
        <path className="utv-drone-arm" d="M-24 0 H24 M-24 0 V-3 M24 0 V-3" />
        <ellipse className="utv-rotor" cx="-24" cy="-4" rx="11" ry="2" />
        <ellipse className="utv-rotor" cx="24" cy="-4" rx="11" ry="2" />
        <rect className="utv-drone-body" x="-9" y="-4" width="18" height="9" rx="3" />
        <rect className="utv-drone-body" x="-5" y="6" width="10" height="7" rx="2" />
        <path className="utv-drone-arm" d="M-11 5 L-15 12 M11 5 L15 12" />
      </g>

      {/* Bed: the cargo box, then the dock on its posts and the rugged computer. */}
      <path className="utv-body" d="M198 124 H300 V164 H204 Q198 164 198 158 Z" />
      <path className="utv-line" d="M204 130 V158" />
      <path className="utv-dock" d="M214 124 V116 M250 124 V116" />
      <path className="utv-dock-pad" d="M208 115 H256" />
      <rect className="utv-box" x="262" y="130" width="36" height="24" rx="3" />
      <path className="utv-fins" d="M269 136 V148 M274 136 V148 M279 136 V148 M284 136 V148" />
      <circle className="utv-led" cx="292" cy="137" r="1.75" />

      {/* Cab: roll cage, seat, steering column. */}
      <path
        className="utv-cage"
        d="M304 164 L312 62 Q313 56 319 56 L384 56 Q390 56 392 61 L410 122"
      />
      <path className="utv-cage thin" d="M318 62 L328 124" />
      <path className="utv-body" d="M300 124 H410 L420 134 V164 H300 Z" />
      <path
        className="utv-seat"
        d="M318 92 Q317 86 323 86 L329 86 Q335 86 334 92 L331 120 L362 120 Q368 120 368 126 L366 132 H320 Z"
      />
      <path className="utv-line" d="M404 120 L390 98" />
      <path className="utv-line strong" d="M384 100 L396 92" />

      {/* Front: hood, grille and bumper. */}
      <path
        className="utv-body"
        d="M410 122 Q430 120 446 130 L452 136 Q456 140 456 146 V160 Q456 166 450 166 H420 V134 Z"
      />
      <path className="utv-line" d="M440 142 H452 M440 148 H452 M440 154 H452" />

      {/* Fenders and wheels. */}
      {WHEELS.map((cx) => (
        <g key={cx}>
          <path
            className="utv-fender"
            d={`M${cx - 36} 166 Q${cx - 34} 140 ${cx} 138 Q${cx + 34} 140 ${cx + 36} 166`}
          />
          <g transform={`translate(${cx} 183)`}>
            <circle r="27" className="utv-tire" />
            <circle r="24" className="utv-tread" />
            <circle r="14" className="utv-rim" />
            <circle r="3.5" className="utv-hub" />
          </g>
        </g>
      ))}

      {/* Roof: RTK GNSS antenna on a mast, and the Starlink Mini tilted on its mount. */}
      <path className="utv-line" d="M331 56 V46" />
      <path className="utv-antenna" d="M320 46 Q320 36 331 36 Q342 36 342 46 Z" />
      <path className="utv-line" d="M352 56 L354 50 M380 56 V46" />
      <path className="utv-panel" d="M348 50 L386 44 L387 49 L349 55 Z" />

      {/* Lidar, front and back: a scanner on a bracket at each end, its window toward the ground. */}
      <path className="utv-line" d="M456 146 H464 M198 146 H190" />
      {[471, 183].map((x) => (
        <g key={x} transform={`translate(${x} 140)`}>
          <rect x="-7" y="-11" width="14" height="20" rx="4" className="utv-lidar" />
          <path d="M-7 -2 H7" className="utv-lidar-window" />
        </g>
      ))}

      {/* Callouts. */}
      <g className="utv-callouts">
        {CALLOUTS.map((c) => {
          const [x0, y0] = c.from;
          const [x1, y1] = c.to;
          const tx = c.anchor === 'end' ? x1 - GAP : c.anchor === 'start' ? x1 + GAP : x1;
          const ty = c.anchor === 'middle' ? y1 + BELOW : y1 + MID;
          return (
            <g key={c.label}>
              <path className="utv-leader" d={`M${x0} ${y0} L${x1} ${y1}`} />
              <circle className="utv-leader-dot" cx={x0} cy={y0} r="2" />
              <text x={tx} y={ty} textAnchor={c.anchor}>
                {c.label}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
