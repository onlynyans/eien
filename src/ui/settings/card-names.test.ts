// A card is called what it shows as its name (WCAG 2.5.3, label in name):
// a face card by its face's name, its sample left out; a theme card by its
// theme's, its note telling more after it. axe's label-content-name-mismatch
// found both, in the extension's popup, which draws them as Settings does.

import { describe, expect, it } from 'vitest';
import { type Setting, settingOf } from '../../core/config';
import { PAPER } from '../../core/themes';
import { settingRow } from './controls';
import { themeCard } from './theme-card';

/** The words `element` shows a screen reader: what's hidden from one is left out. */
function shownWords(element: Element): string {
  const words = (node: Node): string =>
    node instanceof Element
      ? node.getAttribute('aria-hidden') === 'true'
        ? ''
        : [...node.childNodes].map(words).join(' ')
      : (node.textContent ?? '');
  return words(element).replace(/\s+/gu, ' ').trim();
}

/** Its name, and the words it shows: the rule is that the one holds the other. */
const named = (element: Element) => ({
  name: element.getAttribute('aria-label') ?? shownWords(element),
  shown: shownWords(element),
});

describe('cards are called what they show', () => {
  it('a face card, by its face’s name', () => {
    const row = settingRow(settingOf('appearance.face') as Setting, () => {});
    const card = row.element.querySelector('[data-value="literata"]');
    expect(card && named(card)).toEqual({ name: 'Literata', shown: 'Literata' });
  });

  it('a theme card, by its theme’s name, described by its note', () => {
    const card = themeCard(
      { name: PAPER.name, note: PAPER.note, palette: PAPER.palette, value: PAPER.id },
      () => {},
    );
    document.body.append(card);
    expect(named(card)).toEqual({ name: 'Paper', shown: 'Paper' });
    const note = document.getElementById(card.getAttribute('aria-describedby') ?? '');
    expect(note?.textContent).toBe(PAPER.note);
  });
});
