// A pane's edge (spec §4): a hairline between two panes that darkens under
// the pointer, dragged, or stepped with ← → once it has the keyboard. What a
// move does to the widths is ./panes.ts's, and the arithmetic ./pane-state.ts's.

import { h } from '../dom';
import { type Panes, STEP } from './pane-state';

/** A move's start: the widths remembered then, and the pane's width on screen. */
export interface EdgeFrom {
  readonly panes: Panes;
  readonly shown: number;
}

export interface EdgeOf {
  readonly shell: HTMLElement;
  /** The pane's width on screen now. */
  width(): number;
  /** The widths remembered now. */
  panes(): Panes;
  /** Move the edge `by` pixels from where it was at `from`. */
  move(from: EdgeFrom, by: number): void;
  /** Keep the widths on this device. */
  save(): void;
}

/** The edge after `pane` (the sidebar, or the note list). */
export function paneEdge(pane: 'sidebar' | 'list', of: EdgeOf): HTMLElement {
  const edge = h('div', {
    class: `pane-edge pane-edge--${pane}`,
    attrs: {
      role: 'separator',
      tabindex: '0',
      'aria-orientation': 'vertical',
      'aria-label': pane === 'sidebar' ? 'Sidebar width' : 'Note list width',
    },
  });
  edge.addEventListener('pointerdown', (down) => {
    if (down.button !== 0) return;
    down.preventDefault(); // no text selected on the way
    const from = { x: down.clientX, panes: of.panes(), shown: of.width() };
    of.shell.classList.add('is-resizing');
    edge.classList.add('is-dragging');
    // Followed on the document, as a note's drag is (../list/drag.ts): the edge moving out
    // from under the pointer, or its capture lost to another window, doesn't end it.
    // A move with the button up was let go where the window didn't hear it.
    const move = (event: PointerEvent) => {
      if ((event.buttons & 1) === 0) end();
      else of.move(from, event.clientX - from.x);
    };
    // Let go: where it was let go counts, though its last move may have come only with the release.
    const up = (event: PointerEvent) => {
      of.move(from, event.clientX - from.x);
      end();
    };
    const end = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', end);
      of.shell.classList.remove('is-resizing');
      edge.classList.remove('is-dragging');
      of.save();
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', end);
  });
  edge.addEventListener('keydown', (event) => {
    const by = event.key === 'ArrowLeft' ? -STEP : event.key === 'ArrowRight' ? STEP : 0;
    if (by === 0 || event.altKey || event.metaKey || event.ctrlKey) return;
    event.preventDefault();
    of.move({ panes: of.panes(), shown: of.width() }, by);
    of.save();
  });
  return edge;
}
