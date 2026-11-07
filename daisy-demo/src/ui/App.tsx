import { BOTTOM_TABS, useUiStore } from '../state/store';

const CONTROL_SECTIONS: [string, string][] = [
  ['Preset', '4 buttons'],
  ['Range', 'log slider'],
  ['Placement specs', 'N, M, spacing, auto-tune'],
  ['Edge toggles', 'battery bridge, front relays, denser edge'],
  ['Build day', 'slider, play, order'],
  ['Bases', 'presets'],
  ['Failure tools', 'click, area, random, reset'],
  ['Designs', 'save A / save B'],
];

const METRIC_SECTIONS = [
  'Modules / density',
  'Cost',
  'Power',
  'Resilience',
  'Capacity',
  'Build edge',
  'Current failures',
];

export function App() {
  const bottomTab = useUiStore((s) => s.bottomTab);
  const setBottomTab = useUiStore((s) => s.setBottomTab);

  return (
    <div className="app">
      <header className="header">
        <h1>Lane-radio network demo</h1>
        <span className="badge">Simulated · Illustrative values</span>
        <span className="spacer" />
        <button type="button">Scenarios ▾</button>
        <button type="button">Pricing</button>
        <button type="button">About</button>
      </header>

      <aside className="panel panel-controls" aria-label="Controls">
        <div className="panel-body">
          {CONTROL_SECTIONS.map(([title, hint]) => (
            <div className="section" key={title}>
              <div className="label">{title}</div>
              <div className="hint">{hint}</div>
            </div>
          ))}
        </div>
      </aside>

      <main className="panel panel-map" aria-label="Map">
        <div className="map-placeholder">
          Map placeholder - units, modules, links, bases and zones arrive in T1.3
        </div>
      </main>

      <aside className="panel panel-metrics" aria-label="Metrics">
        <div className="panel-body">
          {METRIC_SECTIONS.map((title) => (
            <div className="section" key={title}>
              <div className="label">{title}</div>
            </div>
          ))}
        </div>
      </aside>

      <section className="panel panel-bottom" aria-label="Charts">
        <div className="tabs" role="tablist">
          {BOTTOM_TABS.map((tab) => (
            <button
              type="button"
              role="tab"
              key={tab}
              aria-selected={tab === bottomTab}
              onClick={() => setBottomTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="map-placeholder">{bottomTab} - placeholder</div>
      </section>
    </div>
  );
}
