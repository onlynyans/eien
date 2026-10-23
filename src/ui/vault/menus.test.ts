import { describe, expect, it } from 'vitest';
import { type NoteMenu, noteMenu } from './menus';

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
