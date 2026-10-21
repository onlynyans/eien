// What leaves the app on the phone (spec §8). Copy for AO3 puts the HTML on
// the clipboard as text, for AO3's HTML box. A phone has no save dialog:
// an export goes to Eien/Exports beside the vault's folder (Documents on
// Android; Eien's folder in the Files app on iOS), never over a file there.
// AO3 HTML, EPUB and Word: a PDF needs printing, which the WebView can't do
// to a file without a plugin of Eien's own.

import { Clipboard } from '@capacitor/clipboard';
import { freeName } from '../../core/paths';
import type { OutBridge, OutFile } from '../../platform/bridge';
import { type FilesPort, TakenError } from '../../platform/capacitor/files';
import { tempBeside } from '../../platform/stray';

/** How many names an export tries while others are being saved under them. */
const TRIES = 5;

const EXTENSIONS = { html: '.html', epub: '.epub', docx: '.docx' } as const;

/** Exports into `exports`, named to the writer as in `folder` ("Eien/Exports"). */
export function phoneOut(exports: FilesPort, folder: string): OutBridge {
  /** Write it through a hidden temp file, then give it the first free name. */
  async function save(base: string, extension: string, write: (temp: string) => Promise<void>) {
    await exports.makeFolder('');
    // A temp file of its own (a token of its own), so two exports of one name can't meet.
    const temp = tempBeside(`${base}${extension}`);
    await write(temp);
    const taken = ((await exports.list('')) ?? []).map((entry) => entry.name);
    for (let tries = 0; tries < TRIES; tries++) {
      const file = freeName(base, taken, extension);
      try {
        await exports.renameNew(temp, file);
        return `${folder}/${file}`;
      } catch (error) {
        if (!(error instanceof TakenError)) throw error;
        taken.push(file); // saved just now by another export: the next name
      }
    }
    await exports.remove(temp).catch(() => undefined);
    throw new Error('Another export kept taking the name.');
  }

  return {
    kinds: ['html', 'epub', 'docx'],
    async copy(text) {
      await Clipboard.write({ string: text });
    },
    async saveAs(name, file: OutFile) {
      if (file.kind === 'pdf')
        throw new Error('A PDF isn’t made on the phone yet: export it on a computer.');
      const extension = EXTENSIONS[file.kind];
      const base = name.replace(
        file.kind === 'html' ? /\.html?$/iu : new RegExp(`\\${extension}$`, 'iu'),
        '',
      );
      return save(base, extension, (temp) =>
        file.kind === 'html'
          ? // A byte-order mark, as the desktop's: a browser reads its curly quotes as UTF-8.
            exports.writeText(temp, `﻿${file.text}`)
          : exports.writeBytes(temp, file.bytes),
      );
    },
  };
}
