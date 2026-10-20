// The layers in spec §5 point inward. This test reads every source file's
// imports and fails when one crosses a layer the wrong way.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(import.meta.dirname, '../src');

type Layer = 'core' | 'platform' | 'ui' | 'app';

/** The layers each layer may import from, besides itself. */
const MAY_IMPORT: Record<Layer, Layer[]> = {
  core: [],
  platform: ['core'],
  ui: ['core', 'platform'],
  app: ['core', 'platform'],
};

/** Packages only the Electron app may use; the window and core never touch the system. */
const SYSTEM_PACKAGE = /^(node:|electron($|\/))/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.ts$/.test(entry.name) && !/\.test\.ts$/.test(entry.name) ? [path] : [];
  });
}

function layerOf(file: string): Layer {
  return relative(SRC, file).split(sep)[0] as Layer;
}

/** Every module specifier in `import … from '…'`, `export … from '…'` and `import('…')`. */
function importsOf(source: string): string[] {
  const specifiers = source.matchAll(
    /(?:^|[\s;])(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s*['"]([^'"]+)['"]/gm,
  );
  return [...specifiers].map((m) => m[1] ?? m[2] ?? m[3] ?? '');
}

function problemsIn(file: string): string[] {
  const from = layerOf(file);
  const inPlatformInterface = from === 'platform' && dirname(file) === join(SRC, 'platform');
  return importsOf(readFileSync(file, 'utf8')).flatMap((specifier) => {
    const where = `${relative(SRC, file)} imports '${specifier}'`;
    if (!specifier.startsWith('.')) {
      const systemAllowed = from === 'app' || (from === 'platform' && !inPlatformInterface);
      return SYSTEM_PACKAGE.test(specifier) && !systemAllowed ? [where] : [];
    }
    const target = resolve(dirname(file), specifier);
    if (!target.startsWith(SRC + sep)) return [`${where}, outside src`];
    const to = layerOf(target);
    return to === from || MAY_IMPORT[from].includes(to) ? [] : [where];
  });
}

describe('layers', () => {
  it('every file is in a known layer', () => {
    const unknown = sourceFiles(SRC).filter((f) => !(layerOf(f) in MAY_IMPORT));
    expect(unknown.map((f) => relative(SRC, f))).toEqual([]);
  });

  it('imports point inward: ui and app → platform → core', () => {
    expect(sourceFiles(SRC).flatMap(problemsIn)).toEqual([]);
  });
});

describe('importsOf', () => {
  it('finds every form of import', () => {
    const source = [
      "import a from './a';",
      "import { b } from '../b';",
      "import type { C } from './c';",
      "export { d } from './d';",
      "export * from './e';",
      "import './f.css';",
      "const g = await import('./g');",
      "import {\n  h,\n  i,\n} from 'node:fs';",
    ].join('\n');
    expect(importsOf(source)).toEqual([
      './a',
      '../b',
      './c',
      './d',
      './e',
      './f.css',
      './g',
      'node:fs',
    ]);
  });

  it('ignores words that only look like imports', () => {
    expect(importsOf("const text = 'we import from abroad';")).toEqual([]);
  });
});
