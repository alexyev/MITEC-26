// Player bar (spec 6.2, 7): bottom center, at most 560 px wide. The step and its caption, then play and pause,
// a progress track with one tick per step (click or drag to seek), step back and forward, restart, and the
// playback speed shared by both tabs (1× is the designed pace).
import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { UI } from '../../config/defaults';
import { DockPortal } from '../kit/dock';
import { IconButton } from '../kit/IconButton';
import { Segmented } from '../kit/Segmented';
import type { SegmentedOption } from '../kit/types';
import { stepStarts, walkDuration } from './clock';
import { speedLabel } from './speed';
import type { Player, WalkStep } from './types';

const SPEED_OPTIONS: SegmentedOption[] = UI.player.speeds.map((speed, i) => ({
  value: String(speed),
  label: speedLabel(speed),
  title: i === 0 ? `${speedLabel(speed)} · normal speed` : `${speedLabel(speed)} · faster`,
}));

export interface PlayerBarProps {
  player: Player;
  steps: WalkStep[];
  /** A note for sped-up or slowed-down motion in this step, for example "Packets slowed for visibility". */
  note?: string;
}

export function PlayerBar({ player, steps, note }: PlayerBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const total = walkDuration(steps);
  const starts = stepStarts(steps);
  const step = steps[player.stepIndex];
  const last = steps.length - 1;
  const frac = total > 0 ? Math.min(1, player.t / total) : 1;

  const seekAt = (clientX: number) => {
    const el = trackRef.current;
    if (!el || total <= 0) return;
    const r = el.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    // The very end of the track is the start of the last step.
    player.seek(f * total);
  };
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    seekAt(e.clientX);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (draggingRef.current) seekAt(e.clientX);
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  };

  if (!step) return null;
  const eyebrow = `Step ${player.stepIndex + 1} of ${steps.length} · ${step.label}`;

  return (
    <DockPortal slot="player">
      <section className="panel player" aria-label="Walkthrough">
        <div className="player-head">
          <span className="label">{eyebrow}</span>
          {note ? <span className="player-note">{note}</span> : null}
        </div>
        <p className="player-caption" aria-live="polite">
          {step.caption}
        </p>
        <div className="player-controls">
          <IconButton
            icon={player.playing ? Pause : Play}
            label={player.playing ? 'Pause' : 'Play'}
            onClick={player.playing ? player.pause : player.play}
            primary
          />
          <div
            className="player-track"
            ref={trackRef}
            role="slider"
            tabIndex={0}
            aria-label="Walkthrough progress"
            aria-valuemin={1}
            aria-valuemax={steps.length}
            aria-valuenow={player.stepIndex + 1}
            aria-valuetext={`Step ${player.stepIndex + 1} of ${steps.length}: ${step.label}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <span className="player-rail">
              <span className="player-fill" style={{ width: `${frac * 100}%` }} />
              {starts.slice(1).map((s, i) => (
                <span
                  key={steps[i + 1].id}
                  className={s <= player.t ? 'player-tick passed' : 'player-tick'}
                  style={{ left: `${total > 0 ? (s / total) * 100 : 100}%` }}
                />
              ))}
              <span className="player-thumb" style={{ left: `${frac * 100}%` }} />
            </span>
          </div>
          <IconButton
            icon={SkipBack}
            label="Previous step"
            onClick={() => player.stepBy(-1)}
            disabled={player.t <= 0}
          />
          <IconButton
            icon={SkipForward}
            label="Next step"
            onClick={() => player.stepBy(1)}
            disabled={player.stepIndex >= last}
          />
          <IconButton icon={RotateCcw} label="Restart" onClick={player.restart} />
          <span className="player-divider" aria-hidden="true" />
          <Segmented
            options={SPEED_OPTIONS}
            value={String(player.speed)}
            onChange={(v) => player.setSpeed(Number(v))}
            ariaLabel="Playback speed"
            size="compact"
          />
        </div>
      </section>
    </DockPortal>
  );
}
