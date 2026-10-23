// What leaves the app (spec §8): Copy as HTML puts the HTML on the
// clipboard, as text (for a site's HTML box) and as HTML (for its rich text
// box); an export (HTML, EPUB, Word, PDF) is saved where the writer
// chooses, through the system's own dialog, so the window never names a
// place on disk. A PDF is printed here, from the page the window made.

import { writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { app, type BrowserWindow, ClipboardItem, clipboard, dialog } from 'electron';
import { safeName } from '../../core/paths';
import { CHANNEL, type OutFile, type OutKind } from '../../platform/bridge';
import { answer, text } from './ipc';
import { printPdf } from './print-pdf';

/** The most the window may hand over at once: a long novel's HTML, many times over. */
const MAX_OUT_CHARS = 32 * 1024 * 1024;
/** The most an EPUB or a Word file may be: a long novel's, stored, many times over. */
const MAX_OUT_BYTES = 64 * 1024 * 1024;
/** The most a name offered may be: a title, many times over. */
const MAX_NAME_CHARS = 1000;

/** The most a PDF's page may be: its images are in it as base64, 48 MB of them at most. */
const MAX_PAGE_CHARS = 96 * 1024 * 1024;

function bounded(value: unknown, name: string, most = MAX_OUT_CHARS): string {
  const out = text(value, name);
  if (out.length > most) throw new RangeError(`${name} is too long.`);
  return out;
}

/** Each kind's dialog: its title, and the extension it's saved with. */
const KINDS: Readonly<Record<OutKind, { title: string; name: string; extension: string }>> = {
  html: { title: 'Export HTML', name: 'HTML', extension: 'html' },
  epub: { title: 'Export EPUB', name: 'EPUB', extension: 'epub' },
  docx: { title: 'Export Word Document', name: 'Word Document', extension: 'docx' },
  pdf: { title: 'Export PDF', name: 'PDF', extension: 'pdf' },
};

/** The file the window sent, checked: a known kind, with what that kind holds. */
export function outFile(value: unknown): OutFile {
  const file = (typeof value === 'object' && value !== null ? value : {}) as Record<
    string,
    unknown
  >;
  switch (file.kind) {
    case 'html':
      return { kind: 'html', text: bounded(file.text, 'text') };
    case 'epub':
    case 'docx': {
      const bytes = file.bytes;
      if (!(bytes instanceof Uint8Array)) throw new TypeError('bytes must be bytes.');
      if (bytes.length > MAX_OUT_BYTES) throw new RangeError('The file is too big.');
      return { kind: file.kind, bytes };
    }
    case 'pdf': {
      if (file.page !== 'a4' && file.page !== 'letter')
        throw new TypeError('page must be a4 or letter.');
      return { kind: 'pdf', html: bounded(file.html, 'html', MAX_PAGE_CHARS), page: file.page };
    }
    default:
      throw new TypeError('Not a kind of file Eien saves.');
  }
}

export function serveOut(window: BrowserWindow): void {
  answer(window, CHANNEL.outCopy, (plain, html) =>
    clipboard.write([
      new ClipboardItem({
        'text/plain': bounded(plain, 'text'),
        'text/html': bounded(html, 'html'),
      }),
    ]),
  );
  answer(window, CHANNEL.outSaveAs, async (name, value) => {
    const file = outFile(value);
    const kind = KINDS[file.kind];
    // Only a name is offered: the writer chooses the folder.
    const named = text(name, 'name');
    if (named.length > MAX_NAME_CHARS) throw new RangeError('name is too long.');
    const typed = named.replace(new RegExp(`\\.${kind.extension}$`, 'iu'), '');
    const offered = `${safeName(typed, 'Untitled', 200)}.${kind.extension}`;
    const result = await dialog.showSaveDialog(window, {
      title: kind.title,
      defaultPath: join(app.getPath('documents'), offered),
      filters: [
        { name: kind.name, extensions: file.kind === 'html' ? ['html', 'htm'] : [kind.extension] },
      ],
    });
    if (result.canceled || !result.filePath) return null;
    // HTML with a byte-order mark: a browser opening it reads its curly quotes as UTF-8, not guessed.
    const data =
      file.kind === 'html'
        ? `﻿${file.text}`
        : file.kind === 'pdf'
          ? await printPdf(file.html, file.page)
          : file.bytes;
    await writeFile(result.filePath, data);
    return basename(result.filePath);
  });
}
