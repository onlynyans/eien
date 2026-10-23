// Resource budgets, beside the speed budgets (./budgets.spec.ts): how many
// elements the window holds with thousands of notes, that its memory comes
// back after a long session of switching, how soon the first list is drawn,
// and the size of the built renderer. Each budget was measured on a Mac, then
// given room for CI's slower machines (AGENTS.md, Testing). BUDGETS=1 prints
// what each measured.

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { ALONE, expect, ROOT, test, type VaultFiles } from './launch';

/**
 * Elements in the window with 3,000 notes listed (measured: 492 with three panes, 689 with
 * two). A taller window draws more rows; one element per note would be over 15,000.
 */
const ELEMENTS = 1500;
/** The JS heap may grow this much over 200 notes and 20 layouts switched (measured: 0.58 MB). */
const HEAP_GROWTH = 3 * 1024 * 1024;
/** From the window's start to the first list of 3,000 notes drawn (measured: 150 to 190 ms). */
const FIRST_LIST_MS = 1500;
/**
 * The built renderer's own code and styles, in bytes, +10%. Measured again as features land:
 * 1,614,848 and 137,409 with 3E's row menu and rename in place (#42); 1,688,127 and 152,698
 * with 3D's tags and formatting bar (#41); CSS 169,893 (on Windows) with the ten monos'
 * @font-face rules, Latin and Latin Extended only (ui/theme/monos.css, #54). The CSS is
 * minified from #54 on (electron.vite.config.ts): about 110,000 then, with room for the
 * shut sidebar (#57) and the table editor (#58).
 */
const RENDERER = { js: 1_860_000, css: 118_000 };

const report = (what: string, value: number) => {
  if (process.env.BUDGETS) console.log(`${what}: ${value.toLocaleString()}`);
  return value;
};

const MANY: VaultFiles = Object.fromEntries(
  Array.from({ length: 3000 }, (_, i) => [`Note ${i}.md`, `Words of note ${i}. #many\n`]),
);

/** Every element in the window, those in shadow roots (the editor's) too. */
const elements = (page: Page) =>
  page.evaluate(() => {
    const count = (root: ParentNode): number =>
      [...root.querySelectorAll('*')].reduce(
        (sum, element) => sum + 1 + (element.shadowRoot ? count(element.shadowRoot) : 0),
        0,
      );
    return count(document);
  });

test.describe('three thousand notes', () => {
  test.use({ vaultFiles: { ...MANY, 'Chapter.md': 'The first line.\n' } });

  test('the window holds a few thousand elements, not one per note', async ({ page }) => {
    test.setTimeout(90_000);
    await expect(page.locator('.note-row').first()).toBeVisible({ timeout: 30_000 });
    await page.locator('.tree-row__name[data-key="all"]').click();
    await page.locator('.note-row[data-path="Chapter.md"]').click();
    await expect(page.locator('.title')).toHaveText('Chapter');
    expect(report('elements, three panes', await elements(page))).toBeLessThan(ELEMENTS);

    await page.locator('.sidebar__foot [data-command="panes"]').click();
    await expect(page.locator('.shell')).toHaveAttribute('data-panes', 'two');
    await page.locator('.tree-row__twist[data-key="twist:/all"][aria-expanded="false"]').click();
    await expect(page.locator('.tree-row--note').first()).toBeVisible();
    expect(report('elements, two panes', await elements(page))).toBeLessThan(ELEMENTS);
  });

  test('the first list is drawn soon after the window starts', ALONE, async ({ page }) => {
    test.setTimeout(90_000);
    // The window's own clock starts as it does; the first row seen is the list drawn.
    const drawn = await page.waitForFunction(
      () => (document.querySelector('.note-row') ? performance.now() : 0),
      null,
      { polling: 'raf', timeout: 30_000 },
    );
    expect(report('first list, ms', Math.round(await drawn.jsonValue()))).toBeLessThan(
      FIRST_LIST_MS,
    );
  });
});

test.describe('a long session', () => {
  const NOTES = 20;
  test.use({
    vaultFiles: Object.fromEntries(
      Array.from({ length: NOTES }, (_, i) => [
        `Note ${String(i).padStart(2, '0')}.md`,
        `# Note ${i}\n\n${'Words on the page, *some* of them **strong**. '.repeat(40)}\n`,
      ]),
    ),
  });

  test(
    'switching notes 200 times and layouts 20 times gives its memory back',
    ALONE,
    async ({ page }) => {
      test.setTimeout(180_000);
      const cdp = await page.context().newCDPSession(page);
      const heap = async () => {
        // Twice: what the first frees can let a second free more.
        await cdp.send('HeapProfiler.collectGarbage');
        await cdp.send('HeapProfiler.collectGarbage');
        return (await cdp.send('Runtime.getHeapUsage')).usedSize;
      };
      const name = (i: number) => `Note ${String(i % NOTES).padStart(2, '0')}`;
      const row = (i: number) => page.locator(`.note-row[data-path="${name(i)}.md"]`);
      const switchNotes = async (times: number) => {
        for (let i = 0; i < times; i++) {
          await row(i).click();
          await expect(page.locator('.title')).toHaveText(name(i));
        }
      };
      const switchLayouts = async (times: number) => {
        await page.getByRole('button', { name: 'Settings' }).click();
        const dialog = page.getByRole('dialog', { name: 'Settings' });
        for (let i = 0; i < times; i++) {
          const layout = (['slip', 'runhead', 'band'] as const)[i % 3];
          // The Layout choice: the Running head's strip ground has a swatch named Band too.
          await dialog
            .getByRole('group', { name: 'Layout' })
            .locator(`[data-value="${layout}"]`)
            .click();
          await expect(page.locator('html')).toHaveAttribute('data-layout', layout as string);
        }
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
      };

      await expect(row(0)).toBeVisible();
      // Warmed up: every note and layout seen once, so what's cached for good is in the baseline.
      await switchNotes(NOTES);
      await switchLayouts(3);
      const before = await heap();
      await switchNotes(200);
      await switchLayouts(20);
      await switchNotes(NOTES);
      const growth = (await heap()) - before;
      report('heap before, bytes', before);
      expect(report('heap growth, bytes', growth)).toBeLessThan(HEAP_GROWTH);
    },
  );

  test(
    'a page opened beside and closed 50 times leaves nothing behind',
    ALONE,
    async ({ app, page }) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width: 1600, height: 900 });
      const cdp = await page.context().newCDPSession(page);
      const heap = async () => {
        await cdp.send('HeapProfiler.collectGarbage');
        await cdp.send('HeapProfiler.collectGarbage');
        return (await cdp.send('Runtime.getHeapUsage')).usedSize;
      };
      const pages = page.locator('.page__pages > .page__scroll');
      const besideAndBack = async (times: number) => {
        for (let i = 0; i < times; i++) {
          const note = `Note ${String((i % (NOTES - 1)) + 1).padStart(2, '0')}`;
          await page
            .locator(`.note-row[data-path="${note}.md"]`)
            .click({ modifiers: ['ControlOrMeta'] });
          await expect(pages).toHaveCount(2);
          await app.evaluate(({ BrowserWindow, Menu }) => {
            const window = BrowserWindow.getAllWindows()[0];
            const close = Menu.getApplicationMenu()
              ?.items.find((item) => item.label === 'File')
              ?.submenu?.items.find((item) => item.label === 'Close Window');
            close?.click(undefined, window, window?.webContents);
          });
          await expect(pages).toHaveCount(1);
        }
      };
      await page.locator('.note-row[data-path="Note 00.md"]').click();
      await expect(page.locator('.page__scroll[data-active] .title')).toHaveText('Note 00');
      await besideAndBack(3); // warmed up
      const elementsBefore = await elements(page);
      const before = await heap();
      await besideAndBack(50);
      expect(await elements(page), 'elements, the page closed each time').toBe(elementsBefore);
      const growth = (await heap()) - before;
      expect(report('heap growth after 50 pages beside, bytes', growth)).toBeLessThan(HEAP_GROWTH);
    },
  );
});

test('the built renderer’s code and styles stay within their budget', () => {
  // npm run test:e2e builds first; so does CI, before these tests.
  const assets = join(ROOT, 'out', 'renderer', 'assets');
  const size = (extension: string) =>
    readdirSync(assets)
      .filter((name) => name.endsWith(extension))
      .reduce((sum, name) => sum + statSync(join(assets, name)).size, 0);
  expect(report('renderer JavaScript, bytes', size('.js'))).toBeLessThan(RENDERER.js);
  expect(report('renderer CSS, bytes', size('.css'))).toBeLessThan(RENDERER.css);
});
