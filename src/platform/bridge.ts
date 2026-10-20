/** What the preload exposes to the window as `window.eien`. Every capability
 * the window has beyond a web page is listed here, and nowhere else. */

import type { SettingKey, SettingValues, ToggleKey } from '../core/config';
import type { SprintMinutes } from '../core/counters';
import type { FormatCommandId } from '../core/format';
import type { IndexedNote } from '../core/note';
import type { SearchResult } from '../core/search';
import type { VaultEntry } from '../core/vault';
import type { FileState, MoveResult, WriteResult } from './storage';

export interface VaultInfo {
  /** The vault folder's name, as shown at the top of the sidebar. */
  readonly name: string;
}

/** The vault this window has open: its files, through the main process. */
export interface VaultBridge {
  /** The vault open now, or null when none has been chosen. */
  current(): Promise<VaultInfo | null>;
  /** Ask the writer for a folder and open it; null if they cancel. */
  choose(): Promise<VaultInfo | null>;
  list(): Promise<VaultEntry[]>;
  /** Every note with its preview, words and tags, from the vault's index. */
  notes(): Promise<IndexedNote[]>;
  /** The notes holding every word of `query` (spec §4). */
  search(query: string): Promise<SearchResult>;
  /** The files directly in a folder (a note's versions, .eien/versions/<id>). */
  listFiles(folder: string): Promise<string[]>;
  read(path: string): Promise<FileState | null>;
  /** An image's bytes, to show it; null when it's missing or too big. */
  readBytes(path: string): Promise<Uint8Array | null>;
  write(path: string, text: string, expected: string | null): Promise<WriteResult>;
  /** Move or rename a note or folder (see Storage.move). */
  move(from: string, to: string): Promise<MoveResult>;
  /** Send a note or folder to the system's trash; rejects, leaving it, when it can't. */
  trash(path: string): Promise<void>;
  makeFolder(path: string): Promise<void>;
  /** Paths that changed on disk, as they change. Returns a function to stop. */
  onChange(listener: (paths: string[]) => void): () => void;
}

/** Settings (spec §6): this device's and the open vault's, checked by the main process. */
export interface SettingsBridge {
  /** Every setting's value: this device's, the open vault's, and defaults for the rest. */
  read(): Promise<SettingValues>;
  /** Change one setting; resolves to every value after it, or rejects when it can't be kept. */
  set<K extends SettingKey>(key: K, value: SettingValues[K]): Promise<SettingValues>;
}

/** What leaves the app (spec §8): the clipboard, and a file saved where the writer chooses. */
export interface OutBridge {
  /** Put `text` (plain) and `html` (rich) on the clipboard together. */
  copy(text: string, html: string): Promise<void>;
  /** Ask where to save `text`, offering `name` (an HTML file); the name saved as, or null if cancelled. */
  saveAs(name: string, text: string): Promise<string | null>;
}

/** Menu items the window acts on. */
export type MenuCommand =
  | 'open-vault'
  | 'new-note'
  | 'settings'
  | 'search'
  | 'zoom:in'
  | 'zoom:out'
  | 'zoom:reset'
  | `format:${FormatCommandId}`
  | 'view:live'
  | 'view:source'
  | 'view:reading'
  | 'view:next'
  | 'panes:sidebar'
  | 'panes:list'
  | 'focus:sidebar'
  | 'focus:list'
  | 'focus:page'
  | 'seal'
  | 'compare'
  | 'versions'
  | 'copy-ao3'
  | 'export-ao3'
  | `toggle:${ToggleKey}`
  | `sprint:${SprintMinutes}`
  | 'sprint:stop';

export interface Bridge {
  /** The operating system: 'darwin', 'win32', 'linux', … */
  readonly platform: string;
  readonly vault: VaultBridge;
  readonly settings: SettingsBridge;
  readonly out: OutBridge;
  onMenu(listener: (command: MenuCommand) => void): () => void;
  /**
   * Before the window closes, the main process asks it to save; `save`
   * runs, and the window closes when it's done (or after a short wait).
   */
  onBeforeClose(save: () => Promise<void>): void;
}

/** The IPC channel names, shared by the preload and the main process. */
export const CHANNEL = {
  current: 'vault:current',
  choose: 'vault:choose',
  list: 'vault:list',
  notes: 'vault:notes',
  search: 'vault:search',
  listFiles: 'vault:list-files',
  read: 'vault:read',
  readBytes: 'vault:read-bytes',
  write: 'vault:write',
  move: 'vault:move',
  trash: 'vault:trash',
  makeFolder: 'vault:make-folder',
  changed: 'vault:changed',
  settingsRead: 'settings:read',
  settingsSet: 'settings:set',
  outCopy: 'out:copy',
  outSaveAs: 'out:save-as',
  menu: 'app:menu',
  beforeClose: 'app:before-close',
  closeReady: 'app:close-ready',
} as const;

declare global {
  interface Window {
    readonly eien: Bridge;
  }
}
