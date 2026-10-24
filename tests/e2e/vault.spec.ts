// Phase 3 on the real app and a real folder: open, browse, write, save, and
// keep both when a file changes in two places (spec §2–§3).

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron } from '@playwright/test';
import {
  appEnv,
  clickMenu,
  closeApp,
  editorContent,
  editorLines,
  expect,
  ROOT,
  readQuietly,
  test,
} from './launch';

const SEVENTEEN = '"Look," he begins more softly.\r\n\r\nIt takes her a minute.\r\n';

test.use({
  vaultFiles: {
    'Fic/A Mended Scarf/The Tear.md': 'The scarf catches.\n',
    'Fic/A Mended Scarf/Seventeen.md': SEVENTEEN,
    'Fic/A Mended Scarf/Needle and Thread.md': 'A sewing kit.\n',
    'Fic/A Mended Scarf/.eien-folder.json': JSON.stringify({
      order: ['The Tear.md', 'Needle and Thread.md', 'Seventeen.md'],
      book: {},
    }),
    'Ideas.md': 'Snow on the walls.\n',
    '.eien/config.json': '{}',
  },
});

const fileIn = (vault: string | null, path: string) => {
  if (!vault) throw new Error('no vault');
  return join(vault, ...path.split('/'));
};
/** '' while the file can't be read, so a poll tries again (./launch.ts). */
const readIn = (vault: string | null, path: string) => readQuietly(fileIn(vault, path));

test('shows the vault’s folders and notes, and a book’s chapters in order', async ({ page }) => {
  await expect(page.locator('.tree-row__label', { hasText: 'All Notes' })).toBeVisible();
  await expect(page.locator('.note-row__title'))
    .toHaveText(['Seventeen', 'Needle and Thread', 'The Tear', 'Ideas'], {
      useInnerText: true,
    })
    .catch(async () => {
      // All Notes is newest first; the seeded files may share a timestamp, so check the set.
      const titles = await page.locator('.note-row__title').allInnerTexts();
      expect(titles.sort()).toEqual(['Ideas', 'Needle and Thread', 'Seventeen', 'The Tear']);
    });
  await page.locator('.tree-row__label', { hasText: 'Fic' }).click();
  await page.locator('.tree-row__label', { hasText: 'A Mended Scarf' }).click();
  await expect(page.locator('.list__heading')).toHaveText('A Mended Scarf');
  await expect(page.locator('.note-row')).toHaveText([
    /i\s*The Tear/,
    /ii\s*Needle and Thread/,
    /iii\s*Seventeen/,
  ]);
  await expect(page.locator('.tree-row__label', { hasText: 'config' })).toHaveCount(0); // .eien stays hidden
});

test('saves what is typed, in the file’s own line endings', async ({ page, vault }) => {
  await page.locator('.note-row', { hasText: 'Seventeen' }).click();
  await expect(page.locator('.title')).toHaveText('Seventeen');
  await expect(editorLines(page)).toHaveText([
    '"Look," he begins more softly.',
    '',
    'It takes her a minute.',
    '',
  ]);
  await editorContent(page).click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type('She takes it.');
  await expect
    .poll(() => readIn(vault, 'Fic/A Mended Scarf/Seventeen.md'), { timeout: 5000 })
    .toBe(`${SEVENTEEN}She takes it.`);
  await expect(page.locator('.colophon__words')).toHaveText('13 words');
});

test('quitting straight after typing loses nothing', async ({ app, page, vault }) => {
  await page.locator('.note-row', { hasText: 'Ideas' }).click();
  await editorContent(page).click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(' And the scarf.');
  await closeApp(app); // well inside the 800 ms pause: only the save-before-close can have written it
  expect(readIn(vault, 'Ideas.md')).toBe('Snow on the walls.\n And the scarf.');
});

test('a change made elsewhere appears when nothing is unsaved here', async ({ page, vault }) => {
  await page.locator('.note-row', { hasText: 'Ideas' }).click();
  writeFileSync(fileIn(vault, 'Ideas.md'), 'Snow on the walls, and wind.\n');
  await expect(editorLines(page)).toHaveText(['Snow on the walls, and wind.', ''], {
    timeout: 5000,
  });
});

test('when the file and the editor both changed, both are kept', async ({ page, vault }) => {
  await page.locator('.note-row', { hasText: 'Ideas' }).click();
  await editorContent(page).click();
  await page.keyboard.press('ControlOrMeta+End');
  // Change the file in the same moment, before this edit can save.
  writeFileSync(fileIn(vault, 'Ideas.md'), 'Their version.\n');
  await page.keyboard.type(' Mine.');
  await expect(page.locator('.notice')).toContainText('Your version is kept beside it', {
    timeout: 5000,
  });
  const copies = readdirSync(fileIn(vault, '')).filter((name) =>
    name.startsWith('Ideas (conflict '),
  );
  expect(copies).toHaveLength(1);
  expect(readIn(vault, 'Ideas.md')).toBe('Their version.\n');
  await expect.poll(() => readIn(vault, copies[0] ?? '')).toContain('Mine.');
  await expect(page.locator('.title')).toHaveText(/^Ideas \(conflict /);
});

test('a new note is made in the folder shown, and saves', async ({ page, vault }) => {
  await page.locator('.tree-row__label', { hasText: 'Fic' }).click();
  await page.getByRole('button', { name: 'New note' }).click();
  await expect(page.locator('.title')).toHaveText('Untitled');
  await expect(editorContent(page)).toBeFocused();
  await page.keyboard.type('A first line.');
  await expect
    .poll(() => readIn(vault, 'Fic/Untitled.md'), { timeout: 5000 })
    .toBe('A first line.');
  await page.getByRole('button', { name: 'New note' }).click();
  await expect(page.locator('.title')).toHaveText('Untitled 2');
});

test('the window cannot reach outside its vault', async ({ page }) => {
  const outcomes = await page.evaluate(async () => {
    const tries = ['../outside.md', '/etc/hosts', 'Fic/../../outside.md', 'C:/Windows/win.ini'];
    return Promise.all(
      tries.map((path) =>
        window.eien.vault.read(path).then(
          () => 'read',
          () => 'refused',
        ),
      ),
    );
  });
  expect(outcomes).toEqual(['refused', 'refused', 'refused', 'refused']);
});

test.describe('the vault it starts in', () => {
  test.use({ vaultFiles: null });

  test('with none opened before, its own, made for it; what is already in it stays', async ({
    userData,
  }) => {
    // A separate copy's own vault is Vault in its data folder (an installed copy's: Documents/Eien/Vault).
    const own = join(userData, 'Vault');
    mkdirSync(own);
    writeFileSync(join(own, 'Waiting.md'), 'Already here.\n');
    const app = await _electron.launch({ args: [ROOT], cwd: ROOT, env: appEnv(userData) });
    try {
      await expect((await app.firstWindow()).locator('.note-row__title')).toHaveText(['Waiting']);
      expect(readFileSync(join(own, 'Waiting.md'), 'utf8')).toBe('Already here.\n');
    } finally {
      await closeApp(app);
    }
  });

  test.describe('when the vault last opened is gone', () => {
    test.use({ deviceFile: { vault: join(tmpdir(), 'eien-unplugged-drive', 'Novel') } });

    test('the window says so and asks, rather than show an empty vault in its place', async ({
      page,
      userData,
    }) => {
      await expect(page.locator('.welcome__lede')).toContainText('couldn’t open the folder');
      await expect(page.getByRole('button', { name: 'Choose a folder…' })).toBeVisible();
      expect(existsSync(join(userData, 'Vault'))).toBe(false);
    });
  });

  test('when its own vault can’t be made, the window asks for a folder', async ({ userData }) => {
    writeFileSync(join(userData, 'Vault'), ''); // a file where the folder would go
    const app = await _electron.launch({ args: [ROOT], cwd: ROOT, env: appEnv(userData) });
    try {
      const page = await app.firstWindow();
      await expect(page.getByRole('button', { name: 'Choose a folder…' })).toBeVisible();
    } finally {
      await closeApp(app);
    }
  });
});

test.describe('choosing a vault', () => {
  test.use({ vaultFiles: null });

  test('a chosen folder opens, and opens again on the next launch', async ({
    app,
    page,
    userData,
  }) => {
    const folder = mkdtempSync(join(tmpdir(), 'eien-chosen-'));
    try {
      writeFileSync(join(folder, 'Chosen.md'), 'Here.\n');
      // The system's folder picker can't be clicked by a test: answer it from the main process.
      await app.evaluate(({ dialog }, path) => {
        dialog.showOpenDialog = (async () => ({
          canceled: false,
          filePaths: [path],
        })) as typeof dialog.showOpenDialog;
      }, folder);
      await expect(page.locator('.tree-row__label', { hasText: 'All Notes' })).toBeVisible();
      await clickMenu(app, 'File', 'Open Vault…');
      await expect(page.locator('.note-row__title')).toHaveText(['Chosen']);
      await closeApp(app);

      const again = await _electron.launch({ args: [ROOT], cwd: ROOT, env: appEnv(userData) });
      try {
        await expect((await again.firstWindow()).locator('.note-row__title')).toHaveText([
          'Chosen',
        ]);
      } finally {
        await closeApp(again);
      }
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});

test.describe('after a crash', () => {
  test.use({ vaultFiles: null });

  test('a newer half-written save is kept as a recovered note', async ({ userData }) => {
    const folder = mkdtempSync(join(tmpdir(), 'eien-crash-'));
    try {
      writeFileSync(join(folder, 'Seventeen.md'), 'Old words.\n');
      utimesSync(join(folder, 'Seventeen.md'), new Date(2026, 0, 1), new Date(2026, 0, 1));
      writeFileSync(join(folder, '.Seventeen.md.eien.tmp'), 'Newer words, never renamed.\n');
      const app = await _electron.launch({
        args: [ROOT],
        cwd: ROOT,
        env: appEnv(userData, folder),
      });
      try {
        const page = await app.firstWindow();
        await expect(page.locator('.note-row__title', { hasText: 'recovered' })).toHaveCount(1);
        const recovered = readdirSync(folder).find((name) => name.includes('(recovered '));
        expect(recovered && readFileSync(join(folder, recovered), 'utf8')).toBe(
          'Newer words, never renamed.\n',
        );
        expect(readdirSync(folder).some((name) => name.endsWith('.eien.tmp'))).toBe(false);
      } finally {
        await closeApp(app);
      }
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
