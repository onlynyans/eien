// Where this copy of Eien keeps its data, and its vault until the writer
// opens another, decided here and nowhere else. Three kinds of copy, in this
// order:
// - its own folder (EIEN_USER_DATA): the tests', or anyone running a separate
//   copy. Everything goes there, the vault in Vault inside it.
// - a portable copy (built marked; electron-builder.ts): its data in
//   "Eien Data", and its vault in Vault, both beside the app.
// - installed (or run from source): Chromium's own storage stays in Electron's
//   data folder; this device's settings file goes in Documents/Eien, where the
//   writer can see it, beside the vault, Documents/Eien/Vault, as on the phone.

import { accessSync, constants, mkdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { app } from 'electron';
import { HOME_FOLDER, HOME_VAULT } from '../../core/vault';

/** A portable copy's folder, beside the app. */
export const PORTABLE_FOLDER = 'Eien Data';

/** The installed app's folder in Documents: this device's settings, and the vault. */
export const DOCUMENTS_FOLDER = HOME_FOLDER;

/** This device's settings file, in the settings folder. */
export const SETTINGS_FILE = 'settings.json';

/** What decides where a copy keeps its data. */
export interface Copy {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly platform: NodeJS.Platform;
  /** Built as the portable copy. */
  readonly portable: boolean;
  /** The running executable (app.getPath('exe')). */
  readonly exe: string;
}

/** The folder a portable copy sits in. */
function portableHome(copy: Copy): string {
  // Windows runs a portable .exe from a copy in the temp folder; its launcher says where the real one is.
  if (copy.platform === 'win32' && copy.env.PORTABLE_EXECUTABLE_DIR) {
    return copy.env.PORTABLE_EXECUTABLE_DIR;
  }
  // macOS runs Eien.app/Contents/MacOS/Eien: the folder holding Eien.app.
  if (copy.platform === 'darwin') return resolve(copy.exe, '../../../..');
  return dirname(copy.exe);
}

/** The data folder (Electron's userData) this copy uses, or null for Electron's own. */
export function dataFolder(copy: Copy): string | null {
  if (copy.env.EIEN_USER_DATA) return copy.env.EIEN_USER_DATA;
  if (copy.portable) return join(portableHome(copy), PORTABLE_FOLDER);
  return null;
}

/** The vault opened when none has been yet, or the last one can't be: made if need be. */
export function homeVault(copy: Copy, documents: string): string {
  if (copy.env.EIEN_USER_DATA) return join(copy.env.EIEN_USER_DATA, HOME_VAULT);
  if (copy.portable) return join(portableHome(copy), HOME_VAULT);
  return join(documents, DOCUMENTS_FOLDER, HOME_VAULT);
}

/** Whether this copy keeps its settings file apart from its data folder (installed, or from source). */
export const settingsApart = (copy: Copy): boolean => dataFolder(copy) === null;

/** The folder this device's settings file belongs in. */
export function settingsFolder(copy: Copy, userData: string, documents: string): string {
  return settingsApart(copy) ? join(documents, DOCUMENTS_FOLDER) : userData;
}

/** Whether `path` is `folder` or inside it, comparing as the system does (macOS and Windows ignore case). */
export function isWithin(folder: string, path: string, platform: NodeJS.Platform): boolean {
  const fold = (p: string) => (platform === 'linux' ? resolve(p) : resolve(p).toLowerCase());
  const rel = relative(fold(folder), fold(path));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

/**
 * Makes the data folder if need be. Returns what to tell the writer when it
 * can't be written, or null when it can. A portable copy has nowhere else to
 * keep its data, so it says so rather than keep it somewhere else unseen.
 */
export function prepareDataFolder(folder: string): string | null {
  try {
    mkdirSync(folder, { recursive: true });
    accessSync(folder, constants.W_OK);
    return null;
  } catch {
    // macOS runs a downloaded app that hasn't been moved from a read-only copy.
    if (folder.includes('/AppTranslocation/')) {
      return 'macOS is running Eien from a locked copy, because Eien was downloaded and hasn’t been moved yet. Quit Eien, move it with Finder into the folder you want it to live in, and open it again. Eien keeps its data beside itself, in “Eien Data”.';
    }
    return `Eien keeps its data beside itself, in “Eien Data”, but it can’t write to ${folder}. Move Eien to a folder you can write to, and open it again.`;
  }
}

let portableMark: boolean | undefined;

/** This copy, as it's running. A portable build's package.json says so (electron-builder.ts). */
export function thisCopy(): Copy {
  if (portableMark === undefined) {
    try {
      const meta = JSON.parse(readFileSync(join(app.getAppPath(), 'package.json'), 'utf8'));
      portableMark = app.isPackaged && meta.portable === true;
    } catch {
      portableMark = false;
    }
  }
  return {
    env: process.env,
    platform: process.platform,
    portable: portableMark,
    exe: app.getPath('exe'),
  };
}
