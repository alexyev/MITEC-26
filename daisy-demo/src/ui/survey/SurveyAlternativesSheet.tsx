// The survey's Alternatives comparison (D63), in the Build tab's sheet pattern (D54): our approach and the
// other ways to survey the site, each with a one-line trade-off. Opened from the cost card; Escape closes it.
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { SITE } from '../../config/defaults';
import { SURVEY_ALTERNATIVES_SOURCES } from '../../config/survey';
import { IconButton } from '../kit/IconButton';
import { formatInt, formatUsd } from './format';
import type { SurveyAlternativeRow } from './surveyAlternatives';

export interface SurveyAlternativesSheetProps {
  rows: SurveyAlternativeRow[];
  onClose: () => void;
}

export function SurveyAlternativesSheet({ rows, onClose }: SurveyAlternativesSheetProps) {
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

  // Over the whole shell, so it sits above the panels and the map.
  const host = document.querySelector('.shell') ?? document.body;
  return createPortal(
    <div className="alts-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="panel alts"
        role="dialog"
        aria-modal="true"
        aria-labelledby="survey-alts-title"
        tabIndex={-1}
        ref={ref}
      >
        <header className="panel-head">
          <h2 className="panel-title" id="survey-alts-title">
            Alternatives
          </h2>
          <IconButton icon={X} label="Close alternatives" onClick={onClose} small />
        </header>
        <div className="panel-body alts-body">
          <section className="alts-section" aria-label="Ways to survey the site">
            <h3 className="label">Ways to survey the site · {formatInt(SITE.areaAcres)} acres</h3>
            <ul className="alts-list">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className={r.ours ? 'alts-row survey-alts-row ours' : 'alts-row survey-alts-row'}
                >
                  <div className="alts-main">
                    <span className="alts-name">
                      {r.label}
                      {r.ours ? <span className="alts-tag">Ours</span> : null}
                    </span>
                    <span className="alts-verdict">{r.verdict}</span>
                  </div>
                  <span className="alts-cost num">
                    {r.totalUsd !== null ? formatUsd(r.totalUsd) : ''}
                    {r.costNote ? <span className="alts-cost-note">{r.costNote}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <p className="alts-foot">
            Costs from {SURVEY_ALTERNATIVES_SOURCES.workbook}; the GO2 from{' '}
            {SURVEY_ALTERNATIVES_SOURCES.brief}; RTK from {SURVEY_ALTERNATIVES_SOURCES.research}. An
            option without a sourced cost shows none.
          </p>
        </div>
      </div>
    </div>,
    host,
  );
}
