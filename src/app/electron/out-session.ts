// What leaves the app (spec §8): Copy for AO3 puts the HTML on the
// clipboard, as text (for AO3's HTML box) and as HTML (for its rich text
// box); Export saves it where the writer chooses, through the system's own
// dialog, so the window never names a place on disk.

import { writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { app, type BrowserWindow, ClipboardItem, clipboard, dialog } from 'electron';
import { safeName } from '../../core/paths';
import { CHANNEL } from '../../platform/bridge';
import { answer, text } from './ipc';

/** The most the window may hand over at once: a long novel's HTML, many times over. */
const MAX_OUT_CHARS = 32 * 1024 * 1024;

function bounded(value: unknown, name: string): string {
  const out = text(value, name);
  if (out.length > MAX_OUT_CHARS) throw new RangeError(`${name} is too long.`);
  return out;
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
  answer(window, CHANNEL.outSaveAs, async (name, body) => {
    const content = bounded(body, 'text');
    // Only a name is offered: the writer chooses the folder.
    const file = `${safeName(text(name, 'name').replace(/\.html?$/iu, ''), 'Untitled', 200)}.html`;
    const result = await dialog.showSaveDialog(window, {
      title: 'Export AO3 HTML',
      defaultPath: join(app.getPath('documents'), file),
      filters: [{ name: 'HTML', extensions: ['html', 'htm'] }],
    });
    if (result.canceled || !result.filePath) return null;
    // A byte-order mark: a browser opening the file reads its curly quotes as UTF-8, not guessed.
    await writeFile(result.filePath, `\uFEFF${content}`, 'utf8');
    return basename(result.filePath);
  });
}
