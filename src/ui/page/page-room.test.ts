// Whether a page has room round its sheet for Page width's choices (#62).
// happy-dom lays nothing out: the page's width and the sheet's at Wide are
// stood in, as the window would measure them.

import { afterEach, describe, expect, it } from 'vitest';
import { notesPage, roomForWidths } from './page-room';
import { pageOf } from './test-page-room';

afterEach(() => document.body.replaceChildren());

describe('room round a page', () => {
  it('is there while the sheet at Wide is narrower than the page, so each choice sets its own line', () => {
    expect(roomForWidths(pageOf(1000, 830))).toBe(true);
    // A foldable in Panes, a phone, a narrow pane: Wide would fill it as As set does.
    expect(roomForWidths(pageOf(600, 830))).toBe(false);
    expect(roomForWidths(pageOf(830, 830))).toBe(false);
  });

  it('measures the page as its zoom draws it', () => {
    // 400px of page drawn at twice the size: 800px, room for a 700px line.
    const page = pageOf(400, 700);
    Object.defineProperty(page, 'currentCSSZoom', { value: 2 });
    expect(roomForWidths(page)).toBe(true);
  });

  it('measures a book’s two pages as two, its ruler laid as the sheet in sight is', () => {
    // One page's line at Wide is 830px; two pages', 1,650px.
    const page = pageOf(1200, (ruler) =>
      ruler.querySelector('.epub__pages[data-spread]') ? 1650 : 830,
    );
    const sheet = page.appendChild(document.createElement('article'));
    sheet.className = 'sheet epub-sheet';
    const pages = sheet.appendChild(document.createElement('div'));
    pages.className = 'epub__pages';
    expect(roomForWidths(page)).toBe(true);
    pages.toggleAttribute('data-spread', true);
    expect(roomForWidths(page)).toBe(false);
  });

  it('measures with a sheet it takes away again', () => {
    const page = pageOf(600, 830);
    roomForWidths(page);
    expect(page.querySelector('.page-ruler')).toBeNull();
    expect(page.querySelector('.page-ruler')).toBeNull();
  });

  it('says nothing of a page not laid out: as it was', () => {
    const scroll = document.body.appendChild(document.createElement('div'));
    expect(roomForWidths(scroll)).toBe(true);
  });

  it('measures the notes’ look on the active note’s page, else a note’s in sight, never a book’s', () => {
    expect(notesPage()).toBeNull();
    const book = pageOf(600, 830, 'page__leaf--epub');
    book.parentElement?.setAttribute('data-active', '');
    expect(notesPage()).toBeNull();
    const note = pageOf(1000, 830);
    expect(notesPage()).toBe(note);
    const active = pageOf(700, 830);
    active.parentElement?.setAttribute('data-active', '');
    expect(notesPage()).toBe(active);
  });
});
