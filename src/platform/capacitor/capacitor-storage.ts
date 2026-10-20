// A vault on the phone (spec §10): the Storage contract (../storage.ts) over
// a plain file system (./files.ts) — Capacitor's on the phone. Writes go
// through a hidden temp file and are checked again just before they take
// the file's place; moves refuse what the desktop's refuse. A phone has no
// trash for files, so the trash is .eien/trash in the vault (decided
// 2026-10-20): the words come back from any device, as a system trash
// keeps them, a folder for each moment. There's no watcher
// either: the vault is looked at again every few seconds while the app is
// in front, and at once when it comes back (lookNow).

import {
  fitBytes,
  isHiddenName,
  isWatchedPath,
  MAX_NAME_BYTES,
  nameKey,
  utf8Length,
  vaultPath,
} from '../../core/paths';
import { kindOf, type VaultEntry } from '../../core/vault';
import {
  type FileState,
  MAX_BYTES_READ,
  type MoveResult,
  type Storage,
  type WriteResult,
} from '../storage';
import { type FilesPort, folderOf, nameOf } from './files';

/** Where trashed files go: in the vault, hidden, a folder for each moment something was trashed. */
export const TRASH_FOLDER = '.eien/trash';

/** The end of a write's temp file's name, as the desktop's (it recovers one a crash leaves). */
const TEMP_SUFFIX = '.eien.tmp';

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

/** A short hash of a name (FNV-1a), so two long names cut alike never share a temp file. */
function shortHash(text: string): string {
  let hash = 0x811c9dc5;
  for (const char of text) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** The hidden temp file a write to `path` goes through: ".<name>.eien.tmp" beside it. */
function tempOf(path: string): string {
  const name = nameOf(path);
  let temp = `.${name}${TEMP_SUFFIX}`;
  if (utf8Length(temp) > MAX_NAME_BYTES) {
    const hash = shortHash(name);
    temp = `.${fitBytes(name, MAX_NAME_BYTES - utf8Length(TEMP_SUFFIX) - hash.length - 2)}~${hash}${TEMP_SUFFIX}`;
  }
  const folder = folderOf(path);
  return folder ? `${folder}/${temp}` : temp;
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

/** A trash folder's name for the moment `ms`: "2026-10-20T22-40-00-123Z". */
const stampOf = (ms: number) => new Date(ms).toISOString().replace(/[:.]/gu, '-');

export class CapacitorStorage implements Storage {
  readonly #files: FilesPort;
  readonly #pollMs: number;
  readonly #active: () => boolean;
  readonly #now: () => number;
  /** The operation under way on each file, by its name key, so the next waits for it. */
  readonly #busy = new Map<string, Promise<void>>();
  /** Each watcher's look, to be run now (the app back in front). */
  readonly #lookers = new Set<() => void>();

  constructor(files: FilesPort, options: CapacitorStorageOptions = {}) {
    this.#files = files;
    this.#pollMs = options.pollMs ?? 3000;
    this.#active = options.active ?? (() => true);
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
      const temp = tempOf(at);
      await this.#files.writeText(temp, text);
      const now = await this.read(at);
      if ((now?.version ?? null) !== expected) {
        await this.#files.remove(temp).catch(() => undefined);
        return { ok: false, current: now };
      }
      try {
        await this.#files.rename(temp, at);
      } catch (error) {
        await this.#files.remove(temp).catch(() => undefined); // the temp file, never the note
        throw error;
      }
      return { ok: true, version: await versionOf(text) };
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
      if (caseOnly) {
        // Through a name of its own: a file system that ignores case sees one name for both.
        const step = joined(folderOf(source), `.${nameOf(source)}.eien-case`);
        await this.#files.rename(source, step);
        await this.#files.rename(step, target);
      } else {
        await this.#files.rename(source, target);
      }
      return { ok: true };
    });
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
      const from = holds ? joined(folderOf(at), `.${nameOf(at)}.eien-trashing`) : at;
      if (holds) await this.#files.rename(at, from);
      try {
        const stamp = stampOf(this.#now());
        let folder = `${TRASH_FOLDER}/${stamp}`;
        for (let n = 2; await this.#files.stat(`${folder}/${nameOf(at)}`); n++) {
          folder = `${TRASH_FOLDER}/${stamp}-${n}`; // the same name trashed in the same moment
        }
        await this.#files.makeFolder(folder);
        await this.#files.rename(from, `${folder}/${nameOf(at)}`);
      } catch (error) {
        if (holds) await this.#files.rename(from, at).catch(() => undefined); // back where it was
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

  watch(onChange: (paths: string[]) => void): () => void {
    let last: Map<string, string> | null = null;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let looking = false;
    const look = async () => {
      if (stopped || looking) return;
      looking = true;
      clearTimeout(timer);
      try {
        if (this.#active()) {
          const now = await this.#snapshot().catch(() => null);
          if (now && last) {
            const changed = [...new Set([...last.keys(), ...now.keys()])].filter(
              (path) => last?.get(path) !== now.get(path),
            );
            if (changed.length > 0 && !stopped) onChange(changed);
          }
          if (now) last = now;
        }
      } finally {
        looking = false;
        if (!stopped) timer = setTimeout(() => void look(), this.#pollMs);
      }
    };
    const lookNow = () => void look();
    this.#lookers.add(lookNow);
    void look();
    return () => {
      stopped = true;
      clearTimeout(timer);
      this.#lookers.delete(lookNow);
    };
  }

  /** Look for changes now: the app is back in front, and another device may have written. */
  lookNow(): void {
    for (const look of this.#lookers) look();
  }

  /** What a watcher reports changes in (isWatchedPath), each by its time and size. */
  async #snapshot(): Promise<Map<string, string>> {
    const seen = new Map<string, string>();
    const walk = async (folder: string): Promise<void> => {
      for (const entry of (await this.#files.list(folder)) ?? []) {
        const path = joined(folder, entry.name);
        if (entry.type === 'directory') {
          // Into the vault's folders, and .eien's settings and seals; not its trash, nor other hidden folders.
          const hidden = path.split('/').some(isHiddenName);
          if (!hidden || path === '.eien' || path.startsWith('.eien/versions')) await walk(path);
        } else if (isWatchedPath(path)) {
          seen.set(path, `${entry.mtime}:${entry.size}`);
        }
      }
    };
    await walk('');
    return seen;
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
