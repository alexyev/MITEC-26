// The desert backdrop's worker (D101): generates the terrain layers off the main thread, the macro layer
// first so the ground shows within a moment, and hands each one over without a copy.
import { terrainLayer, type TerrainLayerName, type TerrainPalette } from './terrain';

interface WorkerScope {
  onmessage: ((e: MessageEvent<TerrainPalette>) => void) | null;
  postMessage(message: unknown, transfer: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;
const ORDER: TerrainLayerName[] = ['macro', 'detail', 'scrub'];

scope.onmessage = (e) => {
  for (const name of ORDER) {
    const layer = terrainLayer(name, e.data);
    scope.postMessage(
      { name, layer },
      layer.levels.map((level) => level.buffer),
    );
  }
};
