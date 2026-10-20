# Eien — specification

Status: draft for review. Nothing here is built yet.

Eien is a local Markdown notes app for writers. A vault is a folder of plain
`.md` files. Notes nest in folders and carry tags; a folder can be marked as a
book, which adds ordering, word goals and exports. Every note can be
checkpointed, compared with its checkpoint, and saved as named versions.

It runs on macOS, Windows and Linux (Electron) and on Android and iOS
(Capacitor), from one codebase. Phones and computers share a vault through
Syncthing.

Eien is written from scratch. No code is taken from NEO, Otaku or any other app.

---

## 1. Principles

These decide arguments. When a change conflicts with one, the principle wins.

1. **Words are never lost.** No operation discards text without leaving it
   recoverable: a version, a sibling copy, or the system trash.
2. **Plain files.** A vault opens in any Markdown editor and reads correctly in
   Finder. No database. Eien's own data lives in one hidden `.eien/` folder and
   is readable JSON or Markdown.
3. **Nothing interrupts the writer.** No popups, sounds or notifications while
   typing. Spellcheck is off until asked for.
4. **Simple before clever (KISS).** The smallest design that meets the need.
   No abstraction until there are two real users of it.
5. **One place for each fact (DRY).** Each setting, token, rule and string is
   defined once and read from there.
6. **Clearly labeled.** Every setting, theme token and module says what it is
   in its name. A reader can find the code for a feature from its name.
7. **Verified, not assumed.** Behavior is proven by tests, including the ways a
   user, a sync tool or a crash can break it.

---

## 2. Vault: what's on disk

```
My Vault/
  .eien/
    config.json                vault settings (see §6)
    themes/<name>.json         themes added by the writer (see §7)
    versions/<note id>/        checkpoints and named versions (see §9)
      2026-10-19T16-40-02Z.md
      2026-10-19T17-02-11Z--before the rewrite.md
  attachments/                 images and files pasted into notes
  Fic/
    A Mended Scarf/
      .eien-folder.json        this folder's order, and whether it's a book
      Mending.md
      Fire.md
  Ideas.md
```

### Notes

- A note is any `.md` file in the vault, outside `.eien/`. Other files are
  shown only as attachments.
- The note's title is its file name without `.md`. Renaming the title renames
  the file.
- Text is UTF-8. A byte-order mark and CRLF line endings are read correctly and
  kept as found when the file is written back.
- **Front matter is optional.** A note without it is valid. Eien adds front
  matter only when it needs to store something, and then only the keys it uses:

  ```markdown
  ---
  id: 01JB2X4Q7Z
  tags: [fic/aot, draft]
  ---
  ```

  Unknown keys, comments and their formatting are kept exactly as written.
- `id` is assigned the first time a note needs one (its first checkpoint), so
  versions follow a note through renames and moves.

### Folders, books and order

- Nesting is folders, any depth.
- `.eien-folder.json` exists only when a folder has something to store:

  ```json
  { "order": ["Mending.md", "Fire.md"], "book": { "goal": 40000 } }
  ```

  - `order` is the drag-and-drop order. Files not listed sort after it,
    alphabetically. Names listed but missing are ignored and dropped on the
    next write. Reordering never renames files.
  - `book` marks the folder as a book (ordered reading, word goal, exports).
- The file travels with its folder when the folder is moved or synced.

### Tags

- In front matter (`tags:`), or inline as `#tag` in the text.
- Nested with a slash: `#fic/aot` appears under `fic` in the tree.
- Not tags: `#` inside code, links, URLs, headings (`# Title`), or followed by
  digits only (`#1`).

### Per-device state

Cursor positions, open notes, pane widths, zoom and today's word tally are kept
in the app's own storage on each device. They are never written into the vault,
so two devices never overwrite each other's state through Syncthing.

---

## 3. Saving and sync safety

- **Autosave.** Edits are written 800 ms after typing pauses, and on blur,
  switching notes and quitting. A note that hasn't changed is never rewritten.
- **Durable writes.** Write to a hidden `.name.md.eien.tmp` beside the note,
  flush it to disk, rename it over the note, and flush the folder. A crash
  leaves the old file or the new one, never a partial one. At the next launch
  a stray temp file newer than its note, holding different words, is kept as
  `Note (recovered 2026-10-19 16-40).md`; every other one is removed.
- **External changes.** Eien watches the vault. When a note changes on disk:
  - If the open copy has no unsaved edits, the new text is loaded.
  - If both changed, Eien never overwrites the file. It saves the open text as
    a sibling, `Note (conflict 2026-10-19 16-40).md`, and shows one quiet
    notice. Both versions remain.
- **Syncthing conflicts.** Files named `*.sync-conflict-*` are shown beside
  their note with a mark, so the writer can compare and merge them.
- **Deleting** sends files to the system trash. If the trash fails, nothing is
  deleted and the writer is told.
- **Paths.** Every path from the window is resolved inside the vault (real
  path, no symlink escape). Names are checked for characters and reserved
  names that Windows, macOS or Android can't store (`CON`, `aux`, `:`, `?`,
  trailing dots and spaces), and for case-only collisions.

---

## 4. Interface

### Layout

Three panes, each collapsible, with a two-pane option in settings:

1. **Sidebar** — a collapsible tree:
   - **All Notes**, with a count
   - **Pinned**
   - **Folders**, nested; books marked
   - **Tags**, nested by `/`
   - At the foot: light/dark switch, sync status, settings
2. **Note list** — the notes in the selected folder or tag: title, a line of
   preview, and the date or word count. Sortable by title, modified date or the
   folder's own order (drag to reorder). Hidden in two-pane mode, where the
   tree lists the notes itself.
3. **Page** — the editor, on a paper sheet. A small header shows the note's
   title and its word count. A status line below shows today's words, sprint,
   and zoom. Controls show on hover or keyboard focus.

Every pane can be resized and collapsed. Keyboard: ⌘1/⌘2/⌘3 focus a pane,
⌘\ toggles the sidebar, ⌘⇧\ the note list.

The visual design (type, color, spacing) is set in the design pass. This spec
fixes only the token names it uses (§7).

### Editor views

The editor has three views of the same note, switched by a toolbar control and
⌘E:

| View | What it shows |
|---|---|
| **Live** (default) | Markdown with its marks hidden except on the line being edited. Checkboxes are clickable, images show inline. |
| **Source** | The raw `.md`, with syntax colored. |
| **Reading** | The note rendered and read-only. |

Live is the WYSIWYG view: you see the formatting, not the marks, and you
format without typing them:

- **Keys:** ⌘B bold, ⌘I italic, ⌘U underline, ⌘⇧X strikethrough, ⌘⇧H
  highlight, ⌘K link, ⌘⌥1–3 headings, ⌘⇧. quote, ⌘⇧7 numbered list, ⌘⇧8 list,
  ⌘⇧9 checklist. Each toggles: pressed again, it takes the formatting off.
- **Format menu** in the menu bar with the same commands and their keys.
- **Selection bar:** when text is selected, a small bar of the same commands
  appears beside it. It appears only for a selection and never while typing.
- Typing the Markdown marks works too, as in any Markdown editor.

### Markdown supported

CommonMark plus GitHub extensions, and three common additions:

- Headings, paragraphs, line breaks, `> quotes`
- `*italic*`, `**bold**`, `~~strikethrough~~`, `<u>underline</u>`, `==highlight==`
- Lists, numbered lists, `- [ ] checklists` (interactive)
- `` `code` `` and fenced code blocks
- Links, `[[wiki links]]` between notes, images
- Tables
- `***` scene breaks
- Basic inline HTML: `<p>`, `<br>`, `<hr>`, `<u>`, `<em>`, `<strong>`, `<s>`,
  `<sup>`, `<sub>`. Anything else is shown as text and never run.

### Writing tools

- **Scene break:** Enter on an empty line after an empty line inserts `***`,
  shown as a centered `* * *` in Live and Reading.
- **Quotes:** typed quotes follow the quote setting (curly or straight).
- **Focus mode:** dims every paragraph but the current one.
- **Typewriter scrolling:** keeps the caret line at a fixed height.
- **Counters:** words in the note, in the book, today; sprint timer with words
  gained; zoom.
- **Zoom:** ⌘+ and ⌘− zoom the page in steps of 10%, ⌘0 returns to 100%. Zoom
  is per device and shown in the status line; the panes and the note list keep
  their size.
- **Text size:** a setting that scales the text face from its tuned size
  (90%–130%), separately from zoom.
- **Outline cards:** a book's notes as cards on a board; drag to reorder.
- **Spellcheck:** off until turned on, using the platform's own checker.

---

## 5. Architecture

### Layers

```
src/
  core/        Pure TypeScript. No DOM, no Node, no Capacitor.
               All rules live here, and all of it runs in unit tests.
  platform/    The only code that touches the disk or the OS.
  ui/          The interface. Calls core for rules, platform for disk.
  app/         Entry points: Electron main and preload, Capacitor shell.
```

Imports point inward: `ui` and `app` may use `platform` and `core`; `platform`
may use `core`; `core` uses nothing outside itself. `app` never imports `ui`
code: it loads the built page. Only `app` and the platform implementations may
import Node or Electron. `tests/layers.test.ts` enforces this.

### Modules

Each folder is one feature with one job, named for it. A module exposes a
small `index.ts`; nothing reaches into another module's files.

```
src/core/            (✓ = built)
  paths/        ✓ name rules, reserved names, collisions, vault paths, sibling names
  text/         ✓ BOM and line endings kept, front matter located, words, chapter numbers
  vault/        ✓ entries, the folder tree, .eien-folder.json (order, book)
  saving/       ✓ what to do when a note changes on disk
  config/        settings schema, defaults, validation (§6)
  theme/         theme schema, validation, token list (§7)
  note/          front matter read/write, id
  tags/          tag extraction and the tag tree
  typography/    quotes and dashes
  versions/      checkpoint naming, listing, retention, word diff
  ao3/           Markdown → AO3 HTML, HTML → Markdown
src/platform/
  bridge.ts     ✓ what the window may ask of the system (window.eien)
  storage.ts    ✓ the Storage interface: read, write, list, watch
  electron/     ✓ Storage over Node fs: durable writes, the watcher, crash recovery
  memory/       ✓ Storage in memory, for tests
  capacitor/     Storage over the phone's file system
src/ui/
  app.ts        ✓ the window: panes, vault and note kept in step
  shell/        ✓ the three panes (resizing and collapsing: phase 5)
  sidebar/      ✓ tree: library and folders (tags, pinned: phase 6)
  list/         ✓ note list
  page/         ✓ the sheet, a plain editor, the colophon
  notes/        ✓ the open note: autosave, reload, conflict copies
  vault/        ✓ the vault as the window knows it
  welcome/      ✓ before a vault is open
  theme/        ✓ tokens.css, base.css, fonts, from docs/design
  editor/        CodeMirror setup, the three views, writing tools
  versions/      the checkpoint cycle and named versions
  settings/      the settings screen, generated from the schema
src/app/
  electron/     ✓ main process, preload, window, menus, the vault session
  mobile/        Capacitor configuration
```

### Rules for the code

- **No large files.** A file holds one concept. Past ~300 lines, split it.
- **Names say what things are.** `checkpointFileName`, not `fmt2`.
- **Pure functions in core.** Input in, output out. Side effects only in
  `platform` and `ui`.
- **Errors are values or thrown, never swallowed.** A failed save is shown to
  the writer and retried; it is never silent.
- **No dependency for something a few lines can do.** Each dependency is listed
  in `docs/dependencies.md` with the reason for it.
- **Comments say why, not what.**

### Security

- Electron window: `contextIsolation`, `sandbox`, no Node in the renderer, a
  strict Content Security Policy (`script-src 'self'`).
- The preload exposes one narrow API. Every handler validates its arguments.
- Markdown and pasted HTML are rendered through a sanitizer; scripts, event
  handlers and remote content never run.

### Stack

| Need | Choice | Why |
|---|---|---|
| Desktop | Electron | One web UI on all three desktops |
| Mobile | Capacitor | The same UI on Android and iOS |
| Language | TypeScript, strict | Catches mistakes before they run |
| Build | Vite | Fast, small configuration |
| Editor | CodeMirror 6 | Proven Markdown editing, live preview through decorations |
| Rendering | markdown-it + a sanitizer | Reading view and AO3 export |
| Diff | jsdiff (word level) | Inline strike/insert, like Google Docs |
| Front matter | `yaml` | Keeps comments and formatting when writing back |
| Lint and format | Biome | One tool for both |
| Unit tests | Vitest, fast-check | Fast; property tests for round trips |
| End-to-end | Playwright (Electron) | Drives the real app on all three desktops |

Exact versions are checked and pinned when the project is scaffolded.

---

## 6. Settings

Every setting is defined once, in `src/core/config/schema.ts`:

```ts
{
  key: 'typography.quotes',
  label: 'Quotation marks',
  description: 'Used when typing and when copying for AO3.',
  scope: 'vault',              // 'vault' travels with the notes; 'device' stays on this device
  type: 'choice',
  choices: { curly: 'Curly “ ”', straight: 'Straight " "' },
  default: 'curly',
}
```

The settings screen, defaults, validation and storage all come from that one
list. Adding a setting means adding one entry.

- **Vault settings** live in `.eien/config.json`: quotes, chapter numbers
  (i ii iii or 1 2 3), AO3 options, scene break style.
- **Device settings** live in the app's storage: palette, scheme (day, night or
  the system's), text face, text size, density (comfortable or compact), page
  frame (sheet or full), panes (three or two), zoom, focus and typewriter
  modes, spellcheck.
- An unknown or invalid value in a file is ignored with a warning in the log,
  and the default is used. A bad config never stops the app from opening.

Settings are grouped and labeled on the settings screen: **Appearance**,
**Editor**, **Writing**, **Layout**, **AO3**, **Sync**.

---

## 7. Themes

- All colors, fonts and sizes are CSS custom properties named `--eien-*`,
  defined once in `src/ui/theme/tokens.css`. The list of names is the theme
  contract, documented in `docs/themes.md`. A rename is a breaking change.
- Token groups, each clearly labeled: **surface** (desk, paper, panel),
  **ink** (text, muted, faint), **lines**, **accent**, **status**, **type**
  (prose, interface, mono), **size**, **space**.
- Light and dark are built-in themes. A theme is a JSON file:

  ```json
  {
    "name": "Ember",
    "mode": "dark",
    "tokens": { "--eien-paper": "#1d1b19", "--eien-accent": "#d9792b" }
  }
  ```

  Only known `--eien-*` tokens with valid CSS values are accepted, so a theme
  can't break the layout or run code. Writer themes go in `.eien/themes/`.
- All fonts are bundled. Nothing is fetched from the web.

---

## 8. AO3

AO3 accepts only HTML. Eien keeps notes in Markdown and converts at the edges.

**Copy for AO3** (and Export → AO3 HTML) produces:

| Markdown | HTML |
|---|---|
| paragraph | `<p>…</p>` |
| line break | `<br />` |
| `***` | `<p><br /></p><hr /><p><br /></p>` (setting: plain `<hr />`) |
| `*em*`, `**strong**` | `<em>`, `<strong>` |
| `~~s~~`, `<u>u</u>` | `<s>`, `<u>` |
| `> quote` | `<blockquote>` |
| headings | `<h2>`–`<h6>` |

Quotes are converted to the quote setting on the way out.

**Paste from AO3** (or any HTML) turns it into Markdown:

- `<p>` → paragraphs; empty `<p><br /></p>` spacers are dropped.
- A spacer, `<hr>`, spacer group → one `***`.
- `<em>`/`<i>`, `<strong>`/`<b>`, `<s>`/`<del>`/`<strike>`, `<u>`, `<br>`,
  `<blockquote>`, headings → their Markdown forms.
- Entities are decoded (`&nbsp;`, `&amp;`, `&#8212;`).
- Other tags keep their text and drop the tag.
- **Plain text that is really HTML** — text with literal `<p>` tags, as copied
  from some notes apps — is detected and converted the same way.

A round trip, Markdown → AO3 → Markdown, gives back the same text. Tests prove
it, including on real AO3 output.

---

## 9. Versions

### Checkpoints

- ⌘S makes a checkpoint of the open note: a copy in
  `.eien/versions/<id>/<UTC time>.md`. Nothing is made if the note matches its
  last checkpoint.
- Autosave keeps writing the note itself. A checkpoint is what "saved" means.

### The compare button

One button (and ⌘⇧D) cycles through three states:

1. **Changes** — the draft compared with the last checkpoint, word by word:
   removed words struck through in red, added words underlined in green.
2. **Checkpoint** — the checkpoint alone, read-only.
3. **Draft** — back to editing.

The diff and the checkpoint view are read-only. Typing in them returns to the
draft first.

### Named versions ("savegames")

- Any checkpoint can be named: `2026-10-19T17-02-11Z--before the rewrite.md`.
- The versions panel lists a note's versions; compare any of them with the
  draft, or restore one.
- **Restoring** first checkpoints the current draft, so restoring is undoable.
- **Retention:** named versions are kept until deleted. Unnamed checkpoints
  older than 30 days are thinned to one per day, and the latest is always
  kept. Deleting a version sends it to the trash.

---

## 10. Mobile and sync

- Android and iOS run the same `ui` and `core` with the Capacitor `Storage`.
- **Android:** the vault is a folder in shared storage (e.g. `Documents/Eien`),
  synced by the Syncthing app. Eien asks for the file access it needs once,
  with a plain explanation.
- **iOS:** the vault lives in Eien's own Files folder, visible in the Files
  app. Syncthing on iOS (Möbius Sync) can sync it. Installing on a device needs
  Xcode and an Apple developer account.
- The phone layout is one pane at a time: tree → list → page, with back
  gestures.

---

## 11. Testing

Tests are the proof that the rules in this document hold. Each section above
has tests named after it.

### Unit (Vitest), in `core/`

Every rule, with the cases most likely to break it:

- **Notes:** no front matter; empty front matter; front matter with comments
  and unknown keys (kept byte for byte); BOM; CRLF; an empty file; a 5 MB
  file; a file that's only front matter; `---` used as a rule in the body.
- **Tags:** in code and links (not tags); `#1`; `#fic/aot/s1`; Unicode tags;
  a tag at the end of the file; the same tag in front matter and text.
- **Folders:** order with missing files, extra files, duplicates, a corrupt
  JSON file.
- **Paths:** `CON.md`, `aux`, `a:b`, trailing dot or space, emoji, a 255-byte
  name, `../` escapes, two names differing only in case.
- **Words:** English, French elision, hyphens, em dashes, CJK, emoji, Markdown
  marks and front matter excluded.
- **Quotes:** apostrophes (`'tis`, `rock 'n' roll`, `the '90s`), nested quotes,
  quotes after a dash, toggling twice gives the same text.
- **AO3:** the real sample from a fic; every table row both ways;
  property-based round trips over generated documents (fast-check).
- **Versions:** naming, sorting, retention at day and month boundaries, time
  zones, names with forbidden characters.
- **Settings and themes:** every invalid value falls back; unknown tokens and
  CSS injection attempts are rejected.

### Storage contract

One test suite runs against every `Storage` implementation (memory, Electron's
Node fs), so they behave the same:

- durable write; a crash between write and rename; a leftover `.tmp`
- a file changed on disk while open; deleted while open; renamed while open
- a read-only file; a full disk (simulated); a permission error

### End-to-end (Playwright, the real Electron app)

On macOS, Windows and Linux, each with a fresh temporary vault:

- create, type, quit, relaunch: the text is on disk and back on screen
- another program edits the open note: it reloads, or a conflict copy appears
- checkpoint, edit, cycle the compare button through all three states
- paste the AO3 sample; Copy for AO3 matches the expected HTML
- switch theme, quotes and pane layout; settings survive a restart
- drag notes to reorder; the order survives a restart
- a vault with 5,000 notes opens and searches within set time limits

### CI (GitHub Actions)

On every push and pull request:

1. Biome (lint and format) and TypeScript type check
2. Unit and storage tests, with coverage reported
3. End-to-end tests on macOS, Windows and Linux
4. Android debug build

On a version tag: release builds for each platform. A pull request
can't merge while any check fails.

---

## 12. Phases

Each phase ends with something you can try, and its tests in CI.

| # | Phase | Result |
|---|---|---|
| 1 | Spec | This document, approved |
| 2 | Scaffold and CI | The app opens an empty window on all three desktops; CI runs lint, types, unit and e2e. GitHub setup walkthrough |
| 3 | Vault and saving | Open a folder; tree, list and page; autosave; external changes and conflicts |
| 4 | Editor | Live, Source and Reading views; all Markdown in §4; formatting keys, the Format menu and the selection bar |
| 5 | Design system | Tokens from `docs/design`; palettes and schemes; the eight text faces; text size, density, page frame and zoom; the settings screen |
| 6 | Organizing | Tags, nesting, search, drag-and-drop order, books |
| 7 | Versions | Checkpoints, the compare button, named versions |
| 8 | AO3 and typography | Copy for AO3, paste from HTML, quote setting |
| 9 | Writing tools | Scene breaks, focus, typewriter, counters, sprint, goals, outline cards, spellcheck |
| 10 | Mobile | Android APK with Syncthing; then iOS |
| 11 | Export and import | EPUB, Word, PDF; import from other Markdown folders |

---

## 13. Not doing

- Accounts, cloud services or telemetry.
- Plugins.
- Real-time collaboration.
- Translations of the interface (strings stay in one place so they can come
  later).

## Open questions

1. AO3 scene break: keep AO3's spacer, `<hr>`, spacer pattern as the default?
2. Default sort for the note list: modified date, or title?
3. Today's word count: words added only, or net (added minus deleted)?
