// The phone's ⋯ (spec §10) offers the quick look (#49), as the desktop's
// View → Look… does, next to Settings.

import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../core/config';
import type { MenuItem } from '../menu/menu';
import { moreItems } from './more-menu';

const words = (items: readonly MenuItem[]) =>
  items.map((item) => (item === 'separator' ? '—' : item.label));

describe('the phone’s ⋯', () => {
  it('has Look, just before Settings, running the quick look’s command', () => {
    const run = vi.fn();
    const items = moreItems(
      { values: DEFAULT_SETTINGS, sprinting: false, exportTo: () => {} },
      run,
    );
    expect(words(items).slice(-3)).toEqual(['—', 'Look', 'Settings']);
    const look = items.find((item) => item !== 'separator' && item.label === 'Look');
    if (look && look !== 'separator') look.run();
    expect(run).toHaveBeenCalledWith('look');
  });
});

describe('the ⋯ with a book in front (#40)', () => {
  it('keeps a note’s own choices there, disabled; Find, Look and Settings stay', () => {
    const items = moreItems(
      { values: DEFAULT_SETTINGS, sprinting: false, exportTo: () => {}, kind: 'epub' },
      () => {},
    ).filter((item) => item !== 'separator');
    const disabled = (label: string) =>
      items.find((item) => item.label === label)?.disabled ?? false;
    for (const label of [
      'Seal',
      'Compare',
      'Versions',
      'Outline cards',
      'Copy as HTML',
      'Export…',
      'Focus mode',
    ]) {
      expect(disabled(label), label).toBe(true);
    }
    expect(disabled('Find')).toBe(false);
    expect(disabled('Look')).toBe(false);
    expect(disabled('Settings')).toBe(false);
  });
});

describe('the ⋯’s Quote (#40, Phase 2c)', () => {
  it('is there with a book in front, after Find, and quotes', () => {
    const quote = vi.fn();
    const state = { values: DEFAULT_SETTINGS, sprinting: false, exportTo: () => {}, quote };
    const items = moreItems({ ...state, kind: 'epub' }, () => {});
    expect(words(items).slice(0, 2)).toEqual(['Find', 'Quote in the note']);
    const item = items[1];
    if (item && item !== 'separator') item.run();
    expect(quote).toHaveBeenCalledOnce();
    // Never with a note in front: a note has nothing to quote from.
    expect(words(moreItems({ ...state, kind: 'note' }, () => {}))).not.toContain(
      'Quote in the note',
    );
  });
});

// QA (#40, Phase 4b): the phone has no B and no tools row for a book's bookmark: the ⋯ is its way.
describe('the ⋯’s bookmark (#40, Phase 4b)', () => {
  const state = { values: DEFAULT_SETTINGS, sprinting: false, exportTo: () => {} };
  const bookmark = (items: readonly MenuItem[]) =>
    items.find((item) => item !== 'separator' && item.label === 'Bookmark this page');

  it('is there with a book in front, a toggle checked while the page in sight has one', () => {
    const run = vi.fn();
    for (const bookmarked of [false, true]) {
      const item = bookmark(moreItems({ ...state, kind: 'epub', bookmarked }, run));
      if (!item || item === 'separator') throw new Error('no bookmark in the ⋯');
      expect(item).toMatchObject({ checked: bookmarked, toggle: true });
      expect(item.disabled ?? false).toBe(false);
      item.run();
    }
    // Either way it sends the one command, which puts one there or takes the page's off.
    expect(run.mock.calls).toEqual([['bookmark'], ['bookmark']]);
  });

  it('is never there with a note in front', () => {
    expect(bookmark(moreItems({ ...state, kind: 'note' }, () => {}))).toBeUndefined();
    expect(bookmark(moreItems(state, () => {}))).toBeUndefined();
  });
});

// QA (#40, Phase 5a): the phone has no H and no selection bar over a book: the ⋯ is its Highlight.
describe('the ⋯’s Highlight (#40, Phase 5a)', () => {
  const state = { values: DEFAULT_SETTINGS, sprinting: false, exportTo: () => {} };

  it('is there with a book in front, after Find and before Quote, and highlights', () => {
    const highlight = vi.fn();
    const items = moreItems({ ...state, kind: 'epub', highlight, quote: () => {} }, () => {});
    expect(words(items).slice(0, 3)).toEqual(['Find', 'Highlight', 'Quote in the note']);
    const item = items[1];
    if (item && item !== 'separator') item.run();
    expect(highlight).toHaveBeenCalledOnce();
  });

  it('reads as taking the highlight off while the words chosen lie in one', () => {
    const items = moreItems(
      { ...state, kind: 'epub', highlight: () => {}, highlighted: true },
      () => {},
    );
    expect(words(items)).toContain('Take off the highlight');
    expect(words(items)).not.toContain('Highlight');
  });

  it('is never there with a note in front, nor with nothing to highlight with', () => {
    expect(
      words(moreItems({ ...state, kind: 'note', highlight: () => {} }, () => {})),
    ).not.toContain('Highlight');
    expect(words(moreItems({ ...state, kind: 'epub' }, () => {}))).not.toContain('Highlight');
  });
});
