// Inline bar (spec 6.6): a 48 x 4 px track in `--border` with a fill in the row's story color (or the neutral
// bar color for shares that are no story color, D100), and an optional tick at a target.
import { tokenVar } from './tokens';
import type { InlineBarProps } from './types';

const clampPct = (p: number) => Math.min(100, Math.max(0, Number.isFinite(p) ? p : 0));

export function InlineBar({ pct, token, targetPct, width }: InlineBarProps) {
  const style = width === 'fill' ? undefined : width !== undefined ? { width } : undefined;
  return (
    <span
      className={width === 'fill' ? 'inline-bar fill' : 'inline-bar'}
      style={style}
      role="presentation"
    >
      <span
        className="inline-bar-fill"
        style={{
          width: `${clampPct(pct)}%`,
          background: token === 'neutral' ? 'var(--bar-neutral)' : tokenVar(token),
        }}
      />
      {targetPct !== undefined ? (
        <span className="inline-bar-target" style={{ left: `${clampPct(targetPct)}%` }} />
      ) : null}
    </span>
  );
}
