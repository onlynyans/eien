// Which of the sidebar's sections are folded, remembered on this device
// (spec §2: per-device state stays out of the vault) in the window's own
// storage, as the panes' widths are.

/** The sections that fold: a search's results don't. */
export type SectionId = 'library' | 'folders' | 'shelf' | 'tags';

/** The sections that list folders (#40): FOLDERS for writing, SHELF for reading. */
export type FolderSection = Extract<SectionId, 'folders' | 'shelf'>;

const SECTIONS: readonly SectionId[] = ['library', 'folders', 'shelf', 'tags'];
const KEY = 'eien.folds';

/** The folded sections as stored; anything it doesn't know folds nothing. */
export function readFolds(text: string | null): ReadonlySet<SectionId> {
  let data: unknown;
  try {
    data = JSON.parse(text ?? '[]');
  } catch {
    return new Set();
  }
  return new Set(Array.isArray(data) ? SECTIONS.filter((id) => data.includes(id)) : []);
}

export const writeFolds = (folded: ReadonlySet<SectionId>): string =>
  JSON.stringify(SECTIONS.filter((id) => folded.has(id)));

/** What `key` holds in the window's storage; null where it's refused, so everything starts open. */
export function storedFolds(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Keep `text` under `key`; refused, a fold holds until the window closes. */
export function storeFolds(key: string, text: string): void {
  try {
    localStorage.setItem(key, text);
  } catch {
    // Storage refused: kept in memory alone.
  }
}

/** This device's folds, read once and kept in step with its storage. */
export class Folds {
  #folded = new Set(readFolds(storedFolds(KEY)));

  has(id: SectionId): boolean {
    return this.#folded.has(id);
  }

  set(id: SectionId, folded: boolean): void {
    if (folded) this.#folded.add(id);
    else this.#folded.delete(id);
    storeFolds(KEY, writeFolds(this.#folded));
  }
}
