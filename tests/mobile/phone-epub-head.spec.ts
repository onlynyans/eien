// A book's head on the phone (#57): its sheet's head names the book, title
// and author, on one line however long the title, cut short with an
// ellipsis rather than wrapping down over the page.

import { devices, expect, test } from '@playwright/test';
import { page as chapterPage, handEpub, nav, opf, TITLE, XHTML } from '../support/epub-parts';
import { open, putBytesOutside } from './outside';

test.use({ ...devices['Pixel 7'], reducedMotion: 'reduce' });

/** A light novel's title, longer than any phone's line. */
const LONG =
  'That Time I Was Reincarnated as the Lighthouse Keeper of a Harbour Town at the End of the World';

const book = () =>
  handEpub('content.opf', [
    {
      name: 'content.opf',
      data: opf(
        '3.0',
        [
          { id: 'nav', href: 'nav.xhtml', type: XHTML, properties: 'nav' },
          { id: 'c0', href: 'c0.xhtml', type: XHTML },
        ],
        ['c0'],
      ).replace(TITLE, LONG),
    },
    { name: 'nav.xhtml', data: nav([['Prologue', 'c0.xhtml']]) },
    {
      name: 'c0.xhtml',
      data: chapterPage('Prologue', '<h1>Prologue</h1><p>The lamp was lit at dusk.</p>'),
    },
  ]);

test('a long title in the book’s head stays one line, cut with an ellipsis', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.eien.settings.set('epub.view', 'scroll'));
  await putBytesOutside(
    page,
    'Eien/Vault/Novels/Lighthouse.epub',
    Buffer.from(book()).toString('base64'),
  );
  await page.reload();
  const back = page.locator('.phone-bar__back');
  const row = page.locator('.tree-row--epub .tree-row__name');
  await expect
    .poll(async () => (await row.isVisible()) || (await back.isVisible()), { timeout: 10_000 })
    .toBe(true);
  if (!(await row.isVisible())) await back.click();
  await row.click();
  await expect(page.locator('.epub-chapter')).toContainText('The lamp was lit');
  const head = page.locator('.epub-sheet:not([aria-hidden]) > .sheet__head .crumbs');
  await expect(head).toHaveText(`${LONG} · Jane Austen`);
  const laid = await head.evaluate((element) => {
    const sheet = element.closest('.epub-sheet') as HTMLElement;
    const style = getComputedStyle(element);
    return {
      tall: element.getBoundingClientRect().height,
      line: Number.parseFloat(style.lineHeight),
      cut: element.scrollWidth > element.clientWidth,
      ellipsis: style.textOverflow,
      within: element.getBoundingClientRect().right <= sheet.getBoundingClientRect().right,
    };
  });
  expect(laid.tall).toBeLessThanOrEqual(laid.line + 1);
  expect(laid).toMatchObject({ cut: true, ellipsis: 'ellipsis', within: true });
});
