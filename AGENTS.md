# Eien — notes for agents

Read [docs/spec.md](docs/spec.md) first. It is the source of truth for behavior;
when code and spec disagree, fix one of them in the same change.

## Rules

- **Words are never lost.** Any path that removes text leaves it recoverable
  (a version, a sibling copy, or the system trash), and the UI says where.
- **KISS and DRY.** The smallest design that works. Each setting, token, rule
  and string is defined once.
- **Small, named modules.** One concept per file; split past ~300 lines. No
  catch-all files (`utils.ts`, `helpers.ts`, `app.ts` holding everything).
- **Layers point inward:** `ui` and `app` → `platform` → `core`. `core` is
  pure TypeScript with no DOM, Node or Capacitor imports. `tests/layers.test.ts`
  enforces it.
- **The window never touches the disk.** All file access goes through the
  `Storage` interface in `src/platform/`.
- **Settings** are added only in `src/core/config/schema.ts`. **Theme tokens**
  only in `src/ui/theme/tokens.css`, documented in `docs/design/README.md`.
- **Verify, don't assume.** Every behavior change comes with a test that would
  fail without it. Check library APIs and versions against the installed
  package, not memory.
- **No code from NEO or Otaku.** Eien is written from scratch.
- **Dependencies** are listed in `docs/dependencies.md` with the reason for each.
  Prefer a few lines of code to a new package.
- **Comments say why**, not what.

## Layout

| Path | What |
|---|---|
| `src/core/` | Rules, pure TypeScript: `paths`, `text`, `vault`, `saving`, `format` (the formatting commands), `config` (every setting, and its files), `markdown` (Eien's Markdown and a note's plain text, shared with the editor), `note`, `tags`, `search`, `versions` (ids, seal files, retention, the word diff), `typography` (quotation marks), `counters` (today's tally, a sprint), `ao3` (Copy for AO3 and Paste: `to-html.ts` writes blocks round `inline-writer.ts` (the tags and marks it knows in `inline-tags.ts`), and `bookBlocks` the same for a book's exports; `from-html.ts` reads blocks round `html-inline.ts`, after `tidy.ts` turns styles into tags; `entities.ts`, HTML 4's named references), `export` (a note as a chapter, `chapter.ts`, with its footnotes, which `markdown/footnotes.ts` finds (`markdown/fences.ts`: what's fenced code, line by line); `epub.ts`, `docx.ts` round `docx-body.ts` (its runs, paragraphs and pictures in `docx-runs.ts`), and `print-html.ts`, the PDF's page; `images.ts`, an image's kind and size from its own header; `zip.ts`, a store-only zip of Eien's own), `import` (`plan.ts`: which files of a folder from elsewhere come in, under what names, and why the rest don't) |
| `src/platform/` | `bridge.ts` (all the window may ask), `storage.ts` (the Storage contract), and its `electron/`, `capacitor/` and `memory/` implementations; `index/`, the vault's index over any Storage; `open-vault.ts` (a vault and its index kept in step) and `settings-store.ts` (this device's settings and the vault's), shared by the desktop and the phone; `stray.ts`, what a crash can leave (temp files, each write's own, and a phone's rename steps), recovered at open by `electron/recover-strays.ts` and `capacitor/recover.ts`; `electron/import-folder.ts` copies a folder's notes and images into the vault through its storage (`Storage.writeNew` for an image's bytes), reading them with `electron/outside-folder.ts` (no link followed; the vault told apart by what it is on the disk). `capacitor/` is Storage over a plain `FilesPort` (`files.ts`): Capacitor's Filesystem on the phone (`capacitor-files.ts`), Node's in tests (`node-files.ts`), so the storage contract tests run on it; `recover.ts` puts back what a crash left; `poller.ts` looks for changes, as a phone has no watcher; `phone-trash.ts` is the phone's trash, .eien/trash. `case-twin.ts` keeps every storage from making a name its folder has in another case; `tests/case-folder.ts` gives tests a disk that tells case apart (a disk image on a Mac). `electron/disk-watch.ts` is the desktop's watcher |
| `src/ui/` | The window: `app.ts` holds the settings, the menu and the vault shown; `vault/vault-view.ts` wires the panes (`sidebar`, `list`, `page`) to the vault and the open note (`vault/open-note.ts`), and `vault/pane-drawer.ts` draws them; `shell/panes.ts` resizes and shuts them (widths per device, `shell/pane-state.ts`), and with two panes the sidebar's tree (`sidebar/tree.ts`) lists the notes; `list/search-field.ts` is the one search field, on the list's band or, with no list in sight, in the sidebar (placed by `vault/pane-drawer.ts`); `vault/organize.ts` renames, moves and trashes, keeping order and pins in step; `versions/` seals the open note (`note-versions.ts`, the rules in `core/versions`), compares it with a seal and lists its seals; `menu/` is the floating menu; `welcome/` before a vault is open; `editor/` is CodeMirror in a shadow root (its styles load as constructed style sheets, which the CSP allows), `editor/typing.ts` decides typed quotes and pastes on the editor's state alone, and `editor/writing-tools.ts` the scene break key, focus mode and typewriter scrolling; `vault/ao3-out.ts` is Copy for AO3; `vault/exports.ts` exports a note or a book, with the images `vault/export-images.ts` reads (`vault/current-book.ts` finds the book, for outline cards too) and `vault/importing.ts` imports a folder; `page/word-count.ts` counts the note's words and what the writer's own changes add, and `counters/` shows today's, the book's and a sprint's in the colophon (wired in `vault/counting.ts`); `menu/ask-number.ts` asks for a number where a menu was (a book's goal); `outline/board.ts` is outline cards, shown in the sheet's place (`vault/outline.ts`); `vault/page-parts.ts` makes the page's seals, counters, Copy for AO3 and outline cards together, for `vault/vault-view.ts`; `vault/follow.ts` follows the disk, the settings and the menu's commands while a vault is shown; `menu/menu-bus.ts` carries the menu's commands, from the menu bar or a phone's ⋯; `phone/` is the phone's layout, one pane at a time (`phone-stack.ts`, its back bar, and `more-menu.ts`, the page's ⋯), wired in `vault/phone-view.ts`; `settings/` is the settings screen and the look it sets on `<html>`, and which zoom ⌘+ and ⌘− change (`settings/zoom.ts`); the panes' top bands drag the window (`shell/shell.css`); styles in `theme/` and beside each view |
| `src/app/electron/` | Main process: window, menu, the vault and settings sessions and their IPC (`ipc.ts`: one window per handler), the device's own file (`device-settings.ts`; where it and the data folder are, for an installed, portable or separate copy, is decided in `data-folders.ts` alone), `out-session.ts` (the clipboard, the save dialog; a PDF printed by `print-pdf.ts` in a hidden window that runs nothing), and `import-session.ts` (Import Markdown Folder…); `menu.ts` builds the menu bar, its on/off settings as checks that `checkToggles` keeps in step (`TOGGLES` in `core/config`); `context-menu.ts` is the note's right-click menu (spelling suggestions on macOS, from `context-menu-of.ts`); `frame.ts` is the window with no title bar (the system's controls over the bands, painted as the window's `shell/window-controls.ts` reports them) and the whole window's zoom; the sandboxed `preload.ts` |
| `src/app/mobile/` | The phone: `preload.ts` sets `window.eien` before the window's own script (the page is the desktop's, built by `vite.mobile.config.ts` into `out/mobile`); `mobile-vault.ts` opens the vault in Documents/Eien/Vault (exports go to Documents/Eien/Exports); `vault-home.ts` and `all-files.ts` ask for Android's access (Eien's plugins are in `android/app/src/main/java/io/github/onlynyans/eien/`: `AllFilesPlugin.java`, and `VaultFilesPlugin.java`, the flushed write and the one-step renames `capacitor-files.ts` uses on Android); `phone-out.ts` copies and exports (AO3 HTML, EPUB and Word; no PDF, and no import, on the phone). `android/` is the Capacitor Android project (`capacitor.config.json`); `ios/` is the Capacitor iOS project, with Eien's Swift plugin (`ios/App/App/VaultFileOps.swift`, the file operations, a save's last step coordinated with other apps (`replace`), tested by `scripts/ios/vault-file-ops-test/`, `vault-file-ops-adversarial/` and `vault-file-coordination/`; `VaultFilesPlugin.swift`, registered by its view controller) |
| `tests/` | Architecture tests (layers; `selectors.test.ts`: no style rule ends in `*` after a `:hover` or `:focus`, which restyles the whole window); `zip-interop.test.ts` holds Eien's zips to zlib and `unzip`; `tests/support/` holds what the tests share, Node-free so core's tests can use it: a strict zip reader, a strict XML check, an export's parts; `tests/e2e/` drives the built app on real folders with Playwright; `tests/mobile/` the phone's page in Chromium; `tests/android/` Eien on an emulator or phone over adb |
| `tsconfig.{core,web,node,mobile,e2e}.json` | One per environment: core can use neither DOM nor Node, the window can't use Node, the phone's code has the DOM and no Node |
| `docs/design/` | The approved design and its mockups; `src/ui/theme/` is the tokens' source from phase 3 on. `.interface-design/system.md` sums it up for the interface-design skill |
| `docs/backlog.md` | What comes after the phases: fixes, tweaks and features, each marked for the design pass or not, and the owner's open questions |

Unit tests sit beside their module as `name.test.ts`; property tests (fast-check)
as `name.property.test.ts`. Those try the same generated inputs on every run;
`FC_SEED=<n>` reproduces a failure from another seed, and `FC_RUNS` tries more.

## Commands

```
npm install
npm run dev          # the app with live reload
npm run lint         # Biome: lint and format check (npm run format fixes)
npm run typecheck    # tsc -b over every tsconfig
npm test             # unit and architecture tests (Vitest)
npm run test:e2e     # builds, then drives the real app (Playwright)
npm run check        # all of the above, as CI runs them
npm run test:mutation  # Stryker: the edits to core and platform no test catches
npm run test:mobile  # builds the phone's page, then tests it in Chromium (Playwright)
npm run android      # builds the phone's page and copies it into android/
npm run test:android # builds and installs the debug APK, then tests it on the device adb sees
npm run test:ios-files # the iOS plugin's Swift file operations, with swiftc (Command Line Tools)
npm run test:ios     # on a Mac with Xcode: the app on an iPhone simulator (CI runs it)
npm run package      # builds, then this system's installer in dist/ and portable copy in dist/portable/
npm run test:packaged  # starts the packaged apps in dist/ (or EIEN_APP, EIEN_PORTABLE_APP) (Playwright)
```

The Android commands need a JDK and the Android SDK. On a Mac, from Homebrew:

```
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export PATH="$ANDROID_HOME/platform-tools:$PATH"
# a Pixel 7 on Android 16; software rendering, as the Mac's GPU crashed the emulator twice
$ANDROID_HOME/emulator/emulator -avd eien-pixel7 -gpu swiftshader_indirect &
```

`npm run test:android` clears Eien's data and its Documents/Eien (the vault, Documents/Eien/Vault) on the device
it runs on: use an emulator, not a phone that holds a real vault.

CI (`.github/workflows/ci.yml`) runs lint, types and unit tests on Linux, the
end-to-end tests on macOS, Windows and Linux, the phone's page in Chromium, and
the Android debug build (its APK kept as the run's artifact), and on macOS the
iOS plugin's Swift tests and the app on an iPhone simulator, on every push to
`main` and every pull request. All seven checks must pass before a pull
request merges (the repository's ruleset). The Android tests on a device are run by hand. An end-to-end test that holds the app to a time (a draw,
a search, typing without a stall), or drags with the pointer, is tagged
`ALONE` (`@alone`, from `tests/e2e/launch.ts`): those run after the rest, one
at a time, so they measure Eien and not the tests running beside them, and no
other test's window takes the focus mid-drag.

`.github/workflows/weekly.yml` runs mutation testing (report and score in the
run) and the property tests with a new seed, every Monday and by hand. It never
runs on a push or a pull request, and no change waits on it.

A test that guards a security or safety rule should be shown to fail when the
rule is broken (turn the rule off, run the test, put it back).

## Releases

`electron-builder.ts` makes the installers: a universal `.dmg` (Apple Silicon
and Intel), a Windows setup `.exe` (NSIS, one click, for this user only, so no
admin rights) and a Linux AppImage. With `EIEN_PORTABLE=1` it makes the
portable copies instead, in `dist/portable/`: a zipped `.app` and a single
Windows `.exe` (the AppImage is Linux's). A portable build is marked
(`"portable": true` in its package.json), and keeps everything in "Eien Data"
beside itself; `scripts/package.mjs` (`npm run package`) makes both.
`tests/packaged/` starts the packaged apps and checks that they open, save into
a vault, find the window's storage that another build left, and keep their
data where they should.

Where a copy keeps things is decided in `src/app/electron/data-folders.ts`,
in this order: `EIEN_USER_DATA` (tests, separate copies: everything there); a
portable copy ("Eien Data" beside the `.app`, or beside the `.exe` its
launcher names in `PORTABLE_EXECUTABLE_DIR`; it says so and quits when it
can't write there); else installed (or from source): Electron's data folder,
with this device's `settings.json` in `Documents/Eien`. Each kind has its own
vault to start in (`homeVault`: `Vault` inside `EIEN_USER_DATA`, beside a
portable copy, or in `Documents/Eien`), opened when no other has been; so the
desktop has no welcome screen unless the vault can't be opened. The first start moves
a `settings.json` from the data folder there, never over one already there;
while the vault last opened holds `Documents/Eien`, the file stays in the data
folder, and Eien says so once.

To release, set the version in `package.json` and merge, then tag `main` with
it: `git fetch origin && git tag v0.2.0 origin/main && git push origin v0.2.0`.
`.github/workflows/release.yml` checks the tag matches the version, builds
each installer on its own system, installs and starts it there, and attaches
all three to a draft release, which the owner publishes by hand. Run by hand
(Actions → Release → Run workflow), it builds and tries the installers with no
release, keeping them as the run's artifacts.

- **Identity.** The product name `Eien` and app id `io.github.onlynyans.eien`
  never change. Electron names the device's data folder (userData:
  `settings.json`, the window's storage) after the first, and Windows finds
  the install to update by the second. `tests/identity.test.ts` holds both.
- **Not signed yet.** macOS gets an ad-hoc signature (without one, Apple
  Silicon calls a downloaded app damaged and won't open it); Windows none.
  README → Install tells the writer how to open them. To sign, add repository
  secrets; the workflow passes them on, and `electron-builder.ts` turns on the
  hardened runtime once there's a certificate. Untried until one exists, so
  try a signed build by hand (Run workflow) before a tag.
  - macOS: `MAC_CERTIFICATE` (a Developer ID Application certificate, `.p12`
    in base64) and `MAC_CERTIFICATE_PASSWORD`; to notarize too, `APPLE_ID`,
    `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID`.
  - Windows: `WINDOWS_CERTIFICATE` (`.pfx` in base64) and
    `WINDOWS_CERTIFICATE_PASSWORD`.
- **No auto-update.** Eien never goes online to look for a version. On macOS,
  an updater (electron-updater) would need the app signed; reconsider once it
  is.
- **No icon yet:** the installers use Electron's.
