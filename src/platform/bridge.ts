/** What the preload exposes to the window as `window.eien`. Every capability
 * the window has beyond a web page is listed here, and nowhere else. */

import type { VaultEntry } from '../core/vault';
import type { FileState, WriteResult } from './storage';

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
  read(path: string): Promise<FileState | null>;
  write(path: string, text: string, expected: string | null): Promise<WriteResult>;
  /** Paths that changed on disk, as they change. Returns a function to stop. */
  onChange(listener: (paths: string[]) => void): () => void;
}

/** Menu items the window acts on. */
export type MenuCommand = 'open-vault' | 'new-note';

export interface Bridge {
  /** The operating system: 'darwin', 'win32', 'linux', … */
  readonly platform: string;
  readonly vault: VaultBridge;
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
  read: 'vault:read',
  write: 'vault:write',
  changed: 'vault:changed',
  menu: 'app:menu',
  beforeClose: 'app:before-close',
  closeReady: 'app:close-ready',
} as const;

declare global {
  interface Window {
    readonly eien: Bridge;
  }
}
