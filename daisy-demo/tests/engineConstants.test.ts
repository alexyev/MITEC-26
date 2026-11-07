import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// T0.2 acceptance: no numeric constants in src/engine/ except 0, 1, 2 and math constants.
const ENGINE_DIR = join(__dirname, '..', 'src', 'engine');
const ALLOWED = new Set(['0', '1', '2']);

function stripCommentsAndStrings(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""');
}

describe('engine numeric constants', () => {
  for (const file of readdirSync(ENGINE_DIR).filter((f) => f.endsWith('.ts'))) {
    it(`${file} has only 0, 1 and 2 as numeric literals and a 2-line header comment`, () => {
      const raw = readFileSync(join(ENGINE_DIR, file), 'utf8');
      const lines = raw.split('\n');
      expect(lines[0].startsWith('//')).toBe(true);
      expect(lines[1].startsWith('//')).toBe(true);
      expect(lines[2].startsWith('//')).toBe(false);
      const code = stripCommentsAndStrings(raw);
      const literals = code.match(/(?<![\w.])\d[\w.]*/g) ?? [];
      const bad = literals.filter((l) => !ALLOWED.has(l));
      expect(bad).toEqual([]);
    });
  }
});
