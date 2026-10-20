// A number asked for in a small floating field, where the menu that asked
// was (a book's word goal): Enter gives it, an empty field gives none (the
// value taken away), Esc or a click elsewhere leaves it as it was.

import { h } from '../dom';
import { float, type Place } from './menu';

export interface NumberAsked {
  /** What's asked, as the field's label: "Word goal for A Mended Scarf". */
  readonly label: string;
  readonly value?: number;
  readonly max: number;
  readonly place: Place;
}

/**
 * A whole number as typed, its thousands marked or not ("90000", "90,000",
 * "90.000", "90 000"); null for anything else. A mark between digits that
 * aren't thousands ("1.5", "62,5") is a decimal, not a whole number.
 */
export function readWhole(typed: string): number | null {
  const trimmed = typed.trim();
  if (!/^(?:\d{1,15}|\d{1,3}(?:[,.'’_ \u00a0\u202f]\d{3}){1,4})$/u.test(trimmed)) return null;
  return Number(trimmed.replace(/\D/gu, ''));
}

/** Resolves with the number, null for none, or undefined when the writer leaves it. */
export function askNumber(asked: NumberAsked): Promise<number | null | undefined> {
  return new Promise((done) => {
    let answered = false;
    const answer = (value: number | null | undefined) => {
      if (answered) return;
      answered = true;
      close();
      done(value);
    };
    const field = h('input', {
      class: 'field',
      attrs: {
        type: 'text',
        inputmode: 'numeric',
        autocomplete: 'off',
        spellcheck: 'false',
        'aria-label': asked.label,
        value: asked.value === undefined ? '' : asked.value.toLocaleString(),
      },
    });
    const panel = h(
      'div',
      { class: 'menu ask', attrs: { role: 'dialog', 'aria-label': asked.label } },
      h('span', { class: 'label', text: asked.label }),
      field,
      h('span', { class: 'ask__hint', text: 'Enter sets it · empty, none · Esc leaves it' }),
    );
    field.addEventListener('input', () => field.removeAttribute('aria-invalid'));
    field.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') answer(undefined);
      else if (event.key === 'Enter') {
        const value = field.value.trim() === '' ? null : readWhole(field.value);
        if (
          value === 0 ||
          (value !== null && value > asked.max) ||
          (value === null && field.value.trim())
        ) {
          field.setAttribute('aria-invalid', 'true');
        } else answer(value);
      } else return;
      event.preventDefault();
      event.stopPropagation();
    });
    // Closed any other way (a click elsewhere, the window left): leave it as it was.
    const close = float(panel, asked.place, () => answer(undefined));
    field.focus();
    field.select();
  });
}
