# Dependencies

Every package Eien uses, and why. Versions are pinned exactly in
`package.json`; `package-lock.json` pins the rest.

## Development only

Nothing below ships inside the app except Electron itself, which is the app's
runtime.

| Package | Why |
|---|---|
| `electron` | The desktop runtime: one web interface on macOS, Windows and Linux |
| `electron-vite` | Builds the main process, the sandboxed preload and the window from one config, and runs them together in development |
| `vite` | The bundler under electron-vite; also what Vitest runs on |
| `typescript` | Strict type checking (`npm run typecheck`). Vite strips types; tsc only checks them |
| `@types/node` | Types for the main process and tests. Major version matches Electron's Node (24) |
| `@biomejs/biome` | Lint and format in one tool (`npm run lint`) |
| `vitest` | Unit and architecture tests |
| `@vitest/coverage-v8` | Test coverage report in CI |
| `fast-check` | Property tests (`*.property.test.ts`): generated inputs by the thousand, shrunk to the smallest one a rule fails on (spec §11) |
| `@stryker-mutator/core` | Mutation testing (`npm run test:mutation`, weekly in CI): edits the rules in core and platform one at a time, runs `vitest run` on each, and reports the edits no test catches |
| `@playwright/test` | End-to-end tests that drive the real Electron app |

## Shipped with the app

| Package | Why |
|---|---|
| `@fontsource-variable/newsreader` | The default text face (SIL OFL): variable weight and optical size, roman and italic. Bundled, never fetched |
| `@fontsource-variable/literata` | A text face the writer can choose (SIL OFL): variable weight and optical size, roman and italic |
| `@fontsource-variable/ibm-plex-sans` | A sans-serif text face the writer can choose (SIL OFL): variable weight, roman and italic |
| `@fontsource-variable/source-sans-3` | A warm, open sans-serif text face (SIL OFL): variable weight, roman and italic; the widest language coverage of the faces |
| `@fontsource-variable/atkinson-hyperlegible-next` | A sans-serif text face drawn so no two letters can be mistaken (SIL OFL): variable weight, roman and italic |
| `@fontsource-variable/schibsted-grotesk` | An editorial, newspaper sans-serif text face (SIL OFL): variable weight, roman and italic |
| `@fontsource-variable/hanken-grotesk` | A soft, rounded sans-serif text face (SIL OFL): variable weight, roman and italic |
| `@fontsource-variable/instrument-sans` | A crisp, modern sans-serif text face (SIL OFL): variable weight, roman and italic |
| `yaml` | Reads a note's front matter for its tags (spec §2); later writes it back with comments and formatting kept (ISC) |
| `@codemirror/state`, `@codemirror/view` | The editor: its document, selection and transactions, and the view that draws them. Live and Reading are decorations on it (MIT) |
| `@codemirror/commands` | Undo history and the standard editing keys (MIT) |
| `@codemirror/language`, `@codemirror/lang-markdown` | Markdown parsing in the editor, with GitHub's extensions; the syntax tree Live and Reading are drawn from (MIT) |
| `@lezer/markdown`, `@lezer/highlight`, `@lezer/common` | The parser under lang-markdown, used directly for `==highlight==` and `[[wiki links]]` and the styles of their parts (MIT) |
| `@fontsource/ibm-plex-mono` | The machine voice, whatever the text face (SIL OFL): 400 and 600, and 400 italic |
