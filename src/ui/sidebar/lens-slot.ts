// With two panes the tree lists the notes, and the chosen row's lens (its
// sort and tag filter, ../list/lens-bar.ts) is in the sidebar (backlog #33):
// its quiet icons at the end of the search field's row, and its chips under
// that while a lens is on. No head of its own: the chosen row says what it's
// on, and the icons' group says so to a screen reader. A redraw keeps the
// keyboard on the control it was on; a chip's × goes with its chip, so it
// goes to the filter.

export interface SlotLens {
  /** The chosen row's name. */
  readonly name: string;
  readonly controls: readonly HTMLElement[];
  readonly chips: HTMLElement | null;
}

/** Where the lens draws: its icons, on the search field's row, and its chips, under it. */
export interface LensSlot {
  readonly tools: HTMLElement;
  readonly chips: HTMLElement;
}

/** The group's name: what its icons act on. */
export const lensToolsLabel = (name: string) => `Sort and filter ${name}`;

/** Draw `lens` in `slot`, or hide it for none (three panes, or a search). */
export function drawLensSlot(slot: LensSlot, lens: SlotLens | null): void {
  const active = document.activeElement;
  const inSlot =
    active instanceof HTMLElement && (slot.tools.contains(active) || slot.chips.contains(active));
  const had = inSlot
    ? (active.dataset.key ?? (active.closest('.list__lens') ? 'lens-filter:tree' : null))
    : null;
  slot.tools.hidden = lens === null;
  slot.tools.replaceChildren(...(lens?.controls ?? []));
  if (lens) slot.tools.setAttribute('aria-label', lensToolsLabel(lens.name));
  else slot.tools.removeAttribute('aria-label');
  slot.chips.hidden = !lens?.chips;
  slot.chips.replaceChildren(...(lens?.chips ? [lens.chips] : []));
  if (!had) return;
  const back = `[data-key="${CSS.escape(had)}"]`;
  (
    slot.tools.querySelector<HTMLElement>(back) ?? slot.chips.querySelector<HTMLElement>(back)
  )?.focus();
}
