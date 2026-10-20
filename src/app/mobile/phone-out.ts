// What leaves the app on the phone (spec §8). Copy for AO3 puts the HTML on
// the clipboard as text, for AO3's HTML box. A phone has no save dialog:
// an export goes to "Eien Exports" beside the vault's folder (Documents on
// Android; Eien's folder in the Files app on iOS), never over a file there.

import { Clipboard } from '@capacitor/clipboard';
import { freeName } from '../../core/paths';
import type { OutBridge } from '../../platform/bridge';
import type { FilesPort } from '../../platform/capacitor/files';
import { EXPORT_FOLDER } from './vault-home';

export function phoneOut(exports: FilesPort): OutBridge {
  return {
    async copy(text) {
      await Clipboard.write({ string: text });
    },
    async saveAs(name, text) {
      await exports.makeFolder('');
      const taken = ((await exports.list('')) ?? []).map((entry) => entry.name);
      const file = freeName(name.replace(/\.html?$/iu, ''), taken, '.html');
      // A byte-order mark, as the desktop's: a browser reads its curly quotes as UTF-8.
      await exports.writeText(file, `﻿${text}`);
      return `${EXPORT_FOLDER}/${file}`;
    },
  };
}
