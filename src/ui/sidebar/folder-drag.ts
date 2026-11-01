// Dragging a folder in the sidebar's tree (backlog #12, docs/design/
// explorations/order.md): onto another folder, it goes inside; above or
// below one, it's placed there, in that folder's folder; onto the vault's
// name, to the top; to the left of its own row, out of the folder it's in.
// It lifts and leaves a faint mark as a note's row does (../list/drag.ts);
// Esc puts it back. The keys do the same: ⌥↑ ⌥↓ ⌥← ⌥→.

import { isInside, parentOf } from '../../core/paths';
import type { FolderDrop } from '../vault/folder-order';

/** How far the pointer goes before a press becomes a drag, in pixels. */
const DRAG_AFTER = 5;
/** The share of a folder's row, at its top and at its foot, that places beside rather than inside. */
const EDGE = 0.25;

const FOLDER = '.tree-row__name[data-folder]';

/** Watch `tree` for folders dragged; `allowed` says whether they drag now (not in Arrange mode). */
export function watchFolderDrags(
  tree: HTMLElement,
  drop: (path: string, to: FolderDrop) => void,
  allowed: () => boolean = () => true,
): void {
  let swallowClick = false;
  tree.addEventListener(
    'click',
    (event) => {
      if (!swallowClick) return;
      swallowClick = false;
      event.preventDefault();
      event.stopPropagation();
    },
    true,
  );

  tree.addEventListener('pointerdown', (down) => {
    swallowClick = false;
    if (down.button !== 0 || down.altKey || down.metaKey || down.ctrlKey || down.shiftKey) return;
    if (down.pointerType === 'touch') return; // on a phone, a folder moves by its menu
    if (!allowed()) return;
    const row = (down.target as Element).closest<HTMLElement>(FOLDER);
    const path = row?.dataset.folder;
    if (!row || !path) return;

    let lifted: HTMLElement | null = null;
    let marker: HTMLElement | null = null;
    let lit: Element | null = null;
    let target: FolderDrop | null = null;

    const light = (element: Element | null) => {
      lit?.classList.remove('is-drop-target');
      lit = element;
      lit?.classList.add('is-drop-target');
    };
    const mark = (y: number | null, rect?: DOMRect) => {
      if (y === null || !rect) {
        marker?.remove();
        marker = null;
        return;
      }
      marker ??= document.body.appendChild(
        Object.assign(document.createElement('div'), { className: 'drop-marker' }),
      );
      marker.style.setProperty('--marker-x', `${rect.left}px`);
      marker.style.setProperty('--marker-y', `${y}px`);
      marker.style.setProperty('--marker-w', `${rect.width}px`);
    };

    const move = (event: PointerEvent) => {
      if (!lifted) {
        if (Math.hypot(event.clientX - down.clientX, event.clientY - down.clientY) < DRAG_AFTER)
          return;
        const rect = row.getBoundingClientRect();
        lifted = row.cloneNode(true) as HTMLElement;
        lifted.classList.add('is-lifted');
        for (const attribute of ['data-folder', 'data-key', 'aria-current'])
          lifted.removeAttribute(attribute);
        lifted.setAttribute('aria-hidden', 'true');
        lifted.style.setProperty('--drag-w', `${rect.width}px`);
        lifted.style.setProperty('--drag-dx', `${rect.left - down.clientX}px`);
        lifted.style.setProperty('--drag-dy', `${rect.top - down.clientY}px`);
        document.body.append(lifted);
        tree.closest('.sidebar')?.classList.add('is-dragging');
        row.classList.add('is-left');
      }
      lifted.style.setProperty('--drag-x', `${event.clientX}px`);
      lifted.style.setProperty('--drag-y', `${event.clientY}px`);

      const under = document.elementFromPoint(event.clientX, event.clientY);
      const over = under?.closest<HTMLElement>(`${FOLDER}, .sidebar__vault[data-folder=""]`);
      const at = over?.dataset.folder;
      target = null;
      light(null);
      mark(null);
      if (over === undefined || over === null || at === undefined) return;
      if (at === '') {
        // The vault's name: to the top, where it isn't already.
        if (parentOf(path) !== '') {
          target = { into: '' };
          light(over);
        }
        return;
      }
      const rect = over.getBoundingClientRect();
      if (over === row || over.dataset.key === row.dataset.key) {
        // Its own row: to the left of its name, out of the folder it's in.
        const label = over.querySelector('.tree-row__label')?.getBoundingClientRect();
        if (parentOf(path) !== '' && label && event.clientX < label.left - 8) {
          target = { out: true };
          mark(rect.top + rect.height / 2, rect);
        }
        return;
      }
      if (isInside(at, path)) return; // never into itself
      const y = (event.clientY - rect.top) / rect.height;
      if (y < EDGE) {
        target = { before: at };
        mark(rect.top, rect);
      } else if (y > 1 - EDGE) {
        target = { after: at };
        mark(rect.bottom, rect);
      } else if (parentOf(path) !== at) {
        target = { into: at };
        light(over);
      }
    };

    const finish = (commit: boolean) => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', cancel);
      document.removeEventListener('keydown', key, true);
      light(null);
      mark(null);
      tree.closest('.sidebar')?.classList.remove('is-dragging');
      row.classList.remove('is-left');
      if (!lifted) return;
      lifted.remove();
      swallowClick = true;
      setTimeout(() => {
        swallowClick = false;
      }, 0);
      if (commit && target) drop(path, target);
    };
    const up = (event: PointerEvent) => {
      if (lifted) move(event);
      finish(true);
    };
    const cancel = () => finish(false);
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !lifted) return;
      event.preventDefault();
      event.stopPropagation();
      finish(false);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', cancel);
    document.addEventListener('keydown', key, true);
  });
}
