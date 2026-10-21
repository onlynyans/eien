// The tree's note rows, kept from one draw to the next. With two panes and
// thousands of notes open, opening a note or saving it changes one note's
// rows; making six thousand rows again, and having the window style and lay
// them all out, held up the writer's typing. A row that shows the same is
// the same element; and when only notes' rows changed (./signature.ts),
// those are put right where they stand, with nothing else in the tree touched.

interface Kept {
  /** What the row shows, as a string: the same string, the same row. */
  readonly shows: string;
  readonly row: HTMLElement;
}

interface Listed {
  readonly depth: number;
  readonly rows: readonly HTMLElement[];
}

export class RowCache {
  /** Every note row the last draw drew, by its data-key. */
  #kept = new Map<string, Kept>();
  /** The rows of the draw under way. */
  #next = new Map<string, Kept>();
  /** The note rows under each list the last draw drew (an open row's, by openId, or results). */
  #drawn = new Map<string, Listed>();
  #listing = new Map<string, Listed>();

  /** A draw starts: none of its rows are made yet. */
  begin(): void {
    this.#next = new Map();
    this.#listing = new Map();
  }

  /** The row for `key`: the one drawn before when it `shows` the same, else a new one from `make`. */
  row(key: string, shows: string, make: () => HTMLElement): HTMLElement {
    const kept = this.#next.get(key) ?? this.#kept.get(key);
    const row = kept?.shows === shows ? kept.row : make();
    this.#next.set(key, { shows, row });
    return row;
  }

  /** The note rows a draw lists under `id`, at `depth`. */
  listed(id: string, depth: number, rows: readonly HTMLElement[]): void {
    this.#listing.set(id, { depth, rows });
  }

  /** The draw is in the window: its rows are the ones to keep. */
  settle(): void {
    this.#kept = this.#next;
    this.#drawn = this.#listing;
    this.begin();
  }

  /**
   * Put each list's rows right in place: `rowsOf` gives the rows a list has
   * now. False, with nothing changed, when a list can't be put right in place
   * (it had no rows to find it by, or has none left, which drops its group):
   * the whole tree is drawn instead.
   */
  patch(rowsOf: (id: string, depth: number) => readonly HTMLElement[]): boolean {
    const lists = [...this.#drawn].map(([id, { depth, rows }]) => ({
      before: rows,
      after: rowsOf(id, depth),
    }));
    const placed = ({ before, after }: (typeof lists)[number]) =>
      before.length === 0 ? after.length === 0 : after.length > 0 && before[0]?.isConnected;
    if (!lists.every(placed)) return false;
    for (const { before, after } of lists) placeRows(before, after);
    this.settle();
    return true;
  }
}

/**
 * Make the rows `before` (in the window, in order, the last of their
 * parent's children: a group's notes come after its folders or tags) into
 * the rows `after`, moving and replacing as few as it can. A note saved moves
 * to the top of a list by newest: one row moved.
 */
function placeRows(before: readonly HTMLElement[], after: readonly HTMLElement[]): void {
  const first = before[0];
  const parent = first?.parentElement;
  if (!first || !parent) return;
  const staying = new Set(after);
  for (const row of before) if (!staying.has(row)) row.remove();
  let at: ChildNode | null = before.find((row) => staying.has(row)) ?? null;
  for (const row of after) {
    if (row === at) at = row.nextSibling;
    else parent.insertBefore(row, at);
  }
}
