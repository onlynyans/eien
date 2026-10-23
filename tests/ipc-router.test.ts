// The main process answers many windows through one router (src/app/electron/ipc.ts):
// each channel listened to once, each call routed to the window that sent it. A
// handler registered anywhere else would be the one-window kind again: a second
// window throws "second handler", and closing either window silences both.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ELECTRON = resolve(import.meta.dirname, '../src/app/electron');

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.ts$/.test(entry.name) && !/\.test\.ts$/.test(entry.name) ? [path] : [];
  });
}

describe('the main process’s answers (New Window)', () => {
  it('are registered only by the router, so every window has its own', () => {
    const elsewhere = sources(ELECTRON)
      .filter((path) => !path.endsWith(`${'/'}ipc.ts`))
      .filter((path) => /ipcMain\s*\.\s*(handle|handleOnce)\s*\(/.test(readFileSync(path, 'utf8')))
      .map((path) => relative(ELECTRON, path));
    expect(elsewhere).toEqual([]);
  });
});
