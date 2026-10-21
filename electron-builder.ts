import type { Configuration } from 'electron-builder';

// The installers: npm run package (this system's), and the release workflow
// (.github/workflows/release.yml) on a version tag.

/**
 * Eien's identity. Electron keeps this device's settings in a folder named
 * after the product name (app.getPath('userData'): ~/Library/Application
 * Support/Eien, %APPDATA%\Eien, ~/.config/Eien), and Windows knows an install
 * to update by the app id. Renaming either strands every installed copy's
 * settings, so tests/identity.test.ts holds both.
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

const config: Configuration = {
  ...IDENTITY,
  directories: { output: 'dist' },
  // The build (npm run build), and package.json for its entry point. The
  // production dependencies the main process imports come along by themselves.
  files: ['package.json', 'out/main/**', 'out/preload/**', 'out/renderer/**'],
  // No native modules: nothing to rebuild for Electron.
  npmRebuild: false,
  mac: {
    // One download for Apple Silicon and Intel.
    target: [{ target: 'dmg', arch: ['universal'] }],
    category: 'public.app-category.productivity',
    artifactName: artifactName('mac'),
    identity: signed ? undefined : '-',
    hardenedRuntime: signed,
  },
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
  },
  nsis: {
    // One click, for this user only (%LOCALAPPDATA%\Programs): no admin rights asked.
    oneClick: true,
    perMachine: false,
    artifactName: artifactName('windows-setup'),
  },
  linux: {
    target: [{ target: 'AppImage', arch: ['x64'] }],
    category: 'Office',
    artifactName: artifactName('linux'),
  },
  // Never publishes: the release workflow attaches the files to a draft release itself.
  publish: null,
};

export default config;
