// A vault in memory: the Storage contract without a disk, for tests.

import { baseName, isHiddenName, parentOf, vaultPath } from '../../core/paths';
import { kindOf, type VaultEntry } from '../../core/vault';
import { type FileState, MAX_BYTES_READ, type Storage, type WriteResult } from '../storage';

export class MemoryStorage implements Storage {
  readonly #files = new Map<string, { text: string; modified: number }>();
  readonly #folders = new Set<string>();
  readonly #listeners = new Set<(paths: string[]) => void>();
  #clock = 0;

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
          size: file.text.length,
        }),
      );
    return [...folders, ...files];
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
    const current = await this.read(at);
    if ((current?.version ?? null) !== expected) return { ok: false, current };
    this.#files.set(at, { text, modified: ++this.#clock });
    this.#addParents(at);
    this.#notify([at]);
    return { ok: true, version: versionOf(text) };
  }

  watch(onChange: (paths: string[]) => void): () => void {
    this.#listeners.add(onChange);
    return () => this.#listeners.delete(onChange);
  }

  #addParents(path: string): void {
    for (let folder = parentOf(path); folder; folder = parentOf(folder)) this.#folders.add(folder);
  }

  #notify(paths: string[]): void {
    for (const listener of this.#listeners) listener(paths);
  }
}

/** In memory the content itself is a fine version: equal exactly when the text is. */
const versionOf = (text: string): string => `m:${text}`;
