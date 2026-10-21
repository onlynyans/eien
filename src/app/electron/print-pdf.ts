// A PDF printed by Electron's own Chromium (spec §8), from the page the
// window made of a book or a note (core/export's printHtml). It's printed in
// a hidden window of its own that runs no script, opens nothing and loads
// nothing but the page: a note's words are never a way in.

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { app, BrowserWindow, session } from 'electron';
import type { PageSize } from '../../core/export';

/** The page number at each page's foot, in the page's serif (Chromium fills in the number). */
const FOOTER =
  '<div style="width:100%;text-align:center;font-size:9pt;font-family:Georgia,serif;color:#555"><span class="pageNumber"></span></div>';

/** How long the page may take to load before the print is given up. */
const LOAD_LIMIT_MS = 60_000;

/** The PDF's bytes for the page `html`, on A4 or letter paper. */
export async function printPdf(html: string, page: PageSize): Promise<Uint8Array> {
  const folder = await mkdtemp(join(app.getPath('temp'), 'eien-print-'));
  const file = join(folder, 'print.html');
  // A file, not a data: address: a novel is past what an address may hold.
  await writeFile(file, html, 'utf8');
  const address = pathToFileURL(file).href;
  // Its own session, in memory: nothing it does is kept, and it may ask for nothing.
  const own = session.fromPartition('eien-print');
  own.setPermissionRequestHandler((_contents, _permission, allow) => allow(false));
  // The page itself, and nothing it names (its policy refuses all of that too).
  own.webRequest.onBeforeRequest((details, done) =>
    done({ cancel: details.resourceType !== 'mainFrame' }),
  );
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      session: own,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      javascript: false,
      webviewTag: false,
      spellcheck: false,
    },
  });
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  try {
    let timer: NodeJS.Timeout | undefined;
    const late = new Promise<never>((_, fail) => {
      timer = setTimeout(() => fail(new Error('The page took too long to print.')), LOAD_LIMIT_MS);
    });
    await Promise.race([window.loadURL(address), late]).finally(() => clearTimeout(timer));
    const pdf = await window.webContents.printToPDF({
      pageSize: page === 'letter' ? 'Letter' : 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: FOOTER,
      margins: { top: 0.9, bottom: 0.9, left: 1, right: 1 },
      // The chapters' headings as the PDF's bookmarks; its structure for a screen reader.
      generateDocumentOutline: true,
      generateTaggedPDF: true,
    });
    return new Uint8Array(pdf);
  } finally {
    window.destroy();
    await rm(folder, { recursive: true, force: true });
  }
}
