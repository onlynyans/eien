// Two pages (spec §10, Wide screen): the second note chosen from a list opens
// beside the first, so there are two; with two, a note chosen opens on the
// page you're in. A note opened any other way stays where it was asked for.

import { afterEach, describe, expect, it } from 'vitest';
import type { SettingValues } from '../../core/config';
import { twoPages } from '../phone/room';
import type { PaneLayout } from '../shell/panes';
import { noteActions } from './note-actions';
import { pagesWith } from './pages-harness';
import type { PhoneView } from './phone-view';

const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  document.body.replaceChildren();
});

async function inRoom(
  room: 'pages' | 'one',
  chosen: Partial<SettingValues> = {},
  panes: Partial<PaneLayout> = { listWidth: 0 },
) {
  const made = await pagesWith(
    {
      'Chapter.md': 'The gate held.',
      'Notes.md': 'Snow on the walls.',
      'Map.md': 'The stair.',
    },
    chosen,
  );
  stops.push(() => made.pages.stop());
  const actions = noteActions({
    vault: {} as never,
    state: {} as never,
    nav: {} as never,
    organizer: {} as never,
    pages: made.pages,
    phone: {
      stack: { room, phone: true, splits: twoPages(room), show: () => {} },
    } as unknown as PhoneView,
    panes: panes as PaneLayout,
    sidebar: {} as never,
    act: async () => {},
    refresh: async () => {},
    redraw: async () => {},
    tell: () => {},
    sidebarKey: '⌘\\',
  });
  return { ...made, actions };
}

const notesShown = (pages: Awaited<ReturnType<typeof inRoom>>['pages']) =>
  pages.sides.map((side) => side.note.path);

describe('two pages', () => {
  it('opens the second note chosen beside the first, then any other on the page you’re in', async () => {
    const { pages, actions } = await inRoom('pages');
    await actions.openNote('Chapter.md', 'chosen');
    expect(notesShown(pages)).toEqual(['Chapter.md']);
    await actions.openNote('Notes.md', 'chosen');
    expect(notesShown(pages)).toEqual(['Chapter.md', 'Notes.md']);
    expect(pages.active.note.path).toBe('Notes.md');
    await actions.openNote('Map.md', 'chosen');
    expect(notesShown(pages)).toEqual(['Chapter.md', 'Map.md']);
  });

  it('opens the same note again in place, not beside itself', async () => {
    const { pages, actions } = await inRoom('pages');
    await actions.openNote('Chapter.md', 'chosen');
    await actions.openNote('Chapter.md', 'chosen');
    expect(notesShown(pages)).toEqual(['Chapter.md']);
  });

  it('opens a note in place when it isn’t chosen from a list: a link, a card, a rename, a drop', async () => {
    const { pages, actions } = await inRoom('pages');
    await actions.openNote('Chapter.md', 'chosen');
    await actions.openNote('Notes.md');
    expect(notesShown(pages)).toEqual(['Notes.md']);
    await actions.openNote('Map.md', 'here');
    expect(notesShown(pages)).toEqual(['Map.md']);
  });

  it('opens the second note on the one page where two don’t fit (Tools that follow, too narrow)', async () => {
    const { pages, actions } = await inRoom('pages', { 'appearance.split': 'follow' });
    await actions.openNote('Chapter.md', 'chosen');
    await actions.openNote('Notes.md', 'chosen'); // happy-dom lays out nothing: no room
    expect(notesShown(pages)).toEqual(['Notes.md']);
  });

  it('counts no room the list would give by stepping aside: on a phone it never does', async () => {
    // A Fold 5 upright: 590px of page, short of Tools that follow's 720 even with a list beside.
    const panes = { listWidth: 280, phone: true };
    const { pages, actions } = await inRoom('pages', { 'appearance.split': 'follow' }, panes);
    Object.defineProperty(pages.pane.pagesArea, 'clientWidth', { value: 590 });
    await actions.openNote('Chapter.md', 'chosen');
    await actions.openNote('Notes.md', 'chosen');
    expect(notesShown(pages)).toEqual(['Notes.md']);
  });
});

describe('one at a time', () => {
  it('opens every note on the one page', async () => {
    const { pages, actions } = await inRoom('one');
    await actions.openNote('Chapter.md', 'chosen');
    await actions.openNote('Notes.md', 'chosen');
    expect(notesShown(pages)).toEqual(['Notes.md']);
  });
});
