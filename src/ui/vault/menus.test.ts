import { describe, expect, it } from 'vitest';
import { buildTree } from '../../core/vault';
import { destinations, epubMenu, type NoteMenu, noteMenu } from './menu-items';

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

describe('a book’s menu on SHELF (#40)', () => {
  it('renames, moves and trashes, with a note’s keys, the trash last in carmine', () => {
    const ran: string[] = [];
    const menu = epubMenu({
      trashName: 'the Recycle Bin',
      rename: () => ran.push('rename'),
      moveTo: () => ran.push('move'),
      trash: () => ran.push('trash'),
    });
    expect(labels(menu)).toEqual(['Rename', 'Move to…', '—', 'Move to the Recycle Bin']);
    const items = menu.filter((item) => item !== 'separator');
    const trash = noteMenu(note()).at(-1);
    expect(items.map((item) => item.keys)).toEqual([
      'F2',
      undefined,
      trash !== 'separator' ? trash?.keys : null,
    ]);
    expect(items.at(-1)?.danger).toBe(true);
    for (const item of items) item.run();
    expect(ran).toEqual(['rename', 'move', 'trash']);
  });
});

describe('Move to… (#40)', () => {
  it('lists every folder, those FOLDERS leaves out and those SHELF does too', () => {
    const tree = buildTree(
      [
        { path: 'Novels/Emma.epub', kind: 'epub', modified: 0, size: 0 },
        { path: 'Drafts/One.md', kind: 'note', modified: 0, size: 0 },
        { path: 'Drafts/Old', kind: 'folder', modified: 0, size: 0 },
      ],
      'Vault',
    );
    const items = destinations(tree, 'Vault', 'Drafts', null, () => {});
    expect(items.map((item) => (item === 'separator' ? '—' : item.label))).toEqual([
      'Vault',
      'Drafts',
      'Old',
      'Novels',
    ]);
  });
});
