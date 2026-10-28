// A page holds a note or another kind (./page-side.ts; an EPUB's, backlog
// #40): the split, its pager, swap, the closed book's edge and a page's own
// tools carry a page without asking what it holds, and a file of another kind
// takes a page's place, the page beside it untouched. A stand-in second kind
// (./stand-in-kind.ts) stands for the EPUB's.

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SettingValues } from '../../core/config';
import type { Board } from '../page/board-host';
import { PAGE_MIN } from '../shell/pane-state';
import { pageHosts } from './page-hosts';
import type { Side } from './pages';
import { noted, pagesWith } from './pages-harness';
import { type StandInSide, standInKind } from './stand-in-kind';

const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  document.body.replaceChildren();
  localStorage.clear();
});

async function made(chosen: Partial<SettingValues> = {}) {
  const files = { 'Chapter.md': 'The gate held.', 'Notes.md': 'Snow on the walls.' };
  const m = await pagesWith(files, chosen, [standInKind]);
  stops.push(() => m.pages.stop());
  return m;
}

/** A note on the left, the stand-in beside it (the active one). */
async function noteAndStandIn(chosen: Partial<SettingValues> = {}) {
  const m = await made(chosen);
  await m.pages.open('Chapter.md');
  await m.pages.open('Map.stand', true);
  return m;
}

/** The pages' row: the pages and the divider in it, left to right (the closed book's edge aside). */
const row = (area: HTMLElement) =>
  [...(area.querySelector('.page__pages')?.children ?? [])]
    .filter((part) => !part.classList.contains('page__edge'))
    .map((part) =>
      part.classList.contains('divider') ? 'divider' : (part.getAttribute('aria-label') ?? 'page'),
    );
const kinds = (sides: readonly Side[]) => sides.map((side) => side.kind);
const colophon = (area: HTMLElement) =>
  [...(area.querySelector('.colophon')?.children ?? [])].map((part) => part.className);
const labels = (element: Element | undefined) =>
  [...(element?.querySelectorAll('button') ?? [])].map((button) =>
    button.getAttribute('aria-label'),
  );

describe('a page of another kind in the split', () => {
  it('opens beside a note, the active page, the colophon its own', async () => {
    const { pages, area } = await noteAndStandIn();
    expect(kinds(pages.sides)).toEqual(['note', 'epub']);
    expect(row(area)).toEqual(['Chapter', 'divider', 'Map, the active page']);
    expect(pages.notes()).toEqual({ active: 'Map.stand', other: 'Chapter.md' });
    expect(pages.activeNote).toBeNull();
    expect(colophon(area)).toContain('colophon__leaf');
    expect(colophon(area)).not.toContain('colophon__words');
    expect(pages.pane.head.contains(pages.active.page.runningCrumbs)).toBe(true);
    pages.activate(pages.sides[0] as Side);
    expect(colophon(area)).toContain('colophon__words');
    expect(colophon(area)).not.toContain('colophon__leaf');
    expect(pages.activeNote).toBe(pages.sides[0]);
  });

  it('has a note open beside it', async () => {
    const { pages, area } = await made();
    await pages.open('Map.stand');
    await pages.open('Chapter.md', true);
    expect(kinds(pages.sides)).toEqual(['epub', 'note']);
    expect(row(area)).toEqual(['Map', 'divider', 'Chapter, the active page']);
  });

  it('becomes the active page when the writer goes into it', async () => {
    const { pages } = await noteAndStandIn();
    pages.activate(pages.sides[0] as Side);
    pages.sides[1]?.page.element.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(pages.active.kind).toBe('epub');
  });

  it('swaps with the note, and either closes, never the last', async () => {
    const { pages, area } = await noteAndStandIn();
    pages.swap();
    expect(kinds(pages.sides)).toEqual(['epub', 'note']);
    expect(pages.active.kind).toBe('epub');
    expect(row(area)).toEqual(['Map, the active page', 'divider', 'Chapter']);
    const standIn = pages.active as StandInSide;
    expect(pages.close(standIn)).toBe(true);
    expect(standIn.disposed).toBe(true);
    expect(standIn.page.element.isConnected).toBe(false);
    expect(kinds(pages.sides)).toEqual(['note']);
    expect(pages.close(pages.active)).toBe(false);
  });

  it('closes by its own ×', async () => {
    const { pages } = await noteAndStandIn();
    pages.active.page.element.querySelector<HTMLElement>('.sheet__close')?.click();
    expect(kinds(pages.sides)).toEqual(['note']);
  });

  it('follows the settings, made and changed', async () => {
    const { pages, change } = await noteAndStandIn();
    const standIn = pages.active as StandInSide;
    expect(standIn.followed).toHaveLength(1);
    change({ 'editor.focus': 'on' });
    expect(standIn.followed.at(-1)?.['editor.focus']).toBe('on');
  });

  it('shows nothing once its file goes to the trash, with the folder it was in', async () => {
    const { pages } = await made();
    await pages.open('Atlas/Map.stand');
    pages.closed('Atlas');
    expect(pages.active.path).toBeNull();
    expect(pages.active.page.name).toBe('');
  });
});

describe('a file of another kind opened on a page', () => {
  it('takes the page’s place, the page beside it untouched', async () => {
    const { pages, area } = await made();
    await pages.open('Chapter.md');
    await pages.open('Notes.md', true);
    const [chapter, notes] = pages.sides as [Side, Side];
    pages.activate(chapter);
    const pagesRow = area.querySelector('.page__pages') as HTMLElement;
    const replaceAll = vi.spyOn(pagesRow, 'replaceChildren');
    const gone = [chapter.page.element, chapter.page.runningCrumbs, chapter.page.aside];
    await pages.open('Map.stand');
    expect(kinds(pages.sides)).toEqual(['epub', 'note']);
    expect(pages.sides[1]).toBe(notes);
    expect(pages.active).toBe(pages.sides[0]);
    expect(replaceAll).not.toHaveBeenCalled(); // the note beside never leaves: its scroll is kept
    for (const part of gone) expect(part.isConnected).toBe(false);
    expect(pages.pane.head.contains(pages.active.page.runningCrumbs)).toBe(true);
    expect(row(area)).toEqual(['Map, the active page', 'divider', 'Notes']);
    // The note it showed is the page's other, and is let go once saved.
    expect(pages.active.left?.path).toBe('Chapter.md');
    await vi.waitFor(() => expect(pages.sessions().map(({ path }) => path)).toEqual(['Notes.md']));
  });

  it('gives the keyboard to the page in its place, when the one it took had it', async () => {
    const { pages } = await made();
    await pages.open('Chapter.md');
    pages.active.page.element.querySelector<HTMLElement>('.sheet__close')?.focus();
    expect(pages.active.page.element.contains(document.activeElement)).toBe(true);
    await pages.open('Map.stand');
    expect(pages.active.kind).toBe('epub');
    expect(pages.active.page.element.contains(document.activeElement)).toBe(true);
  });

  it('puts away outline cards lying on the page it takes', async () => {
    const { pages } = await made();
    await pages.open('Chapter.md');
    const closed = vi.fn();
    const board: Board = { element: document.createElement('div'), focus: () => {}, closed };
    noted(pages.active).page.board.show(board);
    await pages.open('Map.stand');
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('leaves one note open however quickly another kind and back are asked for', async () => {
    const { pages } = await made();
    await pages.open('Chapter.md');
    await Promise.all([pages.open('Map.stand'), pages.open('Notes.md')]);
    expect(pages.active.kind).toBe('note');
    expect(pages.notes().active).toBe('Notes.md');
    expect(noted(pages.active).page.editor.text).toBe('Snow on the walls.');
    await vi.waitFor(() => expect(pages.sessions().map(({ path }) => path)).toEqual(['Notes.md']));
  });
});

describe('two pages too narrow for the room', () => {
  it('fold with Two sheets, the pager naming both kinds and turning to either', async () => {
    const { pages, area } = await noteAndStandIn();
    for (const { page } of pages.sides) vi.spyOn(page, 'focus').mockImplementation(() => {});
    const pagesRow = area.querySelector<HTMLElement>('.page__pages') as HTMLElement;
    vi.spyOn(pagesRow, 'clientWidth', 'get').mockReturnValue(2 * PAGE_MIN - 1);
    pages.pane.renamed();
    pages.swap(); // anything that lays them out
    expect(pagesRow.dataset.narrow).toBe('fold');
    const buttons = () => [...pages.pane.pager.querySelectorAll('button')];
    expect(buttons().map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
      ['Map', 'true'],
      ['Chapter', 'false'],
    ]);
    buttons()[1]?.click();
    expect(pages.active.kind).toBe('note');
    buttons()[0]?.click();
    expect(pages.active.kind).toBe('epub');
  });

  it('close to the active page with Facing pages, the edge naming the other', async () => {
    const { pages, area } = await noteAndStandIn({ 'appearance.split': 'facing' });
    for (const { page } of pages.sides) vi.spyOn(page, 'focus').mockImplementation(() => {});
    const pagesRow = area.querySelector<HTMLElement>('.page__pages') as HTMLElement;
    vi.spyOn(pagesRow, 'clientWidth', 'get').mockReturnValue(2 * PAGE_MIN - 1);
    pages.swap();
    expect(pagesRow.dataset.narrow).toBe('close');
    const edge = pagesRow.querySelector<HTMLButtonElement>('.page__edge');
    expect(edge?.getAttribute('aria-label')).toBe('Turn to Chapter, the facing page');
    edge?.click();
    expect(pages.active.kind).toBe('note');
  });
});

describe('a page’s own tools', () => {
  it('are its kind’s in Facing pages: a note’s its seals, the other kind’s its × alone', async () => {
    const { pages } = await noteAndStandIn({ 'appearance.split': 'facing' });
    const own = pageHosts({
      pages,
      mac: false,
      look: () => ({}),
      press: () => {},
      watch: () => {},
    });
    own.sync();
    const [note, standIn] = pages.sides;
    expect(labels(note?.page.folio.tools)).toEqual([
      'Compare',
      'Seal',
      'Versions',
      'Copy as HTML',
      'Close this page',
    ]);
    expect(labels(standIn?.page.folio.tools)).toEqual(['Close this page']);
    // The note's page given to the other kind: its host is drawn anew, for that kind.
    pages.activate(note as Side);
    await pages.open('Atlas.stand');
    own.sync();
    expect(labels(pages.sides[0]?.page.folio.tools)).toEqual(['Close this page']);
  });

  it('are its kind’s as a companion: no note’s ⋯ on the other kind', async () => {
    const { pages } = await noteAndStandIn({ 'appearance.split': 'companion' });
    const own = pageHosts({
      pages,
      mac: false,
      look: () => ({}),
      press: () => {},
      watch: () => {},
    });
    own.sync();
    expect(labels(pages.sides[1]?.page.head.tools)).toEqual([
      'Make it the page',
      'Close this page',
    ]);
    pages.swap(); // the note the companion
    own.sync();
    expect(labels(pages.sides[1]?.page.head.tools)).toEqual([
      'Make it the page',
      'More for this note',
      'Close this page',
    ]);
  });

  it('put each page’s figures at its own foot, whatever it holds', async () => {
    const { pages, area } = await noteAndStandIn({ 'appearance.split': 'facing' });
    expect(pages.sides[0]?.page.folio.figures.textContent).toContain('3 words');
    expect(pages.sides[1]?.page.folio.figures.textContent).toBe('Leaf 0');
    expect(colophon(area)).not.toContain('colophon__leaf');
  });
});
