// "Why UTVs, not robot dogs" (D110), in the Alternatives sheet pattern (D54, D63): the two reasons first, faster
// and connected, then the survey engine's comparison of one UTV and one GO2 on this site, and the cost case.
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Gauge, SatelliteDish, X } from 'lucide-react';
import { UI } from '../../config/defaults';
import { GO2, GO2_KIT, GO2_SOURCES } from '../../config/go2';
import { IconButton } from '../kit/IconButton';
import { InlineBar } from '../kit/InlineBar';
import { sig3 } from './format';
import { compareRows, whyText } from './whyUtv';
import type { WhyUtv } from './whyUtv';

const PCT = 100;

export interface WhyUtvSheetProps {
  why: WhyUtv;
  onClose: () => void;
}

export function WhyUtvSheet({ why, onClose }: WhyUtvSheetProps) {
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

  const text = whyText(why);
  const rows = compareRows(why);
  const { utv, dog } = why.comparison;
  const pace = [
    { label: 'UTV', acresPerH: utv.acresPerH, token: 'work' as const },
    { label: 'GO2', acresPerH: dog.acresPerH, token: 'neutral' as const },
  ];
  const sources = [...GO2_SOURCES, ...GO2_KIT.map((p) => p.source)];
  const host = document.querySelector('.shell') ?? document.body;
  return createPortal(
    <div className="alts-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="panel alts why-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="why-sheet-title"
        tabIndex={-1}
        ref={ref}
      >
        <header className="panel-head">
          <h2 className="panel-title" id="why-sheet-title">
            Why UTVs, not robot dogs
          </h2>
          <IconButton icon={X} label="Close why UTVs" onClick={onClose} small />
        </header>
        <div className="panel-body alts-body">
          <p className="why-intro">
            Exowatt&apos;s challenge video shows a quadruped surveying. Here is one survey UTV
            against one Unitree {GO2.variant}, planned on this site by the same survey engine.
          </p>
          <div className="why-points">
            <section className="why-point" aria-label="Faster">
              <h3 className="why-point-head">
                <Gauge size={UI.icon.sizePx} strokeWidth={UI.icon.strokeWidth} aria-hidden="true" />
                <span>
                  <span className="why-point-value num">{text.speedUp}</span> faster
                </span>
              </h3>
              <div className="why-bars" aria-label="Acres an hour, one unit">
                {pace.map((b) => (
                  <div className="why-bar" key={b.label}>
                    <span className="why-bar-label">{b.label}</span>
                    <InlineBar
                      pct={(b.acresPerH / pace[0].acresPerH) * PCT}
                      token={b.token}
                      width="fill"
                    />
                    <span className="why-bar-value num">{sig3(b.acresPerH)} ac/h</span>
                  </div>
                ))}
              </div>
              <p>{text.faster}</p>
            </section>
            <section className="why-point" aria-label="Solves connectivity">
              <h3 className="why-point-head">
                <SatelliteDish
                  size={UI.icon.sizePx}
                  strokeWidth={UI.icon.strokeWidth}
                  aria-hidden="true"
                />
                Online from day one
              </h3>
              <p>{text.connected}</p>
            </section>
          </div>

          <section className="alts-section" aria-label="One UTV against one GO2">
            <table className="why-table">
              <thead>
                <tr>
                  <th scope="col" className="label">
                    On this site
                  </th>
                  <th scope="col" className="label">
                    Survey UTV
                  </th>
                  <th scope="col" className="label">
                    {GO2.variant}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label}>
                    <th scope="row">{r.label}</th>
                    <td className={r.favors === 'utv' ? 'num better' : 'num'}>{r.utv}</td>
                    <td className={r.favors === 'dog' ? 'num better' : 'num'}>{r.dog}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="alts-section why-cost" aria-label="What it costs">
            <h3 className="label">The cost case</h3>
            <p>{text.cost}</p>
            <p className="why-edge">{text.dogEdge}</p>
          </section>

          <p className="alts-foot">{text.assumptions}</p>
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
