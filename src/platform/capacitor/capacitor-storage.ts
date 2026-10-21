// A vault on the phone (spec §10): the Storage contract (../storage.ts) over
// a plain file system (./files.ts) — Capacitor's on the phone. Writes go
// through a hidden temp file and are checked again just before they take
// the file's place (on iOS inside a write coordinated with other apps);
// moves refuse what the desktop's refuse. A phone has no
// trash for files, so the trash is .eien/trash in the vault (decided
// 2026-10-20): the words come back from any device, as a system trash
// keeps them, a folder for each moment. Moves, trash and renames back never
// replace what arrived meanwhile (renameNew). There's no watcher either: the
// vault is looked at every few seconds, and at once on lookNow (./poller.ts).

import { isHiddenName, nameKey, vaultPath } from '../../core/paths';
import { kindOf, type VaultEntry } from '../../core/vault';
import { type CaseLook, caseTwin, twinError } from '../case-twin';
import {
  type FileState,
  MAX_BYTES_READ,
  type MoveResult,
  type Storage,
  type WriteResult,
} from '../storage';
import { CASE_STEP, NEW_SUFFIX, tempBeside } from '../stray';
import { besidePath, ChangedError, type FilesPort, folderOf, nameOf, TakenError } from './files';
import { TRASH_FOLDER, trashInto } from './phone-trash';
import { Poller } from './poller';

export { TRASH_FOLDER };

/** How many tokens a write tries for its temp file: another one only if it was taken. */
const TEMP_TRIES = 5;

export interface CapacitorStorageOptions {
  /** How often the vault is looked at for changes, in milliseconds. */
  readonly pollMs?: number;
  /** Whether to look now: false while the app is in the background. */
  readonly active?: () => boolean;
  /** The time now, in milliseconds (a test's own clock). */
  readonly now?: () => number;
}

/** Content hash (SHA-256, hex), as the desktop's: equal exactly when the text is. */
async function versionOf(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

const addressable = (path: string): boolean => {
  try {
    vaultPath(path);
    return true;
  } catch {
    return false; // a name Eien can't address on every system: left alone, not listed
  }
};

const joined = (folder: string, name: string) => (folder ? `${folder}/${name}` : name);

export class CapacitorStorage implements Storage {
  readonly #files: FilesPort;
  readonly #poller: Poller;
  readonly #now: () => number;
  /** The operation under way on each file, by its name key, so the next waits for it. */
  readonly #busy = new Map<string, Promise<void>>();

  constructor(files: FilesPort, options: CapacitorStorageOptions = {}) {
    this.#files = files;
    this.#poller = new Poller(files, options.pollMs ?? 3000, options.active ?? (() => true));
    this.#now = options.now ?? Date.now;
  }

  /** The system's own rule for case: Android's shared storage ignores it, iOS's tells it apart. */
  readonly #look: CaseLook = {
    exists: async (path) => (await this.#files.stat(path)) !== null,
    names: async (folder) => ((await this.#files.list(folder)) ?? []).map((entry) => entry.name),
  };

  async list(): Promise<VaultEntry[]> {
    const entries: VaultEntry[] = [];
    const walk = async (folder: string): Promise<void> => {
      for (const entry of (await this.#files.list(folder)) ?? []) {
        const path = joined(folder, entry.name);
        if (isHiddenName(entry.name) || !addressable(path)) continue;
        if (entry.type === 'directory') {
          entries.push({ path, kind: 'folder', modified: 0, size: 0 });
          await walk(path);
        } else {
          entries.push({
            path,
            kind: kindOf(entry.name, false),
            modified: entry.mtime,
            size: entry.size,
          });
        }
      }
    };
    await walk('');
    return entries;
  }

  async listFiles(folder: string): Promise<string[]> {
    const at = folder === '' ? '' : vaultPath(folder);
    return ((await this.#files.list(at)) ?? [])
      .filter(
        (entry) =>
          entry.type === 'file' && !isHiddenName(entry.name) && addressable(joined(at, entry.name)),
      )
      .map((entry) => entry.name);
  }

  async read(path: string): Promise<FileState | null> {
    const text = await this.#files.readText(vaultPath(path));
    return text === null ? null : { text, version: await versionOf(text) };
  }

  async readBytes(path: string): Promise<Uint8Array | null> {
    const at = vaultPath(path);
    const entry = await this.#files.stat(at);
    if (entry?.type !== 'file' || entry.size > MAX_BYTES_READ) return null;
    return this.#files.readBytes(at);
  }

  /** One at a time per file; the version is checked again just before the text takes its place. */
  async write(path: string, text: string, expected: string | null): Promise<WriteResult> {
    const at = vaultPath(path);
    return this.#oneAtATime(nameKey(at), async () => {
      const current = await this.read(at);
      if ((current?.version ?? null) !== expected) return { ok: false, current };
      const twin = current === null ? await caseTwin(this.#look, at) : null;
      if (twin !== null) return { ok: false, current: await this.read(twin) };
      await this.#files.makeFolder(folderOf(at));
      const temp = await this.#freshTemp(at);
      await this.#files.writeText(temp, text);
      const refused = async (current: FileState | null): Promise<WriteResult> => {
        await this.#files.remove(temp).catch(() => undefined);
        return { ok: false, current };
      };
      const now = await this.read(at);
      if ((now?.version ?? null) !== expected) return refused(now);
      try {
        // On iOS coordinated with apps editing the note in place, and looked at once more.
        if (this.#files.replace) await this.#files.replace(temp, at, expected);
        else await this.#files.rename(temp, at);
      } catch (error) {
        if (error instanceof ChangedError) return refused(await this.read(at));
        // The temp file goes only while the note is there as it was: if the rename took the
        // note with it, the temp holds the only words, recovered when the vault next opens.
        const after = await this.read(at).catch(() => undefined);
        if (after !== undefined && (after?.version ?? null) === expected)
          await this.#files.remove(temp).catch(() => undefined);
        throw error;
      }
      return { ok: true, version: await versionOf(text) };
    });
  }

  /**
   * Through a hidden temp file, given the name by renameNew, which refuses a
   * name that's taken. Its bytes go through the Filesystem plugin, which
   * doesn't flush them: the phone imports nothing (spec §8), so nothing it
   * holds now comes this way.
   */
  async writeNew(path: string, bytes: Uint8Array): Promise<boolean> {
    const at = vaultPath(path);
    return this.#oneAtATime(nameKey(at), async () => {
      if (await this.#files.stat(at)) return false;
      if ((await caseTwin(this.#look, at)) !== null) return false;
      await this.#files.makeFolder(folderOf(at));
      const temp = besidePath(at, NEW_SUFFIX);
      try {
        // Inside the try: a write cut short (the disk full) leaves no temp file behind.
        await this.#files.writeBytes(temp, bytes);
        await this.#files.renameNew(temp, at);
        return true;
      } catch (error) {
        if (error instanceof TakenError) return false;
        throw error;
      } finally {
        await this.#files.remove(temp).catch(() => undefined); // gone already once renamed
      }
    });
  }

  async move(from: string, to: string): Promise<MoveResult> {
    const source = vaultPath(from);
    const target = vaultPath(to);
    return this.#oneAtATime(nameKey(source), async () => {
      if (!(await this.#files.stat(source))) return { ok: false, reason: 'missing' };
      if (nameKey(target).startsWith(`${nameKey(source)}/`))
        return { ok: false, reason: 'into-itself' };
      if (source === target) return { ok: true };
      const caseOnly = nameKey(source) === nameKey(target);
      if (await this.#taken(source, target, caseOnly)) return { ok: false, reason: 'taken' };
      if ((await caseTwin(this.#look, target, source)) !== null)
        return { ok: false, reason: 'taken' };
      await this.#files.makeFolder(folderOf(target));
      try {
        if (caseOnly) await this.#renameCase(source, target);
        else await this.#files.renameNew(source, target); // never over what arrived meanwhile
      } catch (error) {
        if (error instanceof TakenError) return { ok: false, reason: 'taken' };
        throw error;
      }
      return { ok: true };
    });
  }

  /**
   * A temp file name for a write to `at` that nothing has: the write's own token, and
   * another if a file is there (Eien's plugins write over one, as the Filesystem's does).
   */
  async #freshTemp(at: string): Promise<string> {
    for (let tries = 1; ; tries++) {
      const temp = joined(folderOf(at), tempBeside(nameOf(at)));
      if ((await this.#files.stat(temp)) === null) return temp;
      if (tries >= TEMP_TRIES) throw new Error(`No free temp file beside ${at}.`);
    }
  }

  /**
   * Through a name of its own: a file system that ignores case sees one name for both. If the
   * second step fails, the first is undone; a crash between them is undone when the vault
   * next opens (./recover.ts).
   */
  async #renameCase(source: string, target: string): Promise<void> {
    const step = besidePath(source, CASE_STEP);
    await this.#files.renameNew(source, step);
    try {
      await this.#files.renameNew(step, target);
    } catch (error) {
      await this.#files.renameNew(step, source).catch(() => undefined);
      throw error;
    }
  }

  /** Whether something other than `source` is at `target` (for a case-only rename: another file). */
  async #taken(source: string, target: string, caseOnly: boolean): Promise<boolean> {
    if (!caseOnly) return (await this.#files.stat(target)) !== null;
    // Ignoring case, the target is the source; telling case apart, both names may be there.
    const names = ((await this.#files.list(folderOf(target))) ?? []).map((entry) => entry.name);
    return names.includes(nameOf(target)) && names.includes(nameOf(source));
  }

  /** Into a folder of its own in .eien/trash, named for the moment, under its own name. */
  async trash(path: string): Promise<void> {
    const at = vaultPath(path);
    if (!(await this.#files.stat(at))) throw new Error(`Nothing to trash: ${path}`);
    await this.#oneAtATime(nameKey(at), () => trashInto(this.#files, at, this.#now()));
  }

  async makeFolder(path: string): Promise<void> {
    const at = vaultPath(path);
    if ((await this.#files.stat(at))?.type === 'file')
      throw new Error(`A file is in the way: ${path}`);
    const twin = await caseTwin(this.#look, at);
    if (twin !== null) throw twinError(twin);
    await this.#files.makeFolder(at);
  }

  watch(onChange: (paths: string[]) => void, ready?: () => void): () => void {
    return this.#poller.watch(onChange, ready);
  }

  /** Look for changes now: the app is back in front, and another device may have written. */
  lookNow(): void {
    this.#poller.lookNow();
  }

  /** Run `task` after every earlier one for `key` has finished. */
  #oneAtATime<T>(key: string, task: () => Promise<T>): Promise<T> {
    const before = this.#busy.get(key) ?? Promise.resolve();
    const run = before.then(task, task);
    const settled = run.then(
      () => undefined,
      () => undefined,
    );
    this.#busy.set(key, settled);
    void settled.then(() => {
      if (this.#busy.get(key) === settled) this.#busy.delete(key);
    });
    return run;
  }
}
