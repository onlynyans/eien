// Dragging a note (spec §4): onto a folder in the sidebar to move it there,
// or, in a folder's own order, between the list's rows to place it. The row
// lifts off the paper and follows the pointer; a hairline marks where it
// will go (docs/design). Esc puts it back. The keyboard has the same moves:
// the row's menu, and Alt+↑/↓.

export interface DragActions {
  /** Whether the rows are in a folder's own order, so one can be placed between others. */
  orderable(): boolean;
  /** Move the note at `path` into `folder` ("" for the vault itself). */
  moveTo(path: string, folder: string): void;
  /** Place the note at `path` just before the note at `before` (last, for null). */
  placeBefore(path: string, before: string | null): void;
}

/** How far the pointer goes before a press becomes a drag, in pixels. */
const DRAG_AFTER = 5;

type Drop = { readonly folder: string } | { readonly before: string | null };

/**
 * Let `list`'s rows (`rows`: the note list's, or the sidebar tree's notes)
 * be dragged onto `[data-folder]` targets anywhere, or between each other:
 * above or below a row, or, for cards laid out `across` (the outline's),
 * before or after one.
 */
export function watchDrags(
  list: HTMLElement,
  actions: DragActions,
  rows = '.note-row[data-path]',
  across = false,
): void {
  /** A drag ends in a click on the row it started from; that click isn't the writer's. */
  let swallowClick = false;
  list.addEventListener(
    'click',
    (event) => {
      if (!swallowClick) return;
      swallowClick = false;
      event.preventDefault();
      event.stopPropagation();
    },
    true,
  );

  list.addEventListener('pointerdown', (down) => {
    if (down.button !== 0 || down.altKey || down.metaKey || down.ctrlKey || down.shiftKey) return;
    const row = (down.target as Element).closest<HTMLElement>(rows);
    const path = row?.dataset.path;
    if (!row || path === undefined) return;

    let lifted: HTMLElement | null = null;
    let marker: HTMLElement | null = null;
    let drop: Drop | null = null;
    let lit: Element | null = null;

    const light = (target: Element | null) => {
      lit?.classList.remove('is-drop-target');
      lit = target;
      lit?.classList.add('is-drop-target');
    };
    /** The hairline where the row will go: along `rect`'s edge at `at` (across, down its side). */
    const mark = (at: number | null, rect?: DOMRect) => {
      if (at === null || !rect) {
        marker?.remove();
        marker = null;
        return;
      }
      marker ??= document.body.appendChild(
        Object.assign(document.createElement('div'), {
          className: across ? 'drop-marker drop-marker--across' : 'drop-marker',
        }),
      );
      marker.style.setProperty('--marker-x', `${across ? at : rect.left}px`);
      marker.style.setProperty('--marker-y', `${across ? rect.top : at}px`);
      marker.style.setProperty('--marker-w', `${rect.width}px`);
      marker.style.setProperty('--marker-h', `${rect.height}px`);
    };

    const move = (event: PointerEvent) => {
      if (!lifted) {
        if (Math.hypot(event.clientX - down.clientX, event.clientY - down.clientY) < DRAG_AFTER)
          return;
        const rect = row.getBoundingClientRect();
        lifted = row.cloneNode(true) as HTMLElement;
        lifted.classList.add('is-lifted');
        lifted.removeAttribute('data-path');
        lifted.removeAttribute('data-key'); // a copy: the keyboard never goes back to it
        lifted.setAttribute('aria-hidden', 'true');
        lifted.style.setProperty('--drag-w', `${rect.width}px`);
        lifted.style.setProperty('--drag-dx', `${rect.left - down.clientX}px`);
        lifted.style.setProperty('--drag-dy', `${rect.top - down.clientY}px`);
        // Inside the list, so it keeps a row's own look (a book's columns); fixed to the pointer.
        (row.closest('ul') ?? document.body).append(lifted);
        list.classList.add('is-dragging');
        row.classList.add('is-left');
      }
      // A redraw mid-drag (a change on disk, news fading) takes the lifted row out with the rows.
      if (!lifted.isConnected) (list.querySelector('ul') ?? document.body).append(lifted);
      lifted.style.setProperty('--drag-x', `${event.clientX}px`);
      lifted.style.setProperty('--drag-y', `${event.clientY}px`);

      const under = document.elementFromPoint(event.clientX, event.clientY);
      const folder = under?.closest<HTMLElement>('[data-folder]');
      if (folder?.dataset.folder !== undefined) {
        drop = { folder: folder.dataset.folder };
        light(folder);
        mark(null);
        return;
      }
      light(null);
      const over = under?.closest<HTMLElement>(rows);
      if (actions.orderable() && over && list.contains(over)) {
        const rect = over.getBoundingClientRect();
        const after = across
          ? event.clientX > rect.left + rect.width / 2
          : event.clientY > rect.top + rect.height / 2;
        const next = after
          ? (over.closest('li')?.nextElementSibling?.querySelector<HTMLElement>(rows) ?? null)
          : over;
        drop = { before: next?.dataset.path ?? null };
        if (across) mark(after ? rect.right : rect.left, rect);
        else mark(after ? rect.bottom : rect.top, rect);
        return;
      }
      drop = null;
      mark(null);
    };

    const finish = (commit: boolean) => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', cancel);
      document.removeEventListener('keydown', key, true);
      light(null);
      mark(null);
      list.classList.remove('is-dragging');
      row.classList.remove('is-left');
      if (!lifted) return;
      lifted.remove();
      swallowClick = true;
      setTimeout(() => {
        swallowClick = false; // in case no click came
      }, 0);
      const target = drop;
      if (!commit || !target) return;
      if ('folder' in target) actions.moveTo(path, target.folder);
      else if (target.before !== path) actions.placeBefore(path, target.before);
    };
    // Where it was let go counts, though its last move may have come only with the release.
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
