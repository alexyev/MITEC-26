import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COLOR_TOKENS } from '../src/ui/kit/tokens';

// T2.1 acceptance: no hex color or font size outside src/ui/tokens.css, and every story color is a token.
const SRC = join(__dirname, '..', 'src');
const TOKENS = join(SRC, 'ui', 'tokens.css');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

const SOURCES = files(SRC).filter((f) => /\.(ts|tsx|css)$/.test(f) && f !== TOKENS);

describe('design tokens', () => {
  it('keeps hex colors in tokens.css only', () => {
    const bad = SOURCES.flatMap((f) =>
      (readFileSync(f, 'utf8').match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).map(
        (m) => `${relative(SRC, f)}: ${m}`,
      ),
    );
    expect(bad).toEqual([]);
  });

  it('keeps rgb() and hsl() colors in tokens.css only', () => {
    const bad = SOURCES.filter((f) => /\b(rgba?|hsla?)\(/.test(readFileSync(f, 'utf8')));
    expect(bad.map((f) => relative(SRC, f))).toEqual([]);
  });

  it('keeps font sizes in tokens.css only', () => {
    const bad = SOURCES.flatMap((f) => {
      const src = readFileSync(f, 'utf8');
      const css = src.match(/font-size:\s*(?!\s|var\()[^;]+/g) ?? [];
      const canvas = src.match(/\.font\s*=\s*['"`][^'"`]*\d+px/g) ?? [];
      const inline = src.match(/fontSize:\s*\d/g) ?? [];
      return [...css, ...canvas, ...inline].map((m) => `${relative(SRC, f)}: ${m}`);
    });
    expect(bad).toEqual([]);
  });

  it('defines every story color and type size of spec 5.2 and 6.4', () => {
    const css = readFileSync(TOKENS, 'utf8');
    for (const t of COLOR_TOKENS) expect(css).toMatch(new RegExp(`--c-${t}:\\s*#`));
    for (const s of [11, 12, 13, 14, 16, 20]) expect(css).toContain(`--fs-${s}: ${s}px;`);
  });
});
