// A model-based test of the Storage contract: random runs of writes (at the
// version each file is at, and at wrong ones), moves, trashing and new
// folders, against the test double and the disk. They must give the same
// answer to every step, send the same things to the trash, and leave the
// same vault.

import { mkdtemp, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CapacitorStorage } from './capacitor/capacitor-storage';
import { NodeFiles } from './capacitor/node-files';
import { openDiskStorage } from './electron/disk-storage';
import { MemoryStorage } from './memory/memory-storage';
import type { Storage } from './storage';

// No two names the same but for case or accents: whether "a.md" and "A.md" are
// one file is the disk's own choice (macOS and Windows: yes; Linux: no), which
// the test double can't make for every system at once.
const NAME = fc.constantFrom('a.md', 'B.md', 'Café.md', '永遠.md', 'Fic', 'x', '.eien', 'nul');
/** Mostly a few paths, so steps meet what earlier ones made: in the vault, in "Fic", deeper. */
const PATH = fc.oneof(
  { weight: 3, arbitrary: NAME },
  { weight: 3, arbitrary: NAME.map((name) => `Fic/${name}`) },
  { weight: 1, arbitrary: fc.tuple(NAME, NAME, NAME).map((parts) => parts.join('/')) },
);
/** Texts as notes hold them: empty, CRLF, a byte-order mark, letters of more than one byte. */
const TEXT = fc.constantFrom('', 'One.', 'Two.\r\nLines.\r\n', '\uFEFFÉté', '永遠 🧣\n');

/**
 * Where a step acts: any path, or the n-th of the entries listed just then
 * (the same one in both storages), so moves and trashing meet what's there.
 */
type Target = string | number;
const TARGET: fc.Arbitrary<Target> = fc.oneof({ weight: 2, arbitrary: fc.nat() }, PATH);

/** Which version a write expects: the file's own, none, one it was at before, or nonsense. */
type Expect = 'current' | 'none' | 'earlier' | 'wrong';

type Step<At = Target> =
  | { readonly kind: 'write'; readonly path: At; readonly text: string; readonly expect: Expect }
  | { readonly kind: 'move'; readonly path: At; readonly to: At }
  | { readonly kind: 'read' | 'trash' | 'makeFolder'; readonly path: At };

const STEP: fc.Arbitrary<Step> = fc.oneof(
  {
    weight: 4,
    arbitrary: fc.record({
      kind: fc.constant('write' as const),
      path: TARGET,
      text: TEXT,
      expect: fc.constantFrom<Expect>('current', 'current', 'none', 'earlier', 'wrong'),
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({
      kind: fc.constant('move' as const),
      path: TARGET,
      to: fc.oneof({ weight: 3, arbitrary: PATH }, TARGET),
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({
      kind: fc.constantFrom('read' as const, 'trash' as const),
      path: TARGET,
    }),
  },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('makeFolder' as const), path: PATH }) },
);

/** `step` with its targets as paths, picked from what `storage` lists now. */
async function resolved(step: Step, storage: Storage): Promise<Step<string>> {
  const listed = (await storage.list()).map((entry) => entry.path).sort();
  const at = (target: Target) =>
    typeof target === 'string' ? target : (listed[target % listed.length] ?? 'a.md');
  return step.kind === 'move'
    ? { ...step, path: at(step.path), to: at(step.to) }
    : { ...step, path: at(step.path) };
}

/** One storage under test, what it sent to the trash, and the versions its files have been at. */
class Subject {
  readonly #earlier = new Map<string, string>();
  constructor(
    readonly storage: Storage,
    readonly trashed: () => readonly string[],
  ) {}

  /** What a step did, in terms both storages share (versions are each one's own). */
  async run(step: Step<string>): Promise<unknown> {
    try {
      switch (step.kind) {
        case 'read':
          return (await this.storage.read(step.path))?.text ?? null;
        case 'move':
          return await this.storage.move(step.path, step.to);
        case 'trash':
          return await this.storage.trash(step.path).then(() => 'trashed');
        case 'makeFolder':
          return await this.storage.makeFolder(step.path).then(() => 'made');
        case 'write':
          return await this.#write(step.path, step.text, step.expect);
      }
    } catch {
      return 'threw';
    }
  }

  async #write(path: string, text: string, expect: Expect): Promise<unknown> {
    const expected = await this.#expected(path, expect);
    const before = await this.storage.read(path).catch(() => null);
    const result = await this.storage.write(path, text, expected);
    if (!result.ok) return { written: false, current: result.current?.text ?? null };
    if (before) this.#earlier.set(path, before.version);
    return { written: true };
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

/**
 * The three storages: the disk's in a temp folder with its system trash
 * played by another, and the phone's over Node's fs in a third.
 */
async function subjects(): Promise<{
  memory: Subject;
  disk: Subject;
  phone: Subject;
  cleanup(): Promise<void>;
}> {
  const root = await mkdtemp(join(tmpdir(), 'eien-model-'));
  const phoneRoot = await mkdtemp(join(tmpdir(), 'eien-model-phone-'));
  const onPhone = new CapacitorStorage(new NodeFiles(phoneRoot));
  const trashedOnPhone: string[] = [];
  const trashOnPhone = onPhone.trash.bind(onPhone);
  onPhone.trash = async (path) => {
    await trashOnPhone(path);
    trashedOnPhone.push(path); // in .eien/trash, hidden: the vault no longer shows it
  };
  const trash = await mkdtemp(join(tmpdir(), 'eien-model-trash-'));
  const trashedOnDisk: string[] = [];
  const onDisk = await openDiskStorage(root, async (file) => {
    // Numbered, so two things trashed under one name don't meet in the trash.
    await rename(file, join(trash, String(trashedOnDisk.length)));
    trashedOnDisk.push(relative(onDisk.root, file).split(sep).join('/'));
  });
  const inMemory = new MemoryStorage();
  return {
    memory: new Subject(inMemory, () => inMemory.trashed),
    disk: new Subject(onDisk, () => trashedOnDisk),
    phone: new Subject(onPhone, () => trashedOnPhone),
    cleanup: async () => {
      await rm(root, { recursive: true, force: true });
      await rm(trash, { recursive: true, force: true });
      await rm(phoneRoot, { recursive: true, force: true });
    },
  };
}

/** Whether a step writes, moves, trashes or makes the vault's own .eien, or something in it. */
const touchesOwnFolder = (step: object): boolean =>
  Object.values(step).some((value) => typeof value === 'string' && /^\.eien(?:\/|$)/u.test(value));

// Each run is a vault on disk: a quarter as many runs as the pure properties, with
// time for a slow disk (Windows takes over 0.2 s a run).
const RUNS = Math.max(10, Math.round((fc.readConfigureGlobal().numRuns ?? 100) / 4));

describe('Storage, memory, disk and phone, over random runs', () => {
  it('give the same answer to every step and leave the same vault', {
    timeout: RUNS * 2000,
  }, async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(STEP, { minLength: 1, maxLength: 30, size: 'max' }),
        async (steps) => {
          const { memory, disk, phone, cleanup } = await subjects();
          // The phone's trash lives in .eien: a run that writes or moves .eien itself (Eien never
          // does) leaves it nowhere, so from that step on the phone is left out of the comparison.
          let phoneToo = true;
          try {
            for (const [i, generated] of steps.entries()) {
              const step = await resolved(generated, memory.storage);
              if (touchesOwnFolder(step)) phoneToo = false;
              const inMemory = await memory.run(step);
              for (const other of phoneToo ? [disk, phone] : [disk]) {
                expect({ step: i, ...step, result: await other.run(step) }).toEqual({
                  step: i,
                  ...step,
                  result: inMemory,
                });
              }
            }
            for (const other of phoneToo ? [disk, phone] : [disk]) {
              expect(await other.vault()).toEqual(await memory.vault());
              expect(other.trashed()).toEqual(memory.trashed());
            }
          } finally {
            await cleanup();
          }
        },
      ),
      { numRuns: RUNS },
    );
  });
});
