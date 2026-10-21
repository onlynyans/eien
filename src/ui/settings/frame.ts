// Settings' box over the window (./box.ts has the arithmetic): its head
// moves it, its edges and corners resize it, a double-click on the head puts
// it back where it first opens. Its box is kept on this device, as a
// window's would be. On a phone it's a full sheet, and none of this applies.

import { h } from '../dom';
import { icon } from '../icons';
import { NARROW } from '../phone/phone-stack';
import { type Area, type Box, dragged, firstBox, fitted, GRIPS, type Grip, readBox } from './box';

const KEY = 'eien.settingsBox';
/** One arrow key's step for the corner grip, with the keyboard on it (--eien-space-4). */
const STEP = 16;

const phone = matchMedia(NARROW);

export interface Frame {
  /** The grips, to go inside the dialog. */
  readonly grips: readonly HTMLElement[];
  /** Lay the box out for the window as it is now: on opening, and as the window changes. */
  place(): void;
  /** Whether a drag ended this pointer's press: its click isn't a click outside. */
  readonly dragging: boolean;
}

function remembered(): Box | null {
  try {
    return readBox(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

function remember(box: Box | null): void {
  try {
    if (box) localStorage.setItem(KEY, JSON.stringify(box));
    else localStorage.removeItem(KEY);
  } catch {
    // The window's storage refused: the box is kept until the window closes.
  }
}

const areaNow = (): Area => ({
  w: document.documentElement.clientWidth,
  h: document.documentElement.clientHeight,
});

export function frame(dialog: HTMLDialogElement, head: HTMLElement): Frame {
  let box: Box | null = remembered();
  let dragging = false;

  const draw = (shown: Box | null) => {
    for (const side of ['left', 'top', 'width', 'height'] as const) {
      dialog.style.removeProperty(side);
    }
    dialog.toggleAttribute('data-placed', shown !== null);
    if (!shown) return;
    dialog.style.setProperty('left', `${shown.x}px`);
    dialog.style.setProperty('top', `${shown.y}px`);
    dialog.style.setProperty('width', `${shown.w}px`);
    dialog.style.setProperty('height', `${shown.h}px`);
  };
  const place = () => draw(phone.matches ? null : fitted(box ?? firstBox(areaNow()), areaNow()));
  const now = (): Box => fitted(box ?? firstBox(areaNow()), areaNow());
  const keep = (next: Box) => {
    box = next;
    draw(next);
  };

  const drag = (event: PointerEvent, grip: Grip) => {
    // A press on a control in the head is the control's; only the primary button drags.
    if (phone.matches || event.button !== 0) return;
    if (grip === 'move' && (event.target as Element).closest('button, input')) return;
    event.preventDefault();
    const start = now();
    const [x0, y0] = [event.clientX, event.clientY];
    const held = event.currentTarget as HTMLElement;
    held.setPointerCapture(event.pointerId);
    dialog.dataset.moving = grip;
    dragging = true;
    const move = (at: PointerEvent) =>
      keep(dragged(start, grip, at.clientX - x0, at.clientY - y0, areaNow()));
    const done = () => {
      held.removeEventListener('pointermove', move);
      delete dialog.dataset.moving;
      remember(box);
      // The click this press makes comes after; it's the drag's, not a click outside.
      setTimeout(() => {
        dragging = false;
      });
    };
    held.addEventListener('pointermove', move);
    held.addEventListener('lostpointercapture', done, { once: true });
  };

  head.addEventListener('pointerdown', (event) => drag(event, 'move'));
  head.addEventListener('dblclick', (event) => {
    if (phone.matches || (event.target as Element).closest('button, input')) return;
    box = null;
    remember(null);
    place();
  });

  const grips = GRIPS.map((grip) => {
    const element = h('span', {
      class: `settings__grip settings__grip--${grip}`,
      attrs: { 'data-grip': grip, 'aria-hidden': 'true' },
    });
    element.addEventListener('pointerdown', (event) => drag(event, grip));
    return element;
  });
  // The corner takes the keyboard too: its arrows resize, as a pane's edge does.
  const corner = grips.find((grip) => grip.dataset.grip === 'se') as HTMLElement;
  corner.append(icon('resize'));
  corner.removeAttribute('aria-hidden');
  corner.tabIndex = 0;
  corner.setAttribute('role', 'button');
  corner.setAttribute('aria-label', 'Resize settings');
  corner.title = 'Resize: the arrow keys';
  corner.addEventListener('keydown', (event) => {
    const by = {
      ArrowLeft: [-STEP, 0],
      ArrowRight: [STEP, 0],
      ArrowUp: [0, -STEP],
      ArrowDown: [0, STEP],
    }[event.key];
    if (!by || phone.matches) return;
    event.preventDefault();
    keep(dragged(now(), 'se', by[0] as number, by[1] as number, areaNow()));
    remember(box);
  });

  addEventListener('resize', () => {
    if (dialog.open) place();
  });
  phone.addEventListener('change', () => {
    if (dialog.open) place();
  });

  return {
    grips,
    place,
    get dragging() {
      return dragging;
    },
  };
}
