// Survey tab, stub of T2.2: the full-site map with the planned units and the base, its step list, legend and
// player. Worker B replaces this file with the survey walkthrough (T3.4, spec 8).
import { UI } from '../../config/defaults';
import { Legend } from '../kit/Legend';
import { Panel } from '../kit/Panel';
import type { LegendItem } from '../kit/types';
import { MapView } from '../map/MapView';
import { PlayerBar } from '../player/PlayerBar';
import { StepList } from '../player/StepList';
import type { WalkStep } from '../player/types';
import { usePlayer } from '../player/usePlayer';

const STEPS: WalkStep[] = [
  {
    id: 'site',
    label: 'Site',
    caption: 'The site before the build: every planned P3 unit, and the base at the center.',
    durationS: UI.surveyStub.introS,
  },
  {
    id: 'your-turn',
    label: 'Your turn',
    caption: 'Your turn: drag to pan the site, and scroll to zoom.',
    durationS: Infinity,
  },
];

const LEGEND: LegendItem[] = [
  { token: 'unit', label: 'Planned unit', shape: 'square' },
  { token: 'base', label: 'Base', shape: 'square' },
];

export function SurveyTab() {
  const player = usePlayer(STEPS);
  return (
    <>
      <MapView />
      <Panel corner="tl" title="Survey">
        <StepList player={player} steps={STEPS} />
      </Panel>
      <Legend items={LEGEND} />
      <PlayerBar player={player} steps={STEPS} />
    </>
  );
}
