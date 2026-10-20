// A formatting edit on a note's text: the changes to make and where the
// selection lands afterwards. Pure, so every rule is tested without an editor.

export interface Change {
  readonly from: number;
  readonly to: number;
  readonly insert: string;
}

export interface Selection {
  readonly from: number;
  readonly to: number;
}

export interface Edit {
  /** In order, non-overlapping, positions in the text before the edit. */
  readonly changes: readonly Change[];
  readonly selection: Selection;
}

/** `text` with `changes` made (for tests and for callers without an editor). */
export function apply(text: string, changes: readonly Change[]): string {
  let out = '';
  let at = 0;
  for (const change of changes) {
    out += text.slice(at, change.from) + change.insert;
    at = change.to;
  }
  return out + text.slice(at);
}
