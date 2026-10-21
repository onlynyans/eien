import type { Configuration } from 'electron-builder';

// The installers and the portable copies: npm run package (this system's,
// scripts/package.mjs), and the release workflow (.github/workflows/release.yml)
// on a version tag.

/**
 * Eien's identity. Electron keeps this device's data in a folder named after
 * the product name (app.getPath('userData'): ~/Library/Application
 * Support/Eien, %APPDATA%\Eien, ~/.config/Eien), and Windows knows an install
 * to update by the app id. Renaming either strands every installed copy's
 * data, so tests/identity.test.ts holds both.
 */
export const IDENTITY = { productName: 'Eien', appId: 'io.github.onlynyans.eien' } as const;

/**
 * Signed only when a certificate is given (CSC_LINK, AGENTS.md → Releases).
 * Until then macOS gets an ad-hoc signature: without one, Apple Silicon calls
 * a downloaded app "damaged" and offers no way to open it. Ad-hoc can't use
 * the hardened runtime (Electron's framework would fail library validation),
 * which notarizing needs, so the two come together.
 */
const signed = Boolean(process.env.CSC_LINK);

/** A download's name, electron-builder filling in its own ${…}: Eien-0.1.0-mac.dmg. */
const artifactName = (system: string) => `\${productName}-\${version}-${system}.\${ext}`;

/**
 * The installers, or (portable) the copies that keep everything beside
 * themselves: a zipped .app and a single Windows .exe. Linux's AppImage is
 * already a single file, so it has no portable build. A portable build is
 * marked in its package.json, which the app reads (src/app/electron/data-folders.ts).
 */
export function builderConfig(portable: boolean): Configuration {
  return {
    ...IDENTITY,
    directories: { output: portable ? 'dist/portable' : 'dist' },
    // The build (npm run build), and package.json for its entry point. The
    // production dependencies the main process imports come along by themselves.
    files: ['package.json', 'out/main/**', 'out/preload/**', 'out/renderer/**'],
    ...(portable ? { extraMetadata: { portable: true } } : {}),
    // No native modules: nothing to rebuild for Electron.
    npmRebuild: false,
    mac: {
      // One download for Apple Silicon and Intel.
      target: [{ target: portable ? 'zip' : 'dmg', arch: ['universal'] }],
      category: 'public.app-category.productivity',
      artifactName: artifactName(portable ? 'mac-portable' : 'mac'),
      identity: signed ? undefined : '-',
      hardenedRuntime: signed,
    },
    win: {
      target: [{ target: portable ? 'portable' : 'nsis', arch: ['x64'] }],
    },
    nsis: {
      // One click, for this user only (%LOCALAPPDATA%\Programs): no admin rights asked.
      oneClick: true,
      perMachine: false,
      artifactName: artifactName('windows-setup'),
    },
    portable: { artifactName: artifactName('windows-portable') },
    linux: {
      target: [{ target: 'AppImage', arch: ['x64'] }],
      category: 'Office',
      artifactName: artifactName('linux'),
    },
    // Never publishes: the release workflow attaches the files to a draft release itself.
    publish: null,
  };
}

export default builderConfig(process.env.EIEN_PORTABLE === '1');
