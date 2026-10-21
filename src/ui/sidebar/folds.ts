// Which of the sidebar's sections are folded, remembered on this device
// (spec §2: per-device state stays out of the vault) in the window's own
// storage, as the panes' widths are.

/** The sections that fold: a search's results don't. */
export type SectionId = 'library' | 'folders' | 'tags';

const SECTIONS: readonly SectionId[] = ['library', 'folders', 'tags'];
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

/** This device's folds, read once and kept in step with its storage. */
export class Folds {
  #folded: Set<SectionId>;

  constructor() {
    let text: string | null = null;
    try {
      text = localStorage.getItem(KEY);
    } catch {
      // Storage refused: every section starts open.
    }
    this.#folded = new Set(readFolds(text));
  }

  has(id: SectionId): boolean {
    return this.#folded.has(id);
  }

  set(id: SectionId, folded: boolean): void {
    if (folded) this.#folded.add(id);
    else this.#folded.delete(id);
    try {
      localStorage.setItem(KEY, writeFolds(this.#folded));
    } catch {
      // Storage refused: the fold holds until the window closes.
    }
  }
}
