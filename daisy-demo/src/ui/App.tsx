// The app: the shell around the active tab. Switching tabs unmounts the other tab, so returning to a tab
// starts its walkthrough from the beginning (spec 7).
import { useShellStore } from '../state/store';
import { BuildTab } from './build/BuildTab';
import { Shell } from './shell/Shell';
import { SurveyTab } from './survey/SurveyTab';

export function App() {
  const tab = useShellStore((s) => s.tab);
  return <Shell>{tab === 'survey' ? <SurveyTab key="survey" /> : <BuildTab key="build" />}</Shell>;
}
