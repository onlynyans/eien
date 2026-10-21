// The sidebar's sections, a contents page's part titles. LIBRARY, FOLDERS
// and TAGS fold from their labels (the mockup's `.section__label`): a button
// the row's height, its twisty in sight on hover, focus, or while folded.
// Which are folded is this device's (./folds.ts). A search's results have a
// plain label, and don't fold.

import { h } from '../dom';
import type { Folds, SectionId } from './folds';
import { twisty } from './tree';

/** A section: its head (the label, and a control beside it), then its rows. */
const part = (head: HTMLElement, control: HTMLElement | undefined, tree: HTMLElement) =>
  h(
    'section',
    { class: 'sidebar__part' },
    h('div', { class: 'sidebar__section' }, head, control),
    tree,
  );

/** A section that folds from its label; none at all with no rows and no control. */
export function foldingSection(
  id: SectionId,
  label: string,
  rows: HTMLElement[],
  folds: Folds,
  control?: HTMLElement,
): HTMLElement[] {
  if (rows.length === 0 && !control) return [];
  const treeId = `sidebar-${id}`;
  const tree = h('ul', { class: 'tree', attrs: { id: treeId, hidden: folds.has(id) } }, ...rows);
  // Folded in place, not redrawn: the twisty turns, and the rows stay as they were.
  const button: HTMLButtonElement = h(
    'button',
    {
      class: 'section__label',
      attrs: {
        type: 'button',
        'aria-expanded': String(!folds.has(id)),
        'aria-controls': treeId,
        'data-key': `section:${id}`,
      },
      on: {
        click: () => {
          const folded = !folds.has(id);
          folds.set(id, folded);
          // A fold never leaves the keyboard on a row it hides: the label takes it.
          if (folded && tree.contains(document.activeElement)) button.focus();
          button.setAttribute('aria-expanded', String(!folded));
          tree.hidden = folded;
        },
      },
    },
    h('span', { class: 'sidebar__label', text: label }),
    twisty(),
  );
  return [part(button, control, tree)];
}

/** A section that doesn't fold: a search's results. */
export const plainSection = (label: string, rows: HTMLElement[], control?: HTMLElement) =>
  part(
    h('p', { class: 'label sidebar__label', text: label }),
    control,
    h('ul', { class: 'tree' }, ...rows),
  );
