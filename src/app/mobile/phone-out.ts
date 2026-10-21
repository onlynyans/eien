// What leaves the app on the phone (spec §8). Copy for AO3 puts the HTML on
// the clipboard as text, for AO3's HTML box. A phone has no save dialog:
// an export goes to "Eien Exports" beside the vault's folder (Documents on
// Android; Eien's folder in the Files app on iOS), never over a file there.

import { Clipboard } from '@capacitor/clipboard';
import { freeName } from '../../core/paths';
import type { OutBridge } from '../../platform/bridge';
import { type FilesPort, TakenError } from '../../platform/capacitor/files';
import { hiddenBeside, TEMP_SUFFIX } from '../../platform/stray';
import { EXPORT_FOLDER } from './vault-home';

/** How many names an export tries while others are being saved under them. */
const TRIES = 5;

export function phoneOut(exports: FilesPort): OutBridge {
  return {
    async copy(text) {
      await Clipboard.write({ string: text });
    },
    async saveAs(name, text) {
      await exports.makeFolder('');
      const base = name.replace(/\.html?$/iu, '');
      const temp = hiddenBeside(`${base}.html`, TEMP_SUFFIX);
      // A byte-order mark, as the desktop's: a browser reads its curly quotes as UTF-8.
      await exports.writeText(temp, `﻿${text}`);
      const taken = ((await exports.list('')) ?? []).map((entry) => entry.name);
      for (let tries = 0; tries < TRIES; tries++) {
        const file = freeName(base, taken, '.html');
        try {
          await exports.renameNew(temp, file);
          return `${EXPORT_FOLDER}/${file}`;
        } catch (error) {
          if (!(error instanceof TakenError)) throw error;
          taken.push(file); // saved just now by another export: the next name
        }
      }
      await exports.remove(temp).catch(() => undefined);
      throw new Error('Another export kept taking the name.');
    },
  };
}
