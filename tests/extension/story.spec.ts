// The extension in Chromium (spec §14): the seal on a story's page,
// the story page over it, its turns, its settings from the popup, and what a
// hostile page can't make it do.

import { expect } from '@playwright/test';
import { AO3_ADULT, AO3_CHAPTER } from '../support/story-pages/ao3';
import { FFN_CHAPTER } from '../support/story-pages/ffn';
import { extensionOrigin, storyFrame, test } from './browser';

const AO3_2 = 'https://archiveofourown.org/works/123/chapters/1002';
const AO3_3 = 'https://archiveofourown.org/works/123/chapters/1003';
const FFN_2 = 'https://www.fanfiction.net/s/42/2/Beneath-the-Walls';
const FFN_3 = 'https://www.fanfiction.net/s/42/3/Beneath-the-Walls';

test.use({
  pages: {
    [AO3_2]: AO3_CHAPTER,
    [AO3_3]: AO3_CHAPTER.replace('chapter-2', 'chapter-3'),
    'https://archiveofourown.org/works/9': AO3_ADULT,
    [FFN_2]: FFN_CHAPTER,
    [FFN_3]: FFN_CHAPTER,
  },
});

test('AO3: the seal opens the chapter on Eien’s sheet, cleaned', async ({ page }) => {
  await page.goto(AO3_2);
  await page.getByRole('button', { name: 'Read in Eien' }).click();
  const story = await storyFrame(page);
  await expect(story.getByRole('heading', { level: 1 })).toHaveText('Beneath the Walls');
  await expect(story.locator('.story__byline')).toHaveText('by Rook, Wren');
  await expect(story.locator('.crumbs')).toHaveText(
    'Harry Potter - J. K. Rowling / Beneath the Walls / ii',
  );
  await expect(story.locator('.story__chapter-title')).toHaveText('The Gate');
  await expect(story.locator('.prose em').first()).toHaveText('groaned');
  await expect(
    story.locator('.prose a[href="https://archiveofourown.org/works/9"]'),
  ).toHaveAttribute('target', '_blank');
  await expect(story.locator('.story__colophon')).toContainText('Chapter ii of 3');
  // The site's own style and script stayed on the site: the sheet wears Eien's.
  await expect(story.locator('.prose p').first()).not.toHaveCSS('color', 'rgb(255, 0, 0)');
  await expect(story.locator('script:not([src])')).toHaveCount(0);
  await expect(page.locator('html')).toHaveCSS('overflow', 'hidden');
});

test('AO3: → turns the chapter, and the story page stays open until Esc closes it', async ({
  page,
}) => {
  await page.goto(AO3_2);
  await page.getByRole('button', { name: 'Read in Eien' }).click();
  await storyFrame(page);
  await page.keyboard.press('ArrowRight');
  await page.waitForURL(`${AO3_3}#workskin`);
  const story = await storyFrame(page);
  await expect(story.locator('.story__colophon')).toContainText('Chapter iii of 3');

  // The key as the page gets it: a pressed key's release would go to a frame that's gone.
  await story.evaluate(() =>
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
  );
  await expect(page.locator('iframe[title="Eien Reader"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Read in Eien' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Read in Eien' })).toBeVisible();
  await expect(page.locator('iframe[title="Eien Reader"]')).toHaveCount(0);
});

test('the band’s × shows the site’s page', async ({ page }) => {
  await page.goto(AO3_2);
  await page.getByRole('button', { name: 'Read in Eien' }).click();
  const story = await storyFrame(page);
  await story.getByRole('button', { name: /Show the site’s page/u }).click();
  await expect(page.locator('iframe[title="Eien Reader"]')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveCSS('overflow', 'hidden');
});

test('FanFiction.Net: a chapter, turned by its own addresses', async ({ page }) => {
  await page.goto(FFN_2);
  await page.getByRole('button', { name: 'Read in Eien' }).click();
  const story = await storyFrame(page);
  await expect(story.locator('.story__chapter-title')).toHaveText('The Gate');
  await expect(story.locator('.prose [data-align="center"] strong')).toHaveText('* * *');
  await expect(story.locator('.prose .scene-break')).toHaveCount(1);
  await story.getByRole('button', { name: 'Next chapter', exact: true }).click();
  await page.waitForURL(FFN_3);
});

test('no seal where the page shows no work', async ({ page }) => {
  await page.goto('https://archiveofourown.org/works/9');
  await expect(page.locator('body')).toContainText('adverse content');
  await expect(page.locator('eien-extension')).toHaveCount(0);
});

test('the site’s own script can’t turn the story’s chapters', async ({ page }) => {
  await page.goto(AO3_2);
  await page.getByRole('button', { name: 'Read in Eien' }).click();
  await storyFrame(page);
  await page.evaluate(() => window.postMessage({ eien: 'turn', to: 'next' }, '*'));
  await page.waitForTimeout(500);
  expect(page.url()).toBe(AO3_2);
});

test('the popup’s settings are worn by the story page at once', async ({ page, context }) => {
  await page.goto(AO3_2);
  await page.getByRole('button', { name: 'Read in Eien' }).click();
  const story = await storyFrame(page);
  const popup = await context.newPage();
  await popup.goto(`${extensionOrigin(story)}/popup.html`);
  await popup
    .getByRole('group', { name: 'Day or night' })
    .getByRole('button', { name: 'Night' })
    .click();
  await popup
    .getByRole('group', { name: 'Typeface' })
    .getByRole('button', { name: 'Literata' })
    .click();
  await popup.getByRole('group', { name: 'Theme' }).getByRole('button', { name: 'Indigo' }).click();
  await expect(story.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(story.locator('html')).toHaveAttribute('data-face', 'literata');
  await expect(story.locator('html')).toHaveAttribute('data-palette', 'indigo');
  await expect(popup.locator('html')).toHaveAttribute('data-palette', 'indigo');
});
