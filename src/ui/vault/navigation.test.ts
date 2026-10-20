import { describe, expect, it } from 'vitest';
import { openId } from '../sidebar/tree';
import { Navigation } from './navigation';

describe('Navigation', () => {
  it('opens every folder down to a chosen one, and ends a search', () => {
    const nav = new Navigation();
    nav.query = 'needle';
    nav.choose({ kind: 'folder', path: 'Fic/AoT/Book' });
    expect([...nav.open].sort()).toEqual(['Fic', 'Fic/AoT', 'Fic/AoT/Book']);
    expect(nav.query).toBe('');
  });

  it('sends a new note to the chosen folder, but not from a search or a tag', () => {
    const nav = new Navigation();
    expect(nav.folder).toBe('');
    nav.choose({ kind: 'folder', path: 'Book' });
    expect(nav.folder).toBe('Book');
    nav.query = 'x';
    expect(nav.folder).toBe('');
    nav.choose({ kind: 'tag', key: 'fic' });
    expect(nav.folder).toBe('');
  });

  it('follows a renamed folder, and the folders in it, but not one whose name only starts the same', () => {
    const nav = new Navigation();
    nav.choose({ kind: 'folder', path: 'Book/Part 1' });
    nav.open.add('Book 2');
    nav.open.add('Bookends');
    nav.follow('Book', 'Novel');
    expect([...nav.open].sort()).toEqual(['Book 2', 'Bookends', 'Novel', 'Novel/Part 1']);
    expect(nav.selection).toEqual({ kind: 'folder', path: 'Novel/Part 1' });
  });

  it('never takes a tag, All Notes or Pinned for a folder of the same name', () => {
    const nav = new Navigation();
    for (const selection of [
      { kind: 'tag', key: 'drafts' },
      { kind: 'all' },
      { kind: 'pinned' },
    ] as const) {
      nav.open.add(openId(selection));
    }
    nav.open.add('#drafts'); // a folder really named "#drafts"
    nav.follow('#drafts', 'Old drafts');
    nav.follow('all', 'Everything');
    expect([...nav.open].sort()).toEqual(['/#drafts', '/all', '/pinned', 'Old drafts']);
  });

  it('chooses All Notes when the chosen folder, or the folder it’s in, goes to the trash', () => {
    const nav = new Navigation();
    nav.choose({ kind: 'folder', path: 'Fic/Book' });
    nav.unselect('Fiction'); // only a name that starts the same
    expect(nav.selection).toEqual({ kind: 'folder', path: 'Fic/Book' });
    nav.unselect('Fic');
    expect(nav.selection).toEqual({ kind: 'all' });
  });

  it('with two panes, opens a chosen row, and shuts it when it’s chosen again', () => {
    const nav = new Navigation();
    nav.chooseAndToggle({ kind: 'folder', path: 'Fic/Book' });
    expect([...nav.open].sort()).toEqual(['Fic', 'Fic/Book']);
    nav.chooseAndToggle({ kind: 'folder', path: 'Fic/Book' });
    expect([...nav.open]).toEqual(['Fic']); // the folder it's in stays open
    expect(nav.selection).toEqual({ kind: 'folder', path: 'Fic/Book' });
    nav.chooseAndToggle({ kind: 'all' });
    nav.chooseAndToggle({ kind: 'tag', key: 'fic' });
    expect(nav.open.has(openId({ kind: 'all' }))).toBe(true);
    nav.chooseAndToggle({ kind: 'all' });
    expect(nav.open.has(openId({ kind: 'all' }))).toBe(false);
    expect(nav.open.has(openId({ kind: 'tag', key: 'fic' }))).toBe(true);
  });

  it('toggles a row open and shut', () => {
    const nav = new Navigation();
    nav.toggle('/all');
    expect(nav.open.has('/all')).toBe(true);
    nav.toggle('/all');
    expect(nav.open.has('/all')).toBe(false);
  });
});
