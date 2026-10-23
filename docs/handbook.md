# Eien — the handbook

For whoever takes Eien over: what it is, how it's built, how to change it
safely, and how it ships. It points into the other documents rather than
repeating them; where they disagree, [spec.md](spec.md) wins for behaviour
and the code wins for fact.

## 1. What Eien is

A local Markdown notes app for writers, especially of long fiction and
fanfiction. Notes are plain `.md` files in a folder (the **vault**). Eien adds
tags, books (a folder of chapters in order), **seals** (versions you keep),
clean HTML on copy, word counts and goals, and exports (EPUB, Word, PDF).
It runs on macOS, Windows and Linux (Electron), and on Android and iOS
(Capacitor). Devices sync through the files themselves, with Syncthing; there
is no server, no account and no network use at all.

Its first rule is that **words are never lost**: every path that removes
text leaves it recoverable (a seal, a sibling copy, the system trash) and
says where. Most of the code's care, and most of its tests, serve that rule.

The interface is "a book on a desk at night": a quiet desk (the sidebar),
washi paper (the list and the page), sumi ink, one vermilion seal. Controls
stay out of sight until the pointer or the keyboard asks for them.

## 2. Reading order

1. [README.md](../README.md): what a writer gets, how to install, where
   things are kept.
2. This handbook.
3. [spec.md](spec.md): the source of truth for behaviour, by section (vault
   on disk §2, saving and sync §3, interface §4, architecture §5, settings
   §6, themes §7, HTML and exports §8, versions §9, phones and sync §10,
   testing §11).
4. [AGENTS.md](../AGENTS.md): the rules for the code, the module map, every
   command, the kinds of test, releasing. Written for people and coding
   agents alike.
5. [backlog.md](backlog.md): what's done, what's left, and the owner's
   decisions with their dates.
6. [design/README.md](design/README.md) and
   [.interface-design/system.md](../.interface-design/system.md): the visual
   system; [design/explorations/](design/explorations/README.md): the stage 2
   and 3 design work, with the components as built at the end of
   [specimen.html](design/explorations/specimen.html).
7. [progress.md](progress.md): where the work stood at the last handover.

## 3. Features, and where they live

Each row: what it is, its section of the spec, and where to start in the code.

| Feature | Spec | Code |
|---|---|---|
| The vault: notes, folders, books, tags, pins | §2, §4 Organizing | `src/core/vault`, `src/core/tags`, `src/ui/vault/vault-state.ts` |
| Saving as you type, conflicts kept, crash recovery | §3 | `src/core/saving`, `src/ui/notes/note-session.ts`, `src/platform/stray.ts` |
| The editor: Live, Source, Reading; formatting; images | §4 Editor views, Markdown | `src/ui/editor/`, `src/core/format`, `src/core/markdown` |
| The window's three layouts (Band, Slip, Running head) | §4 Layouts | `src/ui/chrome/` (commands defined once, hosts per layout) |
| Sidebar: Library, Folders, Tags; two panes | §4 Layout | `src/ui/sidebar/` |
| The note list, search, the lens (sort, tag filter) | §4 Organizing, Search | `src/ui/list/`, `src/core/search`, `src/platform/index/` |
| Your order: folders, notes, tags, All Notes; Arrange mode | §2 Folders, §4 Organizing | `src/ui/vault/folder-order.ts`, `order-actions.ts`, `small-files.ts` |
| Rename in place, Eien's own right-click menu | §4 Organizing | `src/ui/vault/rename-in-row.ts`, `src/ui/list/name-field.ts`, `src/ui/menu/` |
| Tags on the page, the formatting bar | §4 | `src/ui/page/` (stage 3D, #41) |
| Seals: ⌘S, Compare, named seals, restore | §9 | `src/core/versions`, `src/ui/versions/` |
| Copy as HTML, paste from HTML, curly quotes | §8 HTML | `src/core/html`, `src/core/typography`, `src/ui/editor/typing.ts` |
| Counters, goals, sprints, outline cards, focus, typewriter, spellcheck | §4 Writing tools | `src/core/counters`, `src/ui/counters/`, `src/ui/outline/`, `src/ui/editor/writing-tools.ts` |
| Export EPUB, Word, PDF; import a Markdown folder | §8 | `src/core/export`, `src/core/import`, `src/ui/vault/exports.ts` |
| Settings over the window; This vault; faces and weights | §6 | `src/core/config/schema.ts` (every setting), `src/ui/settings/` |
| Themes: the gallery, your own in `.eien/themes` | §7 | `src/core/themes`, `src/ui/theme/`, `src/platform/theme-files.ts` |
| Sync status (Syncthing) | §4 Layout | `src/ui/sidebar/sync-status.ts`, `src/ui/vault/own-writes.ts` |
| The phones | §10 | `src/app/mobile/`, `android/`, `ios/`, `src/ui/phone/` |
| Installers, portable copies, data folders | AGENTS → Releases | `electron-builder.ts`, `src/app/electron/data-folders.ts` |

## 4. Architecture

### Layers

```
src/core      rules, pure TypeScript: no DOM, no Node, no Capacitor
   ↑
src/platform  Storage and its three implementations, the index, settings files
   ↑
src/ui        the window (also the phone's page)      src/app   Electron main, the phone's preload
```

Layers point inward, and `tests/layers.test.ts` fails a change that breaks
that. Each environment has its own tsconfig (`tsconfig.{core,web,node,mobile,e2e}.json`),
so core can't reach for the DOM by accident.

### Processes

- **Desktop:** Electron's main process (`src/app/electron/`) owns the disk,
  the menu and the window. The window (`src/ui/`) is sandboxed: context
  isolation, no Node, a strict content security policy (no inline scripts or
  styles, nothing remote), and it reaches the disk only through `window.eien`,
  the bridge (`src/platform/bridge.ts`), set by the preload. Each IPC channel
  is listened to once, and each call is answered by the window that sent it
  (`src/app/electron/ipc.ts`). A folder is opened once however many windows
  show it (`src/app/electron/vaults.ts`): one index, one watcher, and a
  crash's leftovers recovered only by the first. A setting changed in one
  window is read again by the others.
- **Phone:** the same window code, built by `vite.mobile.config.ts`, inside a
  Capacitor WebView. `src/app/mobile/preload.ts` sets `window.eien` to the same
  bridge, implemented over Capacitor's Filesystem (and Eien's own native
  plugins for the flushed write and one-step renames: Java on Android, Swift
  on iOS). There's no watcher on a phone; a poller looks for changes.

### The Storage contract

Everything on disk goes through `Storage` (`src/platform/storage.ts`): list,
read, write at a version (a write that loses a race is refused, never
overwrites), move, trash, make a folder, watch. Three implementations: the
desktop's disk (`electron/disk-storage.ts`), the phone's (`capacitor/`, over a
`FilesPort` that tests run on Node), and memory (tests). One contract test
suite (`src/platform/storage.test.ts`) runs against all of them, so a rule
holds everywhere. `case-twin.ts` keeps a storage from making a name that only
differs by case from one already there (Syncthing couldn't carry both).

### The window

- `ui/app.ts` opens the vault and holds settings; `ui/vault/vault-view.ts` is
  the composition root that wires the panes to the vault, and
  `ui/vault/pane-drawer.ts` draws them, each draw dropping itself if a newer
  one started.
- The state the panes draw from is `ui/vault/vault-state.ts`: the entries,
  the index's notes, the tree (in your order), tags, pins, each folder's
  settings, All Notes' order.
- File operations go through `ui/vault/organize.ts` (rename, move, trash,
  order, pins) and run one at a time (`one-at-a-time.ts`), each followed by a
  refresh and a redraw.
- The window's controls are **commands, defined once** (`ui/chrome/commands.ts`),
  drawn by **hosts** that each layout places. A layout is a list of hosts;
  switching layouts swaps hosts and nothing else.
- **Long lists draw only the rows in sight** (`ui/shell/windowed-rows.ts`),
  from 200 notes up, in the list and in the tree, with the keyboard reaching
  every row. The tree keeps unchanged rows between draws (`row-cache.ts`).
- Settings live in one schema (`core/config/schema.ts`): each setting's key,
  label, scope (this device or the vault), group (Settings' tab), kind and
  default. Settings over the window draws from it.
- Theme tokens are CSS custom properties, defined once in
  `ui/theme/tokens.css`. A theme overrides tokens and nothing else.

### Key flows

- **Typing to disk:** the editor's change → the note's session debounces
  → `Storage.write(path, text, version)`; a refused write (the file changed
  elsewhere) keeps both: the disk's version as the note, yours beside it, and
  the page says so (spec §3).
- **A change from another device:** the watcher (or the phone's poller)
  reports paths → `ui/vault/follow.ts` settles the burst → the vault state
  refreshes what changed → the panes redraw; the open note reloads if it
  changed and you hadn't. `own-writes.ts` tells the window's own echoes from
  another device's changes, for the sync status (the rule in
  `core/vault/recent-writes.ts`); the main process names the changes another
  window on this device made, so they're not taken for a sync.
- **A rename:** the row's field (`rename-in-row.ts`) → `Organizer.renameNote`
  → `Storage.move` → the folder's order, the pins and All Notes' order follow
  (`small-files.ts`) → refresh.
- **A seal:** ⌘S → a copy in `.eien/versions/<note id>/<UTC time>.md`; the
  note's id lives in its front matter, hidden from the page.

## 5. Data on disk

```
Vault/
  .eien/
    config.json      the vault's settings (chapter numbers, the scene break in copied HTML)
    pinned.json      pinned notes, a list of paths
    order.json       All Notes in your order, a list of paths
    tags.json        { made: tags no note carries yet, order: the tags' order }
    themes/*.json    the writer's own themes
    versions/<id>/   seals, one file each
    trash/           the phone's trash (a phone has no system trash)
  .eien-folder.json  the vault's top folders' order
  Fic/
    .eien-folder.json  { order: [folders, then notes], book: { goal } }
    Chapter.md
```

- Everything Eien keeps is a small JSON file beside the notes, so it syncs
  with them. Each is read, changed and written back at the version read, and
  read again if another device changed it meanwhile (`small-files.ts`). No
  file is written for no change, and a file that isn't JSON is never written
  over: the writer is told to fix it.
- **Per device, never synced:** `settings.json` (in `Documents/Eien`, or the
  data folder; see README → Where Eien keeps things), and the window's own
  storage: pane widths, folded sections, sorts and tag filters per list.
- Names: a note's title is its file name. `core/paths` holds the rules for
  names that every system can store, and for what a watcher reports.

## 6. Safety: the rules, and what holds each

| Rule | Held by |
|---|---|
| A save never leaves a half-written file | writes go to a temp file, flushed, then renamed over (`Storage.write`); `stray.ts` recovers what a crash left at the next open, as a "(recovered …)" note |
| Two devices' changes are both kept | writes at a version; a lost race keeps both (spec §3); Syncthing's conflict copies are shown beside their note, never counted twice |
| Nothing is deleted outright | the system trash on the desktop, `.eien/trash` on a phone; a failed trash deletes nothing and says why |
| A name another file has, case aside, is refused, never numbered over | `src/core/paths/sibling-names.ts`, `src/platform/case-twin.ts` |
| The window can't touch the disk | the sandbox, the bridge, `tests/e2e/window.spec.ts` (the bridge can't be changed, the CSP blocks inline and remote code, navigation and new windows refused) |
| Settings and themes from a synced file can't break the window | `core/themes/tokens.ts` `safeTokens`; settings read by their schema |

A test that guards a safety rule should be seen to fail with the rule turned
off (AGENTS → Tests).

## 7. The interface system

- **Design source:** `docs/design/` (tokens, mockups, the specimen), and
  `.interface-design/system.md`, which sums it up. Decisions after the
  mockups are in `docs/design/explorations/*.md` and the backlog's Decided
  section.
- **Tokens:** `src/ui/theme/tokens.css` is the source in the app;
  `docs/design/tokens.css` mirrors it for the mockups (with the mockups' own
  font names).
- **Icons:** Eien's own, inline SVG on a 16-unit grid (`src/ui/icons.ts`),
  stroked in `currentColor`; no icon font, nothing fetched.
- **Corners:** set by the layout (A 2/4/8, B 4/8/14, C 3/6/10); paper stays
  square.
- **Accessibility:** every control has an accessible name and its key in
  `aria-keyshortcuts`; menus and dialogs are ARIA; the keyboard reaches
  everything and is never left on something hidden or gone. axe-core runs in
  CI over each layout, day and night (WCAG 2.2 AA, contrast included).
- **Never interrupt the writer:** nothing pops up while typing; tooltips go
  away on a key; controls fade in on hover or focus.

## 8. Performance

- Long lists draw only the rows in sight; the tree patches the rows that
  changed instead of redrawing.
- **Budgets, in CI** (`tests/e2e/budgets.spec.ts`, `resources.spec.ts`):
  with 3,000 notes, no task holds the window over 200 ms while drawing,
  moving through a list, switching layouts, a sync of a hundred files, a
  rename, a drag, or filtering from the sidebar; the elements in the window,
  the heap after a long session, the first list's time and the built
  renderer's size each have a ceiling. Never raise a speed budget to pass: find
  what's slow. Size budgets are measured again (+10%) when a feature lands,
  with the numbers written beside them.
- `BUDGETS=1` prints each measure; `SLOW=4` slows the CPU fourfold, as a slow
  runner might.

## 9. Testing and CI

The kinds of test, and how to add each, are in AGENTS → Tests. In short:

- **Unit and property** (Vitest, fast-check) beside each module; the window's
  modules in happy-dom.
- **End to end** (Playwright) on the built app with real folders on disk,
  macOS, Windows and Linux; the phone's page in Chromium; the Android app on
  an emulator, by hand; the iOS app on a simulator in CI.
- **Accessibility, speed and resource budgets**, as above.
- **Mutation testing** weekly (`weekly.yml`), with a new property seed.

**CI** (`.github/workflows/ci.yml`) runs on every push to `main` and every
pull request. The repository's ruleset (id 25452157) requires all seven
checks: Lint, types and unit tests (with the coverage floor and `npm audit`);
End-to-end on macOS, Windows and Linux; Phone page; Android debug build; iOS
simulator. CodeQL (`codeql.yml`) and Dependabot (`.github/dependabot.yml`,
weekly, minor and patch, grouped) run beside them but aren't required.

**Known flaky tests** (they pass on a rerun; fix when seen twice):
`settings-window.spec.ts` (moves and resizes, on Linux and Windows),
`versions.spec.ts` (naming a seal on Linux: the first word typed before the
field has the keyboard), hover-driven checks on Linux's runner (prefer the
keyboard to show a tooltip in a test), and the platform storage tests timing
out at 5 s on a slow Windows runner.

## 10. Building and releasing

- `npm run dev` runs the app; `npm run package` makes this system's installer
  and portable copy in `dist/`; `npm run android` / `npm run ios` prepare the
  phone projects.
- **A release:** set `version` in `package.json`, merge, then tag `main`
  (`git tag v0.1.0 origin/main && git push origin v0.1.0`). `release.yml`
  checks the tag matches, builds each installer on its own system, installs and
  starts it there, and attaches all three to a **draft** release that the
  owner publishes by hand.
- **Signing** isn't set up: macOS gets an ad-hoc signature, Windows none, and
  README → Install tells writers how to open them. The secrets the workflow
  takes when there are certificates are listed in AGENTS → Releases. Try a
  signed build by hand (Actions → Release → Run workflow) before tagging one.
- **No auto-update**, by design: Eien never goes online.
- **Phones:** every run on `main` keeps a debug APK as an artifact; iOS is
  built in Xcode and installed with an Apple ID. There's no store listing.

## 11. Working on Eien

- **Pull requests only** into `main`; squash-merged once all seven checks
  pass. Auto-merge on, with the app's Auto-fix watching CI, is how the work
  has been run.
- **Each change carries its test, its spec change, and its backlog row.**
  The spec changes in the pull request that changes behaviour.
- **Small modules** (about 300 lines), named for one concept; KISS and DRY.
  `vault-view.ts`, the composition root, is the one allowed past that.
- **No code from NEO, Obsidian or Otaku.** Eien is written from scratch.
- **Dependencies** are rare and listed with their reason in
  [dependencies.md](dependencies.md); licences must be permissive (MPL only
  for development tools).
- **Writing style:** comments and docs say why, in plain words, as the rest
  of the code does.
- **Parallel work** (several Claude Code sessions, or people) happens in git
  worktrees under `.claude/worktrees/`, one per branch; never switch branches
  in the main checkout. Stacked pull requests are merged up after each
  change to the one below (`git merge` the lower branch into the higher).
- **Never commit** the untracked font files in `docs/design/fonts`: stage
  files by name.

## 12. Open work and known debt

See [backlog.md](backlog.md) for the full list. At this handover:

- **Not done:** #23 the first release (prepared, see [progress.md](progress.md));
  #22 smaller downloads (left by choice); renaming a tag that notes carry
  (#29's last part, not designed: it would rewrite notes); dragging tags
  (they move by ⌥↑ ⌥↓).
- **Debt:** `vault-view.ts` (about 360 lines) wires everything and could lose
  its sidebar actions to a module; `sidebar.ts` is 330. The design's
  `tokens.css` mirrors the app's by hand.
- **Phones:** Android tests on a device are run by hand; the phone has no PDF
  export and no import.

## 13. Accounts and ownership

- **Code:** github.com/onlynyans/eien (public). Licence: UNLICENSED (all
  rights reserved); bundled fonts are SIL OFL; the app icon's glyph is drawn
  by hand, from no font.
- **Identity:** product name `Eien`, app id `io.github.onlynyans.eien`. Never
  change either: the data folder and Windows' updates depend on them
  (`tests/identity.test.ts`).
- **Services:** none. No server, analytics or crash reporting. GitHub Actions
  is the only infrastructure; repository secrets exist only once signing does.

## 14. Words used here

| Word | Means |
|---|---|
| Vault | The folder of notes Eien has open |
| Book | A folder made a book: its notes are chapters, numbered, with a word goal and exports |
| Seal | A version of a note you keep (⌘S); a named seal is a "savegame" |
| Your order | The order you give folders, notes and tags; written to the vault, so it syncs |
| Lens | A sort or tag filter laid over a list, on this device; it never changes your order |
| Arrange mode | A setting under which rows move only while arranging |
| Machine voice | What the machine says: counts, labels, buttons, the status bar, in the Interface font (IBM Plex Mono unless changed); the text face is for what you wrote, the Source font for the Source view's Markdown |
| Band, Slip, Running head | The three layouts: where the window's controls sit |
| Desk, blotter, paper | The surfaces: the sidebar, the page pane, the list and the sheet |
| Made tag | A tag created from the sidebar before any note carries it (`.eien/tags.json`) |
