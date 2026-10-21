// With two panes the tree lists the notes, and the chosen row's lens (its
// sort and tag filter, ../list/lens-bar.ts) sits in the sidebar under the
// search field (backlog #33). A redraw keeps the keyboard on the control it
// was on; a chip's × goes with its chip, so it goes to the filter.

import { h } from '../dom';

export interface SlotLens {
  /** The chosen row's name. */
  readonly name: string;
  readonly controls: readonly HTMLElement[];
  readonly chips: HTMLElement | null;
}

/** Draw `lens` in `slot`, or hide the slot for none (three panes, or a search). */
export function drawLensSlot(slot: HTMLElement, lens: SlotLens | null): void {
  const active = document.activeElement;
  const had =
    active instanceof HTMLElement && slot.contains(active)
      ? (active.dataset.key ?? (active.closest('.list__lens') ? 'lens-filter:tree' : null))
      : null;
  slot.hidden = lens === null;
  slot.replaceChildren(
    ...(lens
      ? [
          h(
            'div',
            { class: 'sidebar__lens-head' },
            h('span', { class: 'label sidebar__lens-name', text: lens.name }),
            h('span', { class: 'list__tools' }, ...lens.controls),
          ),
          ...(lens.chips ? [lens.chips] : []),
        ]
      : []),
  );
  if (had) slot.querySelector<HTMLElement>(`[data-key="${CSS.escape(had)}"]`)?.focus();
}
