import { describe, expect, it, vi } from 'vitest';
import { contextMenuOf } from './context-menu-of';

const clicked = (on: Partial<Parameters<typeof contextMenuOf>[0]>) => ({
  isEditable: true,
  selectionText: '',
  misspelledWord: '',
  dictionarySuggestions: [],
  ...on,
});

describe('the right-click menu', () => {
  it('in the note: Cut, Copy and Paste', () => {
    const menu = contextMenuOf(clicked({}), { replace: vi.fn(), learn: vi.fn() });
    expect(menu).toEqual([{ role: 'cut' }, { role: 'copy' }, { role: 'paste' }]);
  });

  it('on an underlined word: its suggestions first, which replace it, and Learn Spelling', () => {
    const act = { replace: vi.fn(), learn: vi.fn() };
    const menu = contextMenuOf(
      clicked({ misspelledWord: 'scraf', dictionarySuggestions: ['scarf', 'scrap'] }),
      act,
    );
    expect(menu.map((item) => item.label ?? item.role ?? item.type)).toEqual([
      'scarf',
      'scrap',
      'separator',
      'Learn Spelling',
      'separator',
      'cut',
      'copy',
      'paste',
    ]);
    menu[0]?.click?.({} as never, undefined, {} as never);
    expect(act.replace).toHaveBeenCalledWith('scarf');
    menu[3]?.click?.({} as never, undefined, {} as never);
    expect(act.learn).toHaveBeenCalledWith('scraf');
  });

  it('no suggestions: says so', () => {
    const menu = contextMenuOf(clicked({ misspelledWord: 'xqzt' }), {
      replace: vi.fn(),
      learn: vi.fn(),
    });
    expect(menu[0]).toEqual({ label: 'No Guesses Found', enabled: false });
  });

  it('outside the note: Copy for words chosen, else nothing', () => {
    const act = { replace: vi.fn(), learn: vi.fn() };
    expect(contextMenuOf(clicked({ isEditable: false, selectionText: 'words' }), act)).toEqual([
      { role: 'copy' },
    ]);
    expect(contextMenuOf(clicked({ isEditable: false }), act)).toEqual([]);
  });
});
