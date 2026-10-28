// A page of another kind on the phone and in Wide screen's rooms (spec §10):
// the other note (⇄) goes back across kinds, each where it was left; Two
// pages opens a note beside it; a room with one page closes it, kept as the
// other; and a note dropped on its page opens there. A stand-in second kind
// (./stand-in-kind.ts) stands for the EPUB's (backlog #40).

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PaneLeaf } from '../page/page-leaf';
import { closesBeside, type Room, twoPages } from '../phone/room';
import type { PaneLayout } from '../shell/panes';
import { noteActions } from './note-actions';
import { pageDrop } from './page-drop';
import type { Side } from './pages';
import { noted, pagesWith } from './pages-harness';
import { phoneOther } from './phone-other';
import type { PhoneView } from './phone-view';
import { type StandInSide, standInKind } from './stand-in-kind';

const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  document.body.replaceChildren();
});

async function made() {
  const files = { 'Chapter.md': 'The gate held. It held all night.', 'Notes.md': 'Erwin.' };
  const m = await pagesWith(files, {}, [standInKind]);
  stops.push(() => m.pages.stop());
  return m;
}

/** The back bar's other note, as the phone wires it: a tap opens it where it was left. */
function slipOver(pages: Awaited<ReturnType<typeof made>>['pages']) {
  const other = phoneOther({
    pages,
    has: () => true,
    onPage: () => true,
    open: (place) => pages.open(place.path, false, place),
  });
  const name = () => (other.element.hidden ? null : other.element.textContent);
  return { other, name };
}

const kinds = (sides: readonly Side[]) => sides.map((side) => side.kind);

describe('the phone’s other note across kinds', () => {
  it('goes back from the other kind to the note where it was left, and back again', async () => {
    const { pages } = await made();
    const { other, name } = slipOver(pages);
    await pages.open('Chapter.md');
    noted(pages.active).page.editor.view.dispatch({ selection: { anchor: 9, head: 14 } });
    await pages.open('Map.stand');
    (pages.active as StandInSide).leaf = 3; // a test turns it
    other.sync();
    expect(name()).toBe('Chapter');
    other.element.click();
    await vi.waitFor(() => expect(pages.active.path).toBe('Chapter.md'));
    expect(noted(pages.active).page.editor.view.state.selection.main).toMatchObject({
      anchor: 9,
      head: 14,
    });
    other.sync();
    expect(name()).toBe('Map');
    other.element.click();
    await vi.waitFor(() => expect(pages.active.path).toBe('Map.stand'));
    expect((pages.active as StandInSide).leaf).toBe(3);
    expect(pages.active.page.foot.figures[0]?.textContent).toBe('Leaf 3');
  });

  it('is the page beside, of either kind, while split', async () => {
    const { pages } = await made();
    const { other, name } = slipOver(pages);
    await pages.open('Map.stand');
    await pages.open('Chapter.md', true);
    other.sync();
    expect(name()).toBe('Map');
  });
});

/** Note actions in `room`, the phone's (../phone/room.ts). */
async function inRoom(room: Room) {
  const m = await made();
  const actions = noteActions({
    vault: {} as never,
    state: {} as never,
    nav: {} as never,
    organizer: {} as never,
    pages: m.pages,
    phone: {
      stack: { room, phone: true, splits: twoPages(room), show: () => {} },
    } as unknown as PhoneView,
    panes: { listWidth: 0 } as PaneLayout,
    sidebar: {} as never,
    act: async () => {},
    refresh: async () => {},
    redraw: async () => {},
    tell: () => {},
    sidebarKey: '⌘\\',
  });
  return { ...m, actions };
}

describe('Wide screen’s rooms with a page of another kind', () => {
  it('Two pages: a note chosen opens beside it, then on the page you’re in', async () => {
    const { pages, actions } = await inRoom('pages');
    await pages.open('Map.stand');
    await actions.openNote('Chapter.md', 'chosen');
    expect(kinds(pages.sides)).toEqual(['epub', 'note']);
    await actions.openNote('Notes.md', 'chosen');
    expect(pages.sides.map((side) => side.path)).toEqual(['Map.stand', 'Notes.md']);
  });

  it('One at a time: a note chosen takes its page', async () => {
    const { pages, actions } = await inRoom('one');
    await pages.open('Map.stand');
    await actions.openNote('Chapter.md', 'chosen');
    expect(kinds(pages.sides)).toEqual(['note']);
    expect(pages.active.left?.path).toBe('Map.stand');
  });

  it('a room with one page closes the page beside, of either kind, kept as the other', async () => {
    for (const room of ['one', 'side'] as const) {
      expect(closesBeside(room, 'android')).toBe(true);
      const { pages } = await made();
      const { other, name } = slipOver(pages);
      await pages.open('Chapter.md');
      await pages.open('Map.stand', true);
      pages.activate(pages.sides[0] as Side);
      // As the phone does when the room changes (./phone-view.ts): the slip first, then the close.
      other.sync();
      pages.close(pages.other as Side);
      other.sync();
      expect(kinds(pages.sides)).toEqual(['note']);
      expect(name()).toBe('Map');
    }
  });
});

describe('a note dropped on a page of another kind', () => {
  it('opens there, in its place', async () => {
    const { pages } = await made();
    await pages.open('Map.stand');
    await pages.open('Chapter.md', true);
    const rect = (left: number) =>
      ({ left, right: left + 500, top: 0, bottom: 800, width: 500, height: 800 }) as DOMRect;
    vi.spyOn(pages.pane.pagesArea, 'getBoundingClientRect').mockReturnValue({
      ...rect(0),
      right: 1000,
      width: 1000,
    } as DOMRect);
    for (const [at, { page }] of pages.sides.entries())
      vi.spyOn(page.element as PaneLeaf['element'], 'getBoundingClientRect').mockReturnValue(
        rect(at * 500),
      );
    const opened: [string, boolean][] = [];
    const drop = pageDrop(pages, (path, beside) => opened.push([path, beside]));
    expect(drop.over(100, 100)).toBe(true);
    expect(pages.pane.pagesArea.querySelector('.drop-preview')?.textContent).toBe(
      'Open here, in place of Map',
    );
    drop.drop('Notes.md');
    expect(opened).toEqual([['Notes.md', false]]);
    expect(pages.active.kind).toBe('epub');
  });
});
