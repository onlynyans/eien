// Where the phone's vault is (spec §10), and the access it needs. Android:
// a folder in the shared Documents, synced by Syncthing; Eien asks once for
// the access, after the welcome has said why. iOS: Eien's own folder, which
// the Files app shows, and which needs no asking.

import { Directory, Filesystem } from '@capacitor/filesystem';
import { CapacitorFiles } from '../../platform/capacitor/capacitor-files';
import type { FilesPort } from '../../platform/capacitor/files';
import { AllFiles } from './all-files';

/** The vault's folder, in the system's Documents. */
export const VAULT_FOLDER = 'Eien';
/** Where exports are saved, beside it. */
export const EXPORT_FOLDER = 'Eien Exports';

export interface VaultHome {
  /** The files in the vault's folder. */
  readonly files: FilesPort;
  /** The files in the folder exports go to. */
  readonly exports: FilesPort;
  /** Whether Eien may use the folder now. */
  allowed(): Promise<boolean>;
  /** Ask for the access on the system's screens; whether it was given. */
  ask(): Promise<boolean>;
}

const granted = async (): Promise<boolean> => {
  // Before Android 11, the storage permission; from 11, All files access.
  const legacy = await Filesystem.checkPermissions();
  return legacy.publicStorage === 'granted' && (await AllFiles.status()).granted;
};

export function vaultHome(platform: string): VaultHome {
  const files = new CapacitorFiles(Directory.Documents, VAULT_FOLDER);
  const exports = new CapacitorFiles(Directory.Documents, EXPORT_FOLDER);
  if (platform !== 'android') {
    return { files, exports, allowed: async () => true, ask: async () => true };
  }
  return {
    files,
    exports,
    allowed: () => granted().catch(() => false),
    async ask() {
      if ((await Filesystem.requestPermissions()).publicStorage !== 'granted') return false;
      return (await AllFiles.request()).granted;
    },
  };
}
