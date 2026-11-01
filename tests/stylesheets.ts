// The window's stylesheets, found for the architecture tests that hold
// every one of them to a rule.

import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** The sources: what `stylesheets` looks under, and what a test names a file from. */
export const SRC = resolve(import.meta.dirname, '../src');

/** Every stylesheet under `dir`, at any depth. */
export function stylesheets(dir = SRC): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return stylesheets(path);
    return entry.name.endsWith('.css') ? [path] : [];
  });
}
