// The survey UTV (D84), in the Alternatives sheet pattern (D54, D63): the drawing of the kit, what one UTV
// costs all in from sourced prices, and the lidar grades it could carry. Opened from the cost card.
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { LIDAR_GRADES } from '../../config/utvKit';
import { IconButton } from '../kit/IconButton';
import { formatUsd } from './format';
import { UtvIllustration } from './UtvIllustration';
import { gradeCost } from './utvKit';
import type { UtvKitCost } from './utvKit';

export interface UtvKitSheetProps {
  kit: UtvKitCost;
  onClose: () => void;
}

function range(lowUsd: number, highUsd: number): string {
  return lowUsd === highUsd ? formatUsd(lowUsd) : `${formatUsd(lowUsd)} to ${formatUsd(highUsd)}`;
}

export function UtvKitSheet({ kit, onClose }: UtvKitSheetProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const sources = [...new Set([...kit.rows, ...LIDAR_GRADES].map((r) => r.source))].filter(
    (s) => !kit.unpriced.some((r) => r.source === s),
  );
  const host = document.querySelector('.shell') ?? document.body;
  return createPortal(
    <div className="alts-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="panel alts utv-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="utv-sheet-title"
        tabIndex={-1}
        ref={ref}
      >
        <header className="panel-head">
          <h2 className="panel-title" id="utv-sheet-title">
            The survey UTV
          </h2>
          <IconButton icon={X} label="Close the survey UTV" onClick={onClose} small />
        </header>
        <div className="panel-body alts-body">
          <figure className="utv-figure">
            <UtvIllustration />
            <figcaption>
              A utility UTV with lidar front and back, RTK GNSS and Starlink Mini on the roof, and a
              rugged computer and a lidar drone&apos;s dock in the bed.
            </figcaption>
          </figure>

          <section className="alts-section" aria-label="One UTV, all in">
            <h3 className="label">One UTV, all in · {kit.grade.label.toLowerCase()} lidar</h3>
            <ul className="utv-kit">
              {kit.rows.map((r) => (
                <li className="utv-kit-row" key={r.id}>
                  <span>
                    {r.label}
                    <span className="utv-kit-detail">{r.detail}</span>
                  </span>
                  <span className={r.usd === null ? 'utv-kit-value none' : 'utv-kit-value num'}>
                    {r.usd === null ? 'No public price' : formatUsd(r.usd)}
                  </span>
                </li>
              ))}
              <li className="utv-kit-row total">
                <span>
                  All in
                  {kit.unpriced.length > 0 ? (
                    <span className="utv-kit-detail">
                      without {kit.unpriced.map((r) => r.label.toLowerCase()).join(', ')}
                    </span>
                  ) : null}
                </span>
                <span className="utv-kit-value num">{formatUsd(kit.totalUsd)}</span>
              </li>
              <li className="utv-kit-row sub">
                <span>The UTV and its ground kit, without the drone</span>
                <span className="utv-kit-value num">{formatUsd(kit.groundUsd)}</span>
              </li>
              {kit.serviceUsdPerMonth !== null ? (
                <li className="utv-kit-row sub">
                  <span>Starlink service, on top</span>
                  <span className="utv-kit-value num">
                    {formatUsd(kit.serviceUsdPerMonth)} a month
                  </span>
                </li>
              ) : null}
            </ul>
          </section>

          <section className="alts-section" aria-label="Lidar grades">
            <h3 className="label">Lidar front and back, by grade</h3>
            <ul className="alts-list">
              {LIDAR_GRADES.map((g) => {
                const c = gradeCost(g);
                const ours = g.id === kit.grade.id;
                return (
                  <li
                    key={g.id}
                    className={ours ? 'alts-row survey-alts-row ours' : 'alts-row survey-alts-row'}
                  >
                    <div className="alts-main">
                      <span className="alts-name">
                        {g.label}
                        {ours ? <span className="alts-tag">Priced</span> : null}
                      </span>
                      <span className="alts-verdict">
                        {g.example}. {g.verdict}
                      </span>
                    </div>
                    <span className="alts-cost num">
                      {range(c.lowUsd, c.highUsd)}
                      <span className="alts-cost-note">
                        {g.count === 1 ? 'one system' : `${g.count} units`}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <ul className="utv-sources" aria-label="Sources">
            {sources.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>,
    host,
  );
}
