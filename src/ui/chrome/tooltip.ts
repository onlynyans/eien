// A control's tooltip (system.md, "Tooltip"): raised paper, its words in the
// machine voice and its key after them in pencil, after a short hover, or at
// once when the keyboard reaches it. One for the window, placed under the
// control (over it near the window's foot) and kept inside the window. It
// says what the control's name and aria-keyshortcuts already say, so screen
// readers skip it. Typing takes it away: nothing interrupts the writer.
// It listens on the hosts alone, never the whole document: a pointer
// listener there makes the browser find what's under the pointer each time a
// redraw changes it, and six thousand rows redrawn become one long task.

import { h } from '../dom';

/** As long as a pointer rests before the tooltip shows. */
const HOVER_MS = 450;
const GAP = 6;

export interface Tooltips {
  /** Show the tooltips of the controls in `area` (a host). */
  watch(area: HTMLElement): void;
  stop(): void;
}

export function tooltips(root: Document = document): Tooltips {
  const words = h('span', { class: 'tooltip__words' });
  const key = h('span', { class: 'tooltip__key' });
  const tip = h(
    'div',
    { class: 'tooltip', attrs: { 'aria-hidden': 'true', hidden: true } },
    words,
    key,
  );
  root.body.append(tip);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let shownFor: HTMLElement | null = null;

  // Listened for on the whole document only while a tooltip shows: a press, a key or a scroll anywhere hides it.
  const AWAY = ['pointerdown', 'keydown', 'scroll'] as const;
  const hide = () => {
    clearTimeout(timer);
    shownFor = null;
    if (tip.hidden) return;
    tip.hidden = true;
    for (const type of AWAY) root.removeEventListener(type, hide, true);
  };
  const show = (control: HTMLElement) => {
    // A control faded in by the focus itself is still at nothing: its place counts, not its ink.
    if (!control.isConnected || !control.checkVisibility()) return;
    shownFor = control;
    words.textContent = control.dataset.tip ?? '';
    key.textContent = control.dataset.shortcut ?? '';
    tip.hidden = false;
    for (const type of AWAY) root.addEventListener(type, hide, true);
    const at = control.getBoundingClientRect();
    const box = tip.getBoundingClientRect();
    const below = at.bottom + GAP + box.height <= window.innerHeight;
    const left = Math.min(
      Math.max(GAP, at.left + at.width / 2 - box.width / 2),
      window.innerWidth - box.width - GAP,
    );
    tip.style.setProperty('--tip-x', `${left}px`);
    tip.style.setProperty('--tip-y', `${below ? at.bottom + GAP : at.top - GAP - box.height}px`);
  };
  const controlOf = (target: EventTarget | null) =>
    target instanceof Element ? target.closest<HTMLElement>('[data-tip]') : null;

  const over = (event: PointerEvent) => {
    const control = controlOf(event.target);
    if (control === shownFor) return;
    hide();
    if (control && event.pointerType === 'mouse') timer = setTimeout(() => show(control), HOVER_MS);
  };
  const focused = (event: FocusEvent) => {
    hide();
    const control = controlOf(event.target);
    if (control?.matches(':focus-visible')) show(control);
  };
  return {
    watch(area) {
      area.addEventListener('pointerover', over);
      area.addEventListener('pointerleave', hide);
      area.addEventListener('focusin', focused);
      area.addEventListener('focusout', hide);
    },
    stop() {
      hide();
      tip.remove();
    },
  };
}
