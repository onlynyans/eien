// axe-core over a window: the WCAG 2.2 A and AA rules, colour contrast
// among them. What the tests allow is no serious or critical violation.

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * Each serious or critical violation on the page at rest, one line each, for
 * the report. With motion reduced, Eien's fades take no time (tokens.css): a
 * control half faded in or out is no colour the writer reads it at.
 */
export async function seriousViolations(page: Page): Promise<string[]> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Hover, and a style the window just changed, follow a frame late.
  await page.evaluate(async () => {
    for (let frame = 0; frame < 2; frame++) await new Promise(requestAnimationFrame);
  });
  // Legacy mode: the default one finishes its run in a new tab, which an Electron window can't open.
  const results = await new AxeBuilder({ page }).withTags(WCAG).setLegacyMode(true).analyze();
  return results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .flatMap((violation) =>
      violation.nodes.map(
        (node) =>
          `${violation.id} (${violation.impact}): ${node.target.join(' ')} — ${
            node.failureSummary?.split('\n').slice(1).join(' ').trim() ?? violation.help
          }`,
      ),
    );
}

/**
 * The violations with the pointer resting over each of `areas` in turn, so
 * the controls that show only under it are checked too, each line marked
 * with where the pointer was.
 */
export async function violationsUnder(page: Page, areas: readonly string[]): Promise<string[]> {
  const found: string[] = [];
  for (const area of areas) {
    const box = await page.locator(area).first().boundingBox();
    if (!box) continue;
    await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 120));
    found.push(...(await seriousViolations(page)).map((line) => `${area}: ${line}`));
  }
  return found;
}
