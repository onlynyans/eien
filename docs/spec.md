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
    pinned.json                the pinned notes, in the order pinned (see §4)
    order.json                 All Notes in your order: a list of paths (see §4)
    tags.json                  tags made before any note carries them (see Tags)
    themes/<name>.json         the writer's own themes, one file each (see §7)
    versions/<note id>/        checkpoints and named versions (see §9)
      2026-10-19T16-40-02Z.md
      2026-10-19T17-02-11Z--before the rewrite.md
  Fic/
    A Mended Scarf/
      .eien-folder.json        this folder's order, and whether it's a book
      Mending.md
      Fire.md
      Fire.assets/             Fire's own images, dropped or pasted into it
  Ideas.md
```

### Formats

Eien's own files are JSON, and none carries a format version yet: not
`config.json`, `pinned.json`, `tags.json`, a theme in `themes/`, nor a folder's
`.eien-folder.json`. Each is read leniently instead (keys it doesn't know are
kept, values it can't use are ignored), so an older Eien and a newer
one on two synced devices read each other's files.

- **A new file starts with `"version": 1`**, beside its other keys: the
  EPUB reader's reading state (backlog #40, Phase 1) is the first.
- An existing file takes a `"version"` only when its shape changes in a way
  an older Eien would misread; a file without one is the shape this spec
  describes. A bare list (`pinned.json`) becomes an object to carry it.
- A file whose version is newer than this Eien knows is read for what it can,
  and never written over: a newer device's settings are never lost to an
  older one.
- A change an older Eien would misread is a breaking change: its pull
  request's title carries `!` (AGENTS.md → Releases).

### Notes

- A note is any `.md` file in the vault, outside `.eien/`. Other files are
  shown only as attachments.
- **A note's images** live in a folder beside it named for it: `Fire.md` →
  `Fire.assets/` (`core/vault/assets.ts`). An image dropped on the page or
  pasted into it (PNG, JPEG, GIF, WebP, AVIF or SVG, up to 32 MB) is copied
  there under its own name, or numbered where that's taken (`scarf 2.png`),
  never over what's there; a pasted one with no name is `image.png`. The
  note links to it relative to itself, encoded as a Markdown link must be:
  `![](Fire.assets/scarf.png)`, at the drop point or the caret. The folder
  is the note's: the sidebar never shows it as a folder (nor what's in it)
  while the note is beside it, and renaming, moving or trashing the note
  renames, moves or trashes it too, the note's links to it following. Where
  it can't follow (its new name is taken), it stays, and the list says where
  the images are. A paste that carries words as well as a picture (a word
  processor's) pastes the words. On a phone, images come by paste alone.
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

  - `order` is your order, by name: the folder's own folders first, then its
    notes (`["Wall", "Scarf", "Mending.md", "Fire.md"]`). Names not listed sort
    after, alphabetically. Names listed but missing are ignored and dropped on
    the next write. Reordering never renames files. The vault's own
    `.eien-folder.json` (at its top) holds the top folders' order, so every
    folder's children are ordered the same way; the design's separate
    `.eien/order.json` was folded into these files.
  - `book` marks the folder as a book (ordered reading, word goal, exports).
- The file travels with its folder when the folder is moved or synced.

### Tags

- In front matter (`tags:`), or inline as `#tag` in the text.
- Nested with a slash: `#fic/aot` appears under `fic` in the tree.
- A tag can be made before any note carries it, with the + beside TAGS in the
  sidebar. Tags are found in notes, so such a tag is kept in
  `.eien/tags.json` (`{ "made": [...] }`, watched, so another device's shows at
  once). It's listed faded, in italic, with a line saying how to give it
  notes, and its menu takes it back out. A tag notes carry has no menu yet:
  renaming one everywhere is still to be designed.
- Not tags: `#` inside code, links, URLs, headings (`# Title`), or followed by
  digits only (`#1`).
- **On the page** (§4): a note's tags show in the place its layout gives them,
  and can be added and taken off there. The page writes only front matter's
  `tags:`, in the shape the writer wrote it (a `[list]`, a `- list`, or
  words), every other key, comment and line byte for byte; a note with no
  front matter gets `tags: [tag]` in new front matter. It never edits the
  text: a `#tag` typed in the words stays where the writer put it, and shows
  with a dot and no ×. Front matter it can't change without rewriting it
  (broken YAML, `tags:` twice, a block scalar) is left alone, and Eien says
  so (`core/tags/front-tags.ts`).

### Per-device state

Cursor positions, open notes, pane widths, which of the sidebar's sections are
folded and which of Shelf's folders are shut (by their paths in the vault,
shared by the vaults this device opens, and followed through a rename, a
move or the trash done in Eien), zoom and today's word tally are kept in the
app's own storage on each device. They are never written into the vault,
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
  - **The same note in two windows** (New Window) follows the same rules:
    each window saves through its own session, checked against the file's
    version. The other window reloads what one saved; if both had edited,
    the later save goes to a sibling copy. No words are lost. One window
    showing a note twice (the split) is one document, and saves once.
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

### Windows

Eien can have several windows (File → New Window, ⇧⌘N; a note's menu,
Open in New Window). Each has its own vault, note, panes and split; a new
one opens on the vault and note of the window it was asked from, a step down
and across from it. A window is named for its note, or its vault with none
open, so the system lists it by that (macOS's Window menu, the taskbar).
Close Window (⌘W) saves, then closes it. Two windows on one vault share its
folder: it's read and watched once, and a change one window makes isn't
taken for a sync in the other. A setting changed in one window holds in all
of them. A phone has one window. While the window is split, Close Window
closes the active page instead (see Split).

### Split

Two notes side by side in one window, never top and bottom, laid out as a
device setting says (`appearance.split`, Settings → Look → Appearance):

- **Two sheets** (the default): two papers on one blotter, with one set of
  the layout's tools, one formatting bar and one colophon, all for the
  active page.
- **Facing pages**: one sheet opened like a book, the gutter between its
  pages the divider. The book's tools stay where the layout puts them (with
  Swap the pages among them); each note's own (Compare, Seal, Versions, Copy
  as HTML and its ×) are in its folio at its page's foot, beside its words,
  save and last seal, mirrored on the right page as page numbers are, and
  showing while the pointer is over that page. The colophon keeps the
  book's figures and today's. In the Running head, the tags go to each
  page's own head. The active page carries a mark, a setting of its own
  (`appearance.facingMark`): a ribbon over its top edge, its outer corner
  turned down, or a tab at its outer edge, each arriving with a short motion
  (none with reduced motion).
- **Companion**: the page as it always is, every one of its tools acting on
  it (the formatting bar on whichever words the caret is in); the second
  note a companion at the window's right edge, 380px (at least 300, the page
  beside it at least 400), its words at row size. It has its own head (its
  name; Make it the page, ⇄; its ⋯ with its views, Seal, Versions, Compare,
  Copy as HTML and Open in New Window; its ×) and foot (its words, save and
  last seal); the colophon stays the page's. The one you aren't writing in
  sits back a step, its paper the band's tone. With less than 700px of page
  pane, the companion goes under the page, the divider lying across.
- **Tools that follow**: the note list steps aside while split (never saved
  as shut; Toggle Note List, ⇧⌘\, or its chevron brings it back), the tree
  listing the notes as with two panes, and the two pages take its room. One
  set of the page's furniture, A's band or B's slip, the formatting bar and
  the colophon, stands over the page you're in, placed there by the pane's
  grid and never moved, so the keyboard stays where it is; moving to the
  other page, it fades in there (no motion with reduced motion). The
  Running head's tools stay in it. The other page is paper on the blotter,
  its × on hover. A split asked for without room for two 360px pages beside
  the sidebar is refused, and Eien says why; a split window narrowed past
  it shows the page you're in, and the colophon says the other waits.

What follows holds for all four.

- **Opening:** a row's Ctrl-click (⌘ on a Mac) or Ctrl+Enter; Open to the
  Side in its menu; a row dragged onto the page pane (past 60% of a lone
  page, beside it; onto a page, that page); View → Split Page (⌘D), the note
  beside itself. Split already, the note opens on the other page.
- **The active page** is the one the writer is in (a click, the keyboard),
  or View → Go to Page (⌘3) pressed in a page: the other one. The commands,
  the formatting bar, Copy as HTML, Seal, Compare, Versions and outline
  cards act on it. Its sheet lies on top with the sheet's shadow; the other
  lies flat (with Page frame Full, a 2px rule tops the active page). The
  list's chosen row is its note; the other page's note keeps a fainter rule.
- **Closing:** the sheet's × (on hover), Close Window (⌘W), or Split Page
  again (the other page). A note is never touched by closing its page, but
  for the words just typed there, saved first. The last page never closes.
- **The divider** is a pane's edge: dragged, or ← → with the keyboard, Enter
  or a double-click to even the pages; ⇄ on it (and View → Swap Pages) swaps
  them. Neither page is ever narrower than 360px; where it stands is
  remembered on this device. Which notes are split isn't remembered across a
  restart.
- **Narrow:** below two pages' width, Two sheets fold into one, the active
  page, and a pager with the page's tools names both; Facing pages' book
  closes to the active page, the other page's edge beside it with its name,
  a click (or ⌘3) turning to it; a companion goes under the page; with Tools
  that follow, the other page waits. Shutting a pane opens them again.
- **One note on both pages** is one document: one undo history, one save,
  its words counted once (§3).
- **The phone** shows one page: no split, and its menus offer none.

### Layout

Three panes, each collapsible, with a two-pane option in settings:

1. **Sidebar** — a collapsible tree:
   - **All Notes**, with a count
   - **Pinned**, with its pin, always: with nothing pinned, its list says how
     to pin
   - **Folders**, nested; a book marked BOOK beside its count; a quiet + at
     the label's right (on hover or keyboard focus; always on a phone) makes
     a folder, named in place. Folders is for writing (#40): it lists every
     folder but those whose contents, at any depth, are EPUBs and nothing
     else, which are on Shelf alone. A folder stays while a note is anywhere
     under it, and an empty folder always shows (where it's named); "empty"
     is what the sidebar would show, so a folder of a book and its cover
     picture is books alone. A folder of notes and books is in both
   - **Shelf** (#40), between Folders and Tags, once the vault holds a book
     (an `.epub` file, in any folder): a lens over the one folder tree. Every
     book, named by its file as a note is, under the folders on the way to
     it at their depth. A folder there is Folders' own folder row: its
     twisty, or a click on its name (nothing lists a folder's books), shuts
     and opens it, open at first and remembered on this device (§2); a note
     or folder dragged onto it lands there; and it has the folder's own
     menu and keys (F2, ⌥ and an arrow). Its new name is typed in its row on
     Shelf; Move up and down, ⌥↑ ⌥↓ and ⌥→ go among the folders Shelf shows
     beside it (in Folders, among those Folders shows), stepping over those
     only the other shows; Move to… lists every folder. A folder moved into
     a shut one opens it. When a folder changes sections (its first note
     arrives, or its last leaves), the keyboard stays on its row where the
     row stays, or on the row in its place; the folder chosen stays the
     list's until another is chosen. Opening a book from elsewhere leaves a
     shut folder shut. A book is never in a folder's note list, count or search. A
     click opens it on the page; with two panes, its contents are listed
     under its row. Its row answers as a note's: right-click, the menu key
     or Shift+F10 give its menu (Rename, Move to…, and the trash last), F2
     or a second click on its name renames it in its row (its `.epub` kept
     and shown faded after the field, on a phone too), ⌘⌫ (Ctrl+Delete)
     sends it to the trash: the system's, or a phone's `.eien/trash`, and
     the list says where; a trash that fails deletes nothing and says so.
     A book moved or renamed is followed by its page and its contents in
     the list, takes no place in a folder's own order, and keeps its place
     in `.eien/reading/`, which is kept by what the book holds, not where
     it is
   - **Tags**, nested by `/`; the + beside its label makes a tag, named in
     place (see §2, Tags)
   - Library, Folders, Shelf and Tags fold and open from their labels (a click, Enter
     or Space), each remembered on this device (§2). An open folder or tag has
     a hairline guide down its children.
   - At the foot: the vault's count, then three icons: day or night (a sun
     or a moon, whichever shows; pressed, the other; System is in
     Settings), three panes or two, and settings. Beside them, the sync
     status: when Syncthing syncs the vault (a `.stfolder` marker in it, or,
     on the desktop, in a folder it's in), a sync icon with a tooltip. In the
     added ink it says "Synced · Syncthing"; for 15 minutes after a note
     changes that this window didn't change, it's in pencil and says
     "Changed on another device 4m ago". The window tells the two apart by
     remembering its own writes for a moment (`ui/vault/own-writes.ts`), and
     the main process names what another window on this device wrote. Eien
     only listens: it never starts a sync, and the status writes nothing.
     With no Syncthing, nothing shows
2. **Note list** — the notes in the selected folder or tag: title, a line of
   preview, and the date or word count. Sortable by title, modified date or the
   folder's own order (drag to reorder). At its top, on its own band above the
   heading, the search field ("Search Fic"), which searches only the notes the
   list holds. Its head holds the quiet + (New note, ⌘N) and the lens's filter
   and sort: like every quiet control, they show while the head is hovered or
   one has the keyboard, the same rule as the + beside FOLDERS and TAGS.
   Hidden in two-pane mode, where the tree lists the notes itself. A book
   opened from the shelf (#40) puts its contents here in place of notes: its
   title and author, then its chapters in the book's order, the one on the
   page marked as an open note's row is (↑ ↓ Home End between them, Enter or
   a click to open one), until a row under Library, Folders or Tags is
   chosen. The search field then searches the vault.
3. **Page** — the editor, on a paper sheet; or a book (#40): one chapter of
   it on the note's own sheet, drawn from cleaned nodes in the writer's
   faces and the theme's colours, its pictures from the book's own zip, the
   book's folders above it. A book that won't open says why on the sheet
   (locked with DRM, too large, damaged); its file is only read. A tool
   shows only while the active page can use it (decided 2026-10-29): with a
   book active, a note's tools (the views, Seal, Compare, Versions, Copy as
   HTML, Focus, every format) are set aside in the layout's bars and the
   phone's, not greyed, and their keys do nothing there; choosing a note
   brings them back. The formatting bar's row stays while a note is on
   either page, so neither page moves (beside a book, only its buttons go);
   with a book alone it goes too. The tools every page shares (Look, Split,
   the panes) keep their places, and a page with its own host (Facing
   pages, Tools that follow) keeps its own tools on it. A bar that folds
   fits again as its tools come and go. The phone's ⋯ and the menu bar
   grey the same commands rather than hide them (the views, Seal, Compare,
   Versions, Copy as HTML, every format, Export HTML… and Export Note,
   Outline Cards, Focus Mode, Typewriter Scrolling, Show Markdown Marks),
   from the one rule each control's `on` gives (`ui/chrome/commands.ts`,
   `menuOff`): a menu lists all the app does. The menu bar is the app's: it
   wears the focused window's, and a menu of the bar is never greyed, only
   its items.
   - **A chapter a sheet** (Phase 2): the chapter scrolls as a note does in
     Reading, the usual keys once the page has the keyboard. At its foot,
     after a soft rule, the chapters before and after it in the reading
     order are word buttons named for them ("Previous chapter" for one the
     contents don't name, such as a title page), "The end" at the last;
     nothing moves on until one is pressed, which opens that chapter at its
     top. The colophon says "3 of 61", then how far through the chapter and
     the book ("40% of the chapter", "12% of the book", the book by its
     chapters' sizes; the two dropped first on a narrow page).
   - **Pages** (Phase 3b): **Read in**, a book setting in the shelf's
     quick look, sets a book in *Pages* or *Scroll* (the default for now),
     as do the book's own two tools in the views' place and View → Pages
     and View → Scroll (greyed with a note in front, as a note's views are
     with a book). In pages the sheet fills the pane and the chapter is
     laid in pages as tall as the whole lines it holds, so no line is cut;
     its paragraphs are set as a book's, whatever the scroll style. The
     arrow keys, Space and Shift+Space, Page Up and Page Down turn a page;
     Home and End go to the chapter's ends; past a chapter's last page
     comes the next chapter's first, and back, the last page of the one
     before. On the sheet's sides lie the book's fore-edge, the pages read
     at its left and still to read at its right, up to six paper edges in
     sixths of the book; each side is a button, Previous page or Next page,
     its tooltip saying how many of the chapter's pages are left that way.
     On a touch screen a tap in the page's outer thirds turns it (a tap on
     a link, or ending a selection, never does). A link the keyboard comes
     to on another page turns there. The place is the same as Scroll's,
     the first word in sight, so it carries between Pages and Scroll, a
     restart, a width, a face and page zoom.
   - **Turning the page** (Phase 3b): **Page turn**, a book setting in the
     shelf's quick look: *Curl* (the default; the paper rolls over as it's
     turned, its back showing the words faintly, in light only while it
     moves), *Slide* (the words carried a page) or *Words* (only the ink
     changes). **Turn speed**: *Instant*, *1×* (as designed), *2×* (the
     default), *3×*, *4×*. A key pressed mid-turn finishes it at once; a
     key held down turns at once; with reduced motion every turn is
     instant. A turn moves the page in sight alone, so turning is as quick
     in a long chapter as a short one. **A hand** (Phase 3c): a finger
     takes the page anywhere on it, a mouse (or a pen) at the book's edges,
     or anywhere on a page in flight, to catch it; under Curl
     the corner stays under the hand, and let go, its speed decides: past a
     quarter of the page from the spine (or flicked) it turns, short of it
     it falls back to where it was; a gesture the system cancels (a pinch
     beginning) falls back too. A page in flight can be caught and carried
     on or back; a tap on it lets it fly on (and in an outer third, turns
     the next). Under Slide and Words a drag across asks for the turn.
     Never while words are chosen in the page, nor on a link (but to catch
     a page in flight); a drag that turned is never also a click.
   - **The scroll style**, a book setting in the shelf's quick look (never
     in Settings, which sets notes): *As a note* (the default), its
     paragraphs spaced as a note's in Reading; or *As a book*, indented
     with no space between, the first after a heading, a break or a
     picture flush.
   - **The place kept:** where you are, the chapter and its first line in
     sight (an offset in the chapter's words, so it holds through a new
     width, size, face or scroll style), is kept in
     `.eien/reading/<key>.json` a second after the page comes to rest,
     when the chapter changes, and when the page closes or the window
     quits (a phone, as it goes to the background), and opens there again
     next time. The page put back in the window (⇄) or laid out anew (a
     new width, page zoom) shows the same line.
   - **The book's own links and notes** (Phase 2b): a link reads as one,
     the words' own colour with a quiet underline that darkens under the
     pointer (the extension's story page's, one rule for both), and the
     window's tooltip names where it goes ("Chapter III", "Note 4", or an
     address). A link to one of the book's chapters goes there, to the
     place it names, and **Back to Chapter I** in the colophon (or ⌘[,
     Alt+←) returns to the line it left, one step; choosing a chapter
     yourself forgets it. A note's reference (EPUB 3's `noteref`, or a
     number or a sign in a sup, as EPUB 2 books write them) shows the note
     over the page, in the book's face, from this chapter or another: Esc,
     a click elsewhere or scrolling closes it, the keyboard back on the
     mark, and **Go to the note** goes there. A link to the web or mail
     (`http:`, `https:`, `mailto:`) opens in the system's browser, as a
     note's does in Reading; anything else (a script, data, a file, out of
     the zip) keeps its words alone, with no look of a link. A copy from a
     book holds its words and shapes alone: no address, no note's mark, no
     picture.
   - **Beside a note** (Phase 2c): a book opens on one page of the split as a
     note does: ⌘-click or ⌘Enter on its SHELF row, or its menu's Open to the
     Side (on a phone's Two pages, a book chosen faces the note open),
     in each of the split's modes, ⇄, the pager and the phone's slip.
     **Quote:** words chosen in the book show the selection bar, **Quote in
     the note** and **Copy** (on a phone, the page's ⋯ → Quote in the note;
     on the desktop, Q too). Quote adds them at the end of the note beside
     as a Markdown quote, `— Pride and Prejudice, Chapter III` under it (the
     book's title and the chapter's name, no author), and never touches the
     note's own words; one ⌘Z in the note takes it out (in Live or Source).
     Q quotes only what's chosen now, once. On a phone with one
     page it goes into the note you came from, which opens with it, the
     book a tap away. With no note beside, the colophon says so.
   A small header shows the note's
   title and its word count. A status line below shows today's words, sprint,
   and zoom, at a fixed height (`--status-h`, 40px). Each part of the page
   has its own row (bar, formatting bar, scroll, status), so a part hidden
   never hands its space to another. Controls show on hover or keyboard
   focus (on a touch screen, which can't hover, they stay in sight).

Every pane can be resized and collapsed. Keyboard: ⌘1/⌘2/⌘3 focus a pane,
⌘\ toggles the sidebar, ⌘⇧\ the note list.

- **No title bar.** The panes take the title bar's space, as Claude's desktop
  app does, and their top bands (the sidebar's head, the list's head, the
  page's bar, the running head, the versions panel's head) drag the window;
  every control, field and pane edge in them stays a control. On macOS the traffic lights
  sit over the sidebar's head, in the middle of its band at any zoom, and the
  head starts after them; with the sidebar shut, the corner keeps clear of
  them as Shut sidebar says (Collapsing, below), and in full screen, which has
  no lights, nothing waits for them. On Windows and Linux the
  system's own minimize, maximize and close are drawn over the page's band,
  in the band's colours (they follow day, night and the palette) and at its
  height, and the band keeps clear of them. Where the controls are comes from
  the window controls overlay (`env(titlebar-area-*)`), so nothing is
  measured by hand. Which strip they sit over is the layout's (below): the
  page's band in Band, the blotter's top in Slip, the running head in
  Running head (the traffic lights in the middle of its 40px). The phone
  keeps its own layout.

- **Resizing.** A pane's edge is a hairline that darkens under the pointer:
  drag it, or give it the keyboard and step it with ← and →. Each width has
  its limits: the sidebar 200–420 px (220–520 with two panes, where it holds
  the notes), the list 260–480. In a window too narrow for all three, the
  list and then the sidebar give way, down to their narrowest, so the page
  keeps 360 px; widening the window gives them back.
- **Collapsing.** The seal shuts and opens the sidebar. What's left of it is
  a device setting in Band and Slip, **Shut sidebar** (`appearance.shutSidebar`,
  Settings → Look → Appearance; [corner.md](design/explorations/corner.md)):
  - **The seal alone** (the default): no strip. The seal stays where it was
    in the top row (beside the traffic lights on macOS, at the gutter in full
    screen and on Windows and Linux), and the next pane's band starts past it.
  - **A strip of desk**, as wide as the bands are tall, the seal in its
    middle. On macOS its top widens into a shoulder of desk just wide enough
    for the traffic lights, one band tall, and the seal waits under them; in
    full screen, and on Windows and Linux, there's no shoulder and the seal is
    at the strip's top.

  In Running head a shut sidebar is always its strip, its band's width, the
  seal at its top (the running head holds the lights). The layout's pane
  controls and the View menu shut and open either pane: in Band and Slip a
  chevron at the pane's edge (‹ on hover shuts it; the way back is a › in the
  same spot of the pane beside it, and a shut sidebar's is beside the strip's
  seal; the seal alone is its own way back), in Running head the strip's
  sidebar and list icons, always in sight. A pane shut with the keyboard in it gives the
  keyboard to the page. ⌘1–3 open a shut pane before giving it the keyboard.
  A pane opened again comes back where it was, for as long as the window is
  open: the same rows in sight, and ⌘1 or ⌘2 gives the keyboard back to the
  row it was on as the pane shut. The same list drawn again keeps its scroll;
  another list, or another sort, starts at the top. A folder opened or closed
  in the tree leaves the tree where it was, the folder's row in the same spot.
- **Two panes** (Layout → Panes, or the pair at the sidebar's foot): the list
  is gone and the tree lists the notes, under the vault, each open folder (in
  the folder's own order and sort, a book's numbered), All Notes, Pinned and
  each tag. Choosing a row opens it, and shuts it when chosen again. The
  tree's notes have the list's menu, keys and drags. ⌘2 is the page.
- Whenever no list is in sight (two panes, or the list shut), the search
  field is in the sidebar, under the vault's name, and searches the whole
  vault; its results take the tree's place, and the last action's news shows
  at the sidebar's foot; with the sidebar shut too, in the page's status
  line. The field keeps its words as it moves: opened again, the list
  searches its own notes for them.
- The keyboard is never left on something hidden or gone: a shut pane gives
  it to the page (to the page itself when no note is open), a folded section
  to its label, a redraw gives it back to the control that had it, or to the
  row now in a removed row's place.
- Widths, and which panes are shut, are per device (§2); three or two panes
  is a device setting (§6).
- A long list draws only the rows in sight: the note list, or a list of the
  two-pane tree, once it holds 200 notes or more. A spacer above and below
  keeps the list its whole height, so the scrollbar and positions read as if
  every row were there, and each row says where it stands among them all
  (`aria-posinset` of `aria-setsize`). The keyboard still reaches every row:
  ↑ ↓ move one, PageUp and PageDown a view's worth, Home and End the first
  and last, drawn or not. A row with the keyboard that scrolls out of sight
  leaves it with its list, which carries on from that row; a redraw (a
  change on disk) gives it back to the same note, wherever it now stands.
- Nothing a writer does stalls the window: with three thousand notes,
  drawing a list, moving through it, switching layouts, a hundred notes
  arriving at once, a rename and a drag never hold it longer than 200 ms
  (the speed budgets, `tests/e2e/budgets.spec.ts`).

### Layouts

Three layouts, a device setting (`appearance.layout`, Settings → Look → Appearance;
`data-layout` on `<html>`). They differ only in where the controls sit, not
in what they are or do ([overall.md](design/explorations/overall.md)):

- **Band** (the default): the page's controls in a band above it (views,
  Compare, Seal, Versions, the formatting bar, Focus, Look after a hairline, and the strip's own
  control, which hides the band to a lip and brings it back). Corners 2/4/8px.
- **Slip**: no band; the page's tools float on a raised slip at the
  blotter's top right, which folds away to its fold. The panes' chevrons are
  tabs at their edges. Corners 4/8/14px; the sheet takes a 3px corner.
- **Running head**: one 40px strip across the whole window, the traffic
  lights in it, then the panes' icons, the breadcrumb and every page tool,
  always in sight. The sidebar's head sits under it. Corners 3/6/10px.

Every control is a command, defined once (`ui/chrome/commands.ts`): its icon,
its name, its key, and the menu's command it runs. A layout names its hosts
and the commands each holds (`ui/chrome/band.ts`, `slip.ts`, `runhead.ts`),
each command in exactly one host; switching takes one layout's hosts out and
puts the other's in, and nothing else changes. A host draws its commands as
icon buttons (`ui/icons.ts`), each with an accessible name, a tooltip with
its key (after a short hover, or at once from the keyboard) and its state
(pressed, disabled, or set aside where the active page can't use it, #40);
a host is a toolbar, its arrows moving along it, and Tab
reaches every control. A switch leaves the keyboard on the same command in
the new layout, or on the page. Whether the strip is hidden is per device.

**Short of room** (backlog #36, `ui/chrome/fold.ts`): a page's bar (Band's
band and its formatting row, Slip's slip, Running head's strip) never runs
past the page, the screen, or the system's window controls. The tools that
don't fit fold behind one ⋯ at the bar's end, as few as it takes, in one
order: Versions, Compare, the formatting bar's toggle, Focus, Look, the views (as
one), then the Seal (the formatting row: from Table back, bold and italic
staying). The strip's own control never folds: it's the shut band's way back.
The ⋯ lists what folded in the bar's order, each with its icon, key and state,
and runs it; arrows reach it, and the keyboard on a tool that folds goes to
it. They unfold as the bar's room comes back (the window, a pane, the split's
pager, a touch screen's larger controls). Slip's and Running head's
formatting slips float, with no bar to fold against: they wrap to a second
row or column instead.

**Tags on the page** (backlog #13): Band shows them at the right of the
sheet's running head, mono words with a + on hover; Slip as label slips under
the title; Running head as pills at the colophon's left; a phone, in every
layout, as slips under the title at a finger's size (`LayoutSpec.tags`,
`PHONE_TAGS`). A front-matter tag has a × (on hover, or the keyboard on it); a
tag typed in the text has a dot and no ×, and choosing it shows where it is
in the words. The + (or # with the keyboard on the page, outside the words)
opens a field: its menu lists the vault's tags with their counts, leaving out
the note's, then "Make #…" for a new one; ↓ ↑ and Enter choose, ⌫ in the
empty field takes the last front-matter tag off, Esc closes. A #tag typed in
the words shows on the page once the typing pauses, so nothing on the page
moves mid-word.

On a phone each layout has its own bottom for the page: Band the top bar
(the view, Focus, Look, ⋯), Slip a floating slip (the three views, Focus,
Look, ⋯), Running head a rail at the page's foot (the views, Focus, Seal,
Look, ⋯). The ⋯ holds the rest, as the menu bar does on the desktop.

The visual design (type, color, spacing) is set in the design pass. This spec
fixes only the token names it uses (§7).

### Editor views

The editor has three views of the same note, switched by a toolbar control and
⌘E:

| View | What it shows |
|---|---|
| **Live** (default) | Markdown with its marks hidden except on the line being edited (or everywhere, with Show Markdown marks off). Checkboxes are clickable, images show inline, tables are drawn as tables and edited in place. |
| **Source** | The raw `.md`, with syntax colored. |
| **Reading** | The note rendered and read-only. |

Live is the WYSIWYG view: you see the formatting, not the marks, and you
format without typing them:

- **Keys:** ⌘B bold, ⌘I italic, ⌘U underline, ⌘⇧X strikethrough, ⌘⇧H
  highlight, ⌘K link, ⌘⌥1–3 headings, ⌘⇧. quote, ⌘⇧7 numbered list, ⌘⇧8 list,
  ⌘⇧9 checklist. Each toggles: pressed again, it takes the formatting off.
  ⌘⇧T puts in a table: a header and two rows of two columns, empty, the
  caret in the first cell, on the caret's line if it's blank or else after
  it, a blank line either side; with the caret in a table in Live, it opens
  that cell's menus instead (Tables, below). On
  Windows and Linux ⌘ is Ctrl, and the headings are Ctrl+Shift+1–3: there
  Ctrl+Alt is AltGr, which types characters (², ³ and @ on a German keyboard),
  so a Ctrl+Alt key would take them. macOS keeps ⌘⌥, as ⌘⇧3 is its screenshot.
- **Format menu** in the menu bar with the same commands and their keys.
- **Formatting bar:** the same commands drawn as Eien's icons (bold, italic,
  underline, strikethrough; heading, highlight, link; quote, the lists; a
  table, pressed with the caret in a table, where it opens the caret's
  cell's menus),
  shown or hidden by its control in the page's toolbar, View → Formatting
  Bar or ⇧⌘B (a device setting, off at first). Each button runs the menu's
  command, and shows pressed where its format is on at the caret (read from
  the editor's syntax tree, at the caret alone). One heading control takes
  the caret's line a level down each press: 1, 2, 3, then none. Band draws it
  as the band's second row, Slip as a slip of its own at the blotter's top
  left, Running head as a rail down the page's left margin. Its buttons are
  off in Reading and with no note open. Not on a phone: there the selection
  bar formats.
- **Selection bar:** when text is selected, a small bar of the same commands
  appears beside it. It appears only for a selection and never while typing.
- Typing the Markdown marks works too, as in any Markdown editor.

**Show Markdown marks** (Settings → Writing → Editor, or View → Show
Markdown Marks; a device setting, on at first, as Live has always been: the
marks tell the writer where a format starts and ends). Off, Live keeps every
mark hidden on the caret's line too, so the page reads like a word
processor's, and stays editable (`ui/editor/hidden-marks.ts`): the caret
steps over a hidden mark or a widget whole; Backspace and Delete take the
letter beyond a mark, not the mark, and a pair of marks left with nothing
between them goes too; at a line's start Backspace takes the line's format
off (a heading, a quote, a list item); a table's cell edge stays put.
Typing `**` still formats, the marks hiding once the pair is whole.

**Hide tags and IDs** (Settings → Writing → Editor; a device setting, off
at first, so Source shows the file as it is). On, the front matter's `tags:`
and `id:` lines, each with its list's items, its block's lines and a comment
after it, are out of sight in Live, Source and Reading, so they aren't edited
by accident; the note's tags still show on the page, where they're added and
taken off (§2, Tags). The writer's other keys stay in sight, between the
`---` lines; front matter that holds only tags and the id goes out of sight
whole. The lines are kept and saved as they are (`ui/editor/front-matter-hidden.ts`,
the lines found by `core/note/tag-id-lines.ts`): the caret never rests in
them or in the `---` lines around them; the writer's edits go round them, so
Select All and typing or deleting keeps them, with their `---` lines, and
what's typed follows them; a Backspace or Delete that would join a line in
sight to them does nothing; find neither counts nor replaces a match in them;
a copy leaves them out. Eien's own changes (a seal's id, the page's tags, a
restore, a reload, undo) come through. Front matter YAML can't read is left
in sight.

**Tables** in Live and Reading are drawn in place, row by row
(`ui/editor/live-tables.ts`): each row a line of equal columns with
hairlines between, the header on the band, the pipes and the delimiter row
out of sight, each column aligned as its delimiter says (left `---`, centre
`:-:`, right `--:`, figures on the right in tabular figures). A click in a
cell puts the caret there, and typing edits the cell's Markdown; the file
stays a plain GFM table. The words in a cell are formatted as anywhere else,
and the caret's row shows its pipes (and its marks) as other lines do.

In Live a table is edited as a word processor's is (the table editor,
`core/table` and `ui/editor/table-*.ts`; the design in
`docs/design/explorations/tables.md`, "The choice"):

- **Keys,** with the caret in a table: Tab and Shift-Tab go to the next and
  previous cell, its words chosen, and Tab in the last cell adds a row; the
  arrows cross into the next cell at a cell's edge, ↑ and ↓ always; Enter
  adds a row under the caret's, Shift-Enter says a cell is one line; Esc
  leaves the table for the line after it. ⌥⌘↑ ↓ ← → add a row or column on
  that side; ⌥⌘⌫ removes the row, ⌥⇧⌘⌫ the column; ⌥↑ ↓ move the row;
  ⇧F10 opens the cell's menus. (Ctrl for ⌘ on Windows and Linux.)
- **On the desktop,** a grip at each row's left and over each column shows
  for the row and column under the pointer or the caret. Pressed, it opens
  that row's or column's menu, in the row menu's style (add on either side,
  move, a column's alignment with a dot by the one it has, remove last in
  carmine); dragged, the row or column moves, with the drop line. A + shows
  only while the pointer is on a line between two rows or columns (or the
  table's edges), with the line where the new one goes. A right-click on a
  cell opens both its menus.
- **On a phone,** no grips or + to aim at: the table's tools are one bar at
  the page's foot, above the keyboard, while the caret is in a table (rows,
  columns, alignment; 44px targets). A long press, where the phone gives
  one, opens the cell's menus.
- **Words are never lost.** Each change is one step of the editor's
  history: ⌘Z puts back what a removal took, and the colophon says so ("Row
  2 removed · ⌘Z puts it back").
- **What Markdown can't do, it says,** in the colophon: the head row stays
  (a GFM table always has one), and so does the last column. A cell is one
  line: pasted lines join with spaces. A `|` typed or pasted in a cell is
  saved as `\|`, unless it's escaped already; Backspace and Delete, with
  nothing selected, never take a cell's edge or join a row to the line
  beside it.
- **The file changes only where it must:** a row added, removed or moved
  touches its own line; a column's change rewrites each row's cells, giving
  each row its outer pipes, and leaves their spaces as they were.

Square brackets are a link only with an address or a defined reference, as
CommonMark has it: `[sic]` and `[...]` keep their brackets on the page. HTML at
the start of a line (pasted `<p>…</p>`) looks as it does mid-line. Front matter
shows quietly, in the mono, never as a scene break. A fenced code block shows
its code on the well ground at the words' scale (a size short of them, in the
Source font); its fences (```` ``` ```` and a language) are marks, out of
sight but on the caret's line, and always in Reading.

Links: ⌘-click (Ctrl-click on Windows and Linux) follows one. A web address
opens in the browser; a `[[wiki link]]` opens the note with that title. In
Reading a plain click follows; in Live and Source a plain click places the
caret.

A link's tools in Live (backlog #38): resting the pointer on a link, or the
caret in one, shows where it goes and lets you edit it and open it. The
**Link editing** setting (Writing → Editor) chooses how; any of the three on
any device, the Card by default on the desktop and the Bar on a phone:

- **Card:** a card under the link. A note link's reads as that note's row in
  the list (its folders, title, first line and words); a web link's is its
  address; a note not made yet says so. Its tools: Open, Edit (two fields,
  the words and where it goes) and Take off.
- **In place:** the link's Markdown opens where it stands, its marks shown
  whatever Show Markdown marks says, the address in the Source font, ↗ after
  it to open it. You edit it as text; where it goes is said in the colophon.
- **Bar:** a small bar over the link's line, the selection bar's sibling:
  where it goes (pressed, it's a field), Open, Edit, Take off. A hover shows
  only a tooltip. On a phone it's docked above the keyboard.

What's typed in "goes to" says the kind: an address (`https://…`, `www.…`,
`example.org/…`) makes `[words](address)`, anything else a note's name,
`[[note|words]]` (or `[[note]]` when the words are its name); a name the vault
has as a note stays a note's. Each edit is one step ⌘Z takes back; an empty
"goes to" keeps the old one; Take off keeps the words. The keys, the same in
all three: ⌥↩ opens the caret's link, ⌘K edits it (with words selected
outside a link it still makes one), ⌥F10 takes the keyboard to its tools,
Esc puts them away and brings the keyboard back. They step aside while you
type in a link and come back when the caret moves. A screen reader hears
where a link goes as the caret reaches it.

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

- **Rename** in place, in the row: a note in the list or the tree (F2 on its
  row, a double-click on its name, or Rename in its menu), a folder in the
  tree (F2, or its menu; not a double-click, as a click opens a folder and the
  next shuts it). The name becomes a field in its own face and size, its words
  chosen, a note's `.md` faded after it. Enter keeps the name, Esc puts the old
  one back and the keyboard on the row, and leaving the field keeps it. A note
  can also be renamed by its title on the page (click it), and on a phone that
  is where Rename goes. Renaming changes the file's name, and the folder's
  order and the pins follow. A name another file has (case and accents aside)
  is refused, never numbered: the writer chose it. As it's typed, a small
  ochre line under the row says so, and the field stays open. A change of
  case alone is allowed.
- **A row's menu** (right-click, the menu key or Shift+F10) is Eien's own:
  raised paper headed by the row's name, an icon, a word and its key in
  pencil for each choice (no keys on a phone), and the trash last, in carmine,
  after a rule. Arrows move through it, Enter chooses, Esc closes it and gives
  the keyboard back.
- **Move** a note by dragging it onto a folder (or the vault's name), or with
  Move to… in its menu. Where its name is taken it's numbered ("Ideas 2"), so
  nothing is replaced. The open note carries on at its new path. A folder
  moves the same way, never into itself.
- **Order:** in a folder's own order, drag a row between others, or Alt+↑/↓,
  or Move up/down in its menu. The order is `.eien-folder.json`'s; a folder
  never ordered gets no file. A note moved in goes last.
- **Folders in your order** (backlog #12): in the sidebar's tree, ⌥↑ ⌥↓ move a
  folder among those beside it, ⌥← out of the folder it's in (to just after
  that folder), ⌥→ into the folder above it; its menu has Move up, Move down
  and Move out of …. Dragged, a folder goes inside the folder it's let go
  on, before or after one when let go at that row's top or foot edge (moving
  to that folder first), to the top on the vault's name, and out of its
  folder to the left of its own row. The keyboard goes with it. A folder's
  notes keep their order as its folders move.
- **All Notes in your order** (the list's default): notes not placed yet at
  the top, newest first, then your order, kept as a list of paths in
  `.eien/order.json` (watched, and following a note renamed, moved or
  trashed, as the pins do). ⌥↑ ⌥↓ and a drag place a note there, as in a
  folder.
- **Arranging** (Settings → Writing → Lists): Drag anytime (the default): rows
  drag whenever your order shows. In Arrange mode: the grip in the list's
  head (Arrange) starts it, grips show on every row and any sort or filter is
  set aside so your order shows; Done brings the lens back. Outside it no
  row drags, and a line under the head says so; ⌥↑ ⌥↓ and the menus still
  move rows, being on purpose, and the tree's folders move by their keys and
  menus, not a drag. Not on a phone, which moves rows by their menu.
- **Tags in your order:** ⌥↑ ⌥↓ on a tag's row move it among the tags beside
  it, kept as an `order` in `.eien/tags.json`, every level in one list.
- **The lens** over a list (docs/design/explorations/order.md): a sort (its
  own order, title or newest) and a tag filter, laid over the list's own
  order and never changing it. Each is an icon in the list's head; each part
  that's on is a chip with its ×, and clearing it brings the order back.
  Both are kept per list, on this device. While a lens is on, a folder's rows
  don't move (no drag, no Alt+↑/↓), and a line under the head says why.
  - **The tag filter:** the vault's tags, nested, each left alone, wanted (a
    filled box, a tick) or kept out (a carmine box, a dash, the name struck
    through). A press moves a tag on to the next state, and ⌥ with a press (or
    ⌥Enter) keeps it out at once. With two or more wanted, All of (the
    default) or Any of decides. A note shows if it has the wanted tags and
    none of the kept-out ones; a tag counts with the tags under it (#fic
    finds #fic/aot). Every note clears them all. The list's count says how
    many of how many.
  - **From the sidebar's TAGS** (#32): ⇧ and a click on a tag (or ⇧Enter)
    moves it on in the filter of the list showing, ⌥ and a click (or ⌥Enter)
    keeps it out at once; a plain click still chooses the tag. A tag in the
    filter shows it on its row: a tick when wanted, struck in carmine with a
    dash when kept out. With 3,000 notes it holds to the speed budget.
  - **With two panes** the tree lists the notes, and no list head shows in
    the sidebar: the chosen row's filter and sort are quiet icons at the end
    of the search field's row (a group named "Sort and filter <row>"), its
    chips under it while a lens is on, acting on that row's notes in the tree.
- **Include subfolders** (backlog #42): a folder with folders in it has a
  quiet toggle in its list's head, beside the filter and sort, that lists its
  subfolders' notes too, at every depth. Kept per folder on this device, as
  the lens is, and following a folder renamed or moved; off, the list is the
  folder's own notes. Your order holds: the folder's own notes first, then
  each subfolder's under a head with its path below the folder ("ARC 2 /
  CUT", label type), the groups in your folder order (each folder just
  before the folders in it), each group in its own order or the list's sort.
  A subfolder with no notes listed has no head. It isn't a lens: rows still
  move with it on, and Arrange keeps it. ⌥↑ ⌥↓ and a drag move a note within
  its group; let go among another group's rows, a note moves to that folder
  (as onto the folder in the sidebar, keeping order and pins in step), placed
  where it was let go. The tag filter and a search in the list take in the
  subfolders' notes too, a search's hits in their groups, best first in each;
  the count says "· With subfolders". With two panes the tree lists each
  folder's notes under its own row, as always, never twice. ↑ ↓ (Home, End)
  move from row to row in any note list, over the heads, which are no stop.
- **Books:** Make it a book / Not a book, in a folder's menu.
- **Pinned** notes are listed under Library, in the order pinned
  (`.eien/pinned.json`, watched like the settings). ⇧⌘P (Ctrl+Shift+P) on a
  note's row pins it, or unpins it; so does Pin in its menu.
- **The trash:** Move to the trash (⌘⌫ / Ctrl+Delete on a row, or the menu)
  sends a note or folder to the system's trash (the Recycle Bin on Windows),
  saving the open note first, a note's own images with it; the list says
  where it went. If the trash
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

The search field is on the list's band, where it searches the notes that list holds (All Notes,
Pinned, a folder's own notes, not its subfolders', or a tag's), and its
count says which ("2 notes match · Fic"); with no list in sight (above) it's
under the vault's name and searches the whole vault. On a phone it stays on
the contents page, for the whole vault, as the phone's mockup has it.
⇧⌘F (Edit → Search Notes…) gives the keyboard to whichever field is showing,
opening a shut sidebar for its own. A search matches the notes holding
every word of the query, in the title or the text, with case, accents (the
combining marks of Latin, Greek and Cyrillic, never another script's vowel
signs), curly quotes and full-width forms aside; "quoted words" are a phrase. Notes whose
title holds the words come first, then the most recently changed; the first
200 are listed, with the words around the match. Esc, or emptying the
field, clears it and gives the list (or the tree) back.

Tags follow the same Markdown as the editor: a "#" in code, a link, an
address, HTML or after a "\\" is not a tag. A tag needs a letter; case aside,
#Draft is #draft (folded fully: #Straße is #STRASSE, #İstanbul is
#istanbul), and the sidebar shows the first spelling. Previews and snippets
are cut between whole characters: an emoji made of several is never split. A
paragraph of more than 64 lines is read in pieces of 64, as the parser takes
seconds over one long paragraph full of brackets. Tags count as
words, as on the page.

### Find in the note

⌘F (Ctrl+F elsewhere) finds in the open note, in Live, Source and Reading,
on the active page of a split: each page finds in its own note. Edit → Find
holds Find…, Find and Replace… (⌥⌘F; Ctrl+H off the Mac, where Ctrl+Alt is
AltGr), Find Next (⌘G) and Find Previous (⇧⌘G); on a phone it's the page's
⋯ → Find. It's CodeMirror's search (`@codemirror/search`, `ui/editor/find.ts`),
drawn as Eien's own slip at the page's top right (`ui/find/find-bar.ts`),
which searches nothing itself, so an EPUB's chapters can drive it too.

- The Find field opens with the chosen words in it (a word or a phrase on one
  line), or the last query. Typing goes to the first match from the
  selection's start, so each letter narrows rather than stepping past; Enter
  and ⇧Enter step to the next and previous match, round the note.
- Every match is marked in the text, the current one apart: it is the
  selection. A count says "3 of 12", "12 matches" while the selection is on
  none, "No matches", or "Not a valid pattern"; it stops at 1,000 ("1,000+").
- Three quiet toggles: Match case, Whole word, and Pattern (a regular
  expression, `$1` in the replacement). Without Pattern, what's typed is
  found as written.
- The twisty (or ⌥⌘F) unfolds Replace. Replace (Enter in its field) changes
  the current match and goes to the next; the first press only goes to one.
  Replace all (⌥⌘↵) changes every match. Each is one change, one step of the
  note's history: ⌘Z puts it back, on every page showing the note. Nothing
  can be replaced in Reading or while the note is held still.
- Esc, from the bar or the text, shuts it, and gives the keyboard back to
  the text on the current match. Showing another note shuts it too.

### Writing tools

- **Scene break:** Enter on an empty line after an empty line inserts `***`,
  shown as a centered `* * *` in Live and Reading, and starts a new paragraph
  after it. Not at the note's start, not right after another scene break, and
  never in code or the front matter. ⌘Z takes it back.
- **Quotes:** typed quotes follow the quote setting (curly or straight).
- **Focus mode:** dims every paragraph but the current one (the lines between
  blank lines round the caret). View → Focus Mode (⌘⇧↵, Ctrl+Shift+Enter), or
  Settings → Writing → Editor.
- **Typewriter scrolling:** keeps the caret line at the middle of the page as
  the writer types, deletes or moves with the keys; a click leaves the page
  where it is. View → Typewriter Scrolling, or Settings → Writing → Editor.
- Both are this device's settings; the View menu's checks follow them, wherever
  they're changed.
- **Counters:** words in the note (its words only: not the marks, link
  addresses, HTML tags or front matter), in the book, today; sprint timer with words
  gained; the page's zoom. In the colophon, in that order, with the last seal:
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
- **Zoom:** ⌘+ and ⌘− (Ctrl elsewhere; also the View menu) zoom in steps of
  10%, from 50% to 200%, and ⌘0 returns to 100%. With the keyboard in the page
  (the editor, its sheet, bar or colophon), they zoom the page alone: the
  sheet, its margins and its line, the panes keeping their size. Anywhere
  else (the sidebar, the list, nothing chosen) they zoom the whole interface,
  every pane, as a browser zooms (Electron's own zoom). ⌘0 puts back
  whichever ⌘+ would change there. Both are per device. The colophon shows the
  page's zoom when it isn't 100%, as it's the page's; the interface's shows in
  its own size, and in Settings → Look → Appearance. The phone has the page's alone.
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
  That's macOS's: Settings → Writing → Editor → Spellcheck, or Edit → Check Spelling
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
  vault/        ✓ entries, the folder tree, .eien-folder.json (order, book), pins, a note's own images (.assets)
  saving/       ✓ what to do when a note changes on disk
  format/       ✓ the formatting commands: inline marks, line formats, links, their keys
  config/       ✓ the settings schema, defaults, reading and writing settings files (§6)
  counters/     ✓ today's tally (net, per day) and a sprint's clock
  themes/       ✓ colours and contrast, the gallery, the mix (fitInk), the tokens a theme sets and their check, a theme's file (§7)
  markdown/     ✓ Eien's Markdown (==highlight==, [[wiki links]], footnotes) and a note's plain text
  note/         ✓ a note's preview, words, tags and id
  tags/         ✓ tag extraction and the tag tree
  search/       ✓ folding (case, accents, quotes), query terms, snippets
  typography/   ✓ quotation marks: curled by what's around them, an apostrophe once it shows, and back
  versions/     ✓ the note's id in its front matter, seal file names, retention, word diff
  html/         ✓ Markdown → HTML (and a book's HTML); HTML (a story site's, Google Docs', Word's, a page's) → Markdown; a page's HTML cleaned to what words need, by the caller's rules
  export/       ✓ a note as a chapter (headings, footnotes); EPUB, Word and the PDF's page; a store-only zip
  import/       ✓ which files of a folder from elsewhere come in, under what names, and why the rest don't
  extension/    ✓ the browser extension (Eien Reader): its story, its sites, its messages, where you stopped, its rules for cleaning a site's HTML (§14)
  epub/         ✓ an EPUB read safely: its zip (capped, no path out), its package and contents, a chapter cleaned with its parts named, the reading state's file and its place, a chapter's neighbours and how far through (#40)
src/platform/
  bridge.ts     ✓ what the window may ask of the system (window.eien)
  storage.ts    ✓ the Storage interface: read, write, list, watch
  inflate.ts    ✓ raw deflate inflated by the system's DecompressionStream (an EPUB's zip)
  electron/     ✓ Storage over Node fs: durable writes, the watcher, crash recovery
  memory/       ✓ Storage in memory, for tests
  index/        ✓ the vault's index over any Storage: previews, words, tags, search
  capacitor/    ✓ Storage over the phone's file system: writes through a temp file (on iOS coordinated with other apps), case-only renames in two steps, trash in .eien/trash, polling for changes, recovery after a crash
  case-twin.ts  ✓ no storage makes a name its folder has in another case
  theme-files.ts ✓ the writer's own themes in .eien/themes: list, read, create, write, rename, trash (§7)
  extension/    ✓ the extension's browser API and what it keeps in the browser's storage (§14)
src/ui/
  app.ts        ✓ the window: panes, vault and note kept in step
  shell/        ✓ the panes: resizing, collapsing, three or two, kept per device
  sidebar/      ✓ the seal, the search field; library (all, pinned), folders, tags; with two panes the notes; folders renamed in place
  list/         ✓ note list: previews, a book's words, search results, sorts, dragging
  page/         ✓ the sheet, the title (renaming the note), the colophon, the layout's slots
  chrome/       ✓ the controls: commands once, hosts that draw them, the three layouts, tooltips
  icons.ts      ✓ Eien's own icons, inline SVG
  draw-clean.ts ✓ cleaned HTML drawn element by element, never from HTML
  menu/         ✓ the small floating menu: right-click choices, sorts
  notes/        ✓ the open note: autosave, reload, conflict copies
  vault/        ✓ the vault as the window knows it, its panes drawn, the menu's commands, organizing (rename, move, trash, a note's images with it), images dropped or pasted
  welcome/      ✓ before a vault is open
  theme/        ✓ tokens.css (the eight faces, density, frame), the Slate palette, base.css, fonts; wearing a theme, and the writer's own as the window keeps them
  editor/       ✓ CodeMirror, the three views, the selection bar, images, tables in place, Live with its marks hidden, typed quotes, pasted HTML, the writing tools (scene breaks, focus, typewriter)
  versions/     ✓ sealing, Compare, the versions panel, the colophon's last seal
  outline/      ✓ outline cards: a book's chapters as cards on the blotter, reordered by drag or keys
  counters/     ✓ the colophon's today, book and sprint
  settings/     ✓ Settings over the window: categories and tabs, drawn from the schema; the Themes tabs; the look they set on <html>
  phone/        ✓ the phone's layout: one pane at a time, back; the layout's tools for the page
  extension/    ✓ the extension's pages: the story page, the popup, the content script and each site's markup (§14)
  epub/         ✓ an EPUB's page (#40): a chapter a sheet with its pictures and its foot, the place kept to the line, its kind of page, the reading state's store, the book's stylesheet and scroll style; in pages (3b), its fore-edge, keys and taps, and the page turn (epub/turn/)
src/app/
  electron/     ✓ main process, preload, window, menus, the vault and settings sessions, saving and printing exports, importing a folder
  mobile/       ✓ the phone's preload (window.eien over Capacitor), the vault's place and Android's access, the back gesture
  extension/    ✓ the extension's manifest (§14)
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
- The window writes bytes only as a new image a note shows (one dropped or
  pasted), where nothing is, no bigger than 32 MB (`platform/image-write.ts`,
  checked by the main process and the phone's vault). Everything else it
  writes is text, through the version check.
- Pasted HTML (phase 8) goes through a sanitizer; scripts, event handlers and
  remote content never run.
- An EPUB (#40) is read, never written, and read as hostile: its zip by Eien's
  own reader (`core/epub`), its directory checked whole before anything is
  inflated (no name that isn't a clean path inside it, none twice, every size
  within the caps: the file 32 MB, a text entry 8 MB, a picture 32 MB, 256 MB
  in all, 100 times its stored size past 64 KB), and each entry stopped at its
  declared size as it inflates (its stored bytes fed to the system's
  inflater 4 KB at a time, so a lying header can't make more than a step
  past it), its CRC checked. A book locked with DRM is
  refused, and Eien says so. Its chapters are cleaned by the extension's
  cleaner under the book's rules (pictures only from its own zip, links keep
  their words) and drawn element by element; nothing in a book runs or
  reaches the network.

### Stack

| Need | Choice | Why |
|---|---|---|
| Desktop | Electron | One web UI on all three desktops |
| Mobile | Capacitor | The same UI on Android and iOS |
| Language | TypeScript, strict | Catches mistakes before they run |
| Build | Vite | Fast, small configuration |
| Editor | CodeMirror 6 | Proven Markdown editing, live preview through decorations |
| Rendering | The editor's own parse (Lezer) | Live and Reading style the text in place, so there is no second parser to disagree with the editor. Copy as HTML is phase 8 |
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
  description: 'As you type them, and in what Copy as HTML gives. Code keeps its own.',
  scope: 'vault',              // 'vault' travels with the notes; 'device' stays on this device
  group: 'Writing',            // its tab in Settings (here under This vault)
  type: 'choice',
  choices: { curly: 'Curly “ ”', straight: 'Straight " "' },
  default: 'curly',
}
```

Settings, the defaults, validation and storage all come from that one
list. Adding a setting means adding one entry. A setting joins the list in the
phase that builds what it changes, so the screen never offers a switch that
does nothing.

- **Vault settings** live in `.eien/config.json`: chapter numbers (i ii iii or
  1 2 3), quotation marks and the scene break in copied HTML. Settings shows them apart,
  under This vault. The vault's watcher
  reports this one hidden file, so a change from another device shows at once.
- **Device settings** live in `settings.json`, never in a vault: in
  `Documents/Eien` for an installed copy, in a portable copy's "Eien Data" beside
  it (`src/app/electron/data-folders.ts`). They hold the scheme
  (day, night or the system's), palette, the layout (band, slip or running
  head), text face, text size (90–130%), line spacing and page width (each a
  step either side of the face's own, §6, A quick look), the shelf's own
  look (#40: each of those page settings again under `epub.<key>`),
  density (comfortable or compact), page frame (sheet or full), the page's
  zoom and the interface's (each 50–200%), the interface font, the Source
  font, the weight of the sidebar's names and the list's titles, the Running head's
  ground, panes (three or two), focus mode, typewriter scrolling, the formatting bar,
  whether Live shows the Markdown marks, whether the front matter's tags and id are
  hidden, how a link shows its tools (Link editing, §4), spellcheck (macOS), and on
  the phone how a wide screen is used (§10). A
  setting's default may be a phone's own (`phoneDefault` in the schema: Link editing's
  Bar); there, any choice is written, as the desktop's default isn't the phone's. A
  setting may be one system's alone (`platforms` in the schema): the screen shows it
  only there. A setting that needs panes side by side (`wide` in the schema: Panes,
  Shut sidebar, Arranging, the formatting bar, Page width) shows only while the window has them,
  and comes and goes as that changes (a phone turned, a foldable opened, Wide screen
  set).
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
- Zoom (⌘+, ⌘−, ⌘0, and the View menu) is two settings, as §4 says: the
  page's (Page zoom) scales the sheet only, with its margins and line, the
  panes keeping their size; the interface's (Interface zoom) scales
  everything, as a browser zooms: laid out again at the width it leaves, so
  a smaller zoom is more room (a Galaxy Z Fold 5 sideways at 80% lays out at
  about 880px, not 706, and its Wide screen room follows). The desktop's is
  set by the main process on the window; a phone's by the page's viewport
  (`ui/settings/viewport.ts`; Android's WebView reads it as a browser does
  with its wide viewport on), never smaller than chosen (the app takes no
  pinch). Text size scales the text face everywhere.

### Settings over the window

Settings ([settings.md](design/explorations/settings.md)) opens over the
dimmed window (⌘, or the settings control) as a sheet of raised paper at a
larger inset (64px above and below, 112px at the sides).

- **It moves and resizes** (`ui/settings/box.ts`, `frame.ts`): its head
  moves it, its edges and corners resize it (the corner also by the arrow
  keys), always inside the window and never smaller than 560 × 380. A move
  never resizes. Its box is this device's (the window's own storage), and a
  double-click on its head puts it back where it first opens.
- **Its side column holds categories**, each a label in the machine voice
  over its tabs (`ui/settings/places.ts`); each of the schema's groups is a
  tab:

  | Category | Tabs |
  |---|---|
  | Look | Appearance, Type, Page |
  | Themes | Gallery, Custom (§7) |
  | Writing | Lists, Editor |
  | This vault | Writing |

  **This vault** holds the vault's own settings (those whose scope is
  `vault`) and nothing else, and says they're kept in its
  `.eien/config.json`. A tab with nothing offered here (Lists on a phone)
  isn't shown.
- **Its head is a breadcrumb**, `SETTINGS / CATEGORY / TAB`. It opens on the
  tab last shown, the keyboard on that tab's name.
- A setting is its name, what it does, and its control: choices in a
  segmented well (words, or icons with names), the faces as cards set in
  each face, the Running head's ground as swatches of the theme's surfaces,
  a weight's four steps, or a stepper. Every control is a button, a field or
  a slider, so the keyboard reaches each one. The Type tab opens with a line
  of running text.
- **Esc** closes it (unless it's putting back a name being typed), as does a
  click on the dimmed window, and gives the keyboard back to what opened it.
- **On a phone** it's a full sheet: the tabs in one strip under the head,
  nothing to move or resize; the phone's back closes it first.

### A quick look

Backlog #49 ([look.md](design/explorations/look.md), 1 · On the bar;
[docs/quick-look.md](quick-look.md)): the look's everyday settings, in reach
without Settings.

- **The control** is **Look** (the Aa icon, ⇧⌘L, View → Look…), the page's
  last tool after a hairline in each layout (before Band's and Slip's strip),
  on a phone in the layout's bottom before the ⋯, and in the ⋯. Short of room
  it folds after Focus; folded, the ⋯'s Look opens it under the ⋯.
- **The popover** hangs under the control, its end lined up with it, as wide
  as the list; on a phone (one pane at a time) it's a sheet from the screen's
  foot, no scrim, at a finger's size, with Done. Its head says whose look it
  sets: LOOK / NOTES, *every note*.
- **What's in it** is what the schema marks `quick`, in its order, drawn by
  Settings' own controls with their names alone: Day or night (marked
  `window`: *every page*), Typeface, Text size, **Line spacing** (Tight, As
  set, Loose: × 0.9, 1, 1.12 of the face's leading) and **Page width**
  (Narrow, As set, Wide: × 0.84, 1, 1.18 of its measure), and Page (sheet or
  full), each marked `page`. A setting marked later shows there with nothing
  else to build. Page width needs room round a page (`wide`): a phone's page
  already fills its screen, so it isn't offered there. Narrow also narrows a
  sheet that fills its pane; Two sheets and Facing pages lay each page to
  its half, which it doesn't change.
- **A change shows at once**, nothing to confirm; the popover stays open,
  Day or night turning the window with it. All settings (⌘,) at its foot
  opens Settings at Look.
- **The keyboard:** opened, it's on the first setting's chosen value. Each
  setting is one stop: Tab and ⇧Tab go round them and All settings; arrows
  choose at once (↑ ↓ a row of the faces); in the stepper they move between
  − and +, which Enter and Space press. Esc, the key again, a click
  elsewhere or the phone's back closes it, the keyboard back where it was
  (the control, if it was pressed). Choosing the other page, or the keyboard
  going on into it, closes it. With the band or slip put away, it hangs under
  the strip's control.
- **Whose look:** the active page's. With a note in front, the notes'
  (LOOK / NOTES, *every note*); with a book (#40), the shelf's (LOOK / SHELF,
  *every book on the shelf*): the same `page` settings, kept again on this
  device under `epub.<key>` (`core/config/epub-look.ts`: no copied entries;
  Settings doesn't draw them), with a book's own beside them (the scroll
  style, `quick: 'shelf'`), and worn on the book's page alone, so a
  note's look never changes a book's, nor a book's a note's. Day or night is
  the window's, whichever; so is the frame while two pages share the pane.
  All settings opens Settings at Look, the notes': the shelf's look is set
  here alone, and with a book in front one line at the popover's foot, in
  pencil, says so: "Settings sets notes; this is every book's look." The
  sidebar's sun stays: one press for Day or Night.
- **A note and a book side by side:** while the look is open, the page it
  doesn't change sits back, in the tone the split gives the page you aren't
  in: its paper takes the band's (`data-back` on its leaf). Two notes, or
  two books, wear the one look, so neither sits back. With a companion, the
  look opens for the page itself, which becomes the one you're in.

### Type and the Running head

- **Faces:** one list, `core/config/faces.ts` (FACES), feeds the three face
  settings: Typeface (the eight text faces), **Interface font** (labels,
  buttons, counts and the status bar) and **Source font** (the Source view's
  Markdown, and code), each IBM Plex Mono by default or any face in the list:
  eleven monospaced faces (IBM Plex Mono, JetBrains Mono, Fira Code, Cascadia
  Code, Source Code Pro, Iosevka, Commit Mono, Space Mono, Victor Mono,
  Monaspace Radon, Comic Mono) and the eight text faces. Each face carries its
  own machine sizes (counts, labels, the Source view), so any face reads at
  Plex Mono's size; its family is one token in `tokens.css`
  (`--eien-family-<id>`). The monos other than Plex Mono bring only their
  Latin and Latin Extended files (`ui/theme/monos.css`). A face added later is
  one entry there, and its tokens.
- **Weight of names:** two settings, 400 to 700: the sidebar's names
  (`--eien-weight-tree`) and the list's titles (`--eien-weight-list`). A
  chosen list title is 100 heavier, at most 700 (so 500 at the default); the
  sidebar's chosen name is not heavier.
- **Running head:** the Running head layout's strip takes one of the
  theme's own surfaces as its ground (desk, the default; blotter, band,
  paper or selected), so it follows any theme.

---

## 7. Themes

- All colors, fonts and sizes are CSS custom properties named `--eien-*`,
  defined once in `src/ui/theme/tokens.css`. The list of names is the theme
  contract, documented in `docs/design/README.md`. A rename is a breaking
  change.
- Token groups, each clearly labeled: **surface** (desk, paper, panel),
  **ink** (text, muted, faint), **lines**, **accent**, **status**, **type**
  (prose, interface, mono), **size**, **space**.
- **A theme is colours only**, by day and by night: the five surfaces (desk,
  blotter, band, paper, selected), the four inks (ink, ink-soft, pencil,
  faded), the seal (one per theme: a theme may change its colour, and still
  nothing else is that colour) and the status inks (added, removed,
  caution). The rules, the washes, hover and press, and the raised and well
  grounds are worked out from them (`core/themes/tokens.ts`). Faces, sizes
  and spaces stay Eien's.
- **Eien's contrast** (WCAG), which every theme keeps by day and by night:
  ink, ink-soft, pencil and the status inks reach 4.5:1, faded and the seal
  3:1, on each of the five surfaces (`core/themes/contrast-rules.ts`). The
  verdict says so in words, or names the first colour that falls short.
- **The gallery**, Eien's own (`core/themes/gallery.ts`): Paper (the
  default, tokens.css's own colours), Linen, Indigo, Moss, Candlelight, Ink,
  Blossom, and Slate (its own sheet,
  `slate.css`, from the Otaku design). Each keeps Eien's order of surfaces (darker is further
  back) and its contrast.
- **Your own themes** are one file each in the vault's `.eien/themes/`, so
  they sync with the notes. The file is named for the theme, as a note is
  for its title (a name compared as the storage compares names: no two
  differ only in case), and holds the name and the four choices it's mixed
  from:

  ```json
  {
    "name": "Late Train",
    "mix": { "paper": 215, "warmth": 10, "ink": 225, "seal": 8 }
  }
  ```

  Paper, ink and seal are hues (0–360), warmth the paper's saturation
  (0–40). Every other key in the file is kept when Eien writes it. A choice
  missing or out of range takes the first mix's, with a warning in the log;
  a file that isn't a JSON object is worn as Paper and never written over.
  A theme is made, saved, renamed (the file is renamed) and sent to the
  trash through the Storage contract (`platform/theme-files.ts`), so its
  file is never lost, only sent where it can be taken back. The watcher reports the folder's
  files, so another device's change shows at once.
- **The mix** (`core/themes/mix.ts`) works every colour out from the four
  choices: the surfaces from the paper's hue and warmth (the night's warmth
  stops at 22), the inks from the ink's hue, the seal from its own. Each
  ink, the seal and the status inks are **fitted** (`fitInk`): they start
  where they should sit and step darker by day, or lighter by night, until
  every surface reaches their contrast (the writing itself 7:1). So every
  mix keeps Eien's contrast; property tests hold it.
- **Which theme is worn** is the Palette setting (`appearance.palette`,
  this device's): a gallery theme's id, or `mine:` and one of your own
  themes' names. Paper is worn by tokens.css and Slate by `data-palette`;
  every other theme is its colour tokens set as overrides on `<html>`
  (`ui/theme/wear.ts`), and only known colour tokens whose values are
  `light-dark()` of two colours are applied (`safeTokens`), so a theme
  can't break the layout or run code. One of your own that isn't there (no
  vault open yet, another vault, a file being edited) is worn as Paper.
  Renaming the theme worn moves the setting with it; sending it to the
  trash wears Paper.
- **Settings → Themes** has two tabs (`ui/settings/themes-tabs.ts`), and a
  theme chosen in either is worn on the whole window at once:
  - **Gallery:** Eien's own, as cards (desk | paper with ink | night paper
    with the seal; the name, a note).
  - **Custom:** the writer's own, a card for each file in `.eien/themes`
    (its colours worked out from the file's mix; one that can't be read says
    so), and a "New theme" card, which makes `Untitled.json` (numbered when
    taken), wears it and puts the keyboard in its name. The custom theme worn
    opens its mix (`ui/settings/mix-panel.ts`): its name, renamed in place
    (Enter keeps, Esc puts back; a taken name is refused and said); its file;
    the trash; its colours by day and by night; four knobs (paper, warmth,
    ink, seal) whose tracks show the colours they choose between; and the
    contrast verdict. A knob's mix is worn as it turns and written a moment
    after it rests (`WriterThemes.preview`, then `save`, one write after
    another), so a read of the file meanwhile never takes it back.
  - There's no "from a file": Custom writes the files.
- All fonts are bundled. Nothing is fetched from the web.

---

## 8. What leaves the app, and what comes in

### Copy as HTML

Story sites and many editors take only HTML. Eien keeps notes in Markdown and
converts at the edges.

**Copy as HTML** (and Export → HTML) produces:

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
web, mail and relative addresses only), images, code and tables go as story
sites take them; a highlight and a wiki link go as their words. A table cell's
`\|` goes as a pipe, in its code too, as GFM reads a cell. The front matter is
never posted.

Edit → Copy as HTML (⇧⌘C, Ctrl+Shift+C) copies what's chosen, or the whole
note, as text (for a site's HTML box) and as HTML (for a rich text box). File →
Export HTML… saves the whole note through the system's save dialog, under
the note's name. An empty note copies nothing and says so.

**Paste from HTML** turns it into Markdown:

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
- What would read as Markdown in the words is escaped, and only that, so the
  note shows what the page showed and reads as it did: Eien's own parser
  reads each pasted block, and a `[ ] * _ < ~ ^ = & ! \` or backtick of the
  page's that it reads as a mark is escaped. `[1]`, `[sic]`, `a < b`, `5 * 3`
  and `x^2` stay as written; `*word*`, `<b>`, `[a](b)` and `[^1]` in the words
  are escaped. A page's brackets round its links (Google's citations,
  `[[1](…), [2](…)]`) stay as written. Should that ever show other than
  escaping all of them, all are escaped.
- A link's or an image's address keeps its backslashes: each is escaped, so
  none is read as an escape and the link stays a link.
- List items a page wraps in `<div>`s or `<span>`s inside its list (Google's
  answers) are the list's items.
- A code editor's copy (all of it in one `<pre>`, or one block set in a
  fixed-width face or `white-space: pre`) pastes as its plain text, and so
  does anything pasted into code. So does Sublime Text's Copy as HTML (one
  block kept as typed, `pre-wrap` with its `tab-size` set, in any face): its
  words as typed, as its plain text is the same HTML.

**Typing:** with curly quotes, a quote opens at a line's start and after a
space, bracket, dash or slash (emphasis marks and an opening tag before it
don't count) and closes elsewhere; in a word it's an apostrophe. An opening
single quote becomes an apostrophe once what's typed after it shows it is one:
a year (`'90s`) or an elision (`'tis`, `'em`, `'cause`, `rock 'n' roll`). In
code (or code being typed), an address, an HTML tag and the front matter,
quotes stay as typed.

A round trip, Markdown → HTML → Markdown, gives back the same text. Tests prove
it, including on real output copied from a story site.

### Exports: EPUB, Word, PDF

- **What:** File → Export Note ▸ EPUB…, Word (.docx)…, PDF… exports the open note.
  File → Export Book ▸ the same three exports the book the open note is a
  chapter of, or, with none open there, the book chosen in the sidebar (as
  Outline Cards finds it); with no book, one line of news says so. A note's
  menu has Export… (HTML, EPUB, Word, PDF) for that note, open or not, and
  a book's folder menu has Export… (EPUB, Word, PDF).
- **Where:** saved where the writer chooses, through the system's save
  dialog, offering the note's or the book's name, as Export HTML is. A
  note with no words, or a book with no chapters, exports nothing and says so.
- **A book** is its folder's notes in the book's order (§2), each a chapter;
  notes in its subfolders and Syncthing's conflict copies aren't chapters.
  The book's title is the folder's name. The open note goes as it is on the
  page, words not yet saved included.
- **A chapter's heading** is its note's title, unless the note begins with a
  top-level heading (`# The Scarf`): then that heading is the chapter's, and
  isn't shown twice. Each chapter starts a new page.
- **The Markdown** converts as Copy as HTML converts it (the table above,
  quotes as the vault's setting, front matter left out, a note's own HTML as
  story sites take it), with these differences, the same in all three formats:
  - `==highlight==` is highlighted (`<mark>`; Word's yellow highlight).
  - A scene break (`***`) is a centred `* * *`; the paragraph after it, or
    after a heading, isn't indented.
  - Links go to the web and mail only; a link to anything else (another note,
    a file) is its words, and a `[[wiki link]]` is its words (after a `|`,
    its alias, as Copy as HTML has it).
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
their images) and HTML go to `Eien/Exports` beside the vault's folder (Documents on Android;
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
  checkpoint ("No changes since the last version"); a checkpoint dated ahead (another
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
  the note starts a new line). With Hide tags and IDs on (§4), every view
  keeps the `id:` line out of sight, and the `tags:` lines too.
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
  replaced. The note keeps its own id. A Restore under way when another note
  is opened (a slow disk) still finishes, in its own note's file, never on the
  page; the news says so.
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
  phone's, whatever the system.
- **Wide screen** (backlog #46; `appearance.room`, Settings → Look →
  Appearance, the phone's alone, this device's): wider than a phone held
  upright (520 px; a Galaxy Z Fold 5 opened upright is about 590), the phone
  uses the room as the writer chooses (a foldable opened, a tablet, a phone
  turned sideways) ([tablet.md](design/explorations/tablet.md)). The rules are
  `src/ui/phone/room.ts`; the desktop is always Panes.
  - **Panes** (the default, as before): the desktop's three panes, or two, and
    the split, as on the desktop, with every control and row a finger's
    (`--eien-touch`, 44 px; a compact row 36 px) where a finger is the
    pointer. They need the desktop's 600 px: narrower, one at a time. Tools
    that don't fit their bar scroll in it under a finger; the page never runs
    past the screen, and a phone's browser never zooms out to show it.
  - **One at a time:** the phone, wider.
  - **Side by side:** the phone's way, with the pane you came from kept in
    sight beside the one you're in: the notes beside the page, the contents
    beside the notes. Back moves the pair a step, naming what it brings into
    sight; with the contents in sight there's nothing to go back to. The pane
    beside the page keeps its own width (the sidebar's or the list's, as on
    the desktop), dragged by its edge (a finger wide) and remembered, giving
    way so the page keeps 240 px.
  - **Two pages:** the phone's way, but the page stays in sight: the notes and
    the contents slide over it from the left (the bar's back word brings them,
    and goes on through them to the contents); a tap beside them, or Android's
    back, puts them away (the page under them takes no keys or taps till then). A
    second page opens, laid out as Split says (Facing pages: an open book):
    the second note chosen from a list opens beside the first, and with two,
    a note chosen opens on the page you're in (`opensBeside`,
    `ui/phone/room.ts`); where two don't fit (Tools that follow, too narrow),
    it opens on the one page. A note opened any other way (a link followed,
    an outline card, a rename, a new note, a drop on the page) opens where it
    was asked for. The note you came from (⇄) opens beside this one too, and
    a note's long press offers Open to the Side. Short of the split's room (a
    Fold 5 upright, about 590 px, under Two sheets' 720), the two fold into
    the page you're in, and the bar names both, a tap turning to the other.
    **Two pages when narrow** (`appearance.narrowPages`, the phone's, this
    device's, off by default) keeps them side by side however narrow, in
    every Split mode, each half the room while it's short of the mode's own
    (the divider moves them again once there's room).
    The notes over the page are never under its scrim.
  - Folding, turning the phone, or choosing a room with one page closes the
    page you're not in, never its note: it's the other note, ⇄, where it was
    left. Whatever room, the pane you were at stays. In a room with one page,
    Split Page (⌘D, from a keyboard) opens nothing; a split still closes.
    (A desktop window zoomed under 600 px keeps its split for when it widens.)
  - It opens on the notes. Choosing a folder or tag shows its notes; opening
    a note shows the page. A bar above the pane goes back, naming where
    ("‹ Fic", "‹ Library"); leaving the page closes what lay over it.
  - No split and no New Window: the phone shows one page (but with Wide
    screen's Panes or Two pages), and, but for those, its menus offer neither. Instead, with
    the page in sight, the bar keeps the note
    you came from a tap away at its right (⇄ and its name): a tap goes back
    to it where you left it (its caret and how far it was scrolled), and the
    one you were in becomes the other note.
    Android's back gesture first closes a menu or the settings, then does
    what Esc does where the keyboard is (a rename being typed stops, keeping
    nothing), then closes what lies over the page (Compare gives the draft
    back, the outline cards, the versions), then goes back a pane; at the
    tree it leaves Eien in the background.
  - The page's ⋯ offers what the menu bar does on the desktop: Seal,
    Compare, Versions, Outline cards, Copy as HTML, Export… (the note's own
    choices), Focus mode, Typewriter scrolling, a sprint (Stop while one is
    under way), Settings. The views, Focus mode and the ⋯ itself are the
    layout's phone bottom (§4, Layouts): in the top bar, on a floating slip,
    or in a rail at the page's foot.
  - On a touch screen, the page gives its title the keyboard rather than the
    editor (opening a note to read, closing what lay over it), so the
    phone's keyboard stays down; when the title is the note's own heading,
    the keyboard leaves. A new note goes straight into the editor.
  - Turned sideways or upright, the keyboard on something gone from sight
    goes to the pane in sight, or to the page.
  - A finger scrolls a list, and never lifts a row: a note moves by its menu
    (a long press: Move up, Move down, Move to…), an outline card by its own
    (Move earlier, Move later). Two panes aren't offered, here or in the
    settings: one shows at a time. The tree's seal goes on a step: to the
    notes, or side by side, past them to the page.
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
- **HTML:** the real sample from a fic; every table row both ways;
  property-based round trips over generated documents (fast-check).
- **Exports:** footnotes, headings and the book's differences from copied HTML; over
  generated notes, every EPUB part and every Word part is well-formed XML with
  its prefixes declared, and every word of the note is in each; the zip read
  back by a strict reader and by `unzip`.
- **Import:** names kept, numbered or refused; sizes, kinds and limits.
- **EPUB (#40):** the zip reader (stored and deflated entries, data
  descriptors, the CRC, every cap, a header that lies), names and addresses
  that would leave the zip, the package, nav, NCX and page-list, DRM refused,
  the cleaning rules (pictures, links, Calibre's SVG plates, the named parts),
  the reading state's file and its place (an offset paired with its
  chapter), a chapter's neighbours and how far through, the book's own links
  (only to a chapter, an address of the page's own, read back only as one)
  and the places they name (empty markers, never an id; hostile ids and
  links in `links-hostile.epub`), a note and its reference named; over any bytes, a
  book or a reason and never past a cap; a place's round trip and how far
  through never falling as you read on; and the fixture books (`tests/fixtures/epub/`, made by
  `scripts/epub-fixtures.mjs` from Pride and Prejudice and Hugh Thomson's
  1894 illustrations), held to the bytes their script makes.
- **Versions:** naming, sorting, retention at day and month boundaries, time
  zones, names with forbidden characters.
- **Settings and themes:** every invalid value falls back; unknown tokens and
  CSS injection attempts are rejected; every gallery theme and every mix
  (property tests, and the knobs' grid) keeps Eien's contrast by day and by
  night; a theme file reads back as it was written, unknown keys kept.

### Storage contract

One test suite runs against every `Storage` implementation (memory, Electron's
Node fs), so they behave the same:

- durable write; a crash between write and rename; a leftover `.tmp`
- a new file's bytes (an imported image) written only where nothing is,
  even something that arrived a moment before
- a file changed on disk while open; deleted while open; renamed while open
- a read-only file; a full disk (simulated); a permission error
- the writer's themes in `.eien/themes`: made (numbered when the name is
  taken in any case), listed, saved with unknown keys kept, renamed (a name
  another has refused), sent to the trash, never written over when unreadable

### End-to-end (Playwright, the real Electron app)

On macOS, Windows and Linux, each with a fresh temporary vault:

- create, type, quit, relaunch: the text is on disk and back on screen
- another program edits the open note: it reloads, or a conflict copy appears
- checkpoint, edit, cycle the compare button through all three states
- paste the story site's sample; Copy as HTML matches the expected HTML
- export a book and a note as EPUB, Word and PDF through the menus, read back
  from the files saved; import a folder, and the notes appear beside the
  vault's own, nothing written over
- switch theme, quotes and pane layout; settings survive a restart; Settings
  moved, resized and kept; a custom theme made, worn, renamed and trashed
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
7. The browser extension (Eien Reader) in Chromium, its build kept for 14
   days to load in a browser

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
| 8 | HTML and typography | Copy as HTML, paste from HTML, quote setting |
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

## 14. The browser extension (Eien Reader)

A browser extension that shows a story from a fanfiction site on Eien's
paper: its sheet on the blotter, its typefaces at their own sizes and
measure, its themes by day and night. It reads; it never writes to a vault,
and it never fetches anything.

- **Where.** Chrome, Edge, Brave and Firefox (desktop, and Firefox on
  Android), from one Manifest V3 build (`npm run build:extension`, into
  `out/extension`). The sites are AO3 (`archiveofourown.org`) and
  FanFiction.Net (`www.` and `m.fanfiction.net`), listed once in
  `core/extension/sites.ts`, which the manifest and the content script read.
  Safari (Mac and iPhone) is later: it needs Xcode and an Apple developer
  account.
- **What it asks for.** Storage, and the sites' pages: nothing in the
  background, no other host, no network use of its own.
- **Opening.** On a page that shows a work (one chapter, or the whole work
  at once), the seal stands in the page's bottom-right corner. Pressing it,
  or Read in Eien in the extension's popup, lays the story page over
  the site's. The story page stays open as chapters turn, until it's closed
  (its ×, or Esc), and then stays closed until it's opened again. A page
  with no work (a search, AO3's question before a work for adults) gets no
  seal.
- **The story page.** A band (the seal and the site's name; previous and next
  chapter, day or night, back to the site's page), then the sheet: the
  running head (fandom / title / chapter), the title, who wrote it, what the
  site says of the work (rating, warnings, tags, words; folded), the
  summary and notes, each chapter (its number in the chosen numerals, its
  own title, its notes beside its words), and the turn to the next chapter.
  The colophon says the chapters' words, which chapter of how many, and how
  far down the page you are. ← and → turn the chapter. Kudos, comments and
  the rest of the site are on the site's page, a press away.
- **Settings.** The popup offers Eien's own settings, from the one schema
  (§6), drawn as Settings draws them: the theme (the gallery's), day or
  night, the typeface, text size, density, page and chapter numbers. They're
  kept in the browser's synced storage, so each of its devices reads alike,
  and every open story page wears a change at once. A theme of your own from a
  vault isn't the browser's to read, so it's Paper here.
- **Where you stopped.** How far down each chapter you read is kept on this
  browser (the 500 newest), and a chapter opens there again.
- **Safety.** The site's HTML is read by Eien's own parser and kept to what
  words and their shapes need (paragraphs, emphasis, quotes, lists, tables,
  scene breaks, links to the web, images over https); the extension builds its
  page from those nodes, never from HTML, under a policy that runs only the
  extension's own scripts. Its page is the extension's, in a frame: the
  site's styles and script don't reach it. It asks the content script only
  for a turn (previous, next, a chapter, the site's page), never for an
  address, and the content script acts only on its own frame's messages.

## Open questions

1. ~~HTML scene break: keep the spacer, `<hr>`, spacer pattern as the
   default?~~ Yes: `<p><br /></p><hr /><p><br /></p>`, so the sections
   breathe (2026-10-20).
2. ~~Default sort for the note list: modified date, or title?~~ Neither: your
   own order, with the sorts laid over it like a filter ([backlog](backlog.md)
   #12, 2026-10-20).
3. ~~Today's word count: words added only, or net (added minus deleted)?~~
   Net, as the design shows it ("Today +809").
