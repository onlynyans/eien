// The reader extension (spec §14), built into out/extension, loadable as it
// is (chrome://extensions, about:debugging) or zipped for a store. Two builds:
// the extension's pages, the reader and the popup, with the manifest and the
// seal's icons beside them; then (--mode content) the content script, alone
// as one plain script, since a content script can't be a module.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { ICON_SIZES, readerManifest } from './src/app/extension/manifest';

const root = import.meta.dirname;
const reader = resolve(root, 'src/ui/reader');
const outDir = resolve(root, 'out/extension');
const { version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
  version: string;
};

export default defineConfig(({ mode }) =>
  mode === 'content'
    ? {
        build: {
          outDir,
          emptyOutDir: false,
          lib: {
            entry: resolve(reader, 'content.ts'),
            formats: ['iife'],
            name: 'eienReader',
            fileName: () => 'content.js',
          },
        },
      }
    : {
        root: reader,
        base: './',
        plugins: [
          {
            name: 'eien-extension-manifest',
            generateBundle() {
              this.emitFile({
                type: 'asset',
                fileName: 'manifest.json',
                source: `${JSON.stringify(readerManifest(version), null, 2)}\n`,
              });
              for (const size of ICON_SIZES) {
                this.emitFile({
                  type: 'asset',
                  fileName: `icons/${size}.png`,
                  source: readFileSync(resolve(root, `build/icons/linux/${size}x${size}.png`)),
                });
              }
            },
          },
        ],
        build: {
          outDir,
          emptyOutDir: true,
          // Every asset stays a file: the pages' security policy refuses data: fonts.
          assetsInlineLimit: 0,
          rollupOptions: {
            input: {
              reader: resolve(reader, 'reader.html'),
              popup: resolve(reader, 'popup.html'),
            },
          },
        },
      },
);
