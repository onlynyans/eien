import { describe, expect, it } from 'vitest';
import { type NoteMenu, noteMenu } from './menu-items';

const note = (more: Partial<NoteMenu> = {}): NoteMenu => ({
  pinned: false,
  ordered: false,
  trashName: 'the Trash',
  rename: () => {},
  pin: () => {},
  nudge: () => {},
  moveTo: () => {},
  exportTo: () => {},
  trash: () => {},
  ...more,
});
const labels = (menu: ReturnType<typeof noteMenu>) =>
  menu.map((item) => (item === 'separator' ? '—' : item.label));

describe('a note’s menu (New Window)', () => {
  it('opens the note in a window of its own first, where there are windows', () => {
    let opened = 0;
    const menu = noteMenu(note({ openInNewWindow: () => opened++ }));
    expect(labels(menu).slice(0, 3)).toEqual(['Open in New Window', '—', 'Rename']);
    const first = menu[0];
    if (first && first !== 'separator') first.run();
    expect(opened).toBe(1);
  });

  it('leaves it out on a phone, which has one window', () => {
    expect(labels(noteMenu(note()))).not.toContain('Open in New Window');
  });
});

describe('a note’s menu (the split)', () => {
  it('opens the note to the side first, then in a new window, where the window can split', () => {
    let beside = 0;
    const menu = noteMenu(note({ openBeside: () => beside++, openInNewWindow: () => {} }));
    expect(labels(menu).slice(0, 4)).toEqual([
      'Open to the Side',
      'Open in New Window',
      '—',
      'Rename',
    ]);
    const first = menu[0];
    if (first && first !== 'separator') {
      expect(first.keys).toBe('Mod-Enter'); // as on its row
      first.run();
    }
    expect(beside).toBe(1);
  });

  it('leaves it out where a page can’t split (a phone)', () => {
    expect(labels(noteMenu(note()))).not.toContain('Open to the Side');
  });
});
