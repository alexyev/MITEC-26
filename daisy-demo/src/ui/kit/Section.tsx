// Panel section (spec 6.2, 6.4): an 11 px uppercase label, then its content; sections split by hairlines.
import type { SectionProps } from './types';

export function Section({ label, aside, 'data-tour': tour, children }: SectionProps) {
  return (
    <section className="section" aria-label={label} data-tour={tour}>
      <div className="section-head">
        <h3 className="label">{label}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}
