// A note renamed in its row (backlog #29): from the row's menu, F2 on the
// row, or a double-click on its name, in the note list or the sidebar's tree.
// The row the writer is at is the one that becomes the field (../list/
// name-field.ts); with none of the note's rows in sight (a phone's page, the
// menu bar's command), the title on the page takes the rename, as before.

import { baseName, parentOf, renamedPath, titleOf } from '../../core/paths';
import { editName } from '../list/name-field';

export interface RenameInRow {
  /** The names beside the note, in its folder, as the storage counts them. */
  namesIn(folder: string): string[];
  /** Rename it; its new path, or null when refused (the writer is told why). */
  rename(path: string, typed: string): Promise<string | null>;
  /** Run a file operation, then read the vault again and redraw. */
  act(operation: () => Promise<unknown>): Promise<void>;
  /** The page's title, for a rename with no row in sight. */
  onPage(path: string): void;
}

const PROBLEMS = {
  empty: 'A name needs a letter or a number.',
  taken: 'There is one of that name here already.',
};

/** The row's name elements for the note at `path`, as drawn: the list's and the tree's. */
function labelsOf(path: string): HTMLElement[] {
  const at = CSS.escape(path);
  return [
    ...document.querySelectorAll<HTMLElement>(
      `.note-row[data-path="${at}"] .note-row__title, .tree-row__name[data-path="${at}"] .tree-row__label`,
    ),
  ].filter((label) => label.getClientRects().length > 0);
}

/** How to find the same row again after a redraw: the list's, or the tree's by its key. */
function finderOf(label: HTMLElement, path: string): () => HTMLElement | null {
  const row = label.closest<HTMLElement>('[data-path]');
  const key = row?.dataset.key;
  const at = CSS.escape(path);
  const selector = key
    ? `.tree-row__name[data-key="${CSS.escape(key)}"] .tree-row__label`
    : `.note-row[data-path="${at}"] .note-row__title`;
  return () => document.querySelector<HTMLElement>(selector);
}

/** The row's own button, for the keyboard after: the renamed note's, wherever it's drawn now. */
function rowOf(path: string, like: () => HTMLElement | null): HTMLElement | null {
  return (
    like()?.closest<HTMLElement>('button') ??
    labelsOf(path)[0]?.closest<HTMLElement>('button') ??
    null
  );
}

/** Rename the note at `path` in the row the writer is at, or on the page if none is in sight. */
export function renameInRow(path: string, deps: RenameInRow): void {
  const labels = labelsOf(path);
  const active = document.activeElement;
  const label =
    labels.find((one) => active instanceof Element && one.closest('button') === active) ??
    labels[0];
  if (!label) {
    deps.onPage(path);
    return;
  }
  const find = finderOf(label, path);
  const name = baseName(path);
  const title = titleOf(name);
  editName({
    name: title,
    suffix: name.slice(title.length),
    label: find,
    problem: (typed) => {
      const renamed = renamedPath(path, typed, deps.namesIn(parentOf(path)), true);
      return renamed.ok ? null : PROBLEMS[renamed.problem];
    },
    done: (typed, byKey) => {
      if (typed === null) {
        if (byKey) rowOf(path, find)?.focus();
        return;
      }
      let to: string | null = null;
      void deps
        .act(async () => {
          to = await deps.rename(path, typed);
        })
        // After the redraw: the keyboard on the renamed row, if it had it.
        .then(() => byKey && rowOf(to ?? path, () => null)?.focus());
    },
  });
}
