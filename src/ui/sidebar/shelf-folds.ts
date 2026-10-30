// Which of SHELF's folders are shut (#40), kept on this device (spec §2) in
// the window's own storage, as the sections' folds are (./folds.ts). Kept
// shut, not open, so a folder starts open; by its path in the vault, so a
// rename or a move carries it along (../vault/navigation.ts), as the lists'
// sorts are (../list/sorts.ts).

import { isInside, parentOf } from '../../core/paths';
import { storedFolds, storeFolds } from './folds';

const KEY = 'eien.shelf';

/** The shut folders as stored; anything else shuts nothing. */
export function readShelfFolds(text: string | null): Set<string> {
  let data: unknown;
  try {
    data = JSON.parse(text ?? '[]');
  } catch {
    return new Set();
  }
  return new Set(
    Array.isArray(data)
      ? data.filter((path): path is string => typeof path === 'string' && path !== '')
      : [],
  );
}

export class ShelfFolds {
  #shut = readShelfFolds(storedFolds(KEY));

  /** The shut folders, in order: what the sidebar draws, and its frame compares. */
  get shut(): string[] {
    return [...this.#shut].sort();
  }

  has(path: string): boolean {
    return this.#shut.has(path);
  }

  set(path: string, shut: boolean): void {
    const next = new Set(this.#shut);
    if (shut) next.add(path);
    else next.delete(path);
    this.#keep(next);
  }

  /** Open every folder down to `folder`, so a folder moved into it shows. */
  openTo(folder: string): void {
    const open = new Set<string>();
    for (let at = folder; at; at = parentOf(at)) open.add(at);
    this.#keep(new Set([...this.#shut].filter((path) => !open.has(path))));
  }

  /** A folder renamed or moved: its folds, and those of the folders in it, follow it. */
  follow(from: string, to: string): void {
    const moved = (path: string) => (isInside(path, from) ? to + path.slice(from.length) : path);
    this.#keep(new Set([...this.#shut].map(moved)));
  }

  /** A folder went to the trash: its folds, and those in it, go. */
  forget(path: string): void {
    this.#keep(new Set([...this.#shut].filter((shut) => !isInside(shut, path))));
  }

  /** The shut folders now, stored only when they changed. */
  #keep(shut: Set<string>): void {
    const before = this.shut.join('\n');
    this.#shut = shut;
    if (this.shut.join('\n') !== before) storeFolds(KEY, JSON.stringify(this.shut));
  }
}
