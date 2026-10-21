// A vault on the phone (spec §10): the Storage contract (../storage.ts) over
// a plain file system (./files.ts) — Capacitor's on the phone. Writes go
// through a hidden temp file and are checked again just before they take
// the file's place; moves refuse what the desktop's refuse. A phone has no
// trash for files, so the trash is .eien/trash in the vault (decided
// 2026-10-20): the words come back from any device, as a system trash
// keeps them, a folder for each moment. Moves, trash and renames back never
// replace what arrived meanwhile (renameNew). There's no watcher either: the
// vault is looked at every few seconds, and at once on lookNow (./poller.ts).

import { isHiddenName, nameKey, vaultPath } from '../../core/paths';
import { kindOf, type VaultEntry } from '../../core/vault';
import {
  type FileState,
  MAX_BYTES_READ,
  type MoveResult,
  type Storage,
  type WriteResult,
} from '../storage';
import { CASE_STEP, hiddenBeside, NEW_SUFFIX, TEMP_SUFFIX, TRASH_STEP } from '../stray';
import { type FilesPort, folderOf, nameOf, TakenError } from './files';
import { Poller } from './poller';

/** Where trashed files go: in the vault, hidden, a folder for each moment something was trashed. */
export const TRASH_FOLDER = '.eien/trash';

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

/** The hidden file beside `path` named for `suffix` (a write's temp file, a rename's step). */
const besidePath = (path: string, suffix: string): string => {
  const folder = folderOf(path);
  const name = hiddenBeside(nameOf(path), suffix);
  return folder ? `${folder}/${name}` : name;
};

const addressable = (path: string): boolean => {
  try {
    vaultPath(path);
    return true;
  } catch {
    return false; // a name Eien can't address on every system: left alone, not listed
  }
};

const joined = (folder: string, name: string) => (folder ? `${folder}/${name}` : name);

/** A trash folder's name for the moment `ms`: "2026-10-20T22-40-00-123Z". */
const stampOf = (ms: number) => new Date(ms).toISOString().replace(/[:.]/gu, '-');

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
      await this.#files.makeFolder(folderOf(at));
      const temp = besidePath(at, TEMP_SUFFIX);
      await this.#files.writeText(temp, text);
      const now = await this.read(at);
      if ((now?.version ?? null) !== expected) {
        await this.#files.remove(temp).catch(() => undefined);
        return { ok: false, current: now };
      }
      try {
        await this.#files.rename(temp, at);
      } catch (error) {
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

  /** Through a hidden temp file, given the name by renameNew, which refuses a name that's taken. */
  async writeNew(path: string, bytes: Uint8Array): Promise<boolean> {
    const at = vaultPath(path);
    return this.#oneAtATime(nameKey(at), async () => {
      if (await this.#files.stat(at)) return false;
      await this.#files.makeFolder(folderOf(at));
      const temp = besidePath(at, NEW_SUFFIX);
      await this.#files.writeBytes(temp, bytes);
      try {
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
    await this.#oneAtATime(nameKey(at), async () => {
      // What holds the trash (.eien, a file of that name, the trash itself) steps aside first.
      const holds = `${TRASH_FOLDER}/`.startsWith(`${at}/`);
      const from = holds ? besidePath(at, TRASH_STEP) : at;
      if (holds) await this.#files.renameNew(at, from);
      try {
        const stamp = stampOf(this.#now());
        for (let n = 1; ; n++) {
          // The same name trashed in the same moment takes the next folder.
          const into = `${TRASH_FOLDER}/${n === 1 ? stamp : `${stamp}-${n}`}/${nameOf(at)}`;
          if (await this.#files.stat(into)) continue;
          await this.#files.makeFolder(folderOf(into));
          try {
            await this.#files.renameNew(from, into);
            return;
          } catch (error) {
            if (!(error instanceof TakenError)) throw error;
          }
        }
      } catch (error) {
        if (holds) await this.#files.renameNew(from, at).catch(() => undefined); // back where it was
        throw error;
      }
    });
  }

  async makeFolder(path: string): Promise<void> {
    const at = vaultPath(path);
    if ((await this.#files.stat(at))?.type === 'file')
      throw new Error(`A file is in the way: ${path}`);
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
