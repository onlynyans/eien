// The phone's page (spec §10): the desktop's window (src/ui), built for
// Capacitor into out/mobile, with the phone's preload put before its script.

import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const preload = resolve(import.meta.dirname, 'src/app/mobile/preload.ts');

export default defineConfig({
  root: resolve(import.meta.dirname, 'src/ui'),
  base: './',
  plugins: [
    {
      name: 'eien-mobile-preload',
      transformIndexHtml: {
        order: 'pre',
        handler: () => [
          {
            tag: 'script',
            attrs: { type: 'module', src: `/@fs${preload}` },
            injectTo: 'head-prepend',
          },
        ],
      },
    },
  ],
  build: {
    outDir: resolve(import.meta.dirname, 'out/mobile'),
    emptyOutDir: true,
    // Every asset stays a file: the security policy refuses data: fonts.
    assetsInlineLimit: 0,
  },
});
