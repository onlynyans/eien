// TEMPORARY diagnostic (draft PR, not for merging): why the list head's quiet icons read
// ~0.27 opacity on Linux CI. Logs what changes under a still pointer; always passes.

import { expect, test } from './launch';

test.use({
  vaultFiles: {
    'Ideas.md': 'Snow on the walls. #draft\n',
    'Thaw.md': 'The ice goes.\n',
  },
});

test('diagnose: the list head under a still pointer', async ({ page }) => {
  const head = page.locator('.list__head').first();
  await expect(head).toBeVisible();
  const box = await head.boundingBox();
  if (!box) throw new Error('no box');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const watch = () =>
    page.evaluate(
      () =>
        new Promise<{ records: number; sameHead: boolean; sample: string[] }>((done) => {
          const before = document.querySelector('.list__head');
          let records = 0;
          const sample: string[] = [];
          const observer = new MutationObserver((list) => {
            records += list.length;
            for (const r of list) {
              if (sample.length >= 12) break;
              const t = r.target as Element;
              const name =
                t.nodeType === 1
                  ? `${t.tagName}.${t.className}`
                  : `#text in ${t.parentElement?.className}`;
              sample.push(
                `${r.type}${r.attributeName ? `:${r.attributeName}` : ''} ${name}`.slice(0, 140),
              );
            }
          });
          observer.observe(document.body, {
            subtree: true,
            childList: true,
            attributes: true,
            characterData: true,
          });
          setTimeout(() => {
            observer.disconnect();
            done({ records, sameHead: document.querySelector('.list__head') === before, sample });
          }, 1500);
        }),
    );
  const state = () =>
    page.evaluate(
      ([px, py]) => {
        const icon = document.querySelector('.list__head .icon-button--quiet');
        const under = document.elementFromPoint(px, py);
        const head = document.querySelector('.list__head');
        return {
          window: `${innerWidth}x${innerHeight}`,
          heads: document.querySelectorAll('.list__head').length,
          headRect: JSON.stringify(head?.getBoundingClientRect()),
          headHover: head?.matches(':hover'),
          under: under ? `${under.tagName}.${under.className}` : null,
          underInHead: head && under ? head.contains(under) : null,
          icon: icon ? `${icon.getAttribute('aria-label')} ${icon.className}` : null,
          opacity: icon ? getComputedStyle(icon).opacity : null,
          transition: icon ? getComputedStyle(icon).transition : null,
          animations: icon
            ? icon.getAnimations().map((a) => `${a.playState} ${a.currentTime}`)
            : null,
          visibility: document.visibilityState,
        };
      },
      [x, y] as const,
    );
  await page.mouse.move(1, 1);
  console.log('DIAG rest', JSON.stringify(await state()));
  console.log('DIAG rest mutations', JSON.stringify(await watch()));
  await page.mouse.move(x, y);
  await page.mouse.move(x + 2, y + 2);
  console.log('DIAG hovered now', JSON.stringify(await state()));
  console.log('DIAG hovered mutations', JSON.stringify(await watch()));
  console.log('DIAG hovered after 1.5s', JSON.stringify(await state()));
  await page.waitForTimeout(1000);
  console.log('DIAG hovered after 2.5s', JSON.stringify(await state()));
});
