// The Alternatives comparison (D54): every radio setup of the pricing file on this site, then other ways to
// connect the site, each with a one-line verdict. Opened on demand from the cost card; Escape closes it.
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { ALTERNATIVES_SOURCES } from '../../config/alternatives';
import { PERCENT } from '../../config/play';
import { IconButton } from '../kit/IconButton';
import { InlineBar } from '../kit/InlineBar';
import { formatUsd } from '../survey/format';
import { costText, type Alternatives } from './alternatives';
import { formatCount } from './format';

export interface AlternativesSheetProps {
  alternatives: Alternatives;
  onClose: () => void;
}

export function AlternativesSheet({ alternatives, onClose }: AlternativesSheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { setups, solutions } = alternatives;
  const maxSetup = Math.max(...setups.map((s) => s.totalUsd));
  const sourced = solutions.filter((s) => s.totalUsd !== null).map((s) => s.totalUsd as number);
  const maxSolution = Math.max(...sourced);

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

  // Over the whole shell, so it sits above the panels and the map.
  const host = document.querySelector('.shell') ?? document.body;
  return createPortal(
    <div className="alts-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="panel alts"
        role="dialog"
        aria-modal="true"
        aria-labelledby="alts-title"
        tabIndex={-1}
        ref={ref}
      >
        <header className="panel-head">
          <h2 className="panel-title" id="alts-title">
            Alternatives
          </h2>
          <IconButton icon={X} label="Close alternatives" onClick={onClose} small />
        </header>
        <div className="panel-body alts-body">
          <section className="alts-section" aria-label="Radio setups">
            <h3 className="label">Radio setups · full site</h3>
            <ul className="alts-list">
              {setups.map((s) => (
                <li key={s.id} className={s.ours ? 'alts-row ours' : 'alts-row'}>
                  <div className="alts-main">
                    <span className="alts-name">
                      {s.label}
                      {s.ours ? <span className="alts-tag">Ours</span> : null}
                    </span>
                    <span className="alts-verdict">
                      {formatCount(s.modules)} modules · {s.tradeoff}
                    </span>
                  </div>
                  <InlineBar
                    pct={(s.totalUsd / maxSetup) * PERCENT.scale}
                    token={s.ours ? 'signal' : 'unit'}
                  />
                  <span className="alts-cost num">{formatUsd(s.totalUsd)}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="alts-section" aria-label="Other ways to connect the site">
            <h3 className="label">Other ways to connect the site</h3>
            <ul className="alts-list">
              {solutions.map((s) => (
                <li key={s.id} className={s.ours ? 'alts-row ours' : 'alts-row'}>
                  <div className="alts-main">
                    <span className="alts-name">
                      {s.label}
                      {s.ours ? <span className="alts-tag">Ours</span> : null}
                    </span>
                    <span className="alts-verdict">{s.verdict}</span>
                  </div>
                  {s.totalUsd !== null ? (
                    <InlineBar
                      pct={(s.totalUsd / maxSolution) * PERCENT.scale}
                      token={s.ours ? 'signal' : 'unit'}
                    />
                  ) : (
                    <span />
                  )}
                  <span className="alts-cost num">
                    {costText(s.totalUsd)}
                    {s.costNote ? <span className="alts-cost-note">{s.costNote}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <p className="alts-foot">
            Up-front costs on this site, computed from {ALTERNATIVES_SOURCES.workbook}; Exowatt
            figures from {ALTERNATIVES_SOURCES.brief}; site practice from{' '}
            {ALTERNATIVES_SOURCES.research}. An option without a sourced cost shows none.
          </p>
        </div>
      </div>
    </div>,
    host,
  );
}
