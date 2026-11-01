// A book's highlight taken off and put back in each layout (#40, Phase 5a),
// the window's tools mounted over the pages as the vault view mounts them:
// H keeps the words chosen and lets them go, so H again finds none and says
// so; chosen again, H takes it off, and Put back stands in the pane's
// colophon, in sight, until it's pressed. CI's accessibility run (#140) once
// pressed H twice on one choice and waited for a Put back that never came.

import { afterEach, describe, expect, it } from 'vitest';
import { fixtureEpubs, SAMPLE_SOURCES } from '../../../tests/support/epub-fixtures';
import { LAYOUTS } from '../chrome/commands';
import { epubKind } from '../epub/epub-kind';
import { type EpubSide, isEpub } from '../epub/epub-side-types';
import { CHOOSE_WORDS } from '../epub/page-highlights';
import { withInk } from '../epub/test-ink';
import { laidOut } from '../epub/test-lines';
import { choose, sideWith } from '../epub/test-side';
import { chromeOver, pagesWith } from './pages-harness';

const EPUBS = fixtureEpubs(SAMPLE_SOURCES);

withInk();

const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  document.getSelection()?.removeAllRanges();
  document.body.replaceChildren();
  localStorage.clear();
});

/** The book on the only page, in `layout`, the window's tools drawn round it. */
async function bookIn(layout: (typeof LAYOUTS)[number]): Promise<EpubSide> {
  const books = sideWith({ 'a.epub': EPUBS['plain.epub'] as Uint8Array });
  // Its vault and reading store alone: the page is the pages' own.
  books.side.dispose();
  books.side.page.element.remove();
  const made = await pagesWith({}, { 'appearance.layout': layout }, [epubKind(books.of)]);
  await made.pages.open('a.epub');
  const tools = chromeOver(made);
  stops.push(tools.stop);
  const side = made.pages.active;
  if (!isEpub(side)) throw new Error('no book on the page');
  laidOut(side.page);
  return side;
}

const pressH = (side: EpubSide) =>
  side.page.key(new KeyboardEvent('keydown', { key: 'h', cancelable: true }));
/** The colophon's Put back, where the pane lays the page's figures. */
const putBack = () =>
  [...document.querySelectorAll<HTMLButtonElement>('.colophon button')].find(
    (button) => button.textContent === 'Put back' && !button.hidden,
  );

describe.each(LAYOUTS)('a book’s highlight in the %s layout', (layout) => {
  it('is taken off by H on its words chosen again, and Put back in the colophon restores it', async () => {
    const side = await bookIn(layout);
    const said = side.page.foot.said;
    choose(side, 'universally acknowledged');
    pressH(side);
    await expect.poll(() => side.marks.highlights.all.length).toBe(1);
    expect(document.getSelection()?.toString()).toBe('');
    // Its words let go: H finds none, and nothing is taken off.
    pressH(side);
    await expect.poll(() => said.textContent).toBe(CHOOSE_WORDS);
    expect(putBack()).toBeUndefined();
    expect(side.marks.highlights.all).toHaveLength(1);
    choose(side, 'universally acknowledged');
    pressH(side);
    await expect.poll(() => putBack()).toBeDefined();
    expect(said.textContent).toBe('Highlight taken off.');
    expect(side.marks.highlights.all).toHaveLength(0);
    putBack()?.click();
    await expect.poll(() => side.marks.highlights.all.length).toBe(1);
    expect(said.textContent).toBe('Highlight put back.');
  });
});
