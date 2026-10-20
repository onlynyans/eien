// What a crash can leave in a vault (spec §3), the same on every system: a
// write's hidden temp file beside its note. Each system's storage writes
// through one; each recovers what one holds when the vault opens.

/** The end of a write's temp file's name: ".<note name>.eien.tmp". */
export const TEMP_SUFFIX = '.eien.tmp';

/** Whether `name` is a write's temp file. */
export const isTempName = (name: string): boolean =>
  name.startsWith('.') && name.endsWith(TEMP_SUFFIX) && name.length > TEMP_SUFFIX.length + 1;

/** The note a temp file was written for (a long name's cut, its hash kept). */
export const noteOfTemp = (name: string): string => name.slice(1, -TEMP_SUFFIX.length);

export interface Written {
  readonly text: string;
  /** Last modified, in milliseconds. */
  readonly mtime: number;
}

/**
 * Whether a temp file holds words its note doesn't: there's no note, or the
 * temp is newer and different — and it isn't empty (a write cut before any
 * words went in). Those are kept as a "(recovered …)" note beside it.
 */
export const strayHoldsWords = (temp: Written, note: Written | null): boolean =>
  temp.text.length > 0 && (note === null || (temp.mtime > note.mtime && temp.text !== note.text));
