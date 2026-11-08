// Rows of the survey's Alternatives comparison (D63): our approach and the other ways to survey the site, each
// with a one-line trade-off. A cost shows only where a source gives one, so only our Starlink has a figure.
import { SURVEY_ALTERNATIVES } from '../../config/survey';
import type { SurveyCost } from '../../engine/pricing';

export interface SurveyAlternativeRow {
  id: string;
  label: string;
  verdict: string;
  /** Cost on this site, or null when no source gives one. */
  totalUsd: number | null;
  /** Shown under the cost when it covers only part of the approach. */
  costNote?: string;
  ours: boolean;
}

export function surveyAlternatives(cost: SurveyCost): SurveyAlternativeRow[] {
  return SURVEY_ALTERNATIVES.map((a) => {
    const ours = a.id === 'ours';
    return {
      ...a,
      ours,
      totalUsd: ours ? cost.pricedUsd : null,
      costNote: ours && !cost.complete ? 'Starlink only' : undefined,
    };
  });
}
