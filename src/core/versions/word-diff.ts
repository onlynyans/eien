// The draft compared with a seal, word by word (spec §9): removed words
// struck through, added words underlined. Words are found as the word count
// finds them (Intl.Segmenter: spaces between words, or none, as in Chinese
// and Japanese), punctuation on its own, and each line ends with a mark.
// They're compared with Myers' algorithm, after the unchanged start and end
// are set aside, and within a bound: a rewrite too large to compare word by
// word is compared by lines, and past that shown as all removed and all added.

export type DiffKind = 'same' | 'added' | 'removed';

/** A word, a mark (punctuation), or a line's end. */
export interface DiffToken {
  /** What's compared: the word itself. */
  readonly key: string;
  /** What's shown: the word and the space after it, as written. */
  readonly text: string;
  /** Whether it's a word (counted), not punctuation or a line's end. */
  readonly word: boolean;
}

export interface DiffOp extends DiffToken {
  readonly kind: DiffKind;
}

/** The end of a line of text, as a token's key: it never equals a word. */
export const LINE_END = '\n';

/** How many words and line ends the comparison may find changed before it gives up. */
const MAX_EDITS = 2000;

const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
const SPACE = /^\s+$/u;

/** A text's words and marks, each line ended by a LINE_END; blank lines are left out. */
export function diffTokens(text: string): DiffToken[] {
  const tokens: DiffToken[] = [];
  for (const line of text.split('\n')) {
    const start = tokens.length;
    for (const { segment, isWordLike } of segmenter.segment(line)) {
      const last = tokens.length > start ? tokens[tokens.length - 1] : undefined;
      if (SPACE.test(segment)) {
        // A space is shown after the word before it; one at the line's start, not at all.
        if (last) tokens[tokens.length - 1] = { ...last, text: last.text + segment };
        continue;
      }
      tokens.push({ key: segment, text: segment, word: isWordLike === true });
    }
    if (tokens.length > start) tokens.push({ key: LINE_END, text: '', word: false });
  }
  return tokens;
}

/** One step of an edit: a token kept (at `a` in the seal, `b` in the draft), removed, or added. */
type Step =
  | { readonly kind: 'same'; readonly a: number; readonly b: number }
  | { readonly kind: 'removed'; readonly a: number }
  | { readonly kind: 'added'; readonly b: number };

/**
 * The shortest edit from `a` to `b` by Myers' algorithm, or null when it
 * would take more than `maxEdits` changes (its time and memory grow with them).
 */
function myers(a: readonly string[], b: readonly string[], maxEdits: number): Step[] | null {
  const n = a.length;
  const m = b.length;
  const limit = Math.min(n + m, maxEdits);
  const offset = limit + 1;
  const v = new Int32Array(2 * limit + 3);
  /** Each round's furthest points, kept to walk back along (only the diagonals it reached). */
  const trace: Int32Array[] = [];
  let found = -1;
  search: for (let d = 0; d <= limit; d++) {
    trace.push(v.slice(offset - d - 1, offset + d + 2));
    for (let k = -d; k <= d; k += 2) {
      const down = k === -d || (k !== d && (v[offset + k - 1] ?? 0) < (v[offset + k + 1] ?? 0));
      let x = down ? (v[offset + k + 1] ?? 0) : (v[offset + k - 1] ?? 0) + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) {
        found = d;
        break search;
      }
    }
  }
  if (found < 0) return null;
  const steps: Step[] = [];
  let x = n;
  let y = m;
  for (let d = found; d > 0; d--) {
    const before = trace[d] as Int32Array; // the furthest points after round d - 1
    const at = (k: number) => before[k + d + 1] ?? 0;
    const k = x - y;
    const down = k === -d || (k !== d && at(k - 1) < at(k + 1));
    const prevK = down ? k + 1 : k - 1;
    const prevX = at(prevK);
    const prevY = prevX - prevK;
    while (x > (down ? prevX : prevX + 1) && y > (down ? prevY + 1 : prevY)) {
      steps.push({ kind: 'same', a: --x, b: --y });
    }
    if (down) steps.push({ kind: 'added', b: --y });
    else steps.push({ kind: 'removed', a: --x });
    x = prevX;
    y = prevY;
  }
  while (x > 0 && y > 0) steps.push({ kind: 'same', a: --x, b: --y });
  return steps.reverse();
}

/** Sentence-ending punctuation, in any script. */
const STOP = /^[.!?…。！？]+$/u;

/**
 * Where a run of only added (or only removed) words reads best. Such a run
 * can often sit a word earlier or later and still say the same: in "The
 * welling faded. The tension eased." the added words are "The welling
 * faded." or "welling faded. The". The run is placed where it starts with a
 * word and ends a sentence (or follows one): a writer adds sentences, not
 * word pairs (the mockup's choice).
 */
function placeRuns(ops: DiffOp[]): DiffOp[] {
  const out = [...ops];
  const score = (start: number, end: number) => {
    const before = out[start - 1];
    const ends =
      STOP.test(out[end]?.key ?? '') || !before || before.key === LINE_END || STOP.test(before.key);
    return (out[start]?.word ? 2 : 0) + (ends ? 1 : 0);
  };
  /** The run [start, end] one word back ("x [r1 … rk]" with x = rk is "[x r1 …] rk"), if it can be. */
  const back = (start: number, end: number) => {
    const before = out[start - 1];
    const last = out[end] as DiffOp;
    if (before?.kind !== 'same' || before.key !== last.key || before.key === LINE_END) return false;
    out[start - 1] = { ...before, kind: last.kind };
    out[end] = { ...last, kind: 'same' };
    return true;
  };
  const forward = (start: number, end: number) => {
    const after = out[end + 1];
    const first = out[start] as DiffOp;
    if (after?.kind !== 'same' || after.key !== first.key || after.key === LINE_END) return false;
    out[end + 1] = { ...after, kind: first.kind };
    out[start] = { ...first, kind: 'same' };
    return true;
  };
  for (let end = 0; end < out.length; end++) {
    const kind = out[end]?.kind;
    if (!kind || kind === 'same' || out[end + 1]?.kind === kind) continue; // not a run's last word
    let start = end;
    while (start > 0 && out[start - 1]?.kind === kind) start--;
    // A run beside a run of the other kind is a replacement: it stays put.
    if (start > 0 && out[start - 1]?.kind !== 'same') continue;
    if (out[end + 1] && out[end + 1]?.kind !== 'same') continue;
    while (back(start, end)) {
      start--;
      end--;
    }
    // From the earliest place, try each later one; keep the one that reads best (the earliest of equals).
    let best = score(start, end);
    let moves = 0;
    let bestMoves = 0;
    while (forward(start, end)) {
      start++;
      end++;
      moves++;
      if (score(start, end) > best) {
        best = score(start, end);
        bestMoves = moves;
      }
    }
    for (; moves > bestMoves; moves--) {
      back(start, end);
      start--;
      end--;
    }
  }
  return out;
}

/** Split tokens into lines, each with its LINE_END. */
function linesOf(tokens: readonly DiffToken[]): DiffToken[][] {
  const lines: DiffToken[][] = [];
  let line: DiffToken[] = [];
  for (const token of tokens) {
    line.push(token);
    if (token.key === LINE_END) {
      lines.push(line);
      line = [];
    }
  }
  if (line.length > 0) lines.push(line);
  return lines;
}

const all = (kind: DiffKind, tokens: readonly DiffToken[]): DiffOp[] =>
  tokens.map((token) => ({ ...token, kind }));
const keys = (tokens: readonly DiffToken[]) => tokens.map((token) => token.key);

/** The ops for `steps` over groups of tokens (single tokens, or lines). */
const fromSteps = (
  steps: readonly Step[],
  from: readonly (readonly DiffToken[])[],
  to: readonly (readonly DiffToken[])[],
): DiffOp[] =>
  steps.flatMap((step) =>
    step.kind === 'removed' ? all('removed', from[step.a] ?? []) : all(step.kind, to[step.b] ?? []),
  );

/** The changes from the sealed text `before` to the draft `after`, word by word. */
export function wordDiff(before: string, after: string, maxEdits = MAX_EDITS): DiffOp[] {
  const a = diffTokens(before);
  const b = diffTokens(after);
  let start = 0;
  while (start < a.length && start < b.length && a[start]?.key === b[start]?.key) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1]?.key === b[endB - 1]?.key) {
    endA--;
    endB--;
  }
  // What's kept is shown as the draft has it.
  const head = all('same', b.slice(0, start));
  const tail = all('same', b.slice(endB));
  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  const words = myers(keys(midA), keys(midB), maxEdits);
  if (words) {
    const middle = fromSteps(
      words,
      midA.map((token) => [token]),
      midB.map((token) => [token]),
    );
    return placeRuns([...head, ...middle, ...tail]);
  }
  // Too much changed to compare word by word: compare whole lines, then give up.
  const linesA = linesOf(midA);
  const linesB = linesOf(midB);
  const lineKey = (line: readonly DiffToken[]) => keys(line).join('\u0000');
  const lines = myers(linesA.map(lineKey), linesB.map(lineKey), maxEdits);
  const middle = lines
    ? fromSteps(lines, linesA, linesB)
    : [...all('removed', midA), ...all('added', midB)];
  return [...head, ...middle, ...tail];
}

/** A run of words that changed together, or didn't, as written. */
export interface DiffRun {
  readonly kind: DiffKind;
  readonly text: string;
}

/** A line's runs without the space after its last word. */
function trimEnd(line: DiffRun[]): DiffRun[] {
  const last = line[line.length - 1];
  return last ? [...line.slice(0, -1), { ...last, text: last.text.trimEnd() }] : line;
}

/**
 * The changes as lines of runs, for showing: each line's words, removed
 * before added where they replace each other. A line added or removed
 * whole is one run of its kind.
 */
export function diffLines(ops: readonly DiffOp[]): DiffRun[][] {
  const lines: DiffRun[][] = [];
  let line: DiffRun[] = [];
  let removed = '';
  let added = '';
  const flushChange = () => {
    // Words replaced: a space between what went and what came, where none was written.
    if (removed && added && !/\s$/u.test(removed)) removed += ' ';
    if (removed) line.push({ kind: 'removed', text: removed });
    if (added) line.push({ kind: 'added', text: added });
    removed = '';
    added = '';
  };
  for (const op of ops) {
    if (op.key !== LINE_END) {
      if (op.kind === 'removed') removed += op.text;
      else if (op.kind === 'added') added += op.text;
      else {
        flushChange();
        const last = line[line.length - 1];
        if (last?.kind === 'same') {
          line[line.length - 1] = { kind: 'same', text: last.text + op.text };
        } else line.push({ kind: 'same', text: op.text });
      }
    }
    // A line ends where the draft's lines end; a removed line's end only ends it when
    // nothing of the draft's is on it.
    else if (op.kind !== 'removed' || (line.length === 0 && !added)) {
      flushChange();
      if (line.length > 0) lines.push(trimEnd(line));
      line = [];
    }
  }
  flushChange();
  if (line.length > 0) lines.push(trimEnd(line));
  return lines;
}

/** How many words were removed and added (punctuation and line ends aside). */
export function diffCounts(ops: readonly DiffOp[]): { removed: number; added: number } {
  let removed = 0;
  let added = 0;
  for (const op of ops) {
    if (!op.word) continue;
    if (op.kind === 'removed') removed++;
    else if (op.kind === 'added') added++;
  }
  return { removed, added };
}
