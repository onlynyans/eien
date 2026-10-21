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
  only in `src/ui/theme/tokens.css`, documented in `docs/themes.md`.
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
| `src/core/` | Rules, pure TypeScript: `paths`, `text`, `vault`, `saving`, `format` (the formatting commands), `config` (every setting, and its files), `markdown` (Eien's Markdown and a note's plain text, shared with the editor), `note`, `tags`, `search`, `versions` (ids, seal files, retention, the word diff), `typography` (quotation marks), `counters` (today's tally, a sprint), `ao3` (Copy for AO3 and Paste: `to-html.ts` writes blocks round `inline-writer.ts`; `from-html.ts` reads blocks round `html-inline.ts`, after `tidy.ts` turns styles into tags) |
| `src/platform/` | `bridge.ts` (all the window may ask), `storage.ts` (the Storage contract), and its `electron/`, `capacitor/` and `memory/` implementations; `index/`, the vault's index over any Storage; `open-vault.ts` (a vault and its index kept in step) and `settings-store.ts` (this device's settings and the vault's), shared by the desktop and the phone; `stray.ts`, what a crash can leave (temp files, a phone's rename steps), recovered at open by `electron/recover-strays.ts` and `capacitor/recover.ts`. `capacitor/` is Storage over a plain `FilesPort` (`files.ts`): Capacitor's Filesystem on the phone (`capacitor-files.ts`), Node's in tests (`node-files.ts`), so the storage contract tests run on it; `recover.ts` puts back what a crash left; `poller.ts` looks for changes, as a phone has no watcher |
| `src/ui/` | The window: `app.ts` holds the settings, the menu and the vault shown; `vault/vault-view.ts` wires the panes (`sidebar`, `list`, `page`) to the vault and the open note (`vault/open-note.ts`), and `vault/pane-drawer.ts` draws them; `shell/panes.ts` resizes and shuts them (widths per device, `shell/pane-state.ts`), and with two panes the sidebar's tree (`sidebar/tree.ts`) lists the notes; `vault/organize.ts` renames, moves and trashes, keeping order and pins in step; `versions/` seals the open note (`note-versions.ts`, the rules in `core/versions`), compares it with a seal and lists its seals; `menu/` is the floating menu; `welcome/` before a vault is open; `editor/` is CodeMirror in a shadow root (its styles load as constructed style sheets, which the CSP allows), `editor/typing.ts` decides typed quotes and pastes on the editor's state alone, and `editor/writing-tools.ts` the scene break key, focus mode and typewriter scrolling; `vault/ao3-out.ts` is Copy for AO3 and Export; `page/word-count.ts` counts the note's words and what the writer's own changes add, and `counters/` shows today's, the book's and a sprint's in the colophon (wired in `vault/counting.ts`); `menu/ask-number.ts` asks for a number where a menu was (a book's goal); `outline/board.ts` is outline cards, shown in the sheet's place (`vault/outline.ts`); `vault/page-parts.ts` makes the page's seals, counters, Copy for AO3 and outline cards together, for `vault/vault-view.ts`; `settings/` is the settings screen and the look it sets on `<html>`; styles in `theme/` and beside each view |
| `src/app/electron/` | Main process: window, menu, the vault and settings sessions and their IPC (`ipc.ts`: one window per handler), the device's own file, and `out-session.ts` (the clipboard, the save dialog); `menu.ts` builds the menu bar, its on/off settings as checks that `checkToggles` keeps in step (`TOGGLES` in `core/config`); `context-menu.ts` is the note's right-click menu (spelling suggestions on macOS, from `context-menu-of.ts`); the sandboxed `preload.ts` |
| `src/app/mobile/` | The phone: `preload.ts` sets `window.eien` before the window's own script (the page is the desktop's, built by `vite.mobile.config.ts` into `out/mobile`); `mobile-vault.ts` opens the vault in Documents/Eien; `vault-home.ts` and `all-files.ts` ask for Android's access (Eien's plugins are in `android/app/src/main/java/io/github/onlynyans/eien/`: `AllFilesPlugin.java`, and `VaultFilesPlugin.java`, the flushed write and the one-step renames `capacitor-files.ts` uses on Android); `phone-out.ts` copies and exports. `android/` is the Capacitor Android project (`capacitor.config.json`) |
| `tests/` | Architecture tests (layers; `selectors.test.ts`: no style rule ends in `*` after a `:hover` or `:focus`, which restyles the whole window); `tests/e2e/` drives the built app on real folders with Playwright; `tests/mobile/` the phone's page in Chromium; `tests/android/` Eien on an emulator or phone over adb |
| `tsconfig.{core,web,node,mobile,e2e}.json` | One per environment: core can use neither DOM nor Node, the window can't use Node, the phone's code has the DOM and no Node |
| `docs/design/` | The approved design and its mockups; `src/ui/theme/` is the tokens' source from phase 3 on |

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
```

The Android commands need a JDK and the Android SDK. On a Mac, from Homebrew:

```
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export PATH="$ANDROID_HOME/platform-tools:$PATH"
$ANDROID_HOME/emulator/emulator -avd eien-pixel7 &   # a Pixel 7 on Android 16
```

`npm run test:android` clears Eien's data and its Documents/Eien on the device
it runs on: use an emulator, not a phone that holds a real vault.

CI (`.github/workflows/ci.yml`) runs lint, types and unit tests on Linux, the
end-to-end tests on macOS, Windows and Linux, the phone's page in Chromium, and
the Android debug build (its APK kept as the run's artifact), on every push to
`main` and every pull request. The Android tests on a device are run by hand. An end-to-end test that holds the app to a time (a draw,
a search, typing without a stall), or drags with the pointer, is tagged
`ALONE` (`@alone`, from `tests/e2e/launch.ts`): those run after the rest, one
at a time, so they measure Eien and not the tests running beside them, and no
other test's window takes the focus mid-drag.

`.github/workflows/weekly.yml` runs mutation testing (report and score in the
run) and the property tests with a new seed, every Monday and by hand. It never
runs on a push or a pull request, and no change waits on it.

A test that guards a security or safety rule should be shown to fail when the
rule is broken (turn the rule off, run the test, put it back).
