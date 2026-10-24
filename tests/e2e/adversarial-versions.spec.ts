// Adversarial: phase 7 (seals) on the real app — where the caret and the
// undo history go when a seal gives a note its id, the hidden front matter
// against the writer's keys, Compare in Reading, the panel's keyboard, and
// seals that can't be written.

import { chmodSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ElectronApplication, Page } from '@playwright/test';
import {
  ALONE,
  clickMenu,
  editorContent,
  expect,
  fakeTrash,
  readQuietly,
  test,
  type VaultFiles,
} from './launch';

const ID = 'ABCDEFGHJK';
const SEALED_TEXT = 'Words here.';

test.use({
  vaultFiles: {
    'Draft.md': 'One two three four five six seven eight nine ten.',
    'Short.md': 'Hi',
    'Undo.md': 'Keep this.',
    'Sealed.md': `---\nid: ${ID}\n---\n${SEALED_TEXT}`,
    'Bare.md': '---\nid: BAREBAREBA\n---',
    'Windows.md': '\uFEFF# Windows\r\n\r\nTyped on a PC.\r\n',
  },
});

const at = (vault: string | null, path: string) => join(vault ?? '', ...path.split('/'));
/** '' while the file can't be read, so a poll tries again (./launch.ts). */
const read = (vault: string | null, path: string) => readQuietly(at(vault, path));
const idOf = (text: string) => /^---\nid: (\S+)\n---\n/.exec(text)?.[1] ?? null;
const sealsOf = (vault: string | null, id: string) => {
  const folder = at(vault, `.eien/versions/${id}`);
  return existsSync(folder) ? readdirSync(folder).sort() : [];
};
const row = (page: Page, title: string) =>
  page
    .locator('.note-row')
    .filter({ has: page.locator('.note-row__title', { hasText: new RegExp(`^${title}$`) }) });
const sealLine = (page: Page) => page.locator('.seal-line');
const seal = (app: ElectronApplication) => clickMenu(app, 'File', 'Seal');
const panelOf = (page: Page) => page.getByRole('complementary', { name: 'Versions' });

/** A seal's file name `minutesAgo` before now, as Eien names them. */
const sealName = (minutesAgo: number, name = '') =>
  `${new Date(Date.now() - minutesAgo * 60_000).toISOString().slice(0, 19).replace(/:/g, '-')}Z${name ? `--${name}` : ''}.md`;

/** `count` seals of the note `id`, a minute apart, each `words` long, the newest `firstAgo` minutes ago. */
function sealFiles(id: string, count: number, words = 50, firstAgo = 1): VaultFiles {
  const files: VaultFiles = {};
  const body = Array.from({ length: words }, (_, i) => `word${i % 97}`).join(' ');
  for (let i = 0; i < count; i++) {
    files[`.eien/versions/${id}/${sealName(firstAgo + i)}`] = `---\nid: ${id}\n---\n${body} ${i}.`;
  }
  return files;
}

const setWindow = (app: ElectronApplication, width: number, height: number) =>
  app.evaluate(
    ({ BrowserWindow }, [width, height]) =>
      BrowserWindow.getAllWindows()[0]?.setContentSize(width, height),
    [width, height] as const,
  );

async function open(page: Page, title: string): Promise<void> {
  await row(page, title).click();
  await expect(page.locator('.title')).toHaveText(title);
}

async function typeAtEnd(page: Page, words: string): Promise<void> {
  // At the text's start: on a narrow window the versions panel lies over the page's middle.
  await editorContent(page).click({ position: { x: 4, y: 4 } });
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(words);
}

test.describe('the first seal, which gives the note its id', () => {
  test('typing on after ⌘S carries on where the caret was', async ({ app, page, vault }) => {
    // The writer seals mid-flow and keeps typing: the words must follow "ten.", not land mid-sentence.
    await open(page, 'Draft');
    await typeAtEnd(page, ' Eleven.');
    await seal(app);
    await expect(sealLine(page)).toHaveText('Sealed just now');
    await page.keyboard.type(' Twelve.');
    await expect
      .poll(() => read(vault, 'Draft.md'))
      .toMatch(
        /^---\nid: \S+\n---\nOne two three four five six seven eight nine ten\. Eleven\. Twelve\.$/,
      );
  });

  test('in Source, typing after ⌘S never lands in the new front matter', async ({
    app,
    page,
    vault,
  }) => {
    // A short note sealed in Source: the caret must stay after "Hi", not move into "id: …".
    await open(page, 'Short');
    await page.getByRole('button', { name: 'Source', exact: true }).click();
    await typeAtEnd(page, '!');
    await seal(app);
    await expect(sealLine(page)).toHaveText('Sealed just now');
    await expect.poll(() => idOf(read(vault, 'Short.md'))).not.toBeNull();
    const id = idOf(read(vault, 'Short.md'));
    await page.keyboard.type(' there');
    await expect.poll(() => read(vault, 'Short.md')).toBe(`---\nid: ${id}\n---\nHi! there`);
  });

  test('⌘Z after the first ⌘S still brings back a sentence deleted before it', async ({
    app,
    page,
    vault,
  }) => {
    // Deleted by mistake, then sealed: the sentence was never in a seal, so undo is all that holds it.
    const sentence = ' A sentence deleted by mistake.';
    await open(page, 'Undo');
    await typeAtEnd(page, sentence);
    await expect.poll(() => read(vault, 'Undo.md')).toBe(`Keep this.${sentence}`);
    // The control: before any seal, ⌘Z brings a deletion back.
    for (let i = 0; i < sentence.length; i++) await page.keyboard.press('Backspace');
    await expect.poll(() => read(vault, 'Undo.md')).toBe('Keep this.');
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => read(vault, 'Undo.md')).toBe(`Keep this.${sentence}`);
    // The same after a first seal.
    for (let i = 0; i < sentence.length; i++) await page.keyboard.press('Backspace');
    await expect.poll(() => read(vault, 'Undo.md')).toBe('Keep this.');
    await seal(app);
    await expect(sealLine(page)).toHaveText('Sealed just now');
    await page.keyboard.press('ControlOrMeta+z');
    await expect
      .poll(() => read(vault, 'Undo.md'), { timeout: 3000 })
      .toMatch(/^---\nid: \S+\n---\nKeep this\. A sentence deleted by mistake\.$/);
  });
  test('hardening: a note with a byte-order mark and CRLF keeps both when its first seal adds the id', async ({
    app,
    page,
    vault,
  }) => {
    await open(page, 'Windows');
    await seal(app);
    await expect(sealLine(page)).toHaveText('Sealed just now');
    await expect.poll(() => read(vault, 'Windows.md')).toMatch(/^\uFEFF---\r\nid: \S+\r\n---\r\n/);
    const text = read(vault, 'Windows.md');
    expect(text).toMatch(/^\uFEFF---\r\nid: \S+\r\n---\r\n# Windows\r\n\r\nTyped on a PC\.\r\n$/);
    const id = /id: (\S+)/.exec(text)?.[1] ?? '-';
    const [file] = sealsOf(vault, id);
    expect(read(vault, `.eien/versions/${id}/${file}`)).toBe(text.slice(1).replace(/\r\n/g, '\n'));
  });
});

test.describe('the hidden front matter', () => {
  test('hardening: Source → Live (View menu) with the caret at the very top: typing still reaches the note', async ({
    app,
    page,
    vault,
  }) => {
    // The caret sat on "---" in Source; in Live the writer types and the words vanish.
    await open(page, 'Sealed');
    await page.getByRole('button', { name: 'Source', exact: true }).click();
    await editorContent(page).click();
    await page.keyboard.press('ControlOrMeta+Home');
    await clickMenu(app, 'View', 'Live');
    await expect(editorContent(page)).not.toContainText('id:');
    await page.keyboard.type('Hello ');
    await expect.poll(() => read(vault, 'Sealed.md'), { timeout: 3000 }).toContain('Hello');
    expect(idOf(read(vault, 'Sealed.md'))).toBe(ID);
  });

  test('typing in a note that is only its id, with no line end after it, keeps the id', async ({
    page,
    vault,
  }) => {
    // "---" closing the file: the first letter typed joins it ("---H"), and the id is gone.
    await open(page, 'Bare');
    await editorContent(page).click();
    await page.keyboard.type('Hello');
    await expect.poll(() => read(vault, 'Bare.md')).toContain('Hello');
    expect(idOf(read(vault, 'Bare.md'))).toBe('BAREBAREBA');
  });

  test('hardening: select all and delete, cut, and paste over all keep the id', async ({
    page,
    vault,
  }) => {
    await open(page, 'Sealed');
    await editorContent(page).click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('Retyped.');
    await expect.poll(() => read(vault, 'Sealed.md')).toBe(`---\nid: ${ID}\n---\nRetyped.`);
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('ControlOrMeta+x');
    await expect.poll(() => read(vault, 'Sealed.md')).toBe(`---\nid: ${ID}\n---\n`);
    await page.keyboard.press('ControlOrMeta+v');
    await page.keyboard.press('ControlOrMeta+v');
    await expect.poll(() => read(vault, 'Sealed.md')).toBe(`---\nid: ${ID}\n---\nRetyped.Retyped.`);
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('ControlOrMeta+v');
    await expect.poll(() => read(vault, 'Sealed.md')).toBe(`---\nid: ${ID}\n---\nRetyped.`);
  });
});

test.describe('Compare', () => {
  test('in Reading, a key typed in Compare doesn’t change the read-only note', async ({
    app,
    page,
    vault,
  }) => {
    // Reading is read-only (spec §4); the key typed to leave Compare is written into the note anyway.
    await open(page, 'Sealed');
    await seal(app);
    await expect(sealLine(page)).toHaveText('Sealed just now');
    await page.getByRole('button', { name: 'Reading', exact: true }).click();
    await clickMenu(app, 'View', 'Compare');
    await expect(page.locator('.compare')).toBeVisible();
    await page.locator('.compare').focus();
    await page.keyboard.type('x');
    await expect(editorContent(page)).toBeVisible();
    await page.waitForTimeout(1500); // past the autosave pause
    expect(read(vault, 'Sealed.md')).toBe(`---\nid: ${ID}\n---\n${SEALED_TEXT}`);
  });
});

test.describe('the versions panel', () => {
  test('a seal deleted from the keyboard leaves the keyboard in the panel', async ({
    app,
    page,
  }) => {
    // Enter on Delete: the row goes, and the keyboard with it, to nowhere.
    const trash = await fakeTrash(app);
    await open(page, 'Sealed');
    await seal(app);
    await expect(sealLine(page)).toHaveText('Sealed just now');
    await typeAtEnd(page, ' More.');
    await seal(app);
    await clickMenu(app, 'View', 'Versions');
    const panel = page.getByRole('complementary', { name: 'Versions' });
    await expect(panel.locator('.version__when')).toHaveCount(3);
    const remove = panel.getByRole('button', { name: /to the trash$/ }).first();
    await remove.focus();
    await page.keyboard.press('Enter');
    await expect(panel.locator('.version__when')).toHaveCount(2);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const active = document.activeElement;
          return active !== null && active !== document.body;
        }),
      )
      .toBe(true);
    expect(readdirSync(trash)).toHaveLength(1);
  });

  test('deleting the seal Changes is showing doesn’t leave its words on show', async ({
    app,
    page,
  }) => {
    // Compare shows the changes since the newest seal; that seal goes to the trash, and the view stays.
    await fakeTrash(app);
    await open(page, 'Sealed');
    await seal(app);
    await expect(sealLine(page)).toHaveText('Sealed just now');
    await typeAtEnd(page, ' Second.');
    await seal(app);
    await expect.poll(() => panelOf(page).isHidden()).toBe(true);
    await typeAtEnd(page, ' Third.');
    await clickMenu(app, 'View', 'Compare');
    await expect(page.locator('.compare ins.diff')).toHaveText(['Third.']);
    await clickMenu(app, 'View', 'Versions');
    const panel = panelOf(page);
    await expect(panel.locator('.version__when')).toHaveCount(3);
    await panel
      .getByRole('button', { name: /to the trash$/ })
      .first()
      .click();
    await expect(panel.locator('.version__when')).toHaveCount(2);
    // Either the draft again, or the changes since the seal that's left: "Second." and "Third." added.
    await expect
      .poll(async () =>
        (await page.locator('.compare').count()) === 0
          ? 'draft'
          : (await page.locator('.compare ins.diff').allTextContents()).join(' '),
      )
      .toMatch(/^(draft|Second\. Third\.)$/);
  });

  test('a name being typed isn’t cut short when the panel redraws (another device’s seal arriving)', async ({
    app,
    page,
    vault,
  }) => {
    // Half a name is kept and the rest typed into nowhere; the minute's redraw does the same.
    await open(page, 'Sealed');
    await seal(app);
    await expect(sealLine(page)).toHaveText('Sealed just now');
    await clickMenu(app, 'View', 'Versions');
    const panel = panelOf(page);
    await panel.getByRole('button', { name: /^Name the seal/ }).click();
    await page.keyboard.type('before ');
    writeFileSync(at(vault, `.eien/versions/${ID}/${sealName(3, 'on the phone')}`), 'Phone.');
    await expect(panel.locator('.version__name')).toHaveText(['on the phone']);
    await page.keyboard.type('the rewrite');
    await page.keyboard.press('Enter');
    await expect(panel.locator('.version__name')).toHaveText([
      'before the rewrite',
      'on the phone',
    ]);
  });
});

test.describe('a seal that can’t be written', () => {
  test('⌘S where the note’s seals folder is a file tells the writer it wasn’t sealed', async ({
    app,
    page,
    vault,
  }) => {
    // Another tool left a file where .eien/versions/<id> should be: ⌘S does nothing, and says nothing.
    mkdirSync(at(vault, '.eien/versions'), { recursive: true });
    writeFileSync(at(vault, `.eien/versions/${ID}`), 'not a folder');
    await open(page, 'Sealed');
    await seal(app);
    await expect(page.locator('.list__notice')).toHaveText(/version/i, { timeout: 3000 });
  });

  test('⌘S when the latest seal can’t be read still seals the note, or says why not', async ({
    app,
    page,
    vault,
  }) => {
    test.skip(process.platform === 'win32', 'file modes');
    const folder = at(vault, `.eien/versions/${ID}`);
    mkdirSync(folder, { recursive: true });
    const locked = join(folder, '2026-10-19T08-00-00Z.md');
    writeFileSync(locked, `---\nid: ${ID}\n---\nOlder words.`);
    chmodSync(locked, 0o000);
    try {
      await open(page, 'Sealed');
      await seal(app);
      await expect
        .poll(
          async () =>
            sealsOf(vault, ID).length > 1 ||
            ((await page.locator('.list__notice').textContent()) ?? '') !== '',
          { timeout: 3000 },
        )
        .toBe(true);
    } finally {
      chmodSync(locked, 0o644);
    }
  });
});

const SHARED = 'SHAREDNOTE';

test.describe('words typed while a seal is under way', () => {
  test.use({
    vaultFiles: {
      'Original.md': `---\nid: ${SHARED}\n---\nFirst draft.`,
      'Copy.md': `---\nid: ${SHARED}\n---\nFirst draft.`,
      ...sealFiles(SHARED, 300),
    },
  });

  test('⌘S on a copied note, then typing on: the words typed while its seals are copied stay', async ({
    app,
    page,
    vault,
  }) => {
    // The copy's first seal copies 300 seals; the page is then set back to the text from before them.
    await open(page, 'Copy');
    await typeAtEnd(page, ' Before.');
    await expect.poll(() => read(vault, 'Copy.md')).toContain('Before.');
    await seal(app);
    await page.keyboard.type(' Typed while sealing.');
    await expect(sealLine(page)).toHaveText('Sealed just now', { timeout: 20_000 });
    await expect
      .poll(() => read(vault, 'Copy.md'), { timeout: 5000 })
      .toContain('First draft. Before. Typed while sealing.');
  });
});

test.describe('restoring while old seals are thinned', () => {
  test.use({
    vaultFiles: {
      'Sealed.md': `---\nid: ${ID}\n---\n${SEALED_TEXT}`,
      [`.eien/versions/${ID}/${sealName(5, 'the old ending')}`]: `---\nid: ${ID}\n---\nThe old ending.`,
      // One day, two months ago: all but its last go to the trash on the next seal.
      ...Object.fromEntries(
        Array.from({ length: 12 }, (_, i) => [
          `.eien/versions/${ID}/${sealName(60 * 24 * 60 + i)}`,
          `---\nid: ${ID}\n---\nOld ${i}.`,
        ]),
      ),
    },
  });

  test('words typed during a Restore that’s thinning (a slow trash) are kept somewhere', async ({
    app,
    page,
    vault,
  }) => {
    // Restore seals the draft, waits on the trash, then puts the seal over what was typed meanwhile.
    const trash = await fakeTrash(app, { delayMs: 400 });
    await open(page, 'Sealed');
    await clickMenu(app, 'View', 'Versions');
    await panelOf(page).getByRole('button', { name: 'Restore “the old ending”' }).click();
    await typeAtEnd(page, ' Typed while restoring.');
    await expect(sealLine(page)).toHaveText('Restored. The previous draft was saved as a version', {
      timeout: 20_000,
    });
    await page.waitForTimeout(1500); // past the autosave pause
    const everywhere = [
      read(vault, 'Sealed.md'),
      ...sealsOf(vault, ID).map((file) => read(vault, `.eien/versions/${ID}/${file}`)),
    ];
    expect(readdirSync(trash).length).toBeGreaterThan(0);
    expect(everywhere.some((text) => text.includes('Typed while restoring.'))).toBe(true);
  });
});

test.describe('many seals', () => {
  test.use({
    vaultFiles: {
      'Sealed.md': `---\nid: ${ID}\n---\n${SEALED_TEXT}`,
      ...sealFiles(ID, 1000, 300),
    },
  });

  test(
    'hardening: a thousand seals are listed and counted, and ⌘S still seals, in good time',
    ALONE,
    async ({ app, page, vault }) => {
      await open(page, 'Sealed');
      await expect(sealLine(page)).toHaveText('Sealed 1m ago');
      let started = Date.now();
      await clickMenu(app, 'View', 'Versions');
      const panel = panelOf(page);
      await expect(panel.locator('.version__when')).toHaveCount(1001, { timeout: 10_000 });
      await expect
        .poll(
          () =>
            panel
              .locator('.version .count')
              .evaluateAll((els) => els.filter((el) => !el.textContent).length),
          {
            timeout: 20_000,
          },
        )
        .toBe(0);
      const counted = Date.now() - started;
      started = Date.now();
      await typeAtEnd(page, ' More.');
      await seal(app);
      await expect(sealLine(page)).toHaveText('Sealed just now', { timeout: 10_000 });
      const sealedIn = Date.now() - started;
      expect(sealsOf(vault, ID)).toHaveLength(1001);
      console.log(`1000 seals: listed and counted in ${counted} ms; sealed in ${sealedIn} ms`);
      expect(counted).toBeLessThan(10_000);
      expect(sealedIn).toBeLessThan(5_000);
    },
  );
});

test.describe('the window', () => {
  test('hardening: sealing, Compare, the panel and naming never set a style attribute (CSP)', async ({
    app,
    page,
  }) => {
    await page.evaluate(() => {
      const w = window as unknown as { refused: string[] };
      w.refused = [];
      document.addEventListener('securitypolicyviolation', (event) =>
        w.refused.push(`${event.violatedDirective} ${event.sample}`),
      );
    });
    await open(page, 'Draft');
    await seal(app);
    await expect(sealLine(page)).toHaveText('Sealed just now');
    await typeAtEnd(page, ' Eleven.');
    await clickMenu(app, 'View', 'Compare');
    await expect(page.locator('.compare ins.diff')).toHaveText(['Eleven.']);
    await clickMenu(app, 'View', 'Compare');
    await clickMenu(app, 'View', 'Compare');
    await clickMenu(app, 'View', 'Versions');
    await panelOf(page)
      .getByRole('button', { name: /^Name the seal/ })
      .click();
    await page.keyboard.type('named');
    await page.keyboard.press('Enter');
    await expect(panelOf(page).locator('.version__name')).toHaveText('named');
    await setWindow(app, 900, 700);
    await page.getByRole('button', { name: 'Reading', exact: true }).click();
    await page.getByRole('button', { name: 'Live', exact: true }).click();
    expect(await page.evaluate(() => (window as unknown as { refused: string[] }).refused)).toEqual(
      [],
    );
  });

  test('hardening: on a narrow page the panel lies over it, inside the window, and Close gives the page the keyboard', async ({
    app,
    page,
  }) => {
    await setWindow(app, 1000, 700);
    await open(page, 'Sealed');
    await clickMenu(app, 'View', 'Versions');
    const panel = panelOf(page);
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    const width = await page.evaluate(() => window.innerWidth);
    expect(box && box.x + box.width).toBeLessThanOrEqual(width + 1);
    expect(await panel.evaluate((el) => getComputedStyle(el).position)).toBe('absolute');
    await panel.getByRole('button', { name: 'Close', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(panel).toBeHidden();
    await page.keyboard.type('Typed after closing. ');
    await expect(editorContent(page)).toContainText('Typed after closing.');
  });

  test('hardening: Esc leaves a seal’s name as it was; Enter cleans a name of characters no system can store', async ({
    app,
    page,
    vault,
  }) => {
    await open(page, 'Sealed');
    await seal(app);
    await expect(sealLine(page)).toHaveText('Sealed just now');
    await clickMenu(app, 'View', 'Versions');
    const panel = panelOf(page);
    await panel.getByRole('button', { name: /^Name the seal/ }).click();
    await page.keyboard.type('before: the "rewrite"?');
    await page.keyboard.press('Enter');
    await expect(panel.locator('.version__name')).toHaveText('before the rewrite');
    await expect.poll(() => sealsOf(vault, ID)[0]).toMatch(/Z--before the rewrite\.md$/);
    await panel.getByRole('button', { name: /^Rename/ }).click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('thrown away');
    await page.keyboard.press('Escape');
    await expect(panel.locator('.version__name')).toHaveText('before the rewrite');
    await expect(panel.getByRole('button', { name: /^Rename/ })).toBeFocused();
    await panel.getByRole('button', { name: /^Rename/ }).click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('x'.repeat(400));
    await page.keyboard.press('Enter');
    await expect.poll(() => sealsOf(vault, ID)[0]?.length ?? 0).toBeGreaterThan(200);
    expect(Buffer.byteLength(sealsOf(vault, ID)[0] ?? '')).toBeLessThanOrEqual(255);
  });
});

/** Slow the main process's `name` from node:fs/promises by `ms` for paths holding `part`. */
const slowFs = (
  app: ElectronApplication,
  name: 'readFile' | 'link' | 'open',
  part: string,
  ms: number,
) =>
  app.evaluate(
    (_electron, [name, part, ms]) => {
      const fsp = process.getBuiltinModule('node:fs/promises') as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      const original = fsp[name] as (...args: unknown[]) => Promise<unknown>;
      fsp[name] = async (...args: unknown[]) => {
        if (args.some((arg) => String(arg).includes(part)))
          await new Promise((done) => setTimeout(done, ms));
        return original(...args);
      };
      process.getBuiltinModule('node:module').syncBuiltinESMExports();
    },
    [name, part, ms] as const,
  );

test.describe('another note opened while a seal is at work', () => {
  test.use({
    vaultFiles: {
      'Draft.md': 'One two three four five six seven eight nine ten.',
      'Sealed.md': `---\nid: ${ID}\n---\n${SEALED_TEXT}`,
      [`.eien/versions/${ID}/${sealName(5, 'the old ending')}`]: `---\nid: ${ID}\n---\nThe old ending.`,
      ...Object.fromEntries(
        Array.from({ length: 12 }, (_, i) => [
          `.eien/versions/${ID}/${sealName(60 * 24 * 60 + i)}`,
          `---\nid: ${ID}\n---\nOld ${i}.`,
        ]),
      ),
    },
  });

  test('a Restore that finishes after another note is opened never puts its words in that note', async ({
    app,
    page,
    vault,
  }) => {
    // Restore, then open Draft while it thins: the old note's words land on Draft's page, and typing saves them over Draft.
    await fakeTrash(app, { delayMs: 300 });
    await open(page, 'Sealed');
    await clickMenu(app, 'View', 'Versions');
    await panelOf(page).getByRole('button', { name: 'Restore “the old ending”' }).click();
    await open(page, 'Draft');
    await expect
      .poll(() => read(vault, 'Sealed.md'), { timeout: 20_000 })
      .toContain('The old ending.');
    await typeAtEnd(page, ' Mine.');
    await expect
      .poll(() => read(vault, 'Draft.md'))
      .toBe('One two three four five six seven eight nine ten. Mine.');
  });

  test('a Restore whose draft is slow to seal still restores its own note, never the one opened meanwhile', async ({
    app,
    page,
    vault,
  }) => {
    // The draft's seal is slow to write (a virus scanner, a network drive): Draft opens before the
    // restore reaches the page, and the Restore was dropped.
    await fakeTrash(app);
    await open(page, 'Sealed');
    await clickMenu(app, 'View', 'Versions');
    await slowFs(app, 'open', '.eien', 1000);
    await panelOf(page).getByRole('button', { name: 'Restore “the old ending”' }).click();
    await open(page, 'Draft');
    await expect
      .poll(() => read(vault, 'Sealed.md'), { timeout: 20_000 })
      .toBe(`---\nid: ${ID}\n---\nThe old ending.`);
    await expect(editorContent(page)).toHaveText(
      'One two three four five six seven eight nine ten.',
    );
    await typeAtEnd(page, ' Mine.');
    await expect
      .poll(() => read(vault, 'Draft.md'))
      .toBe('One two three four five six seven eight nine ten. Mine.');
  });

  test('Compare that finishes after another note is opened doesn’t show over that note', async ({
    app,
    page,
  }) => {
    // The seal is slow to read (a big file, a network drive): Compare lands on the next note's page.
    await open(page, 'Sealed');
    await expect(sealLine(page)).toHaveText(/^Sealed /);
    await slowFs(app, 'readFile', '.eien', 1500);
    await clickMenu(app, 'View', 'Compare');
    await open(page, 'Draft');
    await page.waitForTimeout(2500); // the slow read is done
    await expect(editorContent(page)).toBeVisible();
    await expect(page.locator('.compare')).toHaveCount(0);
  });

  test('⌘S while the note is being renamed leaves one note, under the new name, with its id', async ({
    app,
    page,
    vault,
  }) => {
    // The move is slow (a synced folder); the seal writes the old name back, and the renamed note loses its id.
    await open(page, 'Draft');
    await slowFs(app, 'link', 'Draft.md', 1500);
    await page.locator('.title').click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('Renamed');
    await page.keyboard.press('Enter');
    await seal(app);
    await expect.poll(() => existsSync(at(vault, 'Renamed.md')), { timeout: 10_000 }).toBe(true);
    await page.waitForTimeout(3000); // the seal, the watcher and any reload are done
    const notes = readdirSync(at(vault, '')).filter((name) => name.endsWith('.md'));
    const texts = Object.fromEntries(notes.map((name) => [name, read(vault, name)]));
    expect(notes.sort(), JSON.stringify(texts)).toEqual(['Renamed.md', 'Sealed.md']);
    const id = idOf(read(vault, 'Renamed.md'));
    expect(id).not.toBeNull();
    expect(sealsOf(vault, id ?? '-')).toHaveLength(1);
  });
});
