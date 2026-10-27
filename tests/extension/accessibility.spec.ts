// axe-core over the story page and the popup (../e2e/axe.ts), by day and
// by night: no serious or critical violation, colour contrast included.

import { expect, type Page } from '@playwright/test';
import type { Story } from '../../src/core/extension';
import { seriousViolations } from '../e2e/axe';
import { AO3_CHAPTER } from '../support/story-pages/ao3';
import { extensionOrigin, storyFrame, test } from './browser';

const AO3_2 = 'https://archiveofourown.org/works/123/chapters/1002';

/** A story with every part the sheet draws: facts, notes, a chapter's own, a quote, a table. */
const STORY: Story = {
  site: 'ao3',
  id: 'ao3:123',
  title: 'Beneath the Walls',
  authors: ['Rook'],
  fandoms: ['Harry Potter'],
  summary: '<p>The walls held for <em>forty</em> days.</p>',
  notes: '<p>For S.</p>',
  endNotes: '<p>Thanks.</p>',
  facts: [{ label: 'Rating', values: ['Teen And Up Audiences'] }],
  chapters: [
    {
      number: 2,
      title: 'The Gate',
      summary: '<p>They open it.</p>',
      notes: '<p>Short.</p>',
      body: '<p>The gate <a href="https://example.org/">groaned</a>.</p><hr><blockquote><p>Q</p></blockquote><table><tr><th>A</th><td>B</td></tr></table>',
      endNotes: '<p>Bye.</p>',
    },
  ],
  chapterCount: 3,
  previous: true,
  next: true,
};

test.use({ pages: { [AO3_2]: AO3_CHAPTER } });

/** The story page on its own, handed a story as the content script hands it one. */
async function storyAlone(page: Page, origin: string): Promise<void> {
  await page.goto(`${origin}/story.html`);
  // With no page round it, the story page's own window is its parent: a message it sends itself is heard.
  await page.evaluate((story) => window.postMessage({ eien: 'story', story }, '*'), STORY);
  await page.locator('.story__sheet').waitFor();
  await page.locator('.story__facts summary').click();
}

for (const scheme of ['Day', 'Night'] as const) {
  test(`by ${scheme.toLowerCase()}: the story page and the popup`, async ({ page, context }) => {
    await page.goto(AO3_2);
    await page.getByRole('button', { name: 'Read in Eien' }).click();
    const origin = extensionOrigin(await storyFrame(page));
    const popup = await context.newPage();
    await popup.goto(`${origin}/popup.html`);
    await popup
      .getByRole('group', { name: 'Day or night' })
      .getByRole('button', { name: scheme })
      .click();
    await expect(popup.locator('.popup__said')).not.toHaveText('Looking at this page…');
    expect(await seriousViolations(popup)).toEqual([]);

    const story = await context.newPage();
    await storyAlone(story, origin);
    await expect(story.locator('html')).toHaveAttribute(
      'data-theme',
      scheme === 'Day' ? 'light' : 'dark',
    );
    expect(await seriousViolations(story)).toEqual([]);
  });
}
