// A vault in memory: the Storage contract without a disk, for tests.

import { baseName, isHiddenName, isWatchedPath, parentOf, vaultPath } from '../../core/paths';
import { kindOf, type VaultEntry } from '../../core/vault';
import {
  type FileState,
  MAX_BYTES_READ,
  type MoveResult,
  type Storage,
  type WriteResult,
} from '../storage';

export class MemoryStorage implements Storage {
  readonly #files = new Map<string, { text: string; modified: number }>();
  readonly #folders = new Set<string>();
  readonly #listeners = new Set<(paths: string[]) => void>();
  readonly #trashed: string[] = [];
  #clock = 0;

  /** What was sent to the trash, in order: the system trash a test can look in. */
  get trashed(): readonly string[] {
    return this.#trashed;
  }

  /** Put a file in place as another program would (and tell watchers). */
  put(path: string, text: string): void {
    const at = vaultPath(path);
    this.#files.set(at, { text, modified: ++this.#clock });
    this.#addParents(at);
    this.#notify([at]);
  }

  /** Remove a file as another program would (and tell watchers). */
  remove(path: string): void {
    const at = vaultPath(path);
    this.#files.delete(at);
    this.#notify([at]);
  }

  async list(): Promise<VaultEntry[]> {
    const visible = (path: string) => path.split('/').every((part) => !isHiddenName(part));
    const folders = [...this.#folders]
      .filter(visible)
      .map((path): VaultEntry => ({ path, kind: 'folder', modified: 0, size: 0 }));
    const files = [...this.#files]
      .filter(([path]) => visible(path))
      .map(
        ([path, file]): VaultEntry => ({
          path,
          kind: kindOf(baseName(path), false),
          modified: file.modified,
          size: new TextEncoder().encode(file.text).length,
        }),
      );
    return [...folders, ...files];
  }

  async listFiles(folder: string): Promise<string[]> {
    const at = folder === '' ? '' : vaultPath(folder);
    return [...this.#files.keys()]
      .filter((path) => parentOf(path) === at && !isHiddenName(baseName(path)))
      .map(baseName);
  }

  async read(path: string): Promise<FileState | null> {
    const file = this.#files.get(vaultPath(path));
    return file ? { text: file.text, version: versionOf(file.text) } : null;
  }

  async readBytes(path: string): Promise<Uint8Array | null> {
    const file = this.#files.get(vaultPath(path));
    if (!file) return null;
    const bytes = new TextEncoder().encode(file.text);
    return bytes.length > MAX_BYTES_READ ? null : bytes;
  }

  async write(path: string, text: string, expected: string | null): Promise<WriteResult> {
    const at = vaultPath(path);
    // Checked and written with no wait between, so two overlapping writes can't both pass.
    const file = this.#files.get(at);
    const current = file ? { text: file.text, version: versionOf(file.text) } : null;
    if ((current?.version ?? null) !== expected) return { ok: false, current };
    // As on disk: where no file can be, there's none at the version expected (above), and
    // a write expecting none fails.
    for (let folder = parentOf(at); folder; folder = parentOf(folder)) {
      if (this.#files.has(folder)) throw new Error(`Not a folder: ${folder}`);
    }
    if (this.#folders.has(at)) throw new Error(`A folder: ${at}`);
    this.#files.set(at, { text, modified: ++this.#clock });
    this.#addParents(at);
    this.#notify([at]);
    return { ok: true, version: versionOf(text) };
  }

  async move(from: string, to: string): Promise<MoveResult> {
    const source = vaultPath(from);
    const target = vaultPath(to);
    const isFile = this.#files.has(source);
    if (!isFile && !this.#folders.has(source)) return { ok: false, reason: 'missing' };
    if (target === source) return { ok: true };
    if (target.startsWith(`${source}/`)) return { ok: false, reason: 'into-itself' };
    if (this.#files.has(target) || this.#folders.has(target)) return { ok: false, reason: 'taken' };
    for (let folder = parentOf(target); folder; folder = parentOf(folder)) {
      if (this.#files.has(folder)) throw new Error(`Not a folder: ${folder}`);
    }
    // Everything at or under `source` moves, kept as it was (a rename keeps the time).
    const moved = (path: string) =>
      path === source
        ? target
        : path.startsWith(`${source}/`)
          ? target + path.slice(source.length)
          : null;
    for (const [path, file] of [...this.#files]) {
      const next = moved(path);
      if (next === null) continue;
      this.#files.delete(path);
      this.#files.set(next, file);
    }
    for (const folder of [...this.#folders]) {
      const next = moved(folder);
      if (next === null) continue;
      this.#folders.delete(folder);
      this.#folders.add(next);
    }
    this.#addParents(target);
    this.#notify([source, target]);
    return { ok: true };
  }

  async trash(path: string): Promise<void> {
    const at = vaultPath(path);
    const inside = (candidate: string) => candidate === at || candidate.startsWith(`${at}/`);
    if (!this.#files.has(at) && !this.#folders.has(at)) throw new Error(`Nothing to trash: ${at}`);
    for (const file of [...this.#files.keys()]) if (inside(file)) this.#files.delete(file);
    for (const folder of [...this.#folders]) if (inside(folder)) this.#folders.delete(folder);
    this.#trashed.push(at);
    this.#notify([at]);
  }

  async makeFolder(path: string): Promise<void> {
    const at = vaultPath(path);
    for (let folder = at; folder; folder = parentOf(folder)) {
      if (this.#files.has(folder)) throw new Error(`A file: ${folder}`);
    }
    this.#folders.add(at);
    this.#addParents(at);
    this.#notify([at]);
  }

  watch(onChange: (paths: string[]) => void): () => void {
    this.#listeners.add(onChange);
    return () => this.#listeners.delete(onChange);
  }

  #addParents(path: string): void {
    for (let folder = parentOf(path); folder; folder = parentOf(folder)) this.#folders.add(folder);
  }

  #notify(changed: string[]): void {
    const paths = changed.filter(isWatchedPath);
    if (paths.length === 0) return;
    for (const listener of this.#listeners) listener(paths);
  }
}

/** In memory the content itself is a fine version: equal exactly when the text is. */
const versionOf = (text: string): string => `m:${text}`;
