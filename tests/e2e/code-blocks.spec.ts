// A fenced code block in Live on the real app (spec §4): its fences out of
// sight, the block's ground kept round the code, the code at the words' scale.

import { editorContent, expect, test } from './launch';

test.use({
  vaultFiles: {
    'Sums.md':
      'The sums we keep.\n\n```\nGross = Updated / Received\nClose% = Closed / Leads\n```\n\nAfter the sums.\n',
  },
});

test('hides its fences, and sets the code a size short of the words, not the Source view’s', async ({
  page,
}) => {
  await page.locator('.note-row', { hasText: 'Sums' }).click();
  await editorContent(page).locator('.cm-line', { hasText: 'After the sums.' }).click();
  const fences = editorContent(page).locator('.cm-line.eien-fence');
  await expect(fences).toHaveCount(2);
  for (const fence of await fences.all()) await expect(fence).toHaveText('');
  const size = (words: string) =>
    editorContent(page)
      .locator('.cm-line', { hasText: words })
      .evaluate((line) => Number.parseFloat(getComputedStyle(line).fontSize));
  const prose = await size('The sums we keep.');
  const code = await size('Gross = Updated');
  expect(code / prose).toBeCloseTo(0.86, 2);
  // On a fence's line its marks show, to be edited.
  await editorContent(page).locator('.cm-line', { hasText: 'Close%' }).click();
  await page.keyboard.press('ArrowDown');
  await expect(editorContent(page).locator('.cm-line.eien-fence')).toHaveCount(1);
  await expect(editorContent(page).locator('.cm-line', { hasText: '```' })).toHaveCount(1);
});
