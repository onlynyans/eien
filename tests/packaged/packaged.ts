// The packaged app's executables, for tests/packaged: what npm run package
// leaves in dist/, or what the release workflow points at (the app in the
// .dmg, the one the setup installed, the portable copy unzipped).

import { resolve } from 'node:path';
import { appEnv, ROOT } from '../e2e/launch';

const INSTALLED: Partial<Record<NodeJS.Platform, string>> = {
  darwin: 'dist/mac-universal/Eien.app/Contents/MacOS/Eien',
  win32: 'dist/win-unpacked/Eien.exe',
  linux: 'dist/linux-unpacked/eien',
};

/** Linux has none: its AppImage is already a single file. */
const PORTABLE: Partial<Record<NodeJS.Platform, string>> = {
  darwin: 'dist/portable/mac-universal/Eien.app/Contents/MacOS/Eien',
  win32: 'dist/portable/win-unpacked/Eien.exe',
};

/** The installed app (EIEN_APP). */
export const installedApp = resolve(
  ROOT,
  process.env.EIEN_APP ?? INSTALLED[process.platform] ?? '',
);

/** The portable copy (EIEN_PORTABLE_APP), if this system has one. */
const portable = process.env.EIEN_PORTABLE_APP ?? PORTABLE[process.platform];
export const portableApp = portable ? resolve(ROOT, portable) : null;

/** Environment for a copy that decides its own folders, as a writer's does: no EIEN_USER_DATA. */
export function ownFoldersEnv(vault?: string): Record<string, string> {
  const env = appEnv('', vault);
  delete env.EIEN_USER_DATA;
  return env;
}
