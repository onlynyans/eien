// Android's "All files access" (spec §10): the vault is a folder in the
// shared Documents, which Syncthing syncs, and from Android 11 an app may
// use files there that other apps made only with this access. A small
// plugin of Eien's own (android/…/AllFilesPlugin.java) asks for it, once,
// on the system's own screen.

import { registerPlugin } from '@capacitor/core';

export interface AllFilesPlugin {
  /** Whether Eien has the access (always, before Android 11). */
  status(): Promise<{ granted: boolean }>;
  /** Open the system's screen for it; resolves when the writer comes back. */
  request(): Promise<{ granted: boolean }>;
}

export const AllFiles = registerPlugin<AllFilesPlugin>('AllFiles');
