# Eien — notes for agents

Read [docs/spec.md](docs/spec.md) first. It is the source of truth for behavior;
when code and spec disagree, fix one of them in the same change. New to the
project? [docs/handbook.md](docs/handbook.md) is the way in: what Eien is, how
it's built and shipped, and where everything lives.

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
| `src/core/` | Rules, pure TypeScript: `paths`, `text`, `vault` (`assets.ts`: a note's own folder of images, `<note>.assets`, its links and the names images are kept under), `saving`, `format` (the formatting commands), `table` (a GFM table's lines read and written back as they were, `line.ts`; its cells and the keys between them, `table.ts`; the table editor's changes, `edits.ts`; what's typed into a cell, `cell-input.ts`), `config` (every setting, and its files; `faces.ts`, FACES, the one list the three face settings (Typeface, Interface font, Source font) choose from, each face with its machine sizes), `markdown` (Eien's Markdown and a note's plain text, shared with the editor), `note` (`note-tags.ts`: its tags in two kinds, front matter's and the text's), `tags` (`front-tags.ts`, the page's edits to front matter's `tags:` alone; `choices.ts`, what the page's tag field offers), `search`, `versions` (ids, seal files, retention, the word diff), `typography` (quotation marks), `counters` (today's tally, a sprint), `html` (Copy as HTML and Paste: `to-html.ts` writes blocks round `inline-writer.ts` (the tags and marks it knows in `inline-tags.ts`), and `bookBlocks` the same for a book's exports; `from-html.ts` reads blocks round `html-inline.ts`, after `tidy.ts` turns styles into tags; `entities.ts`, HTML 4's named references), `export` (a note as a chapter, `chapter.ts`, with its footnotes, which `markdown/footnotes.ts` finds (`markdown/fences.ts`: what's fenced code, line by line); `epub.ts`, `docx.ts` round `docx-body.ts` (its runs, paragraphs and pictures in `docx-runs.ts`), and `print-html.ts`, the PDF's page; `images.ts`, an image's kind and size from its own header; `zip.ts`, a store-only zip of Eien's own), `import` (`plan.ts`: which files of a folder from elsewhere come in, under what names, and why the rest don't), `themes` (spec §7: `color.ts`, hex, HSL and WCAG contrast; `contrast-rules.ts`, Eien's contrast and the verdict; `gallery.ts`, Eien's own themes; `mix.ts`, a writer's theme from four choices, each ink fitted by `fitInk`; `tokens.ts`, the `--eien-*` overrides a palette wears and `safeTokens`, the check on them; `theme-file.ts`, a file in `.eien/themes`; `choice.ts`, which theme the Palette setting names) |
| `src/platform/` | `bridge.ts` (all the window may ask), `storage.ts` (the Storage contract), and its `electron/`, `capacitor/` and `memory/` implementations; `index/`, the vault's index over any Storage; `open-vault.ts` (a vault and its index kept in step) and `settings-store.ts` (this device's settings and the vault's), shared by the desktop and the phone; `image-write.ts`, the one file the window may write as bytes (a new image), checked by the main process and the phone's vault; `stray.ts`, what a crash can leave (temp files, each write's own, and a phone's rename steps), recovered at open by `electron/recover-strays.ts` and `capacitor/recover.ts`; `electron/import-folder.ts` copies a folder's notes and images into the vault through its storage (`Storage.writeNew` for an image's bytes), reading them with `electron/outside-folder.ts` (no link followed; the vault told apart by what it is on the disk). `capacitor/` is Storage over a plain `FilesPort` (`files.ts`): Capacitor's Filesystem on the phone (`capacitor-files.ts`), Node's in tests (`node-files.ts`), so the storage contract tests run on it; `recover.ts` puts back what a crash left; `poller.ts` looks for changes, as a phone has no watcher; `phone-trash.ts` is the phone's trash, .eien/trash. `case-twin.ts` keeps every storage from making a name its folder has in another case; `theme-files.ts` keeps the writer's themes in `.eien/themes` over any Storage (or the window's bridge to one); `tests/case-folder.ts` gives tests a disk that tells case apart (a disk image on a Mac). `electron/disk-watch.ts` is the desktop's watcher |
| `src/ui/` | The window: `app.ts` holds the settings, the menu and the vault shown; `vault/vault-view.ts` wires the panes (`sidebar`, `list`, the page pane) to the vault, and `vault/pane-drawer.ts` draws them; the page pane is `page/page-pane.ts` (the layout's slots, the colophon, the versions panel beside) with its pages (`page/page.ts`, one page: its sheet, editor and its own status), run by `vault/pages.ts` (the pages, the active one the commands act on, each page's note, `vault/open-note.ts`, and its seals); a note open on any page is held once in `vault/open-notes.ts` (one session, one document, its images), however many pages show it; what the writer does to notes from any pane is `vault/note-actions.ts`, what a row and its menus do `vault/row-actions.ts`, the sidebar's actions `vault/vault-sidebar.ts`, and the list's lens and Arrange mode `vault/list-lens.ts`; the split (spec §4, two pages side by side) is the pane laying out two pages, folded with a pager when narrow (`page/split.css`), the divider between (`page/divider.ts`, where it stands in `shell/split-state.ts`), each page made and let go whole by `vault/page-side.ts`, a note dragged onto the pane by `vault/page-drop.ts`, and a row's marks for the pages' notes, chosen and beside, `list/shown-notes.ts`; a page's title is `page/page-title.ts`; a note's, folder's and tag's menus open from `vault/menus.ts`, their choices listed in `vault/menu-items.ts`; `quiet-button.ts` is the quiet icon button (the +, a sheet's ×, the divider's ⇄); `shell/panes.ts` resizes and shuts them (widths per device, `shell/pane-state.ts`), and with two panes the sidebar's tree (`sidebar/tree.ts`, its styles in `sidebar/tree.css`) lists the notes (`sidebar/note-row.ts`; kept between draws, and put right in place while the rest of the tree is the same, by `sidebar/row-cache.ts`); a long list of notes there, and the note list once it is long, draws only the rows in sight (`shell/windowed-rows.ts`, the arithmetic in `shell/window-range.ts`; the keyboard reaches every row); the sync status at its foot (`sidebar/sync-status.ts`; whether a change came from elsewhere, by `vault/own-writes.ts`, the window's own writes remembered a moment; `app/electron/syncthing.ts` finds the `.stfolder`), a + beside FOLDERS and TAGS (made once, their tooltips watched alone), a new tag named in place by `sidebar/tag-field.ts` and kept by `core/tags/made.ts` in `.eien/tags.json`; folders and tags move in your order (`vault/folder-order.ts`, run by `vault/order-actions.ts`; a folder's keys and a tag's in `sidebar/row-keys.ts`, a folder's drag in `sidebar/folder-drag.ts`); the tree's long lists are `sidebar/tree-windows.ts`, and with two panes the chosen row's lens is `sidebar/lens-slot.ts`; its sections fold (`sidebar/sections.ts`, folded per device in `sidebar/folds.ts`); the lens over each list (`list/lens-bar.ts`: the sort and the tag filter, their chips; `list/tag-filter-panel.ts`, the filter's three states; its rules in `core/tags/filter.ts`; kept per list on this device by `list/sorts.ts`), drawn in the list's head and, with two panes, for the chosen row in the sidebar; `list/search-field.ts` is the one search field, on the list's band or, with no list in sight, in the sidebar (placed by `vault/pane-drawer.ts`); `vault/organize.ts` renames, moves and trashes, keeping order and pins in step (the vault's own small files, pins, tags and All Notes' order, through `vault/small-files.ts`); a note renames in its row (`vault/rename-in-row.ts`, the field laid over the row by `list/name-field.ts`, following its row through redraws); `versions/` seals the open note (`note-versions.ts`, the rules in `core/versions`), compares it with a seal and lists its seals; `menu/` is the floating menu (a row's: its name at the head, an icon, a word and a key per choice, the trash in carmine); `welcome/` before a vault is open; `editor/` is CodeMirror in a shadow root (its styles load as constructed style sheets, which the CSP allows); a note's text and undo history are `editor/note-doc.ts`, one document every view of the note mirrors (a view's change goes through it to the others, ⌘Z and the Edit menu's Undo run on it, and a change is told and counted once, by the view it was made in); the keys are `editor/editor-keys.ts`, the views' extensions by mode `editor-modes.ts`, a link followed `links.ts`; `editor/typing.ts` decides typed quotes and pastes on the editor's state alone, `editor/live-tables.ts` draws a table in place, row by row, its cells as outer decorations, and the table editor edits it in Live (`editor/table-editor.ts` wires it; `table-at.ts` finds the caret's table; `table-commands.ts` makes each change one step of the history and tells the colophon; `table-keys.ts`, `table-input.ts` what's typed, `table-menus.ts`, `table-tools.ts` the grips and + on the desktop, the window's own controls in a layer over the editor, made and placed by `table-controls.ts` from `table-geometry.ts`, dragged by `table-drag.ts`; `table-bar.ts` a phone's bar; their look in `editor/table.css`), `editor/hidden-marks.ts` is Live with Show Markdown marks off (Backspace and Delete beside a hidden mark), `editor/image-drop.ts` hands a dropped or pasted image on (`vault/note-images.ts` copies it into the note's `.assets` and links it; `vault/note-assets.ts` moves and trashes that folder with its note), and `editor/writing-tools.ts` the scene break key, focus mode and typewriter scrolling; `vault/copy-html.ts` is Copy as HTML; `vault/exports.ts` exports a note or a book, with the images `vault/export-images.ts` reads (`vault/current-book.ts` finds the book, for outline cards too) and `vault/importing.ts` imports a folder; `page/page-tags.ts` puts the note's tags on the page (`page/tag-set.ts` draws them, with the + field and its menu; `editor/find-tag.ts` finds one typed in the words), in the slot the layout names; the formatting bar is the `format` slot's host, its buttons pressed by `editor/active-formats.ts`; `page/word-count.ts` counts the note's words and what the writer's own changes add, and `counters/` shows today's, the book's and a sprint's in the colophon (wired in `vault/counting.ts`); `menu/ask-number.ts` asks for a number where a menu was (a book's goal); `outline/board.ts` is outline cards, shown in the sheet's place (`vault/outline.ts`); `vault/page-parts.ts` makes what the pages share (counters, Copy as HTML, exports, outline cards, each acting on the active page) together, for `vault/vault-view.ts`; `vault/follow.ts` follows the disk, the settings and the menu's commands while a vault is shown; `menu/menu-bus.ts` carries the menu's commands, from the menu bar or a phone's ⋯; `phone/` is the phone's layout, one pane at a time (`phone-stack.ts`, its back bar, and `more-menu.ts`, the page's ⋯), wired in `vault/phone-view.ts`; `settings/` is Settings over the window (spec §6): `settings-screen.ts` draws the categories and tabs (`places.ts`: which schema group is which tab, This vault's apart) and each setting by its kind (`controls.ts`), the sheet moved and resized by `frame.ts` (the arithmetic, and the box kept per device, in `box.ts`), the Themes tabs in `themes-tabs.ts` (the cards in `theme-card.ts`, a custom theme's mix in `mix-panel.ts`); the look the settings set on `<html>` (`look.ts`, the custom properties in `look-properties.ts`), and which zoom ⌘+ and ⌘− change (`zoom.ts`); `chrome/` is the window's controls (spec §4, Layouts): every control a command, once, in `chrome/commands.ts` (its icon, name, key and the menu's command it runs), drawn as icon buttons (`icons.ts`, Eien's own, inline SVG) by hosts (`chrome/host.ts`, with tooltips from `chrome/tooltip.ts`), each layout a list of its hosts and the slot each goes in (`chrome/band.ts`, `slip.ts`, `runhead.ts`, each with its own stylesheet and corners; `chrome/layout-spec.ts` the slots and the hosts all three share), mounted and switched by `chrome/chrome.ts` and wired to a shown vault (how each command looks now, the ones the window runs itself) in `vault/chrome-wiring.ts`; `theme/wear.ts` wears the theme chosen on `<html>`, and `theme/writer-themes.ts` keeps the vault's own themes for the window (the API Settings' Themes tabs build on); the panes' top bands drag the window (`shell/shell.css`, which also holds the corner's lengths: `--seal-x`, `--corner`, a shut sidebar's `--strip`), and whether macOS's lights stand in its top-left corner (not in full screen) is `shell/controls-left.ts`; styles in `theme/` and beside each view |
| `src/app/electron/` | Main process: window, menu, the vault and settings sessions and their IPC (`ipc.ts`: each channel listened to once, each call answered by the window that sent it), the vaults the windows hold (`vaults.ts`: each folder opened, recovered and watched once however many windows show it, each window told which changes another window here made), the device's own file (`device-settings.ts`; where it and the data folder are, for an installed, portable or separate copy, is decided in `data-folders.ts` alone), `out-session.ts` (the clipboard, the save dialog; a PDF printed by `print-pdf.ts` in a hidden window that runs nothing), and `import-session.ts` (Import Markdown Folder…); `menu.ts` builds the menu bar, its on/off settings as checks that `checkToggles` keeps in step (`TOGGLES` in `core/config`); `context-menu.ts` is the note's right-click menu (spelling suggestions on macOS, from `context-menu-of.ts`); `frame.ts` is the window with no title bar (the system's controls over the bands, painted as the window's `shell/window-controls.ts` reports them) and the whole window's zoom; the sandboxed `preload.ts` |
| `src/app/mobile/` | The phone: `preload.ts` sets `window.eien` before the window's own script (the page is the desktop's, built by `vite.mobile.config.ts` into `out/mobile`); `mobile-vault.ts` opens the vault in Documents/Eien/Vault (exports go to Documents/Eien/Exports); `vault-home.ts` and `all-files.ts` ask for Android's access (Eien's plugins are in `android/app/src/main/java/io/github/onlynyans/eien/`: `AllFilesPlugin.java`, and `VaultFilesPlugin.java`, the flushed write and the one-step renames `capacitor-files.ts` uses on Android); `phone-out.ts` copies and exports (HTML, EPUB and Word; no PDF, and no import, on the phone). `android/` is the Capacitor Android project (`capacitor.config.json`); `ios/` is the Capacitor iOS project, with Eien's Swift plugin (`ios/App/App/VaultFileOps.swift`, the file operations, a save's last step coordinated with other apps (`replace`), tested by `scripts/ios/vault-file-ops-test/`, `vault-file-ops-adversarial/` and `vault-file-coordination/`; `VaultFilesPlugin.swift`, registered by its view controller) |
| `tests/` | Architecture tests (layers; `selectors.test.ts`: no style rule ends in `*` after a `:hover` or `:focus`, which restyles the whole window); `zip-interop.test.ts` holds Eien's zips to zlib and `unzip`; `tests/support/` holds what the tests share, Node-free so core's tests can use it: a strict zip reader, a strict XML check, an export's parts; `tests/e2e/` drives the built app on real folders with Playwright; `tests/mobile/` the phone's page in Chromium; `tests/android/` Eien on an emulator or phone over adb |
| `tsconfig.{core,web,node,mobile,e2e}.json` | One per environment: core can use neither DOM nor Node, the window can't use Node, the phone's code has the DOM and no Node |
| `docs/design/` | The approved design and its mockups; `src/ui/theme/` is the tokens' source from phase 3 on. `.interface-design/system.md` sums it up for the interface-design skill |
| `docs/backlog.md` | What comes after the phases: fixes, tweaks and features, each marked for the design pass or not, and the owner's open questions |

## Tests

Each kind catches its own regressions; a change adds the kind that would
have caught it breaking.

| Kind | For | Where | Run |
|---|---|---|---|
| Unit | A module's rules, given inputs | `name.test.ts` beside the module | `npm test`, or `npx vitest run <path>` |
| Property | A rule over thousands of generated inputs (fast-check) | `name.property.test.ts` beside it | `npm test` |
| DOM unit | What a window module draws and does: rows, roles, keys, focus kept across a redraw | `name.test.ts` under `src/ui/`, which run in happy-dom | `npx vitest run src/ui` |
| Architecture | Layers, selectors, identity, icons, wiring | `tests/*.test.ts` | `npm test` |
| End to end | The built app on real folders: what a writer does | `tests/e2e/*.spec.ts` | `npm run test:e2e` |
| Accessibility | No serious or critical axe-core violation (WCAG 2.2 AA, contrast included), each layout by day and night, three panes, two, Settings | `tests/e2e/accessibility.spec.ts`, `tests/mobile/accessibility.spec.ts` | in `test:e2e`, `test:mobile` |
| Speed budgets | No long task over 200 ms with thousands of notes | `tests/e2e/budgets.spec.ts` | in `test:e2e` (`ALONE`) |
| Resource budgets | Elements in the window, the JS heap after a long session, the first list's time, the renderer's size | `tests/e2e/resources.spec.ts` | in `test:e2e` |
| Phone page | The phone's page in Chromium, Capacitor's web plugins standing in | `tests/mobile/*.spec.ts` | `npm run test:mobile` |
| Mutation | The edits to core and platform no test notices | Stryker, weekly | `npm run test:mutation` |
| Coverage | A floor: CI fails under `thresholds` in `vitest.config.ts` | lint job | `npm run test:coverage` |

Adding one:

- **Unit and property tests** try the same inputs on every run; `FC_SEED=<n>`
  reproduces a failure from another seed, and `FC_RUNS` tries more.
- **DOM unit tests.** Vitest has two projects (`vitest.config.ts`): `src/ui/**`
  runs in happy-dom, everything else in Node, so core can't lean on a DOM.
  happy-dom lays nothing out: sizes are 0 and `checkVisibility()` is always
  true, so stub `getBoundingClientRect` (or `clientHeight`, `scrollTop`) where
  a module measures, and leave what only a real window shows to the end-to-end
  tests. Test what the writer meets (rows, names, roles, keys, where the
  keyboard is), not private state. `navigator.platform` isn't a Mac's: the
  modifier is Ctrl.
- **Accessibility.** `seriousViolations(page)` (`tests/e2e/axe.ts`) checks
  the window at rest (motion reduced, so no fade is caught halfway);
  `violationsUnder(page, areas)` with the pointer over each area, so controls
  that show on hover are checked too. A new screen or popup adds its state to
  the accessibility specs. Fix what it finds; what can't be fixed in the change
  goes in `docs/backlog.md`.
- **Budgets** (speed's rules are under Commands, after CI). Measure first
  (`BUDGETS=1` prints each number), then set the budget with room for CI's
  slower machines, and write the measured number beside it. A test held to a
  time is `ALONE`. A listener, cache or element kept per note is what the heap
  and element budgets catch.

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
other test's window takes the focus mid-drag. `tests/e2e/budgets.spec.ts` holds the speed budgets
(three thousand notes: no long task over 200 ms while drawing, moving
through, switching layouts, syncing, renaming or dragging). Never raise a
budget to make a test pass; find what's slow. `BUDGETS=1` prints each
measured time, and `SLOW=4` runs them with the CPU four times slower, as a
slow CI machine might be.

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
- **The icon is the seal** (a vermilion square with 永), from one source,
  `build/icons/seal.svg`: 永 from Noto Serif JP (OFL; the outline as a path,
  placed as `.seal` sets it; the SVG's comment says how), in the interface's
  seal colours. After changing
  it run `npm run icons` (`scripts/icons/build.mjs`, which rasterizes with
  Electron itself and writes the `.icns` and `.ico`) and commit what it makes:
  the macOS template (`build/icons/icon.icns`: a rounded square, 824 of 1024
  px, one soft shadow), Windows' `icon.ico` (16 to 256, the full square), Linux's
  PNGs (`build/icons/linux/`, 16 to 512; the 512 is also packed as
  `resources/icon.png` for the window's own icon, `window.ts`), Android's
  adaptive icon (the glyph as a vector, scaled into the 66 dp safe circle, over
  the seal's colour; a themed one too; legacy square and round PNGs under it)
  and iOS's 1024 px square, which must have no alpha channel. `electron-builder.ts`
  names them (`ICONS`); `tests/icons.test.ts` holds the sizes and the wiring.
  The vermilion is the interface's own, not deepened for small sizes: the glyph
  holds at 32 px and up, and at 16 it blurs to a pale mark on the colour.
