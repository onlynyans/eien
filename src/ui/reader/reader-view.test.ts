import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, withDefaults } from '../../core/config';
import type { Story } from '../../core/reader';
import { type ReaderActions, readerView } from './reader-view';

const STORY: Story = {
  site: 'ffn',
  id: 'ffn:42',
  title: 'Lantern',
  authors: ['Wren'],
  fandoms: [],
  summary: '',
  notes: '',
  endNotes: '',
  facts: [],
  chapters: [
    { number: 2, title: '', summary: '', notes: '', body: '<p>A light.</p>', endNotes: '' },
  ],
  chapterCount: 2,
  previous: true,
  next: false,
};

function shown() {
  const actions: ReaderActions = { turn: vi.fn(), scheme: vi.fn(), left: vi.fn() };
  const view = readerView(document.body, actions);
  view.settings(DEFAULT_SETTINGS);
  view.show(STORY, null);
  return { actions, view };
}

const press = (key: string) =>
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
const button = (name: string) =>
  document.querySelector<HTMLButtonElement>(`.reader__bar button[aria-label^="${name}"]`);

beforeEach(() => {
  document.body.replaceChildren();
  // happy-dom has no media queries to match: the system's scheme is day.
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
});

describe('readerView', () => {
  it('turns with the keys, only to chapters there are', () => {
    const { actions } = shown();
    press('ArrowLeft');
    press('ArrowRight');
    press('Escape');
    expect(vi.mocked(actions.turn).mock.calls).toEqual([
      [{ to: 'previous' }],
      [{ to: 'original' }],
    ]);
    expect(button('Next chapter')?.disabled).toBe(true);
  });

  it('says the words and the chapter in the colophon, and the site in the band', () => {
    shown();
    expect(document.querySelector('.reader__colophon')?.textContent).toContain('2 words');
    expect(document.querySelector('.reader__colophon')?.textContent).toContain('Chapter ii of 2');
    expect(document.querySelector('.reader__mark')?.textContent).toContain('FanFiction.Net');
    expect(document.title).toBe('Lantern · Eien');
  });

  it('turns day to night and back, as the setting', () => {
    const { actions, view } = shown();
    button('Night')?.click();
    expect(actions.scheme).toHaveBeenCalledWith('night');
    view.settings(withDefaults({ 'appearance.scheme': 'night' }));
    button('Day')?.click();
    expect(actions.scheme).toHaveBeenLastCalledWith('day');
  });

  it('numbers chapters as the setting says, drawn again when it changes', () => {
    const { view } = shown();
    view.settings(withDefaults({ 'books.numerals': 'arabic' }));
    expect(document.querySelector('.reader__colophon')?.textContent).toContain('Chapter 2 of 2');
  });
});
