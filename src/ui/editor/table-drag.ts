// A row or column carried by its grip (./table-tools.ts), the drop marker
// where it will land, as your order's drag has it (../list/drag.ts, whose
// distance a press goes before it's a drag this shares). The drag listens on
// the whole document and ends however the press ends: let go, the pointer's
// capture lost, or the browser taking the press for its own drag; so a drop
// is never missed. Only Esc puts it back. Let go before it moved, the press
// was a press: the grip's menu.

import { DRAG_AFTER } from '../list/drag';
import { showMarker } from './table-controls';
import { dropAt, inLayer, type TableGeometry } from './table-geometry';

export interface DragOf {
  readonly event: PointerEvent;
  readonly grip: HTMLElement;
  /** The controls' layer: its drop marker shows where the row or column lands. */
  readonly layer: HTMLElement;
  readonly kind: 'row' | 'column';
  readonly from: number;
  readonly geometry: TableGeometry;
  /** Dropped: the row or column goes to `to` among the others. */
  moved(to: number): void;
  /** Let go where it was pressed. */
  pressed(): void;
  /** Ended any way: Esc, a drop or a press. */
  ended(): void;
}

export function startDrag(of: DragOf): void {
  const { event, grip, layer, kind, geometry: g } = of;
  const id = event.pointerId;
  const start = inLayer(layer, event.clientX, event.clientY);
  const home = {
    x: grip.style.getPropertyValue('--at-x'),
    y: grip.style.getPropertyValue('--at-y'),
  };
  const marker = layer.querySelector<HTMLElement>('.drop-marker');
  let moved = false;
  let to: number | null = null;
  try {
    grip.setPointerCapture(id);
  } catch {
    // A pointer that's gone already: the press ends on its own.
  }

  const move = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    const p = inLayer(layer, e.clientX, e.clientY);
    if (!moved && Math.hypot(p.x - start.x, p.y - start.y) < DRAG_AFTER) return;
    if (!moved) {
      moved = true;
      layer.classList.add('is-dragging');
      grip.classList.add('is-carried', 'is-on');
    }
    // The grip follows the pointer along its row's or column's way.
    grip.style.setProperty(kind === 'row' ? '--at-y' : '--at-x', `${kind === 'row' ? p.y : p.x}px`);
    const at = dropAt(g, kind, of.from, kind === 'row' ? p.y : p.x);
    to = at.to;
    if (marker) showMarker(marker, g, { dir: kind, at: at.to }, at.line);
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
    layer.classList.remove('is-dragging');
    grip.classList.remove('is-carried');
    grip.style.setProperty('--at-x', home.x);
    grip.style.setProperty('--at-y', home.y);
    if (marker) showMarker(marker, g, null);
    if (how === 'up' && !moved) of.pressed();
    if (how !== 'esc' && moved && to !== null) of.moved(to);
    of.ended();
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
