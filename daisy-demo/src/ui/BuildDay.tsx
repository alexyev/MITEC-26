// Build-day slider (spec 10.2, "Build day"): the only control of T1.3, floating over the map.
import { getSiteModel } from '../state/model';
import { useUiStore } from '../state/store';
import { frontsAt } from '../engine/schedule';

const fmt = new Intl.NumberFormat('en-US');

export function BuildDay() {
  const day = useUiStore((s) => s.buildDay);
  const setDay = useUiStore((s) => s.setBuildDay);
  const { schedule, site } = getSiteModel();
  const f = frontsAt(schedule, day);
  return (
    <div className="build-day">
      <label className="build-day-label" htmlFor="build-day">
        <span className="label">Build day</span>
        <span className="build-day-value">
          {day}
          <span className="of"> / {schedule.lastDay}</span>
        </span>
      </label>
      <input
        id="build-day"
        type="range"
        min={0}
        max={schedule.lastDay}
        step={1}
        value={day}
        onChange={(e) => setDay(Number(e.target.value))}
      />
      <span className="build-day-stats">
        {fmt.format(f.commissionedCount)} commissioned · {fmt.format(f.edgeZoneCount)} unpowered ·{' '}
        {fmt.format(site.count)} units
      </span>
    </div>
  );
}
