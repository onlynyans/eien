// Where the phone's vault is (spec §10), and the access it needs. Everything
// Eien keeps is in one folder: the vault (Vault, the folder Syncthing syncs)
// and Exports beside it. Android: Documents/Eien in the shared Documents;
// Eien asks once for the access, after the welcome has said why. iOS: the
// app's own Documents, which the Files app shows as "Eien" and which needs
// no asking.

import { Directory, Filesystem } from '@capacitor/filesystem';
import { CapacitorFiles } from '../../platform/capacitor/capacitor-files';
import type { FilesPort } from '../../platform/capacitor/files';
import { AllFiles } from './all-files';

/** Eien's folder in the system's Documents: on iOS the app's Documents are its own already. */
const homeOn = (platform: string) => (platform === 'ios' ? '' : 'Eien/');
/** The vault's folder, in the system's Documents. */
export const vaultFolderOn = (platform: string) => `${homeOn(platform)}Vault`;
/** Where exports are saved, beside it. */
export const exportFolderOn = (platform: string) => `${homeOn(platform)}Exports`;
/** The vault's name, as the sidebar shows it. */
export const VAULT_NAME = 'Eien';

export interface VaultHome {
  /** The files in the vault's folder. */
  readonly files: FilesPort;
  /** The files in the folder exports go to. */
  readonly exports: FilesPort;
  /** That folder, as the writer is told it ("Eien/Exports"). */
  readonly exportFolder: string;
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
  const files = new CapacitorFiles(Directory.Documents, vaultFolderOn(platform));
  const exportFolder = exportFolderOn(platform);
  const exports = new CapacitorFiles(Directory.Documents, exportFolder);
  if (platform !== 'android') {
    return { files, exports, exportFolder, allowed: async () => true, ask: async () => true };
  }
  return {
    files,
    exports,
    exportFolder,
    allowed: () => granted().catch(() => false),
    async ask() {
      if ((await Filesystem.requestPermissions()).publicStorage !== 'granted') return false;
      return (await AllFiles.request()).granted;
    },
  };
}
