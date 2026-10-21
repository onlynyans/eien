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
| `happy-dom` | A DOM for the window's unit tests (`src/ui/**`, the `window` project in `vitest.config.ts`): lighter and quicker than jsdom, and enough for what the modules use (MIT) |
| `@axe-core/playwright` | axe-core's accessibility rules (WCAG 2.2 A and AA, colour contrast) run over the app and the phone's page in the end-to-end tests (MPL-2.0, its axe-core too; a development tool only, never shipped) |
| `fast-check` | Property tests (`*.property.test.ts`): generated inputs by the thousand, shrunk to the smallest one a rule fails on (spec §11) |
| `@stryker-mutator/core` | Mutation testing (`npm run test:mutation`, weekly in CI): edits the rules in core and platform one at a time, runs `vitest run` on each, and reports the edits no test catches |
| `@playwright/test` | End-to-end tests that drive the real Electron app, the phone's page in Chromium, and the Android app's WebView over adb |
| `electron-builder` | Makes the installers from electron-vite's build (`electron-builder.ts`, `npm run package`): a universal `.dmg`, a per-user NSIS setup for Windows and a Linux AppImage, with signing and notarizing built in for when there are certificates. Chosen over Electron Forge, which has no NSIS installer of its own (its Windows ones are Squirrel, MSI and MSIX) and needs a maker package per format |
| `@capacitor/cli` | Copies the phone's page into the Android project (`npm run android`, `cap sync`) and adds its plugins there |

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
| `@capacitor/core` | The phone's runtime under the same window: the bridge to native code and each plugin's web stand-in (MIT) |
| `@capacitor/android` | The Android shell: an activity holding a WebView that serves the page from the app itself, never the network (MIT) |
| `@capacitor/ios` | The iOS shell, the same over WKWebView; its Swift packages (Capacitor's and the plugins') are fetched by Xcode when it builds (MIT) |
| `@capacitor/filesystem` | The phone's files: the vault in the shared Documents/Eien/Vault on Android, Eien's own Files folder on iOS (MIT) |
| `@capacitor/preferences` | This device's settings on the phone, kept apart from the vault as the desktop's are (MIT) |
| `@capacitor/app` | When the phone sends Eien to the background (save now) and brings it back (look at the vault again) (MIT) |
| `@capacitor/clipboard` | Copy for AO3 on the phone (MIT) |

## Not a package

| Need | Instead | Why |
|---|---|---|
| Zip archives (EPUB and Word files are zips) | `src/core/export/zip.ts`, about 100 lines | Both formats need only stored entries (an EPUB's `mimetype` must be stored), and a book's words are small. A package (fflate, JSZip) brings compression and reading Eien doesn't use; Eien's writer is held to zlib's CRC and to `unzip -t` in `tests/zip-interop.test.ts`, and read back strictly by `tests/support/read-zip.ts` |
| The app's icons from the seal | `scripts/icons/build.mjs` (`npm run icons`), about 300 lines | Electron already renders SVG, so an offscreen window rasterizes the seal at each size; `.icns`, `.ico` and the iOS PNG (no alpha) are small containers written in the script. No image package (sharp, png2icons), no system tool (`sips`, `iconutil`), so it runs the same on any machine that has the project. The glyph 永 is drawn as paths in `build/icons/seal.svg`, from no font, so there is no font licence to record |
| EPUB, Word, the PDF's page | `src/core/export/` | Each is a few XML files of fixed shape; the words come from Copy for AO3's own writer (`core/ao3`), so a note converts one way everywhere. The PDF is Electron's own `printToPDF` |

The Android build also needs a JDK (21) and the Android SDK, which are tools on
the machine that builds it, not packages: CI has them, and on a Mac Homebrew
gives them (`openjdk@21`, `android-commandlinetools`).
