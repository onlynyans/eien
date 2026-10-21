// An open vault, as the window asks of it (the VaultBridge in ./bridge.ts):
// its storage, the index over it, and the index kept in step with every
// change made through it and every change seen on disk. The desktop's main
// process serves it over IPC (app/electron/vault-session.ts); the phone's
// window calls it directly (app/mobile).

import { VaultIndex } from './index';
import type { FileState, MoveResult, Storage, WriteResult } from './storage';

export class OpenVault {
  readonly name: string;
  readonly storage: Storage;
  readonly index: VaultIndex;

  private constructor(name: string, storage: Storage, index: VaultIndex) {
    this.name = name;
    this.storage = storage;
    this.index = index;
  }

  /** The vault in `storage`, named `name`, read into its index. */
  static async open(name: string, storage: Storage): Promise<OpenVault> {
    const index = new VaultIndex(storage);
    await index.refresh();
    return new OpenVault(name, storage, index);
  }

  list = () => this.index.entries();
  notes = () => this.index.notes();
  search = (query: string) => this.index.search(query);
  listFiles = (folder: string) => this.storage.listFiles(folder);
  read = (path: string): Promise<FileState | null> => this.storage.read(path);
  readBytes = (path: string) => this.storage.readBytes(path);

  /** The index holds what was written before the window asks for the list again. */
  async write(path: string, text: string, expected: string | null): Promise<WriteResult> {
    const result = await this.storage.write(path, text, expected);
    if (result.ok) await this.#reindex([path]);
    return result;
  }

  async move(from: string, to: string): Promise<MoveResult> {
    const result = await this.storage.move(from, to);
    if (result.ok) await this.#reindex([from, to]);
    return result;
  }

  async trash(path: string): Promise<void> {
    await this.storage.trash(path);
    await this.#reindex([path]);
  }

  async makeFolder(path: string): Promise<void> {
    await this.storage.makeFolder(path);
    await this.#reindex([path]);
  }

  /** Changes on disk: `changed` hears of them once the index holds them. */
  watch(changed: (paths: string[]) => void): () => void {
    return this.storage.watch((paths) => {
      void this.index
        .refresh(paths)
        .catch((error: unknown) => console.error('Eien: the vault couldn’t be read again:', error))
        .finally(() => changed(paths));
    });
  }

  /** The index catches up after a change; if it can't just now, the change still happened. */
  #reindex(paths: string[]): Promise<void> {
    return this.index
      .refresh(paths)
      .catch((error: unknown) => console.error('Eien: the index couldn’t catch up:', error));
  }
}
