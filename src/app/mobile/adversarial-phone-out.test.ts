// Adversarial: the phone's exports into Eien/Exports (spec §8), "under a
// free name, never over a file there", when two are saved at once under one
// name (two books' "Chapter 1", or a second tap). Fails on the code as it
// stands. Node's files stand in for Capacitor's, as the storage tests do.

import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NodeFiles } from '../../platform/capacitor/node-files';
import { phoneOut } from './phone-out';

let folder: string;
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'eien-exports-'));
});
afterEach(async () => {
  await rm(folder, { recursive: true, force: true });
});

const bytes = (text: string) => new TextEncoder().encode(text);

describe('phoneOut', () => {
  it('saves two exports of one name made at once, each under its own name with its own bytes', async () => {
    const out = phoneOut(new NodeFiles(folder), 'Eien/Exports');
    const results = await Promise.allSettled([
      out.saveAs('Chapter 1', { kind: 'epub', bytes: bytes('first book') }),
      out.saveAs('Chapter 1', { kind: 'epub', bytes: bytes('second book') }),
    ]);
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'fulfilled']);
    const names = (await readdir(folder)).filter((name) => !name.startsWith('.')).sort();
    expect(names).toEqual(['Chapter 1 2.epub', 'Chapter 1.epub']);
    const held = await Promise.all(names.map((name) => readFile(join(folder, name), 'utf8')));
    expect(held.sort()).toEqual(['first book', 'second book']);
  });
});
