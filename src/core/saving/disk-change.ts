// What to do when an open note's file changes on disk (spec §3). Words are
// never lost: if the writer's text and the file both changed, neither wins.

export type DiskChange =
  /** The file holds what we last knew: nothing to do. */
  | { readonly kind: 'none' }
  /** No unsaved edits here: show the file's new text. */
  | { readonly kind: 'reload'; readonly text: string }
  /** The file now holds exactly what the editor holds: just note it as saved. */
  | { readonly kind: 'same' }
  /** Both changed: keep the writer's text as a sibling copy; the file keeps the other. */
  | { readonly kind: 'conflict' };

/**
 * @param base the text last read from or written to the file
 * @param editor the text in the editor now
 * @param disk the text in the file now
 */
export function diskChange(base: string, editor: string, disk: string): DiskChange {
  if (disk === base) return { kind: 'none' };
  if (disk === editor) return { kind: 'same' };
  if (editor === base) return { kind: 'reload', text: disk };
  return { kind: 'conflict' };
}

/** The editor holds edits the file doesn't. */
export const hasUnsavedEdits = (base: string, editor: string): boolean => base !== editor;
