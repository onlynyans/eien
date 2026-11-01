# Eien — notes for agents

Read [docs/spec.md](docs/spec.md) first. It is the source of truth for behavior;
when code and spec disagree, fix one of them in the same change. New to the
project? [docs/handbook.md](docs/handbook.md) is the way in: what Eien is, how
it's built and shipped, and where everything lives.

## Words

Each feature has one word, in code, files, CSS and docs:

- **extension**: the browser extension (Eien Reader, spec §14), in
  `src/core/extension/`, `src/platform/extension/`, `src/ui/extension/`,
  `src/app/extension/` and `tests/extension/`. "Eien Reader" is only the name
  users see (the manifest, the popup's title, the frame's title).
- **epub**: the EPUB reader in the app (backlog #40), in `src/core/epub/`
  and `src/platform/inflate.ts` (Phase 1a: reading a book safely); its
  designs are `docs/design/explorations/epub-*` and `epub.md`.
- **reader**: only a person reading. No folder, file or CSS class is named
  for it (`tests/words.test.ts`).
- **book**: a folder made a manuscript, its notes the chapters.

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
- **Data formats.** A new file Eien keeps (in `.eien/` or beside a note)
  starts with `"version": 1`; a change an older Eien would misread is a
  breaking one. Spec §2 → Formats.
- **Settings** are added only in `src/core/config/schema.ts` (a book's look
  derives its own from them, never copied: `config/epub-look.ts`). **Theme tokens**
  only in `src/ui/theme/tokens.css`, documented in `docs/design/README.md`.
- **How something looks** is decided by `.interface-design/system.md` first,
  then each exploration's Decided section (`docs/design/explorations/*.md`),
  then the code (`src/ui/theme/tokens.css` for tokens). The mockups at the top
  of `docs/design/`, with their `tokens.css`, are a 2026-10-20 snapshot, kept
  for their reasoning and never copied from.
- **Verify, don't assume.** Every behavior change comes with a test that would
  fail without it. Check library APIs and versions against the installed
  package, not memory.
- **No code from NEO or Otaku.** Eien is written from scratch.
- **Dependencies** are listed in `docs/dependencies.md` with the reason for each.
  Prefer a few lines of code to a new package.
- **Comments say why**, not what.

## Layout

<!-- Each module or concept has a line of its own, so pull requests that each
add one touch different lines and don't conflict. Add a new module as its own
line, in its place; don't join lines or wrap them. -->

### `src/core/`

Rules, pure TypeScript.

- `paths`
- `text`
- `vault`
  - `tree.ts`: the folder tree, and which folders FOLDERS (`inFolders`: all but a folder of EPUBs alone, at any depth) and SHELF (`onShelf`) list (#40)
  - `assets.ts`: a note's own folder of images, `<note>.assets`, its links and the names images are kept under
  - `subfolders.ts`: a folder's list with its subfolders' notes, in groups
- `saving`
- `format`: the formatting commands
- `table`: a GFM table
  - `line.ts`: its lines read and written back as they were
  - `table.ts`: its cells and the keys between them
  - `edits.ts`: the table editor's changes
  - `cell-input.ts`: what's typed into a cell
- `config`: every setting, and its files
  - `faces.ts`: FACES, the one list the three face settings (Typeface, Interface font, Source font) choose from, each face with its machine sizes
  - `epub-look.ts`: a book's own look (#40), each setting a page wears again under `epub.<key>`
  - a setting's default may be a phone's own (`phoneDefault`, `PHONE_DEFAULTS`: Link editing's Bar)
- `markdown`: Eien's Markdown and a note's plain text, shared with the editor
  - `link-source.ts`: a link written: an address or a note's name, `[words](address)` or `[[note|words]]` (#38)
- `note`
  - `note-tags.ts`: its tags in two kinds, front matter's and the text's
  - `tag-id-lines.ts`: front matter's `tags:` and `id:` lines, which Hide tags and IDs keeps out of sight
- `tags`
  - `front-tags.ts`: the page's edits to front matter's `tags:` alone
  - `choices.ts`: what the page's tag field offers
- `search`
- `versions`: ids, seal files, retention, the word diff
- `typography`: quotation marks
- `counters`: today's tally, a sprint
- `html`: Copy as HTML and Paste
  - `to-html.ts` writes blocks round `inline-writer.ts`, and `bookBlocks` the same for a book's exports
  - `inline-tags.ts`: the tags and marks `inline-writer.ts` knows
  - `from-html.ts` reads blocks round `html-inline.ts`, after `tidy.ts` turns styles into tags
  - `marks-in-words.ts` escapes the page's own marks only where Eien's parser reads them as marks
  - `entities.ts`: HTML 4's named references
  - `clean.ts`: a page's HTML kept to what words need, where links go and images come from by the caller's rules, for the extension now and an EPUB later
  - `clean-elements.ts`: the elements `clean.ts` keeps and the parts it names
  - `anchors.ts`: the places a link may name, kept as empty markers before the page is tidied
- `export`
  - `chapter.ts`: a note as a chapter, with its footnotes, which `markdown/footnotes.ts` finds (`markdown/fences.ts`: what's fenced code, line by line)
  - `epub.ts`
  - `docx.ts`, round `docx-body.ts`
  - `docx-runs.ts`: `docx-body.ts`'s runs, paragraphs and pictures
  - `print-html.ts`: the PDF's page
  - `images.ts`: an image's kind and size from its own header
  - `zip.ts`: a store-only zip of Eien's own
- `import`
  - `plan.ts`: which files of a folder from elsewhere come in, under what names, and why the rest don't
- `swipe`
  - `wheel-swipe.ts`: a trackpad's two fingers across, read from the wheel events they come as: far enough, far more across than down, once a swipe (#70)
- `find`: find in the note: its commands' names and keys, for the menu, the editor and the tooltips, and what its count says
- `themes` (spec §7)
  - `color.ts`: hex, HSL and WCAG contrast
  - `contrast-rules.ts`: Eien's contrast and the verdict
  - `gallery.ts`: Eien's own themes
  - `mix.ts`: a writer's theme from four choices, each ink fitted by `fitInk`
  - `tokens.ts`: the `--eien-*` overrides a palette wears, and `safeTokens`, the check on them
  - `theme-file.ts`: a file in `.eien/themes`
  - `choice.ts`: which theme the Palette setting names
- `extension`: the browser extension's (spec §14)
  - `story.ts`: a work as a site's page shows it, checked as it arrives
  - `sites.ts`: the sites, once
  - `clean.ts`: its rules for `html`'s cleaner: links to the web or mail, images over https
  - `messages.ts`: what its pages say to each other
  - `places.ts`: where each chapter was left
- `epub`: an EPUB read safely (#40; the word in code, as "book" is a manuscript folder)
  - `zip-read.ts`: Eien's own zip reader, its directory checked whole before anything is inflated, each entry counted as it inflates and its CRC checked
  - `caps.ts`: how much of a book Eien reads: the file, entries, a text entry, a picture, the total and the ratio
  - `zip-path.ts`: an entry's name a clean path in the zip, and every address a book gives resolved inside it
  - `refusal.ts`: why a book won't open, and the words the window says
  - `utf8.ts`: UTF-8 read back without TextDecoder
  - `xml-text.ts`: a book's XML as text for `html`'s parser (Latin-1 where declared, CDATA kept)
  - `xml-nodes.ts`: that XML's elements found by their local names
  - `package.ts`: container.xml, the package (metadata, manifest, spine, nav or NCX), and a DRM lock refused
  - `contents.ts`: the contents (nav, NCX, or the spine) and the printed edition's pages (page-list)
  - `epub.ts`: a book opened (`openEpub`), its chapters and pictures read as they're shown, and its key
  - `chapter.ts`: a chapter cleaned by `html`'s cleaner under the book's rules
  - `epub-rules.ts`: those rules: pictures from the zip, links to the book's own chapters or the web and mail, the places they name kept, the parts named (a note and its reference too)
  - `svg-plate.ts`: Calibre's SVG frame round a picture made a plain image
  - `picture-page.ts`: a chapter that's only a picture kept to its pictures, nothing above to push them a page on
  - `first-line.ts`: a chapter's first line, by where it stands
  - `reading.ts`: the reading state's file, `.eien/reading/<key>.json`: the chapter, and the place in it paired with it; never written over when it can't be read
  - `reading-list.ts`: a list in that file, changed in its own array, unknown items and fields kept, each field where it stood
  - `bookmarks.ts`: its bookmarks, a list there (Phase 4b)
  - `highlights.ts`: its highlights, a list there, and what H does to them (Phase 5a)
  - `marks.ts`: both kinds in the book's order, and the walk (`]` and `[`, Find's next and previous)
  - `book-text.ts`: a chapter's blocks as Find reads them, by the one walk, each where it begins in the words (Phase 5c)
  - `find.ts`: what's typed made a matcher (as written, or the bar's options), and every match in a chapter's blocks with the words round it
  - `place.ts`: a place in a chapter, an offset in its words, and the piece of text it falls in
  - `progress.ts`: how far through a chapter and the book, as the colophon says it
  - `chapter-words.ts`: a chapter's words walked once from its cleaned nodes, as a place counts them, each in its block (`BLOCK_NAMES`, the one list)
  - `chapter-count.ts`: a chapter's words counted by that walk, and where the printed pages begin in it (Phase 4)
  - `page-numbers.ts`: a place's page: the printed edition's (the page-list), else how far through the book (a row's, the strip's), and as the colophon says it (#67)
  - `chapters.ts`: what a chapter is called, and the chapters either side of it in the reading order
  - `book-link.ts`: a link to one of the book's chapters, as an address of the page's own and back
  - `quote.ts`: a passage quoted into a note, its citation, at the note's end
  - `pages.ts`: a chapter in pages (Phase 3b): whole lines tall, the pages counted, the page a word falls on, the fore-edge's sixths; two pages to a sight where they fit, and each page's part (front matter, opening, text) (Phase 3d)
  - `imprint.ts`: the imprint's words, how long the book is and how it's set (Phase 3d)
  - `turn/`: a page's turn (Phase 3), as numbers the window draws
    - `curl.ts`: the curl's geometry: the roll over a cylinder that follows the corner, the spine held down, a strip laid by its matrix
    - `band.ts`: a piece of the curl as a band across the fold, a box only moved: where it lies, and the page laid back inside it, so a frame is transforms alone
    - `light.ts`: the light on the roll, each strip shaded by how it faces you and ramped across, the same at every moment (the inks are the window's tokens)
    - `curl-frame.ts`: a curling page at one moment, as bands: what stays, the roll's strips, what lies back, the shadow beneath
    - `curl-turn.ts`: a curl's states: begun, held, let go (the throw decides), flying, caught (a tap lets it fly on), finished, put down
    - `spring.ts`: the finish, a critically damped spring that lands and never bounces
    - `stroke.ts`: a key's hand: where it takes the edge, how high and fast it goes, wandering within bounds turn to turn
    - `speed.ts`: each motion's time, from the calm and quick tokens and the Turn speed; 0 is instant

### `src/platform/`

- `bridge.ts`: all the window may ask
- `storage.ts`: the Storage contract, and its `electron/`, `capacitor/` and `memory/` implementations
- `backs.ts`: the system's back asked of the window's handlers, the newest first, for both preloads (#70)
- `inflate.ts`: raw deflate inflated by the system's DecompressionStream, for an EPUB's zip, in the window on the desktop and the phone
- `index/`: the vault's index over any Storage
- `open-vault.ts`: a vault and its index kept in step, shared by the desktop and the phone
- `settings-store.ts`: this device's settings and the vault's, shared by the desktop and the phone
- `image-write.ts`: the one file the window may write as bytes (a new image), checked by the main process and the phone's vault
- `stray.ts`: what a crash can leave (temp files, each write's own, and a phone's rename steps), recovered at open by `electron/recover-strays.ts` and `capacitor/recover.ts`
- `electron/import-folder.ts` copies a folder's notes and images into the vault through its storage (`Storage.writeNew` for an image's bytes)
- `electron/outside-folder.ts` reads them for it: no link followed; the vault told apart by what it is on the disk
- `capacitor/` is Storage over a plain `FilesPort` (`files.ts`)
  - `capacitor-files.ts`: Capacitor's Filesystem, on the phone
  - `node-files.ts`: Node's, in tests, so the storage contract tests run on it
  - `recover.ts` puts back what a crash left
  - `poller.ts` looks for changes, as a phone has no watcher
  - `phone-trash.ts`: the phone's trash, .eien/trash
- `case-twin.ts` keeps every storage from making a name its folder has in another case
- `theme-files.ts` keeps the writer's themes in `.eien/themes` over any Storage (or the window's bridge to one)
- `tests/case-folder.ts` gives tests a disk that tells case apart (a disk image on a Mac)
- `electron/disk-watch.ts`: the desktop's watcher
- `extension/`: the extension's
  - `browser.ts`: the few parts of a browser's extension API it uses
  - `store.ts`: its settings (synced), places and whether it's open, in the browser's storage

### `src/ui/`

The window. Paths are from `src/ui/`, or from `src/` for `core/` and `app/`.

- `app.ts` holds the settings, the menu and the vault shown
- `vault/vault-view.ts` wires the panes (`sidebar`, `list`, the page pane) to the vault
- `vault/pane-drawer.ts` draws them
- `page/page-pane.ts`: the page pane (the layout's slots, the colophon, the versions panel beside), with its pages
  - `page/page.ts`: one page: its editor, words, tags and its own status round its sheet
  - `page/note-sheet.ts`: the page's sheet
  - `vault/pages.ts` arranges them: the pages, the active one the commands act on, each page's note (`vault/open-note.ts`), and its seals; what each kind keeps up over its pages is the kind's
  - `vault/note-pages.ts`: the note's kind, with what the window asks of notes alone
- A page holds a note or, from backlog #40, an EPUB ([docs/page-kinds.md](docs/page-kinds.md))
  - `page/page-leaf.ts`'s `PaneLeaf`: what the pane asks of any page
  - `vault/page-side.ts`'s `Side`: what the pages hold of one
  - `vault/note-side.ts`: a note's (`isNote`, `activeNote`)
  - `vault/stand-in-kind.ts`: a second kind for the tests
  - a command for one kind is marked `on` in `chrome/commands.ts`, and `menuOff` carries it to the menu bar and the phone's ⋯
  - `vault/command-looks.ts`: how each command looks now, or set aside where the active page is another kind
- `page/note-foot.ts`: a note's colophon items
- `vault/open-notes.ts`: a note open on any page, held once (one session, one document, its images), however many pages show it
- `vault/note-actions.ts`: what the writer does to notes from any pane
- `vault/row-actions.ts`: what a row and its menus do
- `vault/vault-sidebar.ts`: the sidebar's actions
- `vault/epub-wiring.ts`: an EPUB's kind, what SHELF and the list show of the books on the pages, and which note a quote goes into (#40)
  - `vault/epub-found.ts`: the list's field searching the book its contents show (Phase 5c)
- `list/contents-list.ts`: a book's contents in the list, in place of notes (#40)
  - `list/found-rows.ts`: Found's rows, a match in its words, and what the search says (Phase 5c)
  - `list/book-lenses.ts`, `.css`: its lenses, Contents, Marks and Found, and a mark's row of either kind, in the list and under a book's SHELF row (Phase 4c, 5b, 5c), and a Found row's match
- `vault/list-lens.ts`: the list's lens and Arrange mode (Include subfolders too, kept per folder by `list/sorts.ts`)
- The split (spec §4, two pages side by side) is a mode as a layout is
  - `chrome/splits.ts`: Two sheets, Facing pages, Companion, Tools that follow; the room two pages need and what the divider measures, what's too narrow does, which commands move onto a page's own host, what the layout's tools act on, and where each note's figures go
  - `vault/page-hosts.ts`: a page's own host, which those commands move onto
  - `page/pages-row.ts`: the pane's row laying out two pages, folded with a pager, closed to one with the other's edge, or a companion under the page, the active page marked; each page's own head and foot is `page/page-leaf.ts`
  - `page/page-mark.ts`, `page/page-mark.css`: the page's mark (the Page mark setting: ribbon, dog-ear or edge tab) at its outer edge: Facing pages' active page's, and a book's bookmark's (#40 Phase 4b)
  - `page/split.css`, and one sheet per mode: `split-sheets.css`, `split-facing.css`, `split-companion.css`, `split-follow.css`
  - the list stepping aside for a split is `shell/panes.ts`'s
  - `page/divider.ts`: the divider between, each mode's measure in `shell/split-state.ts`
  - `vault/page-more.ts`: a companion's ⋯
  - `vault/note-side.ts`: each note's page, made and let go whole
  - `vault/page-drop.ts`: a note dragged onto the pane
  - `list/shown-notes.ts`: a row's marks for the pages' notes, chosen and beside
- `page/page-title.ts`: a page's title
- `page/page-room.ts`: whether a page has room round its sheet for Page width's choices (#62), measured with a sheet laid at Wide
  - `page/test-page-room.ts`: a page the DOM tests hold, measured as the window would
- `vault/menus.ts`: a note's, a book's (on SHELF), a folder's and a tag's menus open from here
- `vault/menu-items.ts`: their choices
- `draw-clean.ts` draws cleaned nodes (`core/html/clean.ts`) element by element, checking each element, address and part again, for the extension's story page and an EPUB's chapter (#40)
- `quiet-button.ts`: the quiet icon button (the +, a sheet's ×, the divider's ⇄)
- `css-zoom.ts`: the page's zoom as it draws an element, the window's own figure (a table's controls, a book's pages)
- `shell/vault-frame.ts`: the shell the sidebar, list and page pane lie in
- `shell/panes.ts` resizes and shuts them (widths per device, `shell/pane-state.ts`); back opens the one shut nearest the page (`reopen`, #70)
- `shell/swipe-back.ts`: a Mac trackpad's two fingers swiped back across the window (#70), the same back as the bridge's, but no Esc
- `shell/scrolls-across.ts`: whether a gesture's element scrolls sideways itself, which a swipe then leaves alone
- With two panes, the sidebar's tree (`sidebar/tree.ts`, its styles in `sidebar/tree.css`) lists the notes
  - `sidebar/note-row.ts`: a note's row, kept between draws, and put right in place while the rest of the tree is the same, by `sidebar/row-cache.ts`
  - a long list of notes there, and the note list once it is long, draws only the rows in sight (`shell/windowed-rows.ts`, the arithmetic in `shell/window-range.ts`; the keyboard reaches every row)
  - `sidebar/sync-status.ts`: the sync status at its foot; whether a change came from elsewhere, by `vault/own-writes.ts`, the window's own writes remembered a moment over the bridge; `app/electron/syncthing.ts` finds the `.stfolder`
  - a + beside FOLDERS and TAGS (made once, their tooltips watched alone)
  - `sidebar/tag-field.ts`: a new tag named in place, kept by `core/tags/made.ts` in `.eien/tags.json`
  - `vault/folder-order.ts`: folders and tags move in your order, run by `vault/order-actions.ts`
  - `sidebar/row-keys.ts`: a folder's keys and a tag's
  - `sidebar/folder-drag.ts`: a folder's drag
  - `sidebar/tree-windows.ts`: the tree's long lists
  - `sidebar/lens-slot.ts`: with two panes, the chosen row's lens
  - `sidebar/sections.ts`: its sections fold, folded per device in `sidebar/folds.ts`
  - `sidebar/tree-sections.ts`: the sections in order, LIBRARY, FOLDERS, SHELF, TAGS
  - `sidebar/shelf-rows.ts`: SHELF's rows (#40), a lens over the folder tree: its folders FOLDERS' own folder rows, books as controls (a note's row's keys and menu, `vault/row-actions.ts`), an open book's contents with two panes
    - `sidebar/shelf-book-rows.ts`: the rows under a book with two panes: its lenses, its chapters or its marks
    - `sidebar/shelf-row.ts`: a SHELF row and its name, shared by both
    - `sidebar/shelf-folds.ts`: SHELF's shut folders, per device
    - `sidebar/folder-sides.ts`: a folder in FOLDERS, on SHELF or both: where its rename is typed and the keyboard goes back to
    - `sidebar/twist.ts`: a row's twisty and its group, in FOLDERS, TAGS and SHELF alike
    - moves among the folders a section shows: `vault/folder-order.ts`' `shownBeside`
  - `sidebar/sidebar-focus.ts`: where the keyboard is in the tree, kept across its redraws
  - `sidebar/seals.ts`: the seal that shuts the sidebar and the one that opens it, the keyboard handed across
- The lens over each list, drawn in the list's head and, with two panes, for the chosen row in the sidebar
  - `list/lens-bar.ts`: the sort and the tag filter, their chips
  - `list/tag-filter-panel.ts`: the filter's three states, its rules in `core/tags/filter.ts`
  - `list/sorts.ts`: each lens kept per list on this device
- `list/search-field.ts`: the one search field, on the list's band or, with no list in sight, in the sidebar (placed by `vault/pane-drawer.ts`)
- `vault/organize.ts` renames, moves and trashes, keeping order and pins in step (the vault's own small files, pins, tags and All Notes' order, through `vault/small-files.ts`)
- `vault/rename-in-row.ts`: a note renames in its row, the field laid over the row by `list/name-field.ts`, following its row through redraws
- `versions/` seals the open note (`note-versions.ts`, the rules in `core/versions`), compares it with a seal and lists its seals
- `menu/`: the floating menu (a row's: its name at the head, an icon, a word and a key per choice, the trash in carmine)
- `quick-look/`: the quick look (#49, [docs/quick-look.md](docs/quick-look.md))
  - `quick-look/quick-look.ts`: the popover under the Look control (a sheet on the phone), drawn from the settings the schema marks `quick` with Settings' own rows, floated by `menu/menu.ts`; a subject's line at its foot (the shelf's)
  - `quick-look/quick-keys.ts`: its keyboard
  - `quick-look/epub-store.ts`: the shelf's look as its store, with a book in front (#40)
  - opened for the page the layout's tools act on by `vault/look-wiring.ts`, which sits a page of another kind back (`data-back`, `page/split.css`)
- `welcome/`: before a vault is open
- `editor/`: CodeMirror in a shadow root (its styles load as constructed style sheets, which the CSP allows)
  - `editor/note-doc.ts`: a note's text and undo history, one document every view of the note mirrors (a view's change goes through it to the others, ⌘Z and the Edit menu's Undo run on it, and a change is told and counted once, by the view it was made in)
  - `editor/editor-keys.ts`: the keys
  - `editor/editor-modes.ts`: the views' extensions by mode
  - `editor/links.ts`: a link followed
  - A link's tools in Live (#38)
    - `editor/link-core.ts`: the link at a place (its words, where it goes, its kind), an edit as one step of the history, taken off, followed; no window of its own
    - `editor/link-tooltips.ts`: when they show (a hover, the caret; never while typing), the keys (⌥↩, ⌘K, ⌥F10, Esc), and the presenter Link editing chooses, swapped live: the one place a style's name is read
    - `editor/link-presenter.ts`: what a presenter is, and what the three share; each only draws and forwards to the core
    - `editor/link-card.ts`, `editor/link-inline.ts` (with `linkInPlace` in `editor/preview-mode.ts`, which Live's marks follow), `editor/link-bar.ts`: Card, In place, Bar
    - `editor/link.css`: the card's and bar's look; In place's is beside it, in the editor's shadow root
  - `editor/typing.ts` decides typed quotes and pastes on the editor's state alone
  - `editor/live-tables.ts` draws a table in place, row by row, its cells as outer decorations, and the table editor edits it in Live
    - `editor/table-editor.ts` wires the table editor
    - `editor/table-at.ts` finds the caret's table
    - `editor/table-commands.ts` makes each change one step of the history and tells the colophon
    - `editor/table-keys.ts`
    - `editor/table-input.ts`: what's typed
    - `editor/table-menus.ts`
    - `editor/table-tools.ts`: the grips and + on the desktop, the window's own controls in a layer over the editor
    - `editor/table-controls.ts` makes and places them, from `editor/table-geometry.ts`
    - `editor/table-drag.ts` drags them
    - `editor/table-bar.ts`: a phone's bar
    - `editor/table.css`: their look
  - `editor/front-matter-hidden.ts` keeps front matter out of sight and whole (the id alone in Live and Reading; with Hide tags and IDs, the `tags:` and `id:` lines in every view: the caret kept out, the writer's edits taken round them, find and copy passing over them)
  - `editor/hidden-marks.ts`: Live with Show Markdown marks off (Backspace and Delete beside a hidden mark)
  - `editor/image-drop.ts` hands a dropped or pasted image on
    - `vault/note-images.ts` copies it into the note's `.assets` and links it
    - `vault/note-assets.ts` moves and trashes that folder with its note
  - `editor/writing-tools.ts`: the scene break key, focus mode and typewriter scrolling
- `find/`: the find bar
  - `find/find-bar.ts`: the find bar, the window's own slip laid over each page's leaf, which searches nothing itself
  - `find/find.css`: its look
  - `find/find-target.ts`: a `FindTarget`, what the bar searches
  - `editor/find.ts`: a note's, CodeMirror's search and its keys, from `core/find`
  - `editor/find-matches.ts`: the count
  - a page offers its find to the menu's commands as `PaneLeaf.find`
- `vault/copy-html.ts`: Copy as HTML
- `vault/exports.ts` exports a note or a book
  - `vault/export-images.ts` reads the images
  - `vault/current-book.ts` finds the book, for outline cards too
- `vault/importing.ts` imports a folder
- `page/page-tags.ts` puts the note's tags on the page, in the slot the layout names
  - `page/tag-set.ts` draws them, with the + field and its menu
  - `editor/find-tag.ts` finds one typed in the words
- the formatting bar is the `format` slot's host, its buttons pressed by `editor/active-formats.ts`
- `page/word-count.ts` counts the note's words and what the writer's own changes add
- `counters/` shows today's, the book's and a sprint's in the colophon (wired in `vault/counting.ts`)
- `menu/ask-number.ts` asks for a number where a menu was (a book's goal)
- `outline/board.ts`: outline cards, shown in the sheet's place (`vault/outline.ts`)
- `vault/page-parts.ts` makes what the pages share (counters, Copy as HTML, exports, outline cards, each acting on the active page) together, for `vault/vault-view.ts`
- `vault/follow.ts` follows the disk, the settings and the menu's commands while a vault is shown
- `menu/menu-bus.ts` carries the menu's commands, from the menu bar or a phone's ⋯
- `phone/`: the phone's layout, one pane at a time
  - `phone/phone-stack.ts`: its back bar
  - `phone/more-menu.ts`: the page's ⋯
  - `phone/room.ts`: on a wider screen, the room the Wide screen setting chooses (Panes, One at a time, Side by side, Two pages); what's in sight and where back goes
  - `vault/phone-view.ts` wires it
  - `vault/phone-other.ts`: the note you came from, a tap away in its bar (where a page left its last note, `vault/open-note.ts`)
- `settings/`: Settings over the window (spec §6)
  - `settings/settings-screen.ts` draws the categories and tabs, and each setting by its kind (`settings/controls.ts`)
  - `settings/places.ts`: which schema group is which tab, This vault's apart
  - `settings/frame.ts`: the sheet moved and resized (the arithmetic, and the box kept per device, in `settings/box.ts`)
  - `settings/themes-tabs.ts`: the Themes tabs (the cards in `settings/theme-card.ts`, a custom theme's mix in `settings/mix-panel.ts`)
  - `settings/look.ts`: the look the settings set on `<html>` (the custom properties in `settings/look-properties.ts`)
  - `settings/zoom.ts`: which zoom ⌘+ and ⌘− change (a phone's Interface zoom is its page's viewport, `settings/viewport.ts`)
- `chrome/`: the window's controls (spec §4, Layouts)
  - `chrome/commands.ts`: every control a command, once (its icon, name, key and the menu's command it runs)
  - `icons.ts`: Eien's own icons, inline SVG, which the commands are drawn as
  - `chrome/host.ts` draws them as icon buttons, with tooltips from `chrome/tooltip.ts`, a command set aside out of its row
  - `chrome/fold.ts`: short of room, a bar's tools fold behind one ⋯
  - `chrome/band.ts`, `slip.ts`, `runhead.ts`: each layout a list of its hosts and the slot each goes in, each with its own stylesheet and corners
  - `chrome/layout-spec.ts`: the slots and the hosts all three share
  - `chrome/chrome.ts` mounts and switches them
  - `vault/chrome-wiring.ts` wires them to a shown vault (how each command looks now, the ones the window runs itself, the menu bar greyed by the kind in front)
- `theme/wear.ts` wears the theme chosen on `<html>`
- `theme/writer-themes.ts` keeps the vault's own themes for the window (the API Settings' Themes tabs build on)
- `shell/shell.css`: the panes' top bands drag the window; it also holds the corner's lengths: `--seal-x`, `--corner`, a shut sidebar's `--strip`
- `shell/controls-left.ts`: whether macOS's lights stand in the window's top-left corner (not in full screen), and how wide the system's controls are (measured once the window holds still, never mid-resize)
- styles in `theme/` and beside each view
- `epub/`: an EPUB's page (#40)
  - `epub-page.ts`: the page (`PaneLeaf`): its frame (the note's sheet, its ×, a refusal in words), its colophon, the shelf's look, scroll style and Pages or Scroll worn, its keys handed to `page-keys.ts`, its bookmark's mark
  - `chapter-sheet.ts`: the chapter on the sheet: drawn with its foot, its place kept and shown again (scrolling or in pages), its links caught, its words copied and chosen
  - `epub-side.ts`: one page holding a book (`Side`): a chapter at a time, moved between, its place kept in the reading state and shown again
  - `book-parts.ts`: its parts made together: the place said, the bookmarks, the links, the turns
  - `epub-side-types.ts`: what a page holding a book is (`EpubSide`, `EpubSideOf`, `isEpub`)
  - `book-place.ts`: what the page says of where it is as the place moves: the colophon's figures, the fore-edge, the page: printed, else the chapter's own as laid out, else scrolling its percent (Phase 4, #67)
  - `book-count.ts`: a book counted for its page numbers, in the background, never while a page turns; one per book for the window, the last few kept (Phase 4)
  - `book-open.ts`: the book read and opened for its page (or the words it says instead), what it's called, and where it opens
  - `chapter-foot.ts`: a chapter's foot, the chapters either side as word buttons (the sheet's turns, `page/page.css`)
  - `chapter-place.ts`: the first line in sight measured as an offset in the chapter's words, and shown again; the words from a place (a bookmark's)
  - `place-keeper.ts`: the place kept as the page scrolls, measured at rest and never out of sight, shown again when laid out anew
  - `book-links.ts`: a book's links caught on its page (the web's to the system's browser), a note's reference told apart, each named for the tooltip, a place found by its marker
  - `book-follow.ts`: where they take the reader: the note over the page, or the chapter and place, one step back
  - `note-over.ts`: a book's note over its page, floated as a menu
  - `book-words.ts`: a selection's words without the page's own (a copy, a quote)
  - `book-foot.ts`: a book's colophon items: Back, which chapter, where in it, "bookmarked", how far through the book, a line of news; no Today (#66)
  - `book-selection.ts`: the selection bar over a book: Quote in the note, Copy
  - `book-quote.ts`: the words chosen in a book as a quote, cited, and sent to the note beside
  - `test-side.ts`: a book's page over a vault the DOM tests hold
  - `test-lines.ts`: a chapter's lines as the DOM tests lay them out, and a book's page laid out so
  - `epub-kind.ts`: its kind of page (`PageKindOf`): `.epub` files, a moved book followed, a changed one read again, a gone one let go
  - `chapter-view.ts`: a chapter drawn, its pictures the window's own copies (`blob:`) at their size, settled (pictures, fonts) before a place is shown, let go with it
  - `reading-store.ts`: the reading state's file, through the vault's small files, a change to its marks decided against the file as it is then and told to every page of the book
  - `book-marks.ts`: a book's marks on its page over its reading file (which book, how the file stands, one listener, why a change wasn't kept), `]` and `[` walking them, its two kinds:
    - `page-bookmarks.ts`: its bookmarks: whether the page in sight has one, B and the tool, following a turn once it lands (Phase 4b)
    - `page-highlights.ts`: its highlights: inked and ticked, H, the bar's Highlight and Format → Highlight, Put back (Phase 5a)
  - `chapter-range.ts`: words chosen as offsets in the chapter's words, and a span of them back to the text it covers
  - `ink.ts`, `ink.css`: ink over the words by the CSS Custom Highlight API, one Highlight per name for the window, each page's ranges its own; a turn's copy inked in elements
  - `test-ink.ts`: that API stood in for the DOM tests
  - `book-search.ts`: a book searched in the background, a slice a task, never while a page turns; its chapters' blocks kept for the book searched (Phase 5c)
  - `book-find.ts`: the book's `FindTarget` under the window's find bar: the whole book, its matches inked, the one it's on chosen as the bar closes
  - `bookmark.css`: its mark (the Page mark's look), kept to the top of the sheet in sight, and Facing pages' clash
  - `page-marks.ts`: the marks on the sheet, one page's at its right, a spread's verso's at its left (Phase 3d)
  - Set as a book (Phase 3d, `epub-set.css`; two pages, `epub-spread.css`)
    - `front-matter.ts`: Eien's title page and imprint before the first chapter, none of the book's words
    - `running-heads.ts`: the running heads and folios
    - `hyphens.ts`: whether the window hyphenates a language, which justifies the text
  - `epub.css`: the book's stylesheet, its parts from the `--eien-epub-*` tokens
  - `paged-place.ts`: in pages (Phase 3b), the page holding the place shown, a turn keeping its first word, a copy cut to the page in sight; a sight of two pages, and the front matter turned back to, never opened at (Phase 3d)
    - `page-columns.ts`: the chapter laid in columns of whole lines, one page or two to a sight, its pages and the front matter's counted
    - `sight.ts`: the pages in sight, each where its words begin and its part; where the page stands, to put back
    - `spread.ts`: one page or two, as Pages, landscape and Pages, portrait choose for the screen as it's held: One, Two, or Auto, by the pane's room for two of 20em (never a split's)
    - `sight-copy.ts`: a sight's words for a turn's copy, the page as laid: the whole blocks round the sight in the chapter's own columns, laid once out of sight and set on the page's place by measure
    - `test-sight-copy.ts`: its DOM tests' layout, each thing's first box given
  - `book-pages.ts`: the page turn over a book's page, on into the next chapter and back; in Scroll, a chapter turned stepping its words in
  - `chapter-swipe.ts`: a finger swiped across a book in Scroll turns the chapter, never a scroll, a press or the system's edge (#71)
  - `leaf-edges.ts`: the fore-edge either side of the sheet, its two sides the turn's buttons
  - `edge-strip.ts`, `.css`: Marks on the edge (Phase 4d): the whole book down the page's edge, a slider, apart from the fore-edge
  - `book-strip.ts`: the book told to the strip as shares of it (chapters, marks of both kinds, the place), and where a point on it goes
  - `page-keys.ts`: the page's keys, one table: its letters (Q, B, H), `]` and `[`, Back, and in pages the keys that turn and a touch's tap in the outer thirds
  - `turn/`: a page turned (Phase 3)
    - `page-turn.ts`: the turn (`PageTurn`) over a `TurnSurface`: a key's, a click's or a hand's, the Page turn's motion, a key mid-turn finishing it, a chapter drawn first
    - `curl-run.ts`: one curl from its first frame to landing, `curl-view.ts` its copies of the page as bands (`band-box.ts`: drawn once, only moved), in the curl's light, its shadows as strong as the paper is high; on a spread one page's (a `TurnLeaf`) round the gutter, its back the page it reveals, the other still, a back turn mirrored
    - `hand-events.ts`: the pointer and the finger carried to the turn (Phase 3c): a finger anywhere on the page, a mouse at the book's edges or on a page in flight, a cancelled gesture falling back, a drag that turned never also a click
    - `turn-surface.ts`: what a page turn turns over (`TurnSurface`, its `TurnLeaf` on a spread), and what a test stands in for
    - `turn-hand.ts`: a hand on the page, and when its move is a drag across; `turn-queue.ts`: turns waiting for the page they turn from (a chapter drawn first)
    - `step-turn.ts`: Slide (`slide.ts`) or Words (`words.ts`) run between the words left and the words come
    - `page-copy.ts`: the page as it was, laid over it, never reached
    - `turn-tokens.ts`: the tokens a turn reads (times, ease, lengths), reduced motion's 0 among them
    - `next-frame.ts`: the next frame, or a timer where frames stall
    - `turn.css`: the copies and the curl's pieces
- `extension/`: the extension's pages (spec §14)
  - `extension/content.ts`: the content script, built alone as one plain script, reads the page with `sites/` and lays over it the seal and the story frame (`extension/page-overlay.ts`)
  - `extension/sites/ao3.ts`, `extension/sites/ffn.ts`: one module per site's markup
  - `extension/sites/page-text.ts`: an element's words and HTML, its addresses whole
  - `extension/story.html`: the story page
    - `extension/story.ts`, `extension/story-view.ts`: the band, keys and colophon
    - `extension/story-sheet.ts`: the story on the sheet, its links each opening in a tab of its own
    - `extension/story.css`, `extension/story-page.css`: its styles
  - `extension/popup.html`: the popup
    - `extension/popup.ts`: the settings `extension/story-settings.ts` names, drawn by `settings/controls.ts` and `settings/theme-card.ts`
  - `extension/eien-look.css`: what the story page and the popup both wear

### `src/app/electron/`

The main process: window, menu, the vault and settings sessions and their IPC.

- `ipc.ts`: each channel listened to once, each call answered by the window that sent it
- `vaults.ts`: the vaults the windows hold, each folder opened, recovered and watched once however many windows show it, each window told which changes another window here made
- `device-settings.ts`: the device's own file
- `data-folders.ts` alone decides where the device's file and the data folder are, for an installed, portable or separate copy
- `out-session.ts`: the clipboard, the save dialog
- `print-pdf.ts` prints a PDF in a hidden window that runs nothing
- `import-session.ts`: Import Markdown Folder…
- `swipe-session.ts`: a Mac trackpad's swipe back, three fingers by the window's `swipe`, and whether two fingers swipe (#70)
- `menu.ts` builds the menu bar, each item's id its command, its on/off settings as checks that `checkToggles` keeps in step (`TOGGLES` in `core/config`)
- `menu-grey.ts`: the commands a window greys (a note's, with a book in front), checked against the bar's, worn while it's focused
- `context-menu.ts`: the note's right-click menu (spelling suggestions on macOS, from `context-menu-of.ts`)
- `frame.ts`: the window with no title bar (the system's controls over the bands, painted as the window's `shell/window-controls.ts` reports them) and the whole window's zoom
- `preload.ts`: the sandboxed preload

### `src/app/mobile/`

The phone.

- `preload.ts` sets `window.eien` before the window's own script (the page is the desktop's, built by `vite.mobile.config.ts` into `out/mobile`)
- `mobile-vault.ts` opens the vault in Documents/Eien/Vault (exports go to Documents/Eien/Exports)
- `vault-home.ts` and `all-files.ts` ask for Android's access, with Eien's plugins in `android/app/src/main/java/io/github/onlynyans/eien/`
  - `AllFilesPlugin.java`
  - `VaultFilesPlugin.java`: the flushed write and the one-step renames `capacitor-files.ts` uses on Android
  - `MainActivity.java` registers them and turns on the WebView's wide viewport, so Interface zoom reads as a browser's
- `phone-out.ts` copies and exports (HTML, EPUB and Word; no PDF, and no import, on the phone)
- `android/`: the Capacitor Android project (`capacitor.config.json`)
- `ios/`: the Capacitor iOS project, with Eien's Swift plugin
  - `ios/App/App/VaultFileOps.swift`: the file operations, a save's last step coordinated with other apps (`replace`), tested by `scripts/ios/vault-file-ops-test/`, `vault-file-ops-adversarial/` and `vault-file-coordination/`
  - `VaultFilesPlugin.swift`: registered by its view controller

### `src/app/extension/`

- `manifest.ts`: the extension's manifest, Manifest V3 for Chrome and Firefox alike (storage and the story sites' pages, nothing else), written with the seal's icons into `out/extension` by `vite.extension.config.ts`

### `tests/`

- Architecture tests
  - `layers.test.ts`: the layers
  - `selectors.test.ts`: no style rule ends in `*` after a `:hover` or `:focus`, which restyles the whole window
  - `words.test.ts`: no folder, file or CSS class named for "reader", as Words says
  - `epub-copy-css.test.ts`: a book's words' rules look back one sibling at most, never on, float and count nothing, as a turn's copy (`sight-copy.ts`) carries no more
  - `stylesheets.ts`: the stylesheets, found for the tests that hold every one to a rule
- `zip-interop.test.ts` holds Eien's zips to zlib and `unzip`
- `tests/support/` holds what the tests share, Node-free so core's tests can use it: a strict zip reader, a strict XML check, an export's parts, a long book for the budgets (`long-book.ts`) and its reading file with a mark in its last chapter, which the budgets wait on to know it's counted (`marked-book.ts`)
- `tests/e2e/` drives the built app on real folders with Playwright
- `tests/mobile/`: the phone's page in Chromium
- `tests/extension/`: the extension in Chromium, over AO3's and FanFiction.Net's pages as `tests/support/story-pages/` writes them
- `tests/android/`: Eien on an emulator or phone over adb

### Elsewhere

- `tsconfig.{core,web,node,mobile,e2e}.json`: one per environment: core can use neither DOM nor Node, the window can't use Node, the phone's code has the DOM and no Node
- `docs/design/`: the design's reasons and every token documented (`README.md`), and the explorations with their Decided sections; its top-level mockups and their `tokens.css` are the 2026-10-20 snapshot (Rules → How something looks). `.interface-design/system.md` is the design as it stands, for the interface-design skill too
- `docs/backlog.md`: what comes after the phases: fixes, tweaks and features, each marked for the design pass or not, and the owner's open questions

## Tests

Each kind catches its own regressions; a change adds the kind that would
have caught it breaking.

| Kind | For | Where | Run |
|---|---|---|---|
| Unit | A module's rules, given inputs | `name.test.ts` beside the module | `npm test`, or `npx vitest run <path>` |
| Property | A rule over thousands of generated inputs (fast-check) | `name.property.test.ts` beside it | `npm test` |
| DOM unit | What a window module draws and does: rows, roles, keys, focus kept across a redraw | `name.test.ts` under `src/ui/`, which run in happy-dom | `npx vitest run src/ui` |
| Architecture | Layers, selectors, identity, icons, wiring, words | `tests/*.test.ts` | `npm test` |
| End to end | The built app on real folders: what a writer does | `tests/e2e/*.spec.ts` | `npm run test:e2e` |
| Accessibility | No serious or critical axe-core violation (WCAG 2.2 AA, contrast included), each layout by day and night, three panes, two, Settings; the extension's story page and popup by day and night | `tests/e2e/accessibility.spec.ts`, `tests/mobile/accessibility.spec.ts`, `tests/extension/accessibility.spec.ts` | in `test:e2e`, `test:mobile`, `test:extension` |
| Speed budgets | No long task over 200 ms with thousands of notes | `tests/e2e/budgets.spec.ts` | in `test:e2e` (`ALONE`) |
| Resource budgets | Elements in the window, the JS heap after a long session, the first list's time, the renderer's size | `tests/e2e/resources.spec.ts` | in `test:e2e` |
| Phone page | The phone's page in Chromium, Capacitor's web plugins standing in | `tests/mobile/*.spec.ts` | `npm run test:mobile` |
| Browser extension | The built extension loaded into Chromium, the story sites answered by the test's own pages (`EIEN_CHROMIUM` names another Chromium where Playwright's isn't installed) | `tests/extension/*.spec.ts` | `npm run test:extension` |
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
npm run build:extension  # the browser extension (Eien Reader), into out/extension (load it unpacked)
npm run test:extension   # builds the extension, then tests it in Chromium (Playwright)
npm run android      # builds the phone's page and copies it into android/
npm run test:android # builds and installs the debug APK, then tests it on the device adb sees
npm run test:ios-files # the iOS plugin's Swift file operations, with swiftc (Command Line Tools)
npm run test:ios     # on a Mac with Xcode: the app on an iPhone simulator (CI runs it)
npm run changelog    # the next CHANGELOG.md section, from pull requests' titles (-- 0.5.0 writes it)
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
end-to-end tests on macOS, Windows and Linux, the phone's page in Chromium, the
browser extension in Chromium (its build kept as the run's artifact) and
the Android debug build (its APK kept as the run's artifact), and on macOS the
iOS plugin's Swift tests and the app on an iPhone simulator, on every push to
`main` and every pull request. All seven checks the repository's ruleset
names must pass before a pull request merges; the extension's, and
Pull request title (`.github/workflows/pr-title.yml`), join them once the
ruleset names them. The Android tests on a device are run by hand. An end-to-end test that holds the app to a time (a draw,
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

- **One version.** `package.json`'s `version` is the only one. The
  extension's manifest takes it as it's built; `npm run android` and
  `npm run ios` write it into the phone projects (`scripts/version.mjs`):
  Android's `versionName` and iOS's `MARKETING_VERSION`, and as the build
  number both stores need to rise (`versionCode`, `CURRENT_PROJECT_VERSION`)
  major×10000 + minor×100 + patch, so 0.5.0 is 500. `tests/version.test.ts`
  fails when any of them disagrees with `package.json`.
- **Semantic Versioning, below 1.0** while nothing is published: a minor
  version (0.5.0) for a release with features, a patch (0.5.1) for fixes
  alone. 1.0 is the version the owner first publishes.
- **Pull request titles** are Conventional Commits, as a squash merge makes
  the title main's commit subject and the changelog is drafted from those:
  `type(scope): subject`, and GitHub adds ` (#NN)`.
  - Types: `feat` (something a writer can do or see that they couldn't),
    `fix`, `perf`, `refactor`, `docs`, `test`, `ci`, `build`, `chore`.
  - `!` before the colon for a change that breaks a vault's files or settings,
    one an older Eien would misread (spec §2 → Formats):
    `feat(settings)!: one file for the faces`.
  - The scope, when there is one, is one of the Words or an area, lower case:
    `epub`, `extension`, `editor`, `split`, `phone`, `settings`, `sidebar`,
    `list`, `export`, `versions`, `themes`, `search`, `tags`, `sync`.
  - The subject is in the project's voice, plain, lower case after the colon
    (a name in capitals stays: `EPUB`, `AO3`), with no full stop:
    `feat(epub): open an EPUB on a page`, `fix(editor): the caret stays in a cell`.
  - The **Pull request title** check (`.github/workflows/pr-title.yml`,
    `scripts/titles.mjs`) holds every pull request to this, and runs again when
    a title is edited. It's its own workflow, so a rename never cancels or
    repeats the rest of CI.
- **CHANGELOG.md** has a section for each version, in Features, Fixes and
  Other. `npm run changelog` prints what the next section would say, from
  main's subjects since the last tag; `npm run changelog -- 0.5.0` writes it
  in place of the Unreleased section (or above the newest release).
  `--since <ref>` starts somewhere other than the last tag. The release
  workflow holds each tag to it: `npm run changelog -- --notes 0.5.0` prints
  a release's section as committed, and fails without one.

To cut a release, on a branch from `main`:

1. `npm version 0.5.0 --no-git-tag-version`: `package.json`, its lock, and the
   phone projects (npm's `version` script runs `scripts/version.mjs`).
2. `npm run changelog -- 0.5.0`, then read the section and edit it: say it as
   a writer would want to hear it, join a feature's several pull requests in
   one line, and drop what no writer meets. (0.4.0's section is written
   already, by hand, as its titles weren't conventional: give its heading the
   version and the date instead.)
3. A pull request, `chore: release 0.5.0`; merge it once CI passes.
4. Tag `main` with it: `git fetch origin && git tag v0.5.0 origin/main && git push origin v0.5.0`.
   `.github/workflows/release.yml` checks the tag matches the version and
   that CHANGELOG.md has its section, builds each installer on its own
   system, installs and starts it there, and attaches all three to a draft
   release whose notes are that section, which the owner publishes by hand.
   Run by hand (Actions → Release → Run workflow), it builds and tries the
   installers with no release, keeping them as the run's artifacts.

0.2.0 and 0.3.0 were written into CHANGELOG.md afterwards, each ending at
the commit named under its heading; nothing was built for them. Their tags
(`v0.2.0` at `ab9a78c`, `v0.3.0` at `2491dbd`) mark those commits only: each
started `release.yml`, which stopped red at its first check (`package.json`
there still says 0.1.0), and made no release.

0.4.0 (2026-10-28) is the first build since 0.1.0: stage 4, the quick look,
and the EPUB reader's groundwork (#40 Phase 0). The reader's phases begin
0.5.0.

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
