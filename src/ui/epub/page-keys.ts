// A book's page and its keys (#40): its letters (Q quotes, Phase 2c; B
// bookmarks, Phase 4b; H highlights, Phase 5a), each a plain key, held once;
// `]` and `[` the marks walked (Phase 5b), however a layout types them; ⌘[ or Alt+← back, as a
// browser goes back; and in pages (Phase 3b) the arrow keys, Space and Page
// Up and Down a page on or back, Home and End the chapter's ends, and on a
// touch screen a tap in the page's outer thirds. Never from a field (the
// page beside's words, its tags: Alt+← is a word left there), never a
// button's own Space (no turn twice: a clicked edge keeps the keyboard, and
// the arrows still turn from it), nor a tap on a link or one ending a
// selection (Quote and Copy need one).

export interface PageKeysOf {
  /** A page turned `way`; `held`, the key repeating. */
  turn(way: 1 | -1, held: boolean): void;
  /** The chapter's first page or its last. */
  edge(last: boolean): void;
}

/** In pages, the keys that turn: on, back, and to the chapter's ends (Phase 3b). */
const PAGE_KEYS: Readonly<Record<string, 1 | -1 | 'first' | 'last'>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  PageDown: 1,
  ' ': 1,
  ArrowLeft: -1,
  ArrowUp: -1,
  PageUp: -1,
  'Shift+Space': -1,
  Home: 'first',
  End: 'last',
};

/** Where a key is the writer's own: a note's editor, a field. */
const FIELD = '.editor-host, input, textarea, [contenteditable]';

/** What a book's page does for its keys. */
export interface BookKeysOf extends PageKeysOf {
  /** Words chosen in the chapter now. */
  chosen(): boolean;
  /** A book on the page. */
  shown(): boolean;
  /** Whether the chapter is in pages. */
  paged(): boolean;
  /** Whether there's a step back to take. */
  canGoBack(): boolean;
  quote(): void;
  bookmark(): void;
  highlight(): void;
  back(): void;
  /** `]` or `[`: to the next mark, or the one before (Phase 5b). */
  walk(way: 1 | -1): void;
}

/** A plain letter's command on a book's page, and when it applies. */
interface Letter {
  readonly when: (of: BookKeysOf) => boolean;
  readonly run: (of: BookKeysOf) => void;
}

const LETTERS: Readonly<Record<string, Letter>> = {
  // With words chosen in the chapter now: quoted in the note beside (Phase 2c).
  q: { when: (of) => of.chosen(), run: (of) => of.quote() },
  // The page in sight bookmarked, or its bookmark taken off (Phase 4b).
  b: { when: (of) => of.shown(), run: (of) => of.bookmark() },
  // The words chosen kept as a highlight, or the one they lie in taken off (Phase 5a); with none
  // chosen it says so.
  h: { when: (of) => of.shown(), run: (of) => of.highlight() },
};

/** `]` and `[`: the marks walked on, or back. */
const BRACKETS: Readonly<Record<string, 1 | -1>> = { ']': 1, '[': -1 };

/** Whether `event` is Back: ⌘[ (Ctrl+[), or Alt+←. */
const isBack = (event: KeyboardEvent) =>
  (event.key === '[' && (event.metaKey || event.ctrlKey) && !event.altKey) ||
  (event.key === 'ArrowLeft' && event.altKey && !event.metaKey && !event.ctrlKey);

/** A key on a book's page: its letters, Back, and in pages a turn. */
export function bookKey(event: KeyboardEvent, of: BookKeysOf): void {
  if (event.target instanceof Element && event.target.closest(FIELD)) return;
  const plain = !event.metaKey && !event.ctrlKey && !event.altKey;
  const name = event.key.toLowerCase();
  const letter = plain && Object.hasOwn(LETTERS, name) ? LETTERS[name] : undefined;
  if (letter?.when(of)) {
    event.preventDefault();
    if (!event.repeat) letter.run(of);
    return;
  }
  // A bracket typed with whatever a layout needs for it (AltGr, a Mac's Option), but ⌘ or Ctrl
  // alone, which is Back.
  const way = Object.hasOwn(BRACKETS, event.key) ? BRACKETS[event.key] : undefined;
  if (way && !isBack(event) && !((event.metaKey || event.ctrlKey) && !event.altKey) && of.shown()) {
    event.preventDefault();
    of.walk(way);
    return;
  }
  if (isBack(event)) {
    if (!of.canGoBack()) return;
    event.preventDefault();
    of.back();
    return;
  }
  if (plain && of.paged()) pageKey(event, of);
}

/** In pages, a key on the page: a turn, if it's one of a page's. */
export function pageKey(event: KeyboardEvent, of: PageKeysOf): void {
  if (event.key === ' ' && event.target instanceof Element && event.target.closest('button'))
    return;
  if (event.shiftKey && event.key !== ' ') return;
  const way = PAGE_KEYS[event.key === ' ' && event.shiftKey ? 'Shift+Space' : event.key];
  if (way === undefined) return;
  event.preventDefault();
  if (way === 'first' || way === 'last') of.edge(way === 'last');
  else of.turn(way, event.repeat);
}

/**
 * In pages, a click on the page `box`, from a pointer of `pointer` type (its
 * pointerdown's: WebKit's click may not say): a touch's tap in an outer third
 * turns it.
 */
export function pageTap(
  event: MouseEvent,
  pointer: string,
  box: HTMLElement,
  of: PageKeysOf,
): void {
  // A mouse's click is for choosing words; a reader taps.
  if (pointer !== 'touch') return;
  if (event.target instanceof Element && event.target.closest('a[href], button')) return;
  if (document.getSelection()?.isCollapsed === false) return;
  const { left, width } = box.getBoundingClientRect();
  const across = (event.clientX - left) / width;
  if (across < 1 / 3) of.turn(-1, false);
  else if (across > 2 / 3) of.turn(1, false);
}
