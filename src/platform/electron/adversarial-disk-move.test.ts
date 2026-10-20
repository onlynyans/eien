// Adversarial: DiskStorage.move checks that nothing is at `to`, then renames
// onto it. A file another program (a sync tool) puts at `to` in between is
// replaced, its words gone and not in the trash. writeDurably checks again
// just before its rename for exactly this reason; move doesn't. The moment
// in between is played by a hook on the mkdir that move makes there.

import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type DiskStorage, openDiskStorage } from './disk-storage';

const between = vi.hoisted(() => ({ run: null as null | (() => Promise<void>) }));

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    // Another program acts once, just as the next mkdir starts.
    mkdir: async (...args: Parameters<typeof actual.mkdir>) => {
      const run = between.run;
      between.run = null;
      if (run) await run();
      return actual.mkdir(...args);
    },
  };
});

describe('DiskStorage.move, adversarial', () => {
  let root: string;
  let storage: DiskStorage;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'eien-adv-move-'));
    storage = await openDiskStorage(root);
  });
  afterEach(async () => {
    between.run = null;
    await rm(root, { recursive: true, force: true });
  });

  it('never replaces a file that appears at the new name while the move is under way', async () => {
    await writeFile(join(root, 'Draft.md'), 'mine');
    // Syncthing brings the other device's "Chapter.md" in just after the check.
    between.run = () => writeFile(join(root, 'Chapter.md'), 'theirs: a whole chapter');
    const result = await storage.move('Draft.md', 'Chapter.md');
    const texts = await Promise.all(
      (await readdir(root)).map((name) => readFile(join(root, name), 'utf8')),
    );
    // Either the move is refused, or both texts are still in the vault.
    expect(texts).toContain('theirs: a whole chapter');
    expect(texts).toContain('mine');
    expect(result.ok ? 'moved' : result.reason).toBe('taken');
  });
});
