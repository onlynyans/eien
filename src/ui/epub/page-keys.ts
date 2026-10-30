// A book's page in pages turned by the keyboard and a tap (#40, Phase 3b):
// the arrow keys, Space and Page Up and Down a page on or back, Home and End
// the chapter's ends, and on a touch screen a tap in the page's outer thirds.
// Never a button's own Space or Enter (no turn twice), a link's, nor a tap
// ending a selection (Quote and Copy need one).

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

/** In pages, a key on the page: a turn, if it's one of a page's. */
export function pageKey(event: KeyboardEvent, of: PageKeysOf): void {
  if (event.target instanceof Element && event.target.closest('button, a[href]')) return;
  if (event.shiftKey && event.key !== ' ') return;
  const way = PAGE_KEYS[event.key === ' ' && event.shiftKey ? 'Shift+Space' : event.key];
  if (way === undefined) return;
  event.preventDefault();
  if (way === 'first' || way === 'last') of.edge(way === 'last');
  else of.turn(way, event.repeat);
}

/** In pages, a click on the page `box`: a touch's tap in an outer third turns it. */
export function pageTap(event: MouseEvent, box: HTMLElement, of: PageKeysOf): void {
  // A pointer's click is for choosing words; a reader taps.
  if (!(event instanceof PointerEvent) || event.pointerType !== 'touch') return;
  if (event.target instanceof Element && event.target.closest('a[href], button')) return;
  if (document.getSelection()?.isCollapsed === false) return;
  const { left, width } = box.getBoundingClientRect();
  const across = (event.clientX - left) / width;
  if (across < 1 / 3) of.turn(-1, false);
  else if (across > 2 / 3) of.turn(1, false);
}
