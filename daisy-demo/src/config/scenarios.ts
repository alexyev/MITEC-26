// Pre-set scenarios (spec section 8.2): fixed setup, routing model and timeline of "Single radio failure".
// The step table is data here so the packet simulation and the player UI use the same numbers.
import { ROUTING } from './defaults';
import type { PresetId } from '../engine/types';

export interface ScenarioStep {
  id: string;
  label: string;
  /** Start time of the step in seconds. */
  startS: number;
  /** End time in seconds, or null for an open-ended step. */
  endS: number | null;
  ui: string;
}

export interface ScenarioDef {
  id: string;
  title: string;
  setup: {
    presetId: PresetId;
    rangeM: number;
    basesPreset: 'west1' | 'westEast2' | 'corners4' | 'center';
    buildDay: 'last';
    seed: number;
    watchedDistanceFromBaseM: number;
    windowM: { w: number; h: number };
  };
  routing: typeof ROUTING;
  traffic: { watchedPacketIntervalS: number; note: string };
  failureAtS: number;
  /** Placeholder swap time of the maintenance ticket (spec 8.2). */
  maintenance: { swapMinutes: number; ticketAtS: number };
  steps: ScenarioStep[];
}

export const SCENARIOS: Record<string, ScenarioDef> = {
  singleRadioFailure: {
    id: 'singleRadioFailure',
    title: 'Single radio failure - detect and reroute',
    setup: {
      presetId: 'mesh5',
      rangeM: 300,
      basesPreset: 'west1',
      buildDay: 'last',
      seed: 41207,
      watchedDistanceFromBaseM: 2000,
      windowM: { w: 800, h: 400 },
    },
    routing: ROUTING,
    traffic: {
      watchedPacketIntervalS: 0.2,
      note: 'Sped up for visibility; background modules send at the normal rate and are not animated.',
    },
    failureAtS: 5.0,
    maintenance: { swapMinutes: 15, ticketAtS: 10 },
    steps: [
      {
        id: 'normal',
        label: 'Normal',
        startS: 0,
        endS: 5,
        ui: 'Packets move along the path to the base. Path highlighted.',
      },
      {
        id: 'failure',
        label: 'Failure',
        startS: 5.0,
        endS: 5.0,
        ui: 'The module turns red. Packets reach it and stop.',
      },
      {
        id: 'detection',
        label: 'Detection',
        startS: 5.0,
        endS: 8.0,
        ui: 'Neighbors show missed hello 1/3, 2/3, 3/3. Packets wait in the upstream queue.',
      },
      {
        id: 'declaredDown',
        label: 'Declared down',
        startS: 8.0,
        endS: 8.0,
        ui: 'Event log: module declared down by 3 neighbors.',
      },
      {
        id: 'localRepair',
        label: 'Local repair',
        startS: 8.0,
        endS: 8.0,
        ui: 'Upstream module sends via its next-best neighbor. New path highlighted, old path dashed.',
      },
      {
        id: 'routeUpdate',
        label: 'Route update',
        startS: 8.0,
        endS: 8.3,
        ui: 'A ring spreads hop by hop: routes updated at N modules.',
      },
      {
        id: 'queueFlush',
        label: 'Queue flush',
        startS: 8.0,
        endS: 9.0,
        ui: 'Queued packets go on the new path; the queue returns to 0.',
      },
      {
        id: 'recovered',
        label: 'Recovered',
        startS: 9.0,
        endS: null,
        ui: 'Normal flow on the new path; hops and latency increase shown.',
      },
      {
        id: 'ticket',
        label: 'Maintenance ticket',
        startS: 10.0,
        endS: null,
        ui: 'Replace module on its P3. Swap time is a placeholder.',
      },
    ],
  },
};
