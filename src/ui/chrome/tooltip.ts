// A control's tooltip (system.md, "Tooltip"): raised paper, its words in the
// machine voice and its key after them in pencil, after a short hover, or at
// once when the keyboard reaches it. One for the window, placed under the
// control (over it near the window's foot) and kept inside the window. It
// says what the control's name and aria-keyshortcuts already say, so screen
// readers skip it. Typing takes it away: nothing interrupts the writer.

import { h } from '../dom';

/** As long as a pointer rests before the tooltip shows. */
const HOVER_MS = 450;
const GAP = 6;

export function watchTooltips(root: Document = document): () => void {
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

  const hide = () => {
    clearTimeout(timer);
    tip.hidden = true;
    shownFor = null;
  };
  const show = (control: HTMLElement) => {
    if (!control.isConnected || !control.checkVisibility({ opacityProperty: true })) return;
    shownFor = control;
    words.textContent = control.dataset.tip ?? '';
    key.textContent = control.dataset.key ?? '';
    tip.hidden = false;
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
  root.addEventListener('pointerover', over);
  root.addEventListener('focusin', focused);
  root.addEventListener('focusout', hide);
  root.addEventListener('pointerdown', hide, true);
  root.addEventListener('keydown', hide, true);
  root.addEventListener('scroll', hide, true);
  return () => {
    hide();
    tip.remove();
    root.removeEventListener('pointerover', over);
    root.removeEventListener('focusin', focused);
    root.removeEventListener('focusout', hide);
    root.removeEventListener('pointerdown', hide, true);
    root.removeEventListener('keydown', hide, true);
    root.removeEventListener('scroll', hide, true);
  };
}
