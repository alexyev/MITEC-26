import { join } from 'node:path';
import { build, type Rollup } from 'vite';
import { beforeAll, describe, expect, it } from 'vitest';

// D120: three.js and the 3D scene load only when the viewer first asks for the 3D view, so the first page
// load is unchanged. A production build in memory: the entry and everything it imports statically hold no
// three.js; the 3D view's chunk holds it and is reached only through a dynamic import.

const ROOT = join(__dirname, '..');
type Chunk = Rollup.OutputChunk;

let chunks: Chunk[] = [];

beforeAll(async () => {
  const out = await build({
    root: ROOT,
    configFile: join(ROOT, 'vite.config.ts'),
    logLevel: 'silent',
    build: { write: false },
  });
  const outputs = (Array.isArray(out) ? out : [out]) as Rollup.RollupOutput[];
  chunks = outputs.flatMap((o) => o.output.filter((c): c is Chunk => c.type === 'chunk'));
}, 60_000);

const isThree = (id: string) => /node_modules\/three\//.test(id);
const is3dScene = (id: string) =>
  /src\/ui\/scene3d\/(SiteView3D|view|world|geometry|textures)\./.test(id);

/** The chunk and every chunk it imports statically, transitively. */
function staticClosure(start: Chunk): Chunk[] {
  const byName = new Map(chunks.map((c) => [c.fileName, c]));
  const seen = new Set<Chunk>([start]);
  const queue = [start];
  while (queue.length) {
    for (const name of queue.shift()!.imports) {
      const c = byName.get(name);
      if (c && !seen.has(c)) {
        seen.add(c);
        queue.push(c);
      }
    }
  }
  return [...seen];
}

describe('the 3D view is a lazy chunk (D120)', () => {
  it('keeps three.js and the scene out of the main bundle', () => {
    const entry = chunks.find((c) => c.isEntry);
    expect(entry).toBeTruthy();
    const main = staticClosure(entry!);
    const ids = main.flatMap((c) => c.moduleIds);
    expect(ids.filter(isThree)).toEqual([]);
    expect(ids.filter(is3dScene)).toEqual([]);
    // The pin and the loader are in the main bundle; they are what fetches the rest.
    expect(ids.some((id) => id.endsWith('src/ui/scene3d/TakeMeTherePin.tsx'))).toBe(true);
    expect(ids.some((id) => id.endsWith('src/ui/scene3d/useCornerView.ts'))).toBe(true);
  });

  it('puts three.js and the scene in a chunk the entry only imports dynamically', () => {
    const entry = chunks.find((c) => c.isEntry)!;
    const lazy = chunks.filter((c) => c.moduleIds.some(isThree));
    expect(lazy.length).toBeGreaterThan(0);
    for (const c of lazy) {
      expect(c.isEntry).toBe(false);
      expect(entry.imports).not.toContain(c.fileName);
    }
    const view = chunks.find((c) =>
      c.moduleIds.some((id) => id.endsWith('src/ui/scene3d/SiteView3D.tsx')),
    );
    expect(view?.isDynamicEntry).toBe(true);
    expect(entry.dynamicImports).toContain(view!.fileName);
  });
});
