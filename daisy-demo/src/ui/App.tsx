import { UI } from '../config/defaults';
import { BuildDay } from './BuildDay';
import { MapView } from './map/MapView';

// Less is more (decision D10): only what works is on screen. The controls, metrics and chart panels of
// spec 10.2 return, collapsed by default, once they have content.
export function App() {
  return (
    <div className="app">
      <header className="header">
        <img className="mark" src="/favicon.svg" alt="" width={22} height={22} />
        <h1>Lane-radio network demo</h1>
        <span className="badge">Simulated · Illustrative values</span>
        <span className="spacer" />
        <a className="apex" href={UI.apexUrl}>
          {UI.apexLabel}
        </a>
      </header>
      <main className="stage" aria-label="Map">
        <MapView />
        <BuildDay />
      </main>
    </div>
  );
}
