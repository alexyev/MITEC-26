// Radio presets (spec section 4.1). All values are PLACEHOLDERS that the team will verify.
// Prices are not here: they live in pricing.json (spec section 5).
import type { PresetId } from '../engine/types';

export interface RadioPreset {
  id: PresetId;
  label: string;
  /** Along-lane range in meters when the preset is selected. */
  defaultRangeM: number;
  /** Slider limits in meters. */
  minRangeM: number;
  maxRangeM: number;
  /** Data rate per link in bits per second. */
  dataRateBps: number;
  /** Radio power in watts at the default range. */
  powerW: number;
  /** Latency added by one hop in seconds (spec 6.3). */
  perHopLatencyS: number;
  notes: string;
}

export const PRESET_ORDER: PresetId[] = ['ble', 'lora', 'halow', 'mesh5'];

export const PRESETS: Record<PresetId, RadioPreset> = {
  ble: {
    id: 'ble',
    label: 'BLE (long range)',
    defaultRangeM: 80,
    minRangeM: 30,
    maxRangeM: 200,
    dataRateBps: 125_000,
    powerW: 0.3,
    perHopLatencyS: 0.01,
    notes: 'Short, cheap',
  },
  lora: {
    id: 'lora',
    label: 'LoRa',
    defaultRangeM: 1500,
    minRangeM: 500,
    maxRangeM: 4000,
    dataRateBps: 5_000,
    powerW: 0.5,
    perHopLatencyS: 0.3,
    notes: 'Long, very low capacity',
  },
  halow: {
    id: 'halow',
    label: 'Wi-Fi HaLow',
    defaultRangeM: 500,
    minRangeM: 150,
    maxRangeM: 1500,
    dataRateBps: 2_000_000,
    powerW: 2,
    perHopLatencyS: 0.01,
    notes: 'Medium',
  },
  mesh5: {
    id: 'mesh5',
    label: '5 GHz mesh',
    defaultRangeM: 300,
    minRangeM: 100,
    maxRangeM: 800,
    dataRateBps: 50_000_000,
    powerW: 8,
    perHopLatencyS: 0.01,
    notes: 'High capacity',
  },
};

/** Global range slider limits (log scale), spec section 4.2. */
export const RANGE_SLIDER = { minM: 30, maxM: 4000, scale: 'log' } as const;
