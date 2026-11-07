import { BuildDay } from './BuildDay';
import { MapView } from './map/MapView';

// Only what works is on screen: the controls, metrics and chart panels of
// spec 10.2 return, collapsed by default, once they have content.
export function App() {
  return (
    <div className="app">
      <header className="header">
        <h1>Lane-radio network demo</h1>
        <span className="badge">Simulated · Illustrative values</span>
      </header>
      <main className="stage" aria-label="Map">
        <MapView />
        <BuildDay />
      </main>
    </div>
  );
}
