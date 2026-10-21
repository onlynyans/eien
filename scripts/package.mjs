// npm run package, after npm run build: this system's installer in dist/,
// then its portable copy in dist/portable/ (electron-builder.ts). Linux's
// AppImage is both, so Linux makes one.

import { execFileSync } from 'node:child_process';

const builder = (env = {}) =>
  execFileSync('npx', ['electron-builder', '--publish', 'never'], {
    stdio: 'inherit',
    env: { ...process.env, ...env },
    // npx is npx.cmd on Windows, which only a shell runs.
    shell: process.platform === 'win32',
  });

builder();
if (process.platform !== 'linux') builder({ EIEN_PORTABLE: '1' });
