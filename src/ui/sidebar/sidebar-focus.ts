// Where the keyboard is in the sidebar's tree, kept across its redraws
// (./sidebar.ts): the control that had it has it again; a row that's gone
// (trashed, moved away, or a folder gone to the other section, #40) leaves
// it on the row now in its place; a row asked for (a folder renamed or
// made) takes it, the first of those asked for that's there; and the row it
// was on as the sidebar shut is where it goes back to when it opens.

import { isLensKey } from '../list/book-lenses';
import type { TreeWindows } from './tree-windows';

export class SidebarFocus {
  /** The controls to give the keyboard to after the next redraw, by their data-keys: the first there takes it. */
  asked: readonly string[] | null = null;
  /** The row the keyboard was on as the sidebar shut, by its data-key: `focusTree` goes back to it. */
  #left: string | null = null;
  readonly #body: HTMLElement;
  readonly #windows: TreeWindows;
  readonly #search: HTMLElement;
  /** Whether a name is being typed in the tree (a folder's, a tag's): the keyboard stays there. */
  readonly #editing: () => boolean;

  constructor(
    body: HTMLElement,
    windows: TreeWindows,
    search: HTMLElement,
    editing: () => boolean,
  ) {
    this.#body = body;
    this.#windows = windows;
    this.#search = search;
    this.#editing = editing;
  }

  /**
   * Give the keyboard to the marked row (the selected one, or the open note),
   * or the first; with no rows (a search that found nothing), the first
   * control there, or the search field when it's here.
   */
  focusTree(): void {
    const left = this.#left;
    this.#left = null;
    if (left !== null && this.focusKey(left)) return;
    const rows = this.#shown('.tree-row__name');
    (
      rows.find((row) => row.getAttribute('aria-current') === 'true') ??
      rows[0] ??
      this.#shown('.sidebar__tree button')[0] ??
      this.#search.querySelector<HTMLElement>('input')
    )?.focus();
  }

  /** The sidebar shuts with the keyboard in it: the row it was on is where `focusTree` goes back to. */
  keepPlace(): void {
    const active = document.activeElement;
    this.#left =
      active instanceof HTMLElement && this.#body.contains(active)
        ? (active.dataset.key ?? null)
        : null;
  }

  /**
   * Where the keyboard is, before a redraw; the function returned gives it
   * back after. A redraw mustn't take the keyboard's place: the control that
   * had it has it again; a row that's gone (trashed, moved away) leaves it on
   * the row now in its place.
   */
  hold(): () => void {
    const active = document.activeElement;
    const inBody = active instanceof HTMLElement && this.#body.contains(active);
    const asked = this.asked;
    const own = inBody ? active.dataset.key : undefined;
    const focused = asked ?? (own === undefined ? null : [own]);
    const focusedAt =
      asked === null && inBody ? this.#shown('.tree-row__name').indexOf(active) : -1;
    this.asked = null;
    return () => {
      if (focused === null || this.#editing()) return;
      // Still on the control it was on: rows put right around it, or not touched at all.
      if (asked === null && document.activeElement === active) return;
      // The control it was on, drawn anew where the scroll kept it: given back without a scroll,
      // as a half-hidden row clicked would otherwise jump into sight. One asked for may have moved.
      if (focused.some((key) => this.focusKey(key, asked !== null))) return;
      // A book's lens gone (Found, its search cleared): the lens shown now.
      if (focused.some(isLensKey)) {
        this.#shown('.book-lens[aria-pressed="true"]')[0]?.focus();
        return;
      }
      if (focusedAt < 0) return;
      const rows = this.#shown('.tree-row__name');
      rows[Math.min(focusedAt, rows.length - 1)]?.focus();
    };
  }

  /** Give the keyboard to the control `key` names, if it's in sight or a long list holds it. */
  focusKey(key: string, scroll = true): boolean {
    const same = [...this.#body.querySelectorAll<HTMLElement>('[data-key]')].find(
      (control) => control.dataset.key === key,
    );
    const visible = same?.closest('[hidden]') ? undefined : same;
    // A note's row in a long list may be out of sight, undrawn: its list brings it back.
    if (!visible) return this.#windows.focusKey(key);
    visible.focus({ preventScroll: !scroll });
    return true;
  }

  /** The controls `selector` finds that are in sight: none in a folded section. */
  #shown(selector: string): HTMLElement[] {
    return [...this.#body.querySelectorAll<HTMLElement>(selector)].filter(
      (control) => !control.closest('[hidden]'),
    );
  }
}
