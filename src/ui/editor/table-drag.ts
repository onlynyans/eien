// A row or column carried by its grip (./table-tools.ts), with the drop line
// where it will land, as your order's drag has it. The drag listens on the
// whole document and ends however the press ends: let go, the pointer's
// capture lost, or the browser taking the press for its own drag; so a drop
// is never missed. Only Esc puts it back. Let go before it moved, the press
// was a press: the grip's menu.

import type { EditorView } from '@codemirror/view';
import { dropAt, type TableGeometry } from './table-geometry';

/** How far the pointer goes before a press is a drag. */
const SLOP = 4;

export interface DragOf {
  readonly view: EditorView;
  readonly event: PointerEvent;
  readonly grip: HTMLElement;
  /** The drop line: 2px, across or down the table. */
  readonly drop: HTMLElement;
  readonly kind: 'row' | 'column';
  readonly from: number;
  readonly geometry: TableGeometry;
  /** A drag began (true) or ended (false). */
  dragging(on: boolean): void;
  /** Dropped: the row or column goes to `to` among the others. */
  moved(to: number): void;
  /** Let go where it was pressed. */
  pressed(): void;
}

export function startDrag(of: DragOf): void {
  const { event, grip, drop, kind, geometry: g } = of;
  const id = event.pointerId;
  const start = { x: event.clientX, y: event.clientY };
  const box = of.view.dom.getBoundingClientRect();
  let moved = false;
  let to: number | null = null;
  try {
    grip.setPointerCapture(id);
  } catch {
    // A pointer that's gone already: the press ends on its own.
  }

  const move = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!moved && Math.hypot(dx, dy) < SLOP) return;
    if (!moved) {
      moved = true;
      of.dragging(true);
      grip.classList.add('is-carried');
    }
    grip.style.translate =
      kind === 'row' ? `-50% calc(-50% + ${dy}px)` : `calc(-50% + ${dx}px) -50%`;
    const at = dropAt(
      g,
      kind,
      of.from,
      kind === 'row' ? e.clientY - box.top : e.clientX - box.left,
    );
    to = at.to;
    Object.assign(
      drop.style,
      kind === 'row'
        ? {
            left: `${g.left}px`,
            top: `${at.line - 1}px`,
            width: `${g.right - g.left}px`,
            height: '2px',
          }
        : {
            left: `${at.line - 1}px`,
            top: `${g.top}px`,
            width: '2px',
            height: `${g.bottom - g.top}px`,
          },
    );
    drop.classList.add('is-on');
  };

  const end = (how: 'up' | 'lost' | 'esc') => {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    document.removeEventListener('pointercancel', lost);
    grip.removeEventListener('lostpointercapture', lost);
    document.removeEventListener('dragstart', noDrag);
    document.removeEventListener('keydown', esc, true);
    try {
      grip.releasePointerCapture(id);
    } catch {
      // Released already.
    }
    drop.classList.remove('is-on');
    grip.classList.remove('is-carried');
    grip.style.translate = '';
    if (moved) of.dragging(false);
    if (how === 'esc') {
      of.view.focus();
      return;
    }
    if (!moved) {
      if (how === 'up') of.pressed();
      return;
    }
    if (to !== null) of.moved(to);
  };
  const up = (e: PointerEvent) => {
    if (e.pointerId === id) end('up');
  };
  const lost = (e: PointerEvent) => {
    if (e.pointerId === id) end(moved ? 'up' : 'lost');
  };
  const noDrag = (e: DragEvent) => e.preventDefault();
  const esc = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    end('esc');
  };
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
  document.addEventListener('pointercancel', lost);
  grip.addEventListener('lostpointercapture', lost);
  document.addEventListener('dragstart', noDrag);
  document.addEventListener('keydown', esc, true);
}
