// Chromium with the built extension loaded, and the story sites
// answered by the test's own pages: each address the test names is a page,
// any other on those sites is not found.

import { resolve } from 'node:path';
import {
  type BrowserContext,
  test as base,
  chromium,
  expect,
  type Frame,
  type Page,
} from '@playwright/test';

const EXTENSION = resolve(import.meta.dirname, '../../out/extension');

export const test = base.extend<{ context: BrowserContext; pages: Record<string, string> }>({
  pages: [{}, { option: true }],
  context: async ({ pages }, use) => {
    const context = await chromium.launchPersistentContext('', {
      // Chromium itself, not the headless shell, which can't load an extension. EIEN_CHROMIUM names
      // another build where Playwright's own isn't installed.
      ...(process.env.EIEN_CHROMIUM
        ? { executablePath: process.env.EIEN_CHROMIUM }
        : { channel: 'chromium' }),
      args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
    });
    // Nothing reaches the web: a story page's own images (FanFiction.Net's from its CDN) would wait
    // on the network, and the page's load with them. The sites' routes below are tried first.
    await context.route(/^https?:/u, (route) => route.abort());
    for (const host of ['https://archiveofourown.org/**', 'https://*.fanfiction.net/**']) {
      await context.route(host, (route) => {
        const url = new URL(route.request().url());
        const page = pages[`${url.origin}${url.pathname}`];
        return page === undefined
          ? route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not found' })
          : route.fulfill({ contentType: 'text/html; charset=utf-8', body: page });
      });
    }
    await use(context);
    await context.close();
  },
  page: async ({ context }, use) => {
    await use(context.pages()[0] ?? (await context.newPage()));
  },
});

/** The story page's frame over `page`, once it's there. */
export async function storyFrame(page: Page): Promise<Frame> {
  // The frame is in the page before it has gone to the story page: wait for that too.
  const isStory = (each: Frame) => each.url().endsWith('/story.html');
  await expect.poll(() => page.frames().some(isStory)).toBe(true);
  const frame = page.frames().find(isStory);
  if (!frame) throw new Error('The story page’s frame isn’t there.');
  await frame.locator('.story__sheet').waitFor();
  return frame;
}

/** The extension's origin, from its story frame: chrome-extension://<id>. */
export const extensionOrigin = (frame: Frame) => frame.url().replace(/\/story\.html.*$/u, '');
