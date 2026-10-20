// A model-based test of the Storage contract: random runs of writes, at the
// version each file is at and at wrong ones, against the test double and the
// disk. They must give the same answer to every step and leave the same vault.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { openDiskStorage } from './electron/disk-storage';
import { MemoryStorage } from './memory/memory-storage';
import type { Storage } from './storage';

// No two names the same but for case or accents: whether "a.md" and "A.md" are
// one file is the disk's own choice (macOS and Windows: yes; Linux: no), which
// the test double can't make for every system at once.
const NAME = fc.constantFrom('a.md', 'B.md', 'Café.md', '永遠.md', 'Fic', 'x', '.eien', 'nul');
const PATH = fc.array(NAME, { minLength: 1, maxLength: 3 }).map((parts) => parts.join('/'));
/** Texts as notes hold them: empty, CRLF, a byte-order mark, letters of more than one byte. */
const TEXT = fc.constantFrom('', 'One.', 'Two.\r\nLines.\r\n', '\uFEFFÉté', '永遠 🧣\n');

/** Which version a write expects: the file's own, none, one it was at before, or nonsense. */
type Expect = 'current' | 'none' | 'earlier' | 'wrong';

type Step =
  | {
      readonly kind: 'write';
      readonly path: string;
      readonly text: string;
      readonly expect: Expect;
    }
  | { readonly kind: 'read'; readonly path: string };

const STEP: fc.Arbitrary<Step> = fc.oneof(
  {
    weight: 4,
    arbitrary: fc.record({
      kind: fc.constant('write' as const),
      path: PATH,
      text: TEXT,
      expect: fc.constantFrom<Expect>('current', 'current', 'none', 'earlier', 'wrong'),
    }),
  },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('read' as const), path: PATH }) },
);

/** One storage under test, and the versions its files have been at. */
class Subject {
  readonly #earlier = new Map<string, string>();
  constructor(readonly storage: Storage) {}

  /** What a step did, in terms both storages share (versions are each one's own). */
  async run(step: Step): Promise<unknown> {
    try {
      if (step.kind === 'read') return (await this.storage.read(step.path))?.text ?? null;
      const expected = await this.#expected(step.path, step.expect);
      const before = await this.storage.read(step.path).catch(() => null);
      const result = await this.storage.write(step.path, step.text, expected);
      if (!result.ok) return { written: false, current: result.current?.text ?? null };
      if (before) this.#earlier.set(step.path, before.version);
      return { written: true };
    } catch {
      return 'threw';
    }
  }

  async #expected(path: string, expect: Expect): Promise<string | null> {
    if (expect === 'none') return null;
    if (expect === 'wrong') return 'not-a-version';
    if (expect === 'earlier') return this.#earlier.get(path) ?? 'not-a-version';
    return (await this.storage.read(path))?.version ?? null;
  }

  /** Every entry, with each file's text: what a writer would find in the vault. */
  async vault(): Promise<string[]> {
    const entries = await this.storage.list();
    const shown = await Promise.all(
      entries.map(async ({ path, kind, size }) =>
        kind === 'folder'
          ? `${kind} ${path}`
          : `${kind} ${path} ${size} ${JSON.stringify((await this.storage.read(path))?.text)}`,
      ),
    );
    return shown.sort();
  }
}

describe('Storage, memory and disk, over random runs', () => {
  it('give the same answer to every step and leave the same vault', async () => {
    const { numRuns } = fc.readConfigureGlobal();
    await fc.assert(
      fc.asyncProperty(
        fc.array(STEP, { minLength: 1, maxLength: 30, size: 'max' }),
        async (steps) => {
          const root = await mkdtemp(join(tmpdir(), 'eien-model-'));
          try {
            const memory = new Subject(new MemoryStorage());
            const disk = new Subject(await openDiskStorage(root));
            for (const [i, step] of steps.entries()) {
              const [inMemory, onDisk] = [await memory.run(step), await disk.run(step)];
              expect({ step: i, ...step, result: onDisk }).toEqual({
                step: i,
                ...step,
                result: inMemory,
              });
            }
            expect(await disk.vault()).toEqual(await memory.vault());
          } finally {
            await rm(root, { recursive: true, force: true });
          }
        },
      ),
      // Each run is a vault on disk: a quarter as many as the pure properties.
      { numRuns: Math.max(10, Math.round((numRuns ?? 100) / 4)) },
    );
  });
});
