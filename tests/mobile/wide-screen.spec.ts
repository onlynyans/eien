// Wide screen (spec §10, backlog #46): a foldable opened, a tablet, a phone on
// its side, used as the writer chooses: the desktop's panes at a finger's
// size, one at a time, side by side, or two pages with the notes sliding over.
// A finger here, as on a Pixel 7: hasTouch makes the pointer coarse.

import { devices, expect, type Page, test } from '@playwright/test';
import { catchBackButton, open, putOutside, systemBack, threePanes, titles } from './outside';

test.use({ ...devices['Pixel 7'] });
test.beforeEach(({ page }) => catchBackButton(page));

type Room = 'panes' | 'one' | 'side' | 'pages';
type Pane = 'sidebar' | 'list' | 'page';
const PANES: readonly Pane[] = ['sidebar', 'list', 'page'];

/** A foldable's inner screen, held open like a book: its fold down the middle. */
const OPEN_FOLD = { width: 720, height: 820 };
/** A tablet, turned sideways. */
const TABLET = { width: 1180, height: 820 };
/** The phone (Pixel 7), and a foldable folded: under 520px. */
const PHONE = { width: 412, height: 915 };
/** A Galaxy Z Fold 5 opened, upright and sideways: its inner screen, about 590 by 706. */
const FOLD5_UPRIGHT = { width: 590, height: 706 };
const FOLD5_SIDEWAYS = { width: 706, height: 590 };

/**
 * A Galaxy Z Fold 5's inner screen, 1812×2176 pixels, at the density the owner's showed (one pane
 * at a time at 100%, panes at 90%, under the old 520px rule: so 468 to 519px wide), 3.5 a pixel.
 */
const FOLD5 = { width: 518, height: 622 };
const FOLD5_DENSITY = 3.5;
/** Its cover screen, 904×2316 pixels at 2.625 a pixel: a phone's shape, taller still. */
const FOLD5_COVER = { width: 344, height: 882 };
/** Taller than 7:12, held upright (../../src/ui/phone/room.ts, TALL). */
const tall = (screen: { width: number; height: number }) =>
  screen.width / screen.height <= 7 / 12 && screen.height >= screen.width;

const pane = (page: Page, name: Pane) => page.locator(`.shell > .${name}`);
/** The width the panes give the pane beside the page, side by side (not its box, which slides there). */
const besideWidth = (page: Page, name: 'sidebar' | 'list') =>
  page
    .locator('.shell')
    .evaluate((shell, name) => shell.style.getPropertyValue(`--pane-${name}`), name);
const back = (page: Page) => page.locator('.phone-bar__back');
const other = (page: Page) => page.locator('.phone-bar__other');
const titlesOnPage = (page: Page) => page.locator('.page .title');

/** Only `names` in sight. */
async function inSight(page: Page, ...names: Pane[]): Promise<void> {
  for (const each of PANES) {
    if (names.includes(each)) await expect(pane(page, each), each).toBeVisible();
    else await expect(pane(page, each), each).toBeHidden();
  }
}

/** The vault with a folder of two notes and one beside it, the room chosen, on `screen`. */
async function withRoom(
  page: Page,
  room: Room,
  screen: { width: number; height: number },
  more: Record<string, string | number> = {},
): Promise<void> {
  await open(page);
  await threePanes(page); // the list beside the page, which these tests look at; `more` may say two
  await page.evaluate(
    async ([room, more]) => {
      await window.eien.settings.set('appearance.room', room);
      for (const [key, value] of Object.entries(more))
        await window.eien.settings.set(key as never, value as never);
    },
    [room, more] as const,
  );
  await putOutside(
    page,
    'Eien/Vault/Fic/Tear.md',
    '# Tear\n\nThe scarf caught on the gate, and tore.\n',
  );
  await putOutside(page, 'Eien/Vault/Fic/Mend.md', '# Mend\n\nShe mended it by the fire.\n');
  await putOutside(page, 'Eien/Vault/Ideas.md', 'An idea.\n');
  await page.setViewportSize(screen);
  await page.reload(); // the settings as this device keeps them, read as the window starts
  // A tall screen (a phone upright, by its shape) is one at a time, as is one under 440px.
  const fits = !tall(screen) && screen.width >= 440;
  await expect(page.locator('.shell')).toHaveAttribute('data-room', fits ? room : 'one');
  // The vault drawn: All Notes in the list at first, or, with two panes, the folders in the tree.
  if ((await page.locator('.shell').getAttribute('data-panes')) === 'two' && fits)
    await expect(page.locator('.sidebar').getByText('Fic', { exact: true })).toBeVisible();
  else await expect(titles(page)).toHaveCount(3, { timeout: 10_000 });
}

/** Into Fic, and its note `title`. */
async function openInFic(page: Page, title: string): Promise<void> {
  await page.locator('.sidebar').getByText('Fic', { exact: true }).click();
  await titles(page).filter({ hasText: title }).click();
  await expect(titlesOnPage(page).first()).toHaveText(title);
}

test.describe('panes, as before', () => {
  test('the desktop’s panes on a wide touch screen, every target a finger’s', async ({ page }) => {
    await withRoom(page, 'panes', TABLET);
    await inSight(page, 'sidebar', 'list', 'page');
    await expect(back(page)).toBeHidden();
    const row = page.locator('.sidebar .tree-row').first();
    expect((await row.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    // Every control: a square of 44px, the views a well of 44px round theirs, as the phone's are.
    const sizes = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.shell .icon-button, .shell .host__group')]
        .filter((each) => each.checkVisibility() && !each.closest('.host__group > *'))
        .map((each) => each.getBoundingClientRect().height),
    );
    expect(sizes.length).toBeGreaterThan(5);
    for (const size of sizes) expect(size).toBeGreaterThanOrEqual(44);
    // The seal keeps its place, and a finger's reach round it.
    const seal = await page.getByRole('button', { name: 'Hide sidebar' }).boundingBox();
    if (!seal) throw new Error('no seal');
    const reached = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x, y)?.closest('button')?.getAttribute('aria-label'),
      [seal.x + seal.width / 2, seal.y + seal.height + 5] as const,
    );
    expect(reached).toBe('Hide sidebar');
  });

  test('in Running head, its strip holds the finger-sized tools', async ({ page }) => {
    await withRoom(page, 'panes', TABLET, { 'appearance.layout': 'runhead' });
    const strip = await page.locator('.window-head').boundingBox();
    const tool = await page.locator('.window-head .icon-button:visible').first().boundingBox();
    if (!strip || !tool) throw new Error('no running head');
    expect(tool.height).toBeGreaterThanOrEqual(44);
    expect(tool.y + tool.height).toBeLessThanOrEqual(strip.y + strip.height + 0.5);
  });
});

// A phone's own default (#69): a new install's panes are two, the tree listing the notes, so the
// page has the room; Three, once chosen, stands.
test('a new install’s panes are two, the sidebar listing the notes; Three, chosen, stays', async ({
  page,
}) => {
  await open(page);
  await putOutside(page, 'Eien/Vault/Fic/Tear.md', '# Tear\n\nThe scarf caught on the gate.\n');
  await page.setViewportSize(TABLET);
  await page.reload();
  await expect(page.locator('.shell')).toHaveAttribute('data-room', 'panes');
  await expect(page.locator('.shell')).toHaveAttribute('data-panes', 'two');
  await inSight(page, 'sidebar', 'page');
  await page.locator('.sidebar').getByText('Fic', { exact: true }).click();
  await expect(page.locator('.sidebar').getByText('Tear', { exact: true })).toBeVisible();
  await threePanes(page);
  await inSight(page, 'sidebar', 'list', 'page');
});

// What Settings says of it: Two, the phone's own, chosen; Three chosen there stays after a restart.
test('Settings shows a new install’s panes as Two, and Three chosen there stays', async ({
  page,
}) => {
  await open(page);
  await page.setViewportSize(TABLET);
  await page.reload();
  const panes = async () => {
    await page.getByRole('button', { name: 'Settings' }).click();
    const sheet = page.getByRole('dialog', { name: 'Settings' });
    await sheet.getByRole('navigation').getByRole('button', { name: 'Lists', exact: true }).click();
    return { sheet, group: sheet.getByRole('group', { name: 'Panes' }) };
  };
  const { sheet, group } = await panes();
  await expect(group.getByRole('button', { name: 'Two', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await group.getByRole('button', { name: 'Three', exact: true }).click();
  await expect(page.locator('.shell')).toHaveAttribute('data-panes', 'three');
  await sheet.getByRole('button', { name: 'Close settings' }).click();
  await page.reload();
  await expect(page.locator('.shell')).toHaveAttribute('data-panes', 'three');
  const again = await panes();
  await expect(again.group.getByRole('button', { name: 'Three', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test.describe('one at a time', () => {
  test('the phone, wider: one pane, and back', async ({ page }) => {
    await withRoom(page, 'one', TABLET);
    await inSight(page, 'list');
    await back(page).click();
    await inSight(page, 'sidebar');
    await openInFic(page, 'Tear');
    await inSight(page, 'page');
    await expect(back(page)).toHaveText('‹ Fic');
  });
});

test.describe('side by side', () => {
  test('the pane you came from stays beside: the contents by the notes, the notes by the page', async ({
    page,
  }) => {
    await withRoom(page, 'side', OPEN_FOLD);
    await inSight(page, 'sidebar', 'list'); // the notes, the contents beside them
    await expect(back(page)).toBeHidden(); // the contents in sight: nothing to go back to
    await openInFic(page, 'Tear');
    await inSight(page, 'list', 'page');
    await expect(back(page)).toHaveText('‹ Library');
    // Another note from the list beside: only the page changes.
    await titles(page).filter({ hasText: 'Mend' }).click();
    await expect(titlesOnPage(page)).toHaveText('Mend');
    await inSight(page, 'list', 'page');
    await back(page).click();
    await inSight(page, 'sidebar', 'list');
  });

  test('the notes keep their width beside the page, dragged by their edge, and kept', async ({
    page,
  }) => {
    await withRoom(page, 'side', OPEN_FOLD);
    await openInFic(page, 'Tear');
    await expect.poll(() => besideWidth(page, 'list')).toBe('316px'); // the list's own width
    const edge = await page.locator('.pane-edge--list').boundingBox();
    if (!edge) throw new Error('no edge beside the page');
    expect(edge.width).toBeGreaterThanOrEqual(44); // a finger's to take hold of
    const x = edge.x + edge.width / 2;
    const y = edge.y + edge.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 40, y, { steps: 4 });
    await page.mouse.up();
    await expect.poll(() => besideWidth(page, 'list')).toBe('356px');
    await expect.poll(async () => (await pane(page, 'page').boundingBox())?.x).toBe(356);
    await page.reload();
    await openInFic(page, 'Mend');
    await expect.poll(() => besideWidth(page, 'list')).toBe('356px');
  });

  test('on a tablet, the notes are a list’s width beside the page', async ({ page }) => {
    await withRoom(page, 'side', TABLET);
    await openInFic(page, 'Tear');
    await expect.poll(() => besideWidth(page, 'list')).toBe('316px');
  });

  test('folded, it’s the phone again, at the pane you were at; opened, the pane before is back', async ({
    page,
  }) => {
    await withRoom(page, 'side', OPEN_FOLD);
    await openInFic(page, 'Tear');
    await page.setViewportSize(PHONE);
    await inSight(page, 'page');
    await expect(titlesOnPage(page)).toHaveText('Tear');
    await page.setViewportSize(OPEN_FOLD);
    await inSight(page, 'list', 'page');
  });
});

test.describe('two pages', () => {
  test('the notes slide over the page, which stays; a tap on it, or back, puts them away', async ({
    page,
  }) => {
    await withRoom(page, 'pages', TABLET);
    await back(page).click();
    await openInFic(page, 'Tear');
    await inSight(page, 'page');
    await back(page).click(); // ‹ Fic: the notes come to the page
    await inSight(page, 'list', 'page');
    const list = await pane(page, 'list').boundingBox();
    expect(list?.width).toBeLessThan(TABLET.width / 2);
    // Over the scrim that dims the page, not under it. The page is inert under the notes, which a
    // hit test passes through, so it's lifted for the look: what's drawn on top at a note's place.
    const onTop = async () => {
      // Measured where the note is now: the notes slide in.
      const mend = await titles(page).filter({ hasText: 'Mend' }).boundingBox();
      if (!mend) return null;
      return page.evaluate(
        ([x, y]) => {
          const under = document.querySelector<HTMLElement>('.shell > .page');
          if (!under) return null;
          under.inert = false;
          const hit = document.elementFromPoint(x, y)?.closest('.shell > *')?.classList[0];
          under.inert = true;
          return hit ?? null;
        },
        [mend.x + mend.width / 2, mend.y + mend.height / 2] as const,
      );
    };
    await expect.poll(onTop).toBe('list');
    // A tap on the page beside the notes puts them away, and opens nothing.
    await page.mouse.click(TABLET.width - 40, TABLET.height / 2);
    await inSight(page, 'page');
    await expect(titlesOnPage(page)).toHaveText('Tear');
    // A second note chosen from them opens beside the first: two pages.
    await back(page).click();
    await titles(page).filter({ hasText: 'Mend' }).click();
    await inSight(page, 'page');
    await expect(titlesOnPage(page)).toHaveText(['Tear', 'Mend']);
  });

  test('the system’s back puts the notes away, and leaves the page as it was', async ({ page }) => {
    await withRoom(page, 'pages', TABLET);
    await back(page).click();
    await openInFic(page, 'Tear');
    await back(page).click();
    await inSight(page, 'list', 'page');
    await systemBack(page);
    await inSight(page, 'page');
    await expect(titlesOnPage(page)).toHaveText('Tear');
  });

  test('the second note chosen faces the first; folded, it’s a tap away, and back beside at a tap', async ({
    page,
  }) => {
    await withRoom(page, 'pages', TABLET, { 'appearance.split': 'facing' });
    await back(page).click();
    await openInFic(page, 'Tear');
    await back(page).click();
    await titles(page).filter({ hasText: 'Mend' }).click(); // the second note: the facing page
    await expect(titlesOnPage(page)).toHaveText(['Tear', 'Mend']);
    await expect(other(page)).toBeHidden(); // it's on the facing page, not a tap away
    // Folded: one page, the one you're in; the facing note a tap away.
    await page.setViewportSize(PHONE);
    await expect(titlesOnPage(page)).toHaveCount(1);
    await expect(titlesOnPage(page)).toHaveText('Mend');
    await expect(other(page)).toHaveAccessibleName('Switch to Tear');
    // Opened again, the note you came from comes back as the facing page at a tap.
    await page.setViewportSize(TABLET);
    await other(page).click();
    await expect(titlesOnPage(page)).toHaveCount(2);
  });

  test('a note’s long press opens it to the side; side by side has no such choice', async ({
    page,
  }) => {
    await withRoom(page, 'pages', TABLET);
    await back(page).click();
    await openInFic(page, 'Tear');
    await back(page).click();
    await titles(page).filter({ hasText: 'Mend' }).click({ button: 'right' });
    await page.locator('.menu [role^="menuitem"]', { hasText: /^Open to the Side$/ }).click();
    await expect(titlesOnPage(page)).toHaveCount(2);
  });
});

test.describe('changed in Settings', () => {
  test('the window follows at once, and the panes’ settings come and go with the panes', async ({
    page,
  }) => {
    await withRoom(page, 'one', TABLET);
    await back(page).click();
    await page.getByRole('button', { name: 'Settings' }).click();
    const sheet = page.getByRole('dialog', { name: 'Settings' });
    const lists = sheet.getByRole('navigation').getByRole('button', { name: 'Lists', exact: true });
    await expect(lists).toBeHidden();
    const room = sheet.getByRole('group', { name: 'Wide screen' });
    await room.getByRole('button', { name: 'Panes', exact: true }).click();
    await expect(page.locator('.shell')).toHaveAttribute('data-room', 'panes');
    await expect(lists).toBeVisible();
    await room.getByRole('button', { name: 'Side by side', exact: true }).click();
    await expect(page.locator('.shell')).toHaveAttribute('data-room', 'side');
    await expect(lists).toBeHidden();
    await sheet.getByRole('button', { name: 'Close settings' }).click();
    await inSight(page, 'sidebar', 'list');
  });

  test('leaving two pages for a room with one closes the page beside, its note a tap away', async ({
    page,
  }) => {
    await withRoom(page, 'pages', TABLET);
    await back(page).click();
    await openInFic(page, 'Tear');
    await back(page).click();
    await titles(page).filter({ hasText: 'Mend' }).click(); // the second note: beside the first
    await expect(titlesOnPage(page)).toHaveCount(2);
    await page.getByRole('button', { name: 'More' }).click();
    await page.locator('.menu [role^="menuitem"]', { hasText: /^Settings$/ }).click();
    const sheet = page.getByRole('dialog', { name: 'Settings' });
    await sheet
      .getByRole('group', { name: 'Wide screen' })
      .getByRole('button', { name: 'Side by side' })
      .click();
    await sheet.getByRole('button', { name: 'Close settings' }).click();
    await expect(titlesOnPage(page)).toHaveCount(1);
    await expect(titlesOnPage(page)).toHaveText('Mend'); // the page you're in stays
    await expect(other(page)).toHaveAccessibleName('Switch to Tear');
  });
});

for (const room of ['panes', 'side', 'pages'] as const) {
  test(`a phone, folded or upright, is one at a time with ${room} chosen`, async ({ page }) => {
    await withRoom(page, room, PHONE);
    await inSight(page, 'list');
  });
}

test.describe('a Galaxy Z Fold 5 opened upright, about 590px', () => {
  test('side by side keeps the contents beside the notes', async ({ page }) => {
    await withRoom(page, 'side', FOLD5_UPRIGHT);
    await inSight(page, 'sidebar', 'list');
    await openInFic(page, 'Tear');
    await inSight(page, 'list', 'page');
  });

  test('two pages slide the notes over the page', async ({ page }) => {
    await withRoom(page, 'pages', FOLD5_UPRIGHT);
    await back(page).click();
    await openInFic(page, 'Tear');
    await back(page).click();
    await inSight(page, 'list', 'page');
  });

  test('two pages, short of two sheets’ 720px: the second note chosen folds in with the first, a pager naming both', async ({
    page,
  }) => {
    await withRoom(page, 'pages', FOLD5_UPRIGHT);
    await back(page).click();
    await openInFic(page, 'Tear');
    await back(page).click();
    await titles(page).filter({ hasText: 'Mend' }).click();
    await inSight(page, 'page');
    const pager = page.getByRole('group', { name: 'The two pages' });
    await expect(pager).toBeVisible();
    await expect(pager.getByRole('button')).toHaveText([/Tear/, /Mend/]);
    await pager.getByRole('button', { name: 'Tear' }).click(); // a tap turns to the other
    await expect(page.getByRole('region', { name: 'Tear, the active page' })).toBeVisible();
  });

  for (const split of ['sheets', 'facing', 'companion', 'follow'] as const) {
    test(`two pages, with Two pages when narrow (${split}): side by side, each half the screen, nothing past its page`, async ({
      page,
    }) => {
      await withRoom(page, 'pages', FOLD5_UPRIGHT, {
        'appearance.narrowPages': 'on',
        'appearance.split': split,
      });
      await back(page).click();
      await openInFic(page, 'Tear');
      await back(page).click();
      await titles(page).filter({ hasText: 'Mend' }).click();
      await expect(titlesOnPage(page)).toHaveText(['Tear', 'Mend']);
      await expect(page.getByRole('group', { name: 'The two pages' })).toBeHidden();
      const leaves = await page.locator('.page__pages > .page__leaf').evaluateAll((sheets) =>
        sheets.map((sheet) => {
          const box = sheet.getBoundingClientRect();
          const past = [...sheet.querySelectorAll<HTMLElement>('button')]
            .filter((button) => button.checkVisibility())
            .filter((button) => {
              const at = button.getBoundingClientRect();
              return at.left < box.left - 0.5 || at.right > box.right + 0.5;
            })
            .map((button) => button.getAttribute('aria-label'));
          return { width: box.width, past };
        }),
      );
      expect(leaves.map(({ past }) => past)).toEqual([[], []]);
      // Even halves of the room (Facing pages' gutter and margins aside).
      const [left, right] = leaves.map(({ width }) => width);
      expect(Math.abs((left ?? 0) - (right ?? 0))).toBeLessThan(2);
      expect(left).toBeGreaterThan(FOLD5_UPRIGHT.width * 0.4);
    });
  }

  test('panes, short of the desktop’s 600px, show what fits: two, the tree listing the notes', async ({
    page,
  }) => {
    await withRoom(page, 'panes', FOLD5_UPRIGHT);
    await expect(page.locator('.shell')).toHaveAttribute('data-panes', 'two');
    await inSight(page, 'sidebar', 'page');
  });
});

test.describe('the desktop’s panes on a Fold 5 sideways', () => {
  for (const layout of ['band', 'slip', 'runhead'] as const) {
    test(`${layout}: the tools that don’t fit fold behind a ⋯; nothing runs past the page or the screen`, async ({
      page,
    }) => {
      await withRoom(page, 'panes', FOLD5_SIDEWAYS, {
        'appearance.layout': layout,
        'editor.formatBar': 'on',
      });
      // Two panes here for the room (#68): Fic's notes in the tree.
      await expect(page.locator('.shell')).toHaveAttribute('data-panes', 'two');
      await page.locator('.sidebar').getByText('Fic', { exact: true }).click();
      await page.locator('.sidebar').getByText('Tear', { exact: true }).click();
      await expect(titlesOnPage(page)).toHaveText('Tear');
      const bar = page.locator(layout === 'runhead' ? '.window-head' : '.page__bar');
      const more = bar.getByRole('button', { name: 'More tools' });
      const drawn = await bar.evaluate((bar) => {
        const box = bar.getBoundingClientRect();
        const style = getComputedStyle(bar);
        // Inside the bar, and the bar inside its page (A's and B's) and the screen.
        const room = bar.closest('.page')?.getBoundingClientRect().right ?? innerWidth;
        const left = box.left + Number.parseFloat(style.paddingLeft);
        const right = Math.min(box.right - Number.parseFloat(style.paddingRight), room, innerWidth);
        const controls = [...bar.querySelectorAll<HTMLElement>('button')]
          .filter((button) => button.checkVisibility())
          .map((button) => ({
            name: button.getAttribute('aria-label'),
            box: button.getBoundingClientRect(),
          }));
        return {
          outside: controls
            .filter(({ box }) => box.left < left - 0.5 || box.right > right + 0.5)
            .map(({ name }) => name),
          overlapping: controls.flatMap((one, at) =>
            controls
              .slice(at + 1)
              .filter(({ box }) => box.left < one.box.right - 0.5 && one.box.left < box.right - 0.5)
              .filter(({ box }) => box.top < one.box.bottom - 0.5 && one.box.top < box.bottom - 0.5)
              .map(({ name }) => `${one.name} over ${name}`),
          ),
          scrolls: getComputedStyle(bar).overflowX,
          // The formatting row (A's) too, when it's on.
          formatOutside: [...document.querySelectorAll<HTMLElement>('.page__format button')]
            .filter((button) => button.checkVisibility())
            .filter(
              (button) => button.getBoundingClientRect().right > Math.min(room, innerWidth) + 0.5,
            )
            .map((button) => button.getAttribute('aria-label')),
          folded: [...bar.querySelectorAll<HTMLElement>('.host [data-command][hidden]')].map(
            (button) => button.getAttribute('aria-label'),
          ),
          scale: window.visualViewport?.scale,
          viewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content'),
        };
      });
      expect(drawn.outside).toEqual([]);
      expect(drawn.formatOutside).toEqual([]);
      expect(drawn.overlapping).toEqual([]);
      expect(drawn.scrolls).not.toBe('auto');
      // A and B's bar is the page's, 246px here: tools fold. C's is the window's, and they fit.
      expect(drawn.folded.length > 0).toBe(layout !== 'runhead');
      expect(drawn.scale).toBe(1);
      // A phone's browser zooms out to show what runs past the screen (a Fold 5 did, leaving the
      // window's lower half blank), which Chromium's phone emulation doesn't: the page forbids it.
      expect(drawn.viewport).toContain('minimum-scale=1');
      if (drawn.folded.length === 0) {
        await expect(more).toBeHidden();
        return;
      }
      // The ⋯ offers just what folded.
      await more.click();
      const offered = page.locator('.menu [role^="menuitem"]');
      await expect(offered).toHaveText(drawn.folded.map((name) => name ?? ''));
    });
  }

  test('compact takes space from the contents’ rows, still a finger’s reach', async ({ page }) => {
    await withRoom(page, 'panes', TABLET, { 'appearance.density': 'compact' });
    const row = page.locator('.sidebar .tree-row').first();
    expect((await row.boundingBox())?.height).toBe(36);
  });
});

// #68: the room by the screen's shape, which zoom doesn't change. A Fold 5 opened is near square
// (5:6), a phone upright tall (9:20), so a Fold 5 at its own size has Wide screen's every room.
test.describe('a Galaxy Z Fold 5 at its own size, 1812×2176 pixels', () => {
  test.use({ deviceScaleFactor: FOLD5_DENSITY });

  for (const room of ['side', 'pages', 'one'] as const)
    test(`opened, upright: ${room} as chosen`, async ({ page }) => {
      await withRoom(page, room, FOLD5);
      await expect(page.locator('.shell')).toHaveAttribute('data-room', room);
      await expect
        .poll(() => page.evaluate(() => [screen.width * devicePixelRatio, devicePixelRatio]))
        .toEqual([FOLD5.width * FOLD5_DENSITY, FOLD5_DENSITY]);
    });

  test('opened, upright: Panes shows two, the tree listing the notes, with Three chosen', async ({
    page,
  }) => {
    await withRoom(page, 'panes', FOLD5);
    await expect(page.locator('.shell')).toHaveAttribute('data-panes', 'two');
    await inSight(page, 'sidebar', 'page');
    await page.locator('.sidebar').getByText('Fic', { exact: true }).click();
    await page.locator('.sidebar').getByText('Tear', { exact: true }).click();
    await expect(titlesOnPage(page).first()).toHaveText('Tear');
    await inSight(page, 'sidebar', 'page'); // the page beside the tree, no step to it
  });

  test('at 70%, turned on its side (889px), three panes fit; upright again (740px), two', async ({
    page,
  }) => {
    await withRoom(page, 'panes', FOLD5, { 'window.zoom': 70 });
    await expect(page.locator('.shell')).toHaveAttribute('data-panes', 'two');
    await page.setViewportSize({ width: FOLD5.height, height: FOLD5.width });
    await expect(page.locator('.shell')).toHaveAttribute('data-panes', 'three');
    await inSight(page, 'sidebar', 'list', 'page');
    await page.setViewportSize(FOLD5);
    await expect(page.locator('.shell')).toHaveAttribute('data-panes', 'two');
  });

  test('the foot’s Panes says two are here for the room, and follows the room as it turns', async ({
    page,
  }) => {
    await withRoom(page, 'panes', FOLD5, { 'window.zoom': 70 });
    const toggle = page.locator('.host--foot [data-command="panes"]');
    const crowded = async () => {
      await expect(toggle).toHaveAttribute(
        'data-tip',
        'Three panes, two here for the room · switch to two',
      );
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    };
    await crowded();
    await page.setViewportSize({ width: FOLD5.height, height: FOLD5.width }); // room for three
    await expect(toggle).toHaveAttribute('data-tip', 'Three panes · switch to two');
    await page.setViewportSize(FOLD5);
    await crowded();
    await toggle.click(); // Two chosen, as it said
    await expect(toggle).toHaveAttribute('data-tip', 'Two panes · switch to three');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  for (const room of ['panes', 'side', 'pages'] as const)
    test(`folded, its cover screen is one at a time with ${room} chosen`, async ({ page }) => {
      await withRoom(page, room, FOLD5_COVER);
      await inSight(page, 'list');
    });
});

test('a phone upright zoomed out to 50%, 824px wide, is still one at a time: tall', async ({
  page,
}) => {
  await withRoom(page, 'panes', PHONE, { 'window.zoom': 50 });
  await expect.poll(() => page.evaluate(() => innerWidth)).toBe(PHONE.width * 2);
  await expect(page.locator('.shell')).toHaveAttribute('data-room', 'one');
  await inSight(page, 'list');
});

// #68: the room follows each of its queries as the window changes, the window and Settings alike.
// Each step changes one query alone: the screen's shape (600px wide or more either side), or a
// window under 440px (narrower than 600px either side, and never tall).
test.describe('the room follows each of its queries live', () => {
  const NEAR_SQUARE = { width: 900, height: 1000 };
  /** As tall as a phone, wider than 600px: a phone upright, zoomed out. */
  const TALL_WIDE = { width: 700, height: 1300 };
  const SMALL = { width: 500, height: 700 };
  /** Under 440px, not a phone's shape: a small window beside another. */
  const CRAMPED = { width: 420, height: 600 };

  test('a screen turned tall is one at a time, and back', async ({ page }) => {
    await withRoom(page, 'panes', NEAR_SQUARE);
    await page.setViewportSize(TALL_WIDE);
    await expect(page.locator('.shell')).toHaveAttribute('data-room', 'one');
    await page.setViewportSize(NEAR_SQUARE);
    await expect(page.locator('.shell')).toHaveAttribute('data-room', 'panes');
  });

  test('a window under 440px is one at a time, and back', async ({ page }) => {
    await withRoom(page, 'side', SMALL);
    await page.setViewportSize(CRAMPED);
    await expect(page.locator('.shell')).toHaveAttribute('data-room', 'one');
    await page.setViewportSize(SMALL);
    await expect(page.locator('.shell')).toHaveAttribute('data-room', 'side');
  });

  test('Settings, open, offers the panes’ settings as the shape changes', async ({ page }) => {
    await withRoom(page, 'panes', NEAR_SQUARE);
    await page.getByRole('button', { name: 'Settings' }).click();
    const sheet = page.getByRole('dialog', { name: 'Settings' });
    const lists = sheet.getByRole('navigation').getByRole('button', { name: 'Lists', exact: true });
    await expect(lists).toBeVisible();
    await page.setViewportSize(TALL_WIDE);
    await expect(lists).toBeHidden();
    await page.setViewportSize(NEAR_SQUARE);
    await expect(lists).toBeVisible();
  });
});
