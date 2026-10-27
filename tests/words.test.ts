// Each feature has one word (AGENTS.md → Words), so no one reading the code
// takes the browser extension for the EPUB reader. "reader" is a person
// reading: no folder or file under src/ or tests/ is named for it, and no
// stylesheet defines a .reader class. The browser extension is "extension",
// the EPUB reader "epub".

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '..');
const WORDS =
  'AGENTS.md → Words: "reader" is only a person reading; the browser extension is "extension", the EPUB reader "epub"';

/** Paths (from the repository's root) that may still be named "reader", each with its reason. None yet. */
const ALLOWED: readonly string[] = [];

/** Every folder and file under `dir`, as paths from the repository's root. */
function pathsUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    const here = relative(ROOT, path);
    return entry.isDirectory() ? [`${here}/`, ...pathsUnder(path)] : [here];
  });
}

const paths = ['src', 'tests'].flatMap((dir) => pathsUnder(join(ROOT, dir)));

/** Whether `path` is a folder called reader, or a file whose name starts with it. */
const namedReader = (path: string) => {
  const name = path.replace(/\/$/u, '').split('/').at(-1) ?? '';
  return path.endsWith('/') ? name.toLowerCase() === 'reader' : /^reader/iu.test(name);
};

/** The selectors `css` defines a .reader class in, comments left out. */
function readerSelectors(css: string): string[] {
  const bare = css.replace(/\/\*[\s\S]*?\*\//gu, '');
  return [...bare.matchAll(/([^{}]+)\{/gu)]
    .map((match) => (match[1] as string).trim())
    .filter((prelude) => /\.reader/iu.test(prelude));
}

describe('one word for each feature', () => {
  it('names no folder or file under src/ or tests/ "reader"', () => {
    const named = paths.filter((path) => namedReader(path) && !ALLOWED.includes(path));
    expect(named, WORDS).toEqual([]);
  });

  it('defines no .reader class in a stylesheet under src/', () => {
    const defined = paths
      .filter((path) => path.startsWith('src/') && path.endsWith('.css'))
      .filter((path) => !ALLOWED.includes(path))
      .flatMap((path) =>
        readerSelectors(readFileSync(join(ROOT, path), 'utf8')).map((s) => `${path}: ${s}`),
      );
    expect(defined, WORDS).toEqual([]);
  });

  it('finds what it guards', () => {
    expect(paths).toContain('src/ui/extension/');
    expect(namedReader('src/ui/reader/')).toBe(true);
    expect(namedReader('src/ui/extension/reader-view.ts')).toBe(true);
    expect(namedReader('src/ui/extension/story-view.ts')).toBe(false);
    expect(readerSelectors('/* .reader */ .story { } .reader__bar, .x { }')).toEqual([
      '.reader__bar, .x',
    ]);
  });
});
