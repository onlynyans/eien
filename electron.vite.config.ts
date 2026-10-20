import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';

const electronDir = resolve(import.meta.dirname, 'src/app/electron');

export default defineConfig({
  main: {
    build: {
      rolldownOptions: { input: { main: resolve(electronDir, 'main.ts') } },
    },
  },
  preload: {
    build: {
      rolldownOptions: {
        input: { preload: resolve(electronDir, 'preload.ts') },
        // A sandboxed preload can't be an ES module.
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  renderer: {
    root: resolve(import.meta.dirname, 'src/ui'),
    build: {
      rolldownOptions: { input: resolve(import.meta.dirname, 'src/ui/index.html') },
      // Every asset stays a file: the security policy refuses data: fonts, and
      // small font subsets would otherwise be inlined as data: URLs.
      assetsInlineLimit: 0,
    },
  },
});
