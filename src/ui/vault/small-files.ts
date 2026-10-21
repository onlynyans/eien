// The vault's own small files, each read, changed and written back at the
// version read (read again if another device changed it meanwhile): the pins
// (.eien/pinned.json), All Notes' order (.eien/order.json), the tags made and
// their order (.eien/tags.json), and a folder's settings. No file is written
// for no change, and a file that isn't JSON is never written over.

import { VAULT_ORDER, VAULT_PINS, VAULT_TAGS } from '../../core/paths';
import { withMadeTag, withTagOrder } from '../../core/tags';
import { parsePins, pinsText } from '../../core/vault';
import type { VaultBridge } from '../../platform/bridge';

/** How many times a small file is read and written again while it keeps changing. */
const TRIES = 3;

/** What a small file holds, as the writer reads it when it can't be changed. */
const WHAT: Record<string, string> = { pins: 'pins', tags: 'tags made', order: 'notes’ order' };

export interface SmallFilesContext {
  readonly vault: Pick<VaultBridge, 'read' | 'write'>;
  tell(message: string): void;
}

export class SmallFiles {
  readonly #ctx: SmallFilesContext;

  constructor(context: SmallFilesContext) {
    this.#ctx = context;
  }

  /** Make a tag no note carries yet, or take one made back out. */
  makeTag(tag: string, made: boolean): Promise<boolean> {
    return this.update(VAULT_TAGS, (text) => withMadeTag(text, tag, made), 'tags');
  }

  /** The tags in your order (their keys, every level). */
  setTagOrder(order: readonly string[]): Promise<boolean> {
    return this.update(VAULT_TAGS, (text) => withTagOrder(text, order), 'tags');
  }

  /** All Notes in your order: every note's path, as shown. */
  setAllOrder(paths: readonly string[]): Promise<boolean> {
    return this.#changeList(VAULT_ORDER, () => [...paths], 'order');
  }

  changePins(change: (pins: string[]) => string[]): Promise<boolean> {
    return this.#changeList(VAULT_PINS, change, 'pins');
  }

  /** A note or folder moved or trashed: the pins and All Notes' order follow it. */
  async followPaths(change: (paths: string[]) => string[]): Promise<void> {
    await this.changePins(change);
    await this.#changeList(VAULT_ORDER, change, 'order');
  }

  /** A list of paths in one of the vault's own files. */
  #changeList(file: string, change: (paths: string[]) => string[], what: string): Promise<boolean> {
    return this.update(
      file,
      (text) => {
        const paths = parsePins(text);
        const next = change(paths);
        // A vault never pinned or ordered has no such file.
        return next.join('\n') === paths.join('\n') ? undefined : pinsText(next);
      },
      what,
    );
  }

  /**
   * Read a small file, change it, and write it back at the version read; read
   * again if it changed meanwhile. `change` gives the new text, undefined for
   * nothing to write, or null when the file can't be read as it should be.
   */
  async update(
    path: string,
    change: (text: string | null) => string | null | undefined,
    what: string,
  ): Promise<boolean> {
    for (let attempt = 0; attempt < TRIES; attempt++) {
      const file = await this.#ctx.vault.read(path);
      const next = change(file?.text ?? null);
      if (next === undefined) return true;
      if (next === null) {
        this.#ctx.tell(
          `${path} isn’t valid JSON, so the ${WHAT[what] ?? 'folder’s settings'} weren’t changed. Fix or remove it, then try again.`,
        );
        return false;
      }
      if ((await this.#ctx.vault.write(path, next, file?.version ?? null)).ok) return true;
    }
    this.#ctx.tell(`${path} kept changing; try again.`);
    return false;
  }
}
