// Which of SHELF's folders are shut (#40), kept on this device (spec §2) in
// the window's own storage, as the sections' folds are (./folds.ts). Kept
// shut, not open, so a folder starts open; by its path in the vault, so a
// rename or a move carries it along (../vault/navigation.ts), as the lists'
// sorts are (../list/sorts.ts).

import { isInside, parentOf } from '../../core/paths';

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
  #shut: Set<string>;

  constructor() {
    let text: string | null = null;
    try {
      text = localStorage.getItem(KEY);
    } catch {
      // Storage refused: every folder starts open.
    }
    this.#shut = readShelfFolds(text);
  }

  /** The shut folders, in order: what the sidebar draws, and its frame compares. */
  get shut(): string[] {
    return [...this.#shut].sort();
  }

  has(path: string): boolean {
    return this.#shut.has(path);
  }

  set(path: string, shut: boolean): void {
    if (shut) this.#shut.add(path);
    else this.#shut.delete(path);
    this.#store();
  }

  /** Open every folder down to `folder`, so a folder moved into it shows. */
  openTo(folder: string): void {
    const before = this.#shut.size;
    for (let at = folder; at; at = parentOf(at)) this.#shut.delete(at);
    if (this.#shut.size !== before) this.#store();
  }

  /** A folder renamed or moved: its folds, and those of the folders in it, follow it. */
  follow(from: string, to: string): void {
    const moved = [...this.#shut].map((path) =>
      isInside(path, from) ? to + path.slice(from.length) : path,
    );
    this.#shut = new Set(moved);
    this.#store();
  }

  /** A folder went to the trash: its folds, and those in it, go. */
  forget(path: string): void {
    const before = this.#shut.size;
    for (const shut of [...this.#shut]) if (isInside(shut, path)) this.#shut.delete(shut);
    if (this.#shut.size !== before) this.#store();
  }

  #store(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.shut));
    } catch {
      // Storage refused: the fold holds until the window closes.
    }
  }
}
