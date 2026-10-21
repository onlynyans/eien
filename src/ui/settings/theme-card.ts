// A theme as a card (system.md, "Themes"): its desk, its paper with the ink
// on it by day, its paper and seal by night; then its name, its kanji and a
// note. The Gallery and Custom tabs both draw them, from a palette.

import type { Palette } from '../../core/themes';
import { h } from '../dom';

export interface CardOf {
  readonly name: string;
  readonly kanji?: string;
  readonly note: string;
  /** Null for a theme whose colours can't be worked out (a file that isn't one). */
  readonly palette: Palette | null;
  /** The palette setting's value it wears. */
  readonly value: string;
}

/** Colours as CSSOM properties: the security policy refuses style attributes. */
const painted = (element: HTMLElement, color: string | undefined) => {
  if (color) element.style.setProperty('background', color);
  return element;
};

/** The card's strip of colours, drawn again as a mix changes. */
export function paintSwatch(swatch: HTMLElement, palette: Palette | null): void {
  const at = (role: keyof Palette, scheme: 0 | 1) => palette?.[role][scheme];
  const chip = (color: string | undefined, mark?: HTMLElement) => painted(h('i', {}, mark), color);
  swatch.replaceChildren(
    chip(at('desk', 0)),
    chip(at('paper', 0), painted(h('span', { class: 'theme__ink' }), at('ink', 0))),
    chip(at('paper', 1), painted(h('span', { class: 'theme__dot' }), at('seal', 1))),
  );
}

export function themeCard(of: CardOf, choose: () => void): HTMLButtonElement {
  const swatch = h('span', { class: 'theme__sw', attrs: { 'aria-hidden': 'true' } });
  paintSwatch(swatch, of.palette);
  return h(
    'button',
    {
      class: 'theme',
      attrs: { type: 'button', 'data-value': of.value, 'aria-label': of.name },
      on: { click: choose },
    },
    swatch,
    h(
      'span',
      { class: 'theme__title' },
      h('span', { class: 'theme__name', text: of.name }),
      of.kanji ? h('span', { class: 'theme__kanji', text: of.kanji }) : null,
    ),
    h('span', { class: 'label theme__note', text: of.note }),
  );
}

/** Mark the card worn, given the palette's value. */
export function markWorn(cards: Iterable<HTMLElement>, value: string): void {
  for (const card of cards) card.setAttribute('aria-pressed', String(card.dataset.value === value));
}
