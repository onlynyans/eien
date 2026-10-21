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
- **Durable writes.** Write to a hidden temp file beside the note, flush it to
  disk, rename it over the note, and flush the folder. A crash leaves the old
  file or the new one, never a partial one. Each write's temp file is its own
  (`.name.md.<token>.eien.tmp`, a random token), never one that's there: a
  temp file a crash left, here or on another device that Syncthing brought it
  from, is never written over or renamed away by a save. At the next launch a
  stray temp file holding words its note doesn't (with a token or from before
  them, `.name.md.eien.tmp`) is kept as `Note (recovered 2026-10-19 16-40).md`,
  whatever its time: its words may be nowhere else. One holding the note's own
  words, or none, is removed; one that can't be read is left for the next
  launch.
- **Renames in two steps.** The phone renames a note or folder whose name
  changes only in case through a hidden step name (`.name.md.eien-case`), as
  its storage ignores case. A crash between the steps leaves the step, which
  Syncthing may bring to another device. Whichever device opens the vault next
  puts it back under its name, or beside what's there now, never over it. A
  step lasts a moment, so one found at launch was left by a crash; one caught
  in flight at worst leaves a duplicate.
- **One write at a time.** Writes to one file (case and accents aside) run one
  after another, so two can't both pass the version check. The version is
  checked again after the temp file is flushed, just before it takes the
  note's place: a change another program makes in that moment is refused, not
  overwritten. On iOS that last look is inside a write coordinated with other
  apps (NSFileCoordinator): an app editing the note in place, through the
  Files app, saves its own changes first, so they're seen and kept, and is
  told of Eien's save, so it reads the note again rather than save its old
  words over Eien's.
- **Case twins.** On a system that tells case apart (Linux, iOS), a new note,
  image or folder, a move and a rename never take a name another entry in
  its folder has in another case (`chapter.md` beside `Chapter.md`, or a
  folder `fic` beside `Fic`): macOS, Windows and Android's shared storage
  can't hold both, so Syncthing couldn't bring them there. A rename by case
  alone is the same entry, and allowed. Twins made elsewhere are left as they
  are, each saved under its own name.
- **External changes.** Eien watches the vault. What changes while the vault
  is first read, before the watcher listens (Syncthing catching up as a phone
  opens Eien), is caught by one more look once it listens, reading only what
  changed. When a note changes on disk:
  - If the open copy has no unsaved edits, the new text is loaded.
  - If both changed, Eien never overwrites the file. It saves the open text as
    a sibling, `Note (conflict 2026-10-19 16-40).md`, and shows one quiet
    notice. Both versions remain.
  - If only the bytes changed (another editor's line endings or byte-order
    mark, the same words), Eien takes the file's version and its format, and
    the next save keeps them.
  - After a reload, undo starts afresh: ⌘Z can't step back over the other
    device's words.
  - When a folder holding the open note changes (renamed or removed
    elsewhere), the note is checked again; a save never makes the old folder
    again.
  - Changes are told in bursts, 120 ms after the first, so a file written
    without pause can't hold the others' news back.
- **Syncthing conflicts.** Files named `*.sync-conflict-*` are shown beside
  their note with a mark, so the writer can compare and merge them.
- **Deleting** sends files to the system trash. If the trash fails, nothing is
  deleted and the writer is told.
- **Paths.** Every path from the window is resolved inside the vault (real
  path, no symlink escape). Names are checked for characters and reserved
  names that Windows, macOS or Android can't store (`CON`, `aux`, `COM0`, `:`,
  `?`, trailing dots and spaces, a broken character), and for collisions:
  names are compared case and accents aside, folded as macOS folds them
  (`Straße` is `STRASSE`). A name is kept exactly as written; on Linux and
  Android a composed and a decomposed `Café` are two files.
- **Settings files.** This device's file is written over only when it was
  read; one that can't be read just now refuses the change (and the app opens
  with the defaults). JSON files saved with a byte-order mark are read.

---

## 4. Interface

### Layout

Three panes, each collapsible, with a two-pane option in settings:

1. **Sidebar** — a collapsible tree:
   - **All Notes**, with a count
   - **Pinned**
   - **Folders**, nested; books marked
   - **Tags**, nested by `/`
   - At the foot: light/dark switch, sync status (not built yet:
     [backlog](backlog.md) #10), settings
2. **Note list** — the notes in the selected folder or tag: title, a line of
   preview, and the date or word count. Sortable by title, modified date or the
   folder's own order (drag to reorder). Hidden in two-pane mode, where the
   tree lists the notes itself.
3. **Page** — the editor, on a paper sheet. A small header shows the note's
   title and its word count. A status line below shows today's words, sprint,
   and zoom. Controls show on hover or keyboard focus (on a touch screen,
   which can't hover, they stay in sight).

Every pane can be resized and collapsed. Keyboard: ⌘1/⌘2/⌘3 focus a pane,
⌘\ toggles the sidebar, ⌘⇧\ the note list.

- **Resizing.** A pane's edge is a hairline that darkens under the pointer:
  drag it, or give it the keyboard and step it with ← and →. Each width has
  its limits: the sidebar 200–420 px (220–520 with two panes, where it holds
  the notes), the list 260–480. In a window too narrow for all three, the
  list and then the sidebar give way, down to their narrowest, so the page
  keeps 360 px; widening the window gives them back.
- **Collapsing.** The sidebar shuts to a strip holding the seal; the seal
  shuts and opens it. The page bar's SIDEBAR and LIST words, and the View
  menu, shut and open either. A pane shut with the keyboard in it gives the
  keyboard to the page. ⌘1–3 open a shut pane before giving it the keyboard.
- **Two panes** (Layout → Panes, or the pair at the sidebar's foot): the list
  is gone and the tree lists the notes, under the vault, each open folder (in
  the folder's own order and sort, a book's numbered), All Notes, Pinned and
  each tag. Choosing a row opens it, and shuts it when chosen again. The
  tree's notes have the list's menu, keys and drags. ⌘2 is the page.
- Whenever no list is in sight (two panes, or the list shut), a search's
  results take the tree's place, and the last action's news shows at the
  sidebar's foot; with the sidebar shut too, in the page's status line.
- The keyboard is never left on something hidden or gone: a shut pane gives
  it to the page (to the page itself when no note is open), a redraw gives it
  back to the control that had it, or to the row now in a removed row's place.
- Widths, and which panes are shut, are per device (§2); three or two panes
  is a device setting (§6).

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

Square brackets are a link only with an address or a defined reference, as
CommonMark has it: `[sic]` and `[...]` keep their brackets on the page. HTML at
the start of a line (AO3's `<p>…</p>`) looks as it does mid-line. Front matter
shows quietly, in the mono, never as a scene break.

Links: ⌘-click (Ctrl-click on Windows and Linux) follows one. A web address
opens in the browser; a `[[wiki link]]` opens the note with that title. In
Reading a plain click follows.

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

### Organizing

- **Rename** a note by its title on the page (click it, or F2 on its row; Enter
  keeps, Esc doesn't), a folder in place (F2, or its menu). Renaming changes
  the file's name, and the folder's order and the pins follow. A name another
  file has (case and accents aside) is refused, never numbered: the writer
  chose it. A change of case alone is allowed.
- **Move** a note by dragging it onto a folder (or the vault's name), or with
  Move to… in its menu. Where its name is taken it's numbered ("Ideas 2"), so
  nothing is replaced. The open note carries on at its new path. A folder
  moves the same way, never into itself.
- **Order:** in a folder's own order, drag a row between others, or Alt+↑/↓,
  or Move up/down in its menu. The order is `.eien-folder.json`'s; a folder
  never ordered gets no file. A note moved in goes last.
- **Sort** a list by its own order, title or newest; the choice is kept per
  list, on this device.
- **Books:** Make it a book / Not a book, in a folder's menu.
- **Pinned** notes are listed under Library, in the order pinned
  (`.eien/pinned.json`, watched like the settings).
- **The trash:** Move to the trash (⌘⌫ / Ctrl+Delete on a row, or the menu)
  sends a note or folder to the system's trash (the Recycle Bin on Windows),
  saving the open note first; the list says where it went. If the trash
  fails, nothing is deleted and the list says why.
- While the open note is moved or trashed, the page holds still (typing isn't
  taken) and its last words are saved first. If they can't be saved (the disk
  is full), nothing moves: the words stay on the page and the list says why.
  A note sent to the trash never saves again.
- A move never replaces anything: a file is given its new name with a link,
  which fails if something is there (even something that arrived a moment
  ago), and only then loses its old name. Folders, and disks without links,
  are looked at once more just before the rename.
- Names Eien makes stop at 245 bytes, leaving room for a save's temp file; a
  longer name made elsewhere saves through a shortened temp name that keeps
  its extension (a hash tells two cut alike apart), so a note's words a crash
  leaves there come back as a note.
- A folder's `.eien-folder.json` is watched, so an order from another device
  shows at once. Writing an order drops names that aren't there.
- Every menu opens from the keyboard too (Shift+F10 or the menu key), and a
  redraw never takes the keyboard's place in the list or the sidebar.

### Search and the index

The main process keeps an index of the vault: every note's preview (its
first words, marks taken out), its words and its tags, and its text for
search. It reads only what changed, by time and size and by what the watcher
names, sixteen files at a time; a note over 8 MB is listed but not read. A
write updates the index before it returns, so a new note is listed at once.

Search (⇧⌘F, or the field under the vault's name) finds the notes holding
every word of the query, in the title or the text, with case, accents (the
combining marks of Latin, Greek and Cyrillic, never another script's vowel
signs), curly quotes and full-width forms aside; "quoted words" are a phrase. Notes whose
title holds the words come first, then the most recently changed; the first
200 are listed, with the words around the match. Esc clears it.

Tags follow the same Markdown as the editor: a "#" in code, a link, an
address, HTML or after a "\\" is not a tag. A tag needs a letter; case aside,
#Draft is #draft (folded fully: #Straße is #STRASSE, #İstanbul is
#istanbul), and the sidebar shows the first spelling. Previews and snippets
are cut between whole characters: an emoji made of several is never split. A
paragraph of more than 64 lines is read in pieces of 64, as the parser takes
seconds over one long paragraph full of brackets. Tags count as
words, as on the page.

### Writing tools

- **Scene break:** Enter on an empty line after an empty line inserts `***`,
  shown as a centered `* * *` in Live and Reading, and starts a new paragraph
  after it. Not at the note's start, not right after another scene break, and
  never in code or the front matter. ⌘Z takes it back.
- **Quotes:** typed quotes follow the quote setting (curly or straight).
- **Focus mode:** dims every paragraph but the current one (the lines between
  blank lines round the caret). View → Focus Mode (⌘⇧↵, Ctrl+Shift+Enter), or
  Settings → Editor.
- **Typewriter scrolling:** keeps the caret line at the middle of the page as
  the writer types, deletes or moves with the keys; a click leaves the page
  where it is. View → Typewriter Scrolling, or Settings → Editor.
- Both are this device's settings; the View menu's checks follow them, wherever
  they're changed.
- **Counters:** words in the note (its words only: not the marks, link
  addresses, HTML tags or front matter), in the book, today; sprint timer with words
  gained; zoom. In the colophon, in that order, with the last seal:
  - **Today** is net (what's typed less what's cut, so it can fall below
    nothing), on this device, counted from the writer's own changes only: a
    note opened, reloaded from another device, sealed or restored is no one
    writing. It starts again at midnight and is kept across a restart.
  - **Book** shows when the open note is a chapter of a book: the book's words,
    the open chapter's counted live, and its goal ("Book 54,210 / 90,000"). A
    book's folder menu has **Word goal…**: a small field where Enter sets it
    and an empty field takes it away.
  - **Sprint:** View → Start Sprint (10, 15, 25, 30, 45 or 60 minutes) counts
    down with the words gained; View → Stop Sprint ends it. When the time is
    up the colophon says "Sprint done" and one line of news says how many
    words: no sound, no window. The words typed right up to the end are the
    sprint's. A sprint under way survives a restart; one found over for more
    than an hour is gone. A clock set back never gives it more time.
  - An undo or redo of Eien's own change (a restore) is no one writing either.
- **Zoom:** ⌘+ and ⌘− zoom the page in steps of 10%, ⌘0 returns to 100%. Zoom
  is per device and shown in the status line when it isn't 100%; the panes and
  the note list keep their size.
- **Text size:** a setting that scales the text face from its tuned size
  (90%–130%), separately from zoom.
- **Outline cards:** a book's notes as cards on a board; drag to reorder.
  View → Outline Cards (⌘⇧O) lays out, in the page's place, the book the open
  note is a chapter of (or, with none open there, the book chosen): index
  cards on the blotter in the book's order, each with its number, title, first
  lines and words, the open chapter marked. A card opens its chapter; dragging
  one, or Alt and an arrow, puts it elsewhere in the book (the folder's order,
  as the list's drag does; dropped on a folder in the sidebar, it moves there);
  the arrows move between cards; Esc, or the menu again, gives the page back,
  where the writer was in it. Opening another note, choosing a view or Compare
  gives it back too; the Format menu does nothing to a page the cards hide.
  The keyboard is always on a card or Close, and goes to the page with it.
  With no book to show, one line of news says so.
- **Spellcheck:** off until turned on, using the platform's own checker.
  That's macOS's: Settings → Editor → Spellcheck, or Edit → Check Spelling
  While Typing. A right-click on a word it underlines offers its suggestions
  and Learn Spelling, then Cut, Copy and Paste. Windows and Linux don't offer
  it: Electron has no checker of their own there and would download
  dictionaries from Google, so the checker is off for good (decided
  2026-10-20; bundled dictionaries may come later).

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
  vault/        ✓ entries, the folder tree, .eien-folder.json (order, book), pins
  saving/       ✓ what to do when a note changes on disk
  format/       ✓ the formatting commands: inline marks, line formats, links, their keys
  config/       ✓ the settings schema, defaults, reading and writing settings files (§6)
  counters/     ✓ today's tally (net, per day) and a sprint's clock
  theme/         theme schema, validation, token list (§7)
  markdown/     ✓ Eien's Markdown (==highlight==, [[wiki links]], footnotes) and a note's plain text
  note/         ✓ a note's preview, words, tags and id
  tags/         ✓ tag extraction and the tag tree
  search/       ✓ folding (case, accents, quotes), query terms, snippets
  typography/   ✓ quotation marks: curled by what's around them, an apostrophe once it shows, and back
  versions/     ✓ the note's id in its front matter, seal file names, retention, word diff
  ao3/          ✓ Markdown → AO3 HTML (and a book's HTML); HTML (AO3's, Google Docs', Word's, a page's) → Markdown
  export/       ✓ a note as a chapter (headings, footnotes); EPUB, Word and the PDF's page; a store-only zip
  import/       ✓ which files of a folder from elsewhere come in, under what names, and why the rest don't
src/platform/
  bridge.ts     ✓ what the window may ask of the system (window.eien)
  storage.ts    ✓ the Storage interface: read, write, list, watch
  electron/     ✓ Storage over Node fs: durable writes, the watcher, crash recovery
  memory/       ✓ Storage in memory, for tests
  index/        ✓ the vault's index over any Storage: previews, words, tags, search
  capacitor/    ✓ Storage over the phone's file system: writes through a temp file (on iOS coordinated with other apps), case-only renames in two steps, trash in .eien/trash, polling for changes, recovery after a crash
  case-twin.ts  ✓ no storage makes a name its folder has in another case
src/ui/
  app.ts        ✓ the window: panes, vault and note kept in step
  shell/        ✓ the panes: resizing, collapsing, three or two, kept per device
  sidebar/      ✓ the seal, the search field; library (all, pinned), folders, tags; with two panes the notes; folders renamed in place
  list/         ✓ note list: previews, a book's words, search results, sorts, dragging
  page/         ✓ the sheet, the title (renaming the note), the view switch, the colophon
  menu/         ✓ the small floating menu: right-click choices, sorts
  notes/        ✓ the open note: autosave, reload, conflict copies
  vault/        ✓ the vault as the window knows it, its panes drawn, the menu's commands, organizing (rename, move, trash)
  welcome/      ✓ before a vault is open
  theme/        ✓ tokens.css (the eight faces, density, frame), the Otaku palette, base.css, fonts
  editor/       ✓ CodeMirror, the three views, the selection bar, images, typed quotes, pasted HTML, the writing tools (scene breaks, focus, typewriter)
  versions/     ✓ sealing, Compare, the versions panel, the colophon's last seal
  outline/      ✓ outline cards: a book's chapters as cards on the blotter, reordered by drag or keys
  counters/     ✓ the colophon's today, book and sprint
  settings/     ✓ the settings screen, drawn from the schema; the look they set on <html>
  phone/        ✓ the phone's layout: one pane at a time, back, the page's ⋯
src/app/
  electron/     ✓ main process, preload, window, menus, the vault and settings sessions, saving and printing exports, importing a folder
  mobile/       ✓ the phone's preload (window.eien over Capacitor), the vault's place and Android's access, the back gesture
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
- Notes are never put on the page as HTML. Live and Reading style the text in
  place; only the tags in §4 get their look, and any other HTML stays as text.
- Images come only from the vault, read through the bridge and shown as `blob:`
  URLs; an image from the web shows as a note and is never fetched.
- Pasted HTML (phase 8) goes through a sanitizer; scripts, event handlers and
  remote content never run.

### Stack

| Need | Choice | Why |
|---|---|---|
| Desktop | Electron | One web UI on all three desktops |
| Mobile | Capacitor | The same UI on Android and iOS |
| Language | TypeScript, strict | Catches mistakes before they run |
| Build | Vite | Fast, small configuration |
| Editor | CodeMirror 6 | Proven Markdown editing, live preview through decorations |
| Rendering | The editor's own parse (Lezer) | Live and Reading style the text in place, so there is no second parser to disagree with the editor. AO3's HTML is phase 8 |
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
  description: 'As you type them, and in what Copy for AO3 gives. Code keeps its own.',
  scope: 'vault',              // 'vault' travels with the notes; 'device' stays on this device
  type: 'choice',
  choices: { curly: 'Curly “ ”', straight: 'Straight " "' },
  default: 'curly',
}
```

The settings screen, defaults, validation and storage all come from that one
list. Adding a setting means adding one entry. A setting joins the list in the
phase that builds what it changes, so the screen never offers a switch that
does nothing.

- **Vault settings** live in `.eien/config.json`: chapter numbers (i ii iii or
  1 2 3); later quotes, AO3 options, scene break style. The vault's watcher
  reports this one hidden file, so a change from another device shows at once.
- **Device settings** live in `settings.json`, never in a vault: in
  `Documents/Eien` for an installed copy, in a portable copy's "Eien Data" beside
  it (`src/app/electron/data-folders.ts`). They hold the scheme
  (day, night or the system's), palette, text face, text size (90–130%),
  density (comfortable or compact), page frame (sheet or full) and zoom
  (50–200%), panes (three or two), focus mode, typewriter scrolling and
  spellcheck (macOS). A setting may be one system's alone (`platforms` in the
  schema): the screen shows it only there.
- An unknown or invalid value in a file is ignored with a warning in the log,
  and the default is used. A bad config never stops the app from opening.
- Writing a file changes one key and keeps every other key as it is, even ones
  this version doesn't know, so an older Eien on another device never drops a
  newer one's settings. A default is left out rather than written.
- A vault file that isn't valid JSON is never written over: the setting isn't
  saved, and the settings screen says why.
- The main process checks every change against the schema. Day or night is
  set there (`nativeTheme`) before the window first draws, and as
  `data-theme` on the page; the other settings are data attributes and custom
  properties on `<html>` that the tokens follow.
- Zoom (⌘+, ⌘−, ⌘0, and the View menu) scales the sheet only, with its
  margins and line; the panes keep their size. Text size scales the text
  face everywhere.

Settings are grouped and labeled on the settings screen: **Appearance**,
**Editor**, **Writing**, **Layout**, **AO3**, **Sync**.

---

## 7. Themes

- All colors, fonts and sizes are CSS custom properties named `--eien-*`,
  defined once in `src/ui/theme/tokens.css`. The list of names is the theme
  contract, documented in `docs/design/README.md`. A rename is a breaking
  change.
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
  (Not built yet: [backlog](backlog.md) #20. Washi and Otaku are built in.)
- All fonts are bundled. Nothing is fetched from the web.

---

## 8. What leaves the app, and what comes in

### AO3

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

Quotes are converted to the quote setting on the way out. Lists, links (to
web, mail and relative addresses only), images, code and tables go as AO3
takes them; a highlight and a wiki link go as their words. The front matter is
never posted.

Edit → Copy for AO3 (⇧⌘C, Ctrl+Shift+C) copies what's chosen, or the whole
note, as text (for AO3's HTML box) and as HTML (for its rich text box). File →
Export AO3 HTML… saves the whole note through the system's save dialog, under
the note's name. An empty note copies nothing and says so.

**Paste from AO3** (or any HTML) turns it into Markdown:

- `<p>` → paragraphs; empty `<p><br /></p>` spacers are dropped.
- A spacer, `<hr>`, spacer group → one `***`.
- `<em>`/`<i>`, `<strong>`/`<b>`, `<s>`/`<del>`/`<strike>`, `<u>`, `<br>`,
  `<blockquote>`, headings → their Markdown forms.
- Entities are decoded (`&nbsp;`, `&amp;`, `&#8212;`).
- Other tags keep their text and drop the tag.
- **Plain text that is really HTML** — text with literal `<p>` tags, as copied
  from some notes apps — is detected and converted the same way.
- Styles count as their tags: Google Docs marks words with
  `font-weight`, `font-style`, `text-decoration` and `vertical-align`, and
  wraps the whole paste in `<b style="font-weight:normal">`, which is no bold.
  A link's underline is the link's. An inline element round blocks goes inside
  each block, so paragraphs stay paragraphs.
- What would read as Markdown in the words is escaped, so the note shows what
  the page showed.
- A code editor's copy (all of it in one `<pre>`, or one block set in a
  fixed-width face or `white-space: pre`) pastes as its plain text, and so
  does anything pasted into code.

**Typing:** with curly quotes, a quote opens at a line's start and after a
space, bracket, dash or slash (emphasis marks and an opening tag before it
don't count) and closes elsewhere; in a word it's an apostrophe. An opening
single quote becomes an apostrophe once what's typed after it shows it is one:
a year (`'90s`) or an elision (`'tis`, `'em`, `'cause`, `rock 'n' roll`). In
code (or code being typed), an address, an HTML tag and the front matter,
quotes stay as typed.

A round trip, Markdown → AO3 → Markdown, gives back the same text. Tests prove
it, including on real AO3 output.

### Exports: EPUB, Word, PDF

- **What:** File → Export Note ▸ EPUB…, Word (.docx)…, PDF… exports the open note.
  File → Export Book ▸ the same three exports the book the open note is a
  chapter of, or, with none open there, the book chosen in the sidebar (as
  Outline Cards finds it); with no book, one line of news says so. A note's
  menu has Export… (AO3 HTML, EPUB, Word, PDF) for that note, open or not, and
  a book's folder menu has Export… (EPUB, Word, PDF).
- **Where:** saved where the writer chooses, through the system's save
  dialog, offering the note's or the book's name, as Export AO3 HTML is. A
  note with no words, or a book with no chapters, exports nothing and says so.
- **A book** is its folder's notes in the book's order (§2), each a chapter;
  notes in its subfolders and Syncthing's conflict copies aren't chapters.
  The book's title is the folder's name. The open note goes as it is on the
  page, words not yet saved included.
- **A chapter's heading** is its note's title, unless the note begins with a
  top-level heading (`# The Scarf`): then that heading is the chapter's, and
  isn't shown twice. Each chapter starts a new page.
- **The Markdown** converts as Copy for AO3 converts it (the table above,
  quotes as the vault's setting, front matter left out, a note's own HTML as
  AO3 takes it), with these differences, the same in all three formats:
  - `==highlight==` is highlighted (`<mark>`; Word's yellow highlight).
  - A scene break (`***`) is a centred `* * *`; the paragraph after it, or
    after a heading, isn't indented.
  - Links go to the web and mail only; a link to anything else (another note,
    a file) is its words, and a `[[wiki link]]` is its words (after a `|`,
    its alias, as Copy for AO3 has it).
  - **Images** from the vault go in: `![A red scarf](attachments/scarf.png)`,
    by a path from the note's folder or from the vault's top
    (`/attachments/scarf.png`), as the page finds it. PNG, JPEG and GIF, each
    up to 32 MB and 48 MB in all for one export, carried as the file has them
    (never redrawn), each file once however often it's shown; at most as wide
    as the room it's in (in Word, sized to fit the page, a quote's indents, a
    list's, a table's cell). An image in a footnote goes too. An image from
    the web is never fetched. One the page doesn't show (a hidden name, a name
    with no image's extension), one that isn't there, of another kind (WebP,
    SVG…) or past those sizes is its description, and one line of news after
    the export says how many were left out so. A footnote's mark in an
    image's description goes just after the image; a link round an image with
    no description is left off, the image kept.
  - A numbered list keeps its first number (`1994.` stays 1994).
  - A character reference is the character, whichever of HTML 4's names it
    uses (`&eacute;`, `&euro;`); one that names nothing (`R&D;`) is its words.
  - A paragraph of more than 64 lines (no blank line in it) goes as
    paragraphs of 64, as the index reads it (§4): the parser takes seconds
    over one.
- **Footnotes,** as GitHub and Obsidian write them: `[^1]` in the text, and
  `[^1]: The note.` at a line's start, its later lines indented four spaces
  (or a lazy line carrying on its first paragraph). Labels are matched case
  aside; a label's first definition counts, a later one stays as words. A
  chapter's notes are numbered in the order they're first referred to; a note
  never referred to comes last, and a `[^x]` with no note is shown as written.
  In code, a link's address, an HTML tag or a wiki link, `[^1]` is just text;
  a mark in a link's words goes just after the link. A note's first line is
  words, as the page shows it after `[^1]: ` (never a heading, a list or code
  of its own). A note nothing leads to (no mark in the text, nor in a note
  the text leads to) is shown in the text's flow, not hidden as a pop-up.
- **EPUB 3:** a title page (a book's), a contents page, one file per chapter
  with its notes at its end, as pop-up notes where the reader has them (Apple
  Books, Kobo), and an EPUB 2 contents file for older readers. Its identifier
  is made from the vault's and the book's names, so a book exported again is
  the same book to a reader. Its language is the system's. The styles are few,
  so the reader's own font and size win.
- **Word (.docx):** the book's title on its own page, each chapter from a new
  page under Heading 1, the note's headings, quotes and lists in Word's own
  styles (so Word's navigation and contents see them), footnotes as Word's
  own (each mark its own footnote), the page number at the foot (none on the
  title page). 12-point Times New Roman, the first line of each paragraph
  indented. For Word, Pages, LibreOffice and Google Docs.
- **Paper and language:** the window's language, as the system sets it
  (`en-US`), is the EPUB's language, and its region the paper for Word and
  the PDF: Letter where that region uses it (the US, Canada, Mexico, the
  Philippines and the rest of Unicode's list), A4 elsewhere and with none.
- **PDF:** Electron's own Chromium prints it, on that paper; the system's serif; each chapter from a new page,
  its notes at its end; the page number at the foot; the headings as the
  PDF's bookmarks. It's printed in a hidden window that runs no script and
  loads nothing from anywhere.
- EPUB and Word are zip archives. Eien writes them itself, stored without
  compression (all EPUB needs, and a book's words are small), rather than
  carry a package for it.

### Import a folder of Markdown

File → Import Markdown Folder… copies a folder of notes from elsewhere (an
Obsidian vault, iA Writer's library, a plain folder) into the vault.

- The writer chooses the folder with the system's dialog. Eien copies it into
  a new folder at the vault's top, named for it ("Drafts", or "Drafts 2" when
  that's taken). The original is never moved or changed, and nothing in the
  vault is ever written over: each note is written only where nothing is.
- A note is a `.md`, `.markdown`, `.mdown`, `.mkd` or `.txt` file. It comes in
  as `.md`, its text exactly as it was (front matter, line endings, a
  byte-order mark). Its folders come with it; a folder with no notes or
  images doesn't.
- **Images** (PNG, JPEG, GIF, WebP, AVIF and SVG: what a note shows) come in
  too, byte for byte, in the same folders and under the same names, so a
  note's `![…](scarf.png)` still finds them; each up to 32 MB, the most a
  note shows. An image is written only where nothing is, as a note is.
- Two names one system would take for one file (`Notes.md` and `notes.md`,
  or `Notes.md` and `Notes.txt`) keep the first and number the second
  (`notes 2.md`, `Notes 2.md`), as a move numbers them (§4); folders too.
  A note that arrives at a name while the import runs (Syncthing) is kept,
  and the imported one is numbered.
- Left out, and said so: a note over 8 MB (the most the index reads); an
  image over 32 MB; a note that isn't UTF-8 text; a file that can't be read;
  a name that can't exist on every system (§3); a link, which is never
  followed; and every file that's neither a note nor an image (PDFs,
  documents, which stay where they are). Hidden files and folders
  (`.obsidian`, `.git`, `.DS_Store`) are left out without a word. At most
  10,000 notes, and 10,000 images, come in at once; the rest are said to be
  left. One import
  looks at 100,000 files and into folders 64 deep: where it stops, it says
  so.
- A link is never followed, even one put in a file's or a folder's place
  while the import runs: each note is read only if neither it nor a folder
  on its way is a link.
- A folder that is the vault, is inside it, or holds it is refused, however
  its path is spelled (macOS's `/System/Volumes/Data/…`, a bind mount): the
  folders are compared as the disk has them.
- The new folder's name is chosen against the vault's top as the disk has it
  at that moment.
- Afterwards the sidebar shows the new folder, and one line of news says how
  many notes and images came in. When anything was left out, a dialog lists what and
  why (the first 30, and how many more).

### On the phone

The phone has no menu bar: a note's menu and a book's offer the exports (a
long press), and so does the page's ⋯ for the note open. EPUB, Word (with
their images) and AO3 HTML go to `Eien/Exports` beside the vault's folder (Documents on Android;
Eien's folder in the Files app on iOS), under a free name, never over a file
there. PDF isn't offered: the WebView can't print to
a file without a plugin of Eien's own, which may come later. Import isn't
offered either: a folder copied into Documents/Eien/Vault (by the Files app
or Syncthing) is in the vault already.

---

## 9. Versions

The interface calls a checkpoint a **seal**, and a named version a **named
seal** (docs/design).

### Checkpoints

- ⌘S (File → Seal, the page's SEAL) makes a checkpoint of the open note: a
  copy in `.eien/versions/<id>/<UTC time>.md`, the time to the second
  (`2026-10-19T16-40-02Z.md`); a second one in the same second is
  `2026-10-19T16-40-02Z~2.md`. Nothing is made if the note matches its last
  checkpoint ("Nothing new to seal"); a checkpoint dated ahead (another
  device's clock) isn't taken as the last. The note is saved as it's sealed,
  a note that can't be saved isn't sealed, and a seal pressed while the note
  is being renamed or moved waits for that, then seals. What can't be done is
  said, never dropped.
- Autosave keeps writing the note itself. A checkpoint is what "saved" means.
  The colophon says when: "Sealed 2h ago", or "Not sealed yet".
- **The id.** A note's first seal gives it an `id` (ten letters and digits,
  the first a letter, so YAML reads it as text), added as the first key of its
  front matter by one line: every other key, comment and space stays byte for
  byte, and the caret, the undo history and anything typed meanwhile stay.
  Front matter that isn't a map of keys, or an `id` another tool wrote that
  can't name a folder, is never rewritten: the note isn't sealed, and the
  writer is told why (an empty `id:` is filled in). A note that shares its
  id with another (a copied file; Syncthing's conflict copies aren't
  counted) is given a new one on its next seal, and takes the seals so far
  with it, so neither loses its history.
- Front matter holding only that `id` is Eien's bookkeeping: Live and Reading
  keep it out of sight (Source shows it), the caret never rests in it, and the
  writer's edits never reach into it (typing after a closing `---` that ends
  the note starts a new line).
- Another device's seal (synced into `.eien/versions/`) shows at once.

### The compare button

One button (and ⌘⇧D) cycles through three states:

1. **Changes** — the draft compared with the last checkpoint, word by word:
   removed words struck through in red, added words underlined in green, and
   how many of each. A new sentence before one that starts the same shows as
   a sentence added whole.
2. **Checkpoint** — the checkpoint alone, read-only.
3. **Draft** — back to editing.

The diff and the checkpoint view are read-only. Typing in them returns to the
draft first, the key typed there (in Reading, only the draft comes back).
Words are found as the word count finds them, in scripts with spaces or
without, and compared in the note's text (its marks and front matter aside),
within a bound: a rewrite too large to compare word by word is compared by
lines. A sentence added is shown whole, its stop and all. Nothing a slow
Compare or Restore finishes lands on a note opened meanwhile.

### Named versions ("savegames")

- Any checkpoint can be named: `2026-10-19T17-02-11Z--before the rewrite.md`.
- The versions panel (VERSIONS) lists the draft and a note's versions, newest
  first, with their words: compare any of them with the draft, restore one,
  name it in place, or delete it.
- **Restoring** first checkpoints the current draft, so restoring is undoable
  (⌘Z too); words typed while it works are checkpointed before they're
  replaced. The note keeps its own id.
- **Retention:** named versions are kept until deleted. Unnamed checkpoints
  older than 30 days are thinned to one per day (the day's last, in the
  writer's own time zone), and the latest is always kept. Thinning happens
  after a seal, and what it thins goes to the system trash. Deleting a
  version sends it to the trash.

---

## 10. Mobile and sync

- Android and iOS run the same `ui` and `core` with the Capacitor `Storage`.
- **One folder, `Documents/Eien`, on every device:** the vault in `Vault`
  (the folder Syncthing syncs), exports in `Exports`, and on a computer this
  device's settings file beside them, never synced. Every device starts in
  `Documents/Eien/Vault`, made if need be; the phone has no other. A computer
  opens the vault last opened instead, once the writer has chosen one with
  Open Vault (which starts in `Documents/Eien`); when that one can't be opened
  (a drive that isn't connected), it says so and asks, rather than show an
  empty vault in its place. A portable copy starts in `Vault` beside itself.
- **Android:** the vault is `Documents/Eien/Vault` in shared storage, synced
  by the Syncthing app. Its writes and renames are Eien's own (a small plugin): a
  write is flushed to the disk, a save's rename replaces the note in one step,
  and a move, the trash and recovery never rename over a file that's there,
  even one Syncthing brought a moment ago. Eien asks once for the file access it needs (All files
  access, from Android 11), after the welcome says why. Eien has no internet
  permission. Trash goes to `.eien/trash` in the vault, so any device can take
  it back; exports go to `Documents/Eien/Exports`. Eien saves when the phone
  sends it to the background, and looks at the vault again when it comes back
  (and every few seconds while it's in front: a phone has no file watcher).
- **iOS:** the vault is `Vault` in the app's own Documents, which the Files
  app shows as "Eien" ("On My iPhone › Eien › Vault"), with `Exports` beside
  it; no access to ask for. Its writes and renames are Eien's own, as on
  Android (a Swift plugin: flushed to the disk, renames in one step, never
  over a file that's there), and a save's last step is coordinated with apps
  editing the note in place (§3). Syncthing on iOS (Möbius Sync) can sync the
  folder. CI builds the app and runs it on a simulator, with no Apple account;
  installing it on a device needs Xcode and an Apple ID.
- **The phone layout** is one pane at a time: tree → list → page. A window
  narrower than 600 px (narrower than any desktop window can be) is a
  phone's, whatever the system; turned sideways, a phone wide enough shows
  the three panes.
  - It opens on the notes. Choosing a folder or tag shows its notes; opening
    a note shows the page. A bar above the pane goes back, naming where
    ("‹ Fic", "‹ Library"); leaving the page closes what lay over it.
    Android's back gesture first closes a menu or the settings, then does
    what Esc does where the keyboard is (a rename being typed stops, keeping
    nothing), then closes what lies over the page (Compare gives the draft
    back, the outline cards, the versions), then goes back a pane; at the
    tree it leaves Eien in the background.
  - The page's ⋯ offers what the menu bar does on the desktop: Seal,
    Compare, Versions, Outline cards, Copy for AO3, Export… (the note's own
    choices), Focus mode, Typewriter scrolling, a sprint (Stop while one is
    under way), Settings. The page's bar keeps its
    three views.
  - On a touch screen, the page gives its title the keyboard rather than the
    editor (opening a note to read, closing what lay over it), so the
    phone's keyboard stays down; when the title is the note's own heading,
    the keyboard leaves. A new note goes straight into the editor.
  - Turned sideways or upright, the keyboard on something gone from sight
    goes to the pane in sight, or to the page.
  - A finger scrolls a list, and never lifts a row: a note moves by its menu
    (a long press: Move up, Move down, Move to…), an outline card by its own
    (Move earlier, Move later). Two panes aren't offered, here or in the
    settings: one shows at a time. The tree's seal goes on to the notes.
  - Controls that wait for the pointer on the desktop stay in sight on a
    touch screen, which has no hover.

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
- **Exports:** footnotes, headings and the book's differences from AO3; over
  generated notes, every EPUB part and every Word part is well-formed XML with
  its prefixes declared, and every word of the note is in each; the zip read
  back by a strict reader and by `unzip`.
- **Import:** names kept, numbered or refused; sizes, kinds and limits.
- **Versions:** naming, sorting, retention at day and month boundaries, time
  zones, names with forbidden characters.
- **Settings and themes:** every invalid value falls back; unknown tokens and
  CSS injection attempts are rejected.

### Storage contract

One test suite runs against every `Storage` implementation (memory, Electron's
Node fs), so they behave the same:

- durable write; a crash between write and rename; a leftover `.tmp`
- a new file's bytes (an imported image) written only where nothing is,
  even something that arrived a moment before
- a file changed on disk while open; deleted while open; renamed while open
- a read-only file; a full disk (simulated); a permission error

### End-to-end (Playwright, the real Electron app)

On macOS, Windows and Linux, each with a fresh temporary vault:

- create, type, quit, relaunch: the text is on disk and back on screen
- another program edits the open note: it reloads, or a conflict copy appears
- checkpoint, edit, cycle the compare button through all three states
- paste the AO3 sample; Copy for AO3 matches the expected HTML
- export a book and a note as EPUB, Word and PDF through the menus, read back
  from the files saved; import a folder, and the notes appear beside the
  vault's own, nothing written over
- switch theme, quotes and pane layout; settings survive a restart
- drag notes to reorder; the order survives a restart
- a vault with 5,000 notes opens and searches within set time limits: listed
  within 15 s of launch, a search answered within 2 s, a typed change in the
  index within 5 s (on a 2024 Mac: 2.3 s, 0.4 s and 2.8 s)

### The phone

- **In Chromium** (`npm run test:mobile`): the phone's page, with
  Capacitor's web stand-ins for its plugins (the Filesystem in IndexedDB).
  The bridge, the storage over the Filesystem's calls, recovery, settings,
  trash and exports run as on the phone.
- **On Android** (`npm run test:android`, by hand: it needs an emulator or a
  phone over adb): Playwright drives Eien's WebView while adb plays Syncthing
  and the system. The access asked for and refused; a note synced in; saving
  when the app goes to the background; a restart; a crash's leftovers; a
  case-only rename on the shared storage, which ignores case; the back
  gesture; a long press.
- **On iOS** (CI, or `npm run test:ios` on a Mac with Xcode): the Swift file
  operations tested with swiftc alone (`npm run test:ios-files`), a save
  coordinated with another app's open note among them, then the
  app built for an iPhone simulator, started with a crash's leftovers in its
  vault, and held to recovering them: the bridge, the storage and the Swift
  plugin together. The screen is kept.

### CI (GitHub Actions)

On every push and pull request:

1. Biome (lint and format) and TypeScript type check
2. Unit and storage tests, with coverage reported
3. End-to-end tests on macOS, Windows and Linux
4. The phone's page in Chromium
5. Android debug build, kept for 14 days to install on a phone
6. iOS: the Swift file operations, and the app on a simulator

On a version tag: the installers (a universal `.dmg`, a Windows setup, a
Linux AppImage), each built on its own system, installed and started there
(`tests/packaged`), then attached to a draft release. A pull request
can't merge while any check fails.

Weekly, and never a check a change waits on: mutation testing of `core`
and `platform` (Stryker), and the property tests with new inputs.

---

## 12. Phases

Each phase ends with something you can try, and its tests in CI. All eleven
are built (2026-10-20); what comes next is in the [backlog](backlog.md).

| # | Phase | Result |
|---|---|---|
| 1 | Spec | This document, approved |
| 2 | Scaffold and CI | The app opens an empty window on all three desktops; CI runs lint, types, unit and e2e. GitHub setup walkthrough |
| 3 | Vault and saving | Open a folder; tree, list and page; autosave; external changes and conflicts |
| 4 | Editor | Live, Source and Reading views; all Markdown in §4; formatting keys, the Format menu and the selection bar |
| 5 | Design system | Tokens from `docs/design`; palettes and schemes; the eight text faces; text size, density, page frame and zoom; the settings screen |
| 6 | Organizing | Tags, nesting, search, drag-and-drop order, books, pins, rename, move, trash; then resizing and collapsing the panes, and two-pane mode |
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

1. ~~AO3 scene break: keep AO3's spacer, `<hr>`, spacer pattern as the
   default?~~ Yes: `<p><br /></p><hr /><p><br /></p>`, so the sections
   breathe (2026-10-20).
2. ~~Default sort for the note list: modified date, or title?~~ Neither: your
   own order, with the sorts laid over it like a filter ([backlog](backlog.md)
   #12, 2026-10-20).
3. ~~Today's word count: words added only, or net (added minus deleted)?~~
   Net, as the design shows it ("Today +809").
