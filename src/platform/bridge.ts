/** What the preload exposes to the window as `window.eien`. Every capability
 * the window has beyond a web page is listed here, and nowhere else. */

import type { SettingKey, SettingValues, ToggleKey } from '../core/config';
import type { SprintMinutes } from '../core/counters';
import type { PageSize } from '../core/export';
import type { FormatCommandId } from '../core/format';
import type { ImportReport } from '../core/import';
import type { IndexedNote } from '../core/note';
import type { SearchResult } from '../core/search';
import type { VaultEntry } from '../core/vault';
import type { FileState, MoveResult, WriteResult } from './storage';

export interface VaultInfo {
  /** The vault folder's name, as shown at the top of the sidebar. */
  readonly name: string;
  /** Syncthing syncs it: a `.stfolder` marker in it or a folder it's in (the sidebar's sync status). */
  readonly syncthing?: boolean;
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
  /** The notes holding every word of `query` (spec §4); given `within`, only among those. */
  search(query: string, within?: readonly string[] | null): Promise<SearchResult>;
  /** The files directly in a folder (a note's versions, .eien/versions/<id>). */
  listFiles(folder: string): Promise<string[]>;
  read(path: string): Promise<FileState | null>;
  /** An image's bytes, to show it; null when it's missing or too big. */
  readBytes(path: string): Promise<Uint8Array | null>;
  write(path: string, text: string, expected: string | null): Promise<WriteResult>;
  /**
   * Write an image's bytes as a new file, making the folders above it, only
   * where nothing is (see Storage.writeNew): false, and nothing written, when
   * the name is taken. Refused for anything but an image a note shows.
   */
  writeNew(path: string, bytes: Uint8Array): Promise<boolean>;
  /** Move or rename a note or folder (see Storage.move). */
  move(from: string, to: string): Promise<MoveResult>;
  /** Send a note or folder to the system's trash; rejects, leaving it, when it can't. */
  trash(path: string): Promise<void>;
  makeFolder(path: string): Promise<void>;
  /**
   * Ask for a folder of Markdown from elsewhere and copy its notes into the
   * vault (spec §8); null if the writer cancels. Rejects where there's no
   * importing (the phone) or the folder can't be (the vault itself).
   */
  importFolder(): Promise<ImportReport | null>;
  /**
   * Paths that changed on disk, as they change, and of those (`local`, the
   * desktop's only) the ones another window on this device wrote. Returns a
   * function to stop.
   */
  onChange(listener: (paths: string[], local?: readonly string[]) => void): () => void;
}

/** Settings (spec §6): this device's and the open vault's, checked by the main process. */
export interface SettingsBridge {
  /** Every setting's value: this device's, the open vault's, and defaults for the rest. */
  read(): Promise<SettingValues>;
  /** Change one setting; resolves to every value after it, or rejects when it can't be kept. */
  set<K extends SettingKey>(key: K, value: SettingValues[K]): Promise<SettingValues>;
  /**
   * Another window on this device changed a setting: read them again. The
   * desktop's only (a phone has one window). Returns a function to stop.
   */
  onChanged?(listener: () => void): () => void;
}

/** A note's or a book's exports (spec §8). */
export type ExportFormat = 'epub' | 'docx' | 'pdf';

/** A file to save: HTML as text; an EPUB or a Word file as bytes; a PDF as the page to print. */
export type OutFile =
  | { readonly kind: 'html'; readonly text: string }
  | { readonly kind: 'epub' | 'docx'; readonly bytes: Uint8Array }
  | { readonly kind: 'pdf'; readonly html: string; readonly page: PageSize };

export type OutKind = OutFile['kind'];

/** What leaves the app (spec §8): the clipboard, and a file saved where the writer chooses. */
export interface OutBridge {
  /** The kinds of file this device can save (a phone prints no PDF). */
  readonly kinds: readonly OutKind[];
  /** Put `text` (plain) and `html` (rich) on the clipboard together. */
  copy(text: string, html: string): Promise<void>;
  /** Save `file`, offering `name` (no extension); where it was saved as the writer knows it, or null if cancelled. */
  saveAs(name: string, file: OutFile): Promise<string | null>;
}

/** Menu items the window acts on. */
export type MenuCommand =
  | 'open-vault'
  | 'new-note'
  | 'new-window'
  | 'close-window'
  | 'settings'
  /** Settings, open at Look: the quick look's All settings. */
  | 'settings:look'
  /** The quick look (#49): the active page's look, in a popover. */
  | 'look'
  | 'search'
  | 'find'
  | 'find:replace'
  | 'find:next'
  | 'find:previous'
  | 'zoom:in'
  | 'zoom:out'
  | 'zoom:reset'
  | `format:${FormatCommandId}`
  | 'view:live'
  | 'view:source'
  | 'view:reading'
  | 'view:pages'
  | 'view:scroll'
  | 'bookmark'
  | 'view:next'
  | 'panes:sidebar'
  | 'panes:list'
  | 'focus:sidebar'
  | 'focus:list'
  | 'focus:page'
  | 'split'
  | 'split:swap'
  | 'seal'
  | 'compare'
  | 'versions'
  | 'copy-html'
  | 'export-html'
  | `export-note:${ExportFormat}`
  | `export-book:${ExportFormat}`
  | 'import-folder'
  | `toggle:${ToggleKey}`
  | `sprint:${SprintMinutes}`
  | 'sprint:stop'
  | 'outline';

/** The page's top band as drawn: the system's window controls are drawn over it, to match. */
export interface ControlsPaint {
  /** Its colour and its ink, as Chromium computes them (rgb()). */
  readonly band: string;
  readonly ink: string;
  /** Its height, in the page's pixels. */
  readonly height: number;
}

export interface Bridge {
  /** The operating system: 'darwin', 'win32', 'linux', … */
  readonly platform: string;
  readonly vault: VaultBridge;
  readonly settings: SettingsBridge;
  readonly out: OutBridge;
  /** The desktop's windows: a phone has one, and none of this. */
  readonly window?: WindowBridge;
  onMenu(listener: (command: MenuCommand) => void): () => void;
  /**
   * The system's back (Android's back button or gesture). Each handler is
   * asked, the newest first, until one went back (true); when none did, the
   * app steps aside, as Android apps do. The desktop has none. Returns a
   * function to stop.
   */
  onBack(handler: () => boolean): () => void;
  /**
   * Before the window closes, the main process asks it to save; `save`
   * runs, and the window closes when it's done (or after a short wait).
   */
  onBeforeClose(save: () => Promise<void>): void;
  /**
   * Draw the system's window controls (Windows, Linux) as the band is.
   * macOS's traffic lights take no colour, and a phone has none.
   */
  paintControls(paint: ControlsPaint): Promise<void>;
}

/** What a window was opened on: a note to show, or none (spec §4, New Window). */
export interface WindowStart {
  readonly note: string | null;
}

/** The desktop's windows: each its own vault, note, panes and split. */
export interface WindowBridge {
  /** A new window, on this window's vault, showing `note` (or none). */
  open(note: string | null): Promise<void>;
  /** Close this window, once what's typed is saved. */
  close(): Promise<void>;
  /** What this window was opened on, asked once it shows its vault. */
  start(): Promise<WindowStart>;
  /** The menu bar's commands that do nothing in this window now, greyed while it's focused (#40). */
  greyMenu(commands: readonly MenuCommand[]): Promise<void>;
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
  writeNew: 'vault:write-new',
  move: 'vault:move',
  trash: 'vault:trash',
  makeFolder: 'vault:make-folder',
  importFolder: 'vault:import-folder',
  changed: 'vault:changed',
  settingsRead: 'settings:read',
  settingsSet: 'settings:set',
  settingsChanged: 'settings:changed',
  outCopy: 'out:copy',
  outSaveAs: 'out:save-as',
  menu: 'app:menu',
  beforeClose: 'app:before-close',
  closeReady: 'app:close-ready',
  paintControls: 'app:paint-controls',
  windowOpen: 'window:open',
  windowClose: 'window:close',
  windowStart: 'window:start',
  greyMenu: 'window:grey-menu',
} as const;

declare global {
  interface Window {
    readonly eien: Bridge;
  }
}
