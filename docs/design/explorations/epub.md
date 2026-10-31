# Reading EPUBs: nine explorations

**Chosen (2026-10-28), and building in phases.** Backlog #40. Phases 0, 1
and 2 are built; Phase 3, turning pages, is built; Phase 4, place,
bookmarks and page count, is built; Phase 5, highlights and Find, is built
([The build](#the-build)). Three
sets of three, in one family so they share one look: turning pages, scrolling,
and the features (page count, bookmarks, highlights, search in the book).

Each page works, by Day and Night, in A · Band, B · Slip and C · Running head,
with the sidebar open or shut, the list shown or hidden, the window as wide or
narrow as you like, and on the phone (the bar's Device). Each works from the
keyboard, and each says what the phone does. The text is *Pride and Prejudice*
(1813, public domain): its first three chapters, with the other fifty-eight
counted by their length, so page counts and progress are the whole book's.
Your place carries from page to page, so you can compare them on the same
words.

| Group | Page | Direction |
|---|---|---|
| Pages | [epub-spread.html](epub-spread.html) | 1 · The spread |
| | [epub-leaf.html](epub-leaf.html) | **2 · One leaf, its edges** (recommended) |
| | [epub-columns.html](epub-columns.html) | 3 · Columns to the pane |
| Scroll | [epub-chapter.html](epub-chapter.html) | **1 · A chapter a sheet** (recommended) |
| | [epub-roll.html](epub-roll.html) | 2 · One roll |
| | [epub-beside.html](epub-beside.html) | 3 · Beside a note (recommended later, as a mode on 1) |
| Features | [epub-margin.html](epub-margin.html) | 1 · On the page (its marks recommended) |
| | [epub-index.html](epub-index.html) | **2 · In the list** (recommended, with 1's marks) |
| | [epub-edge.html](epub-edge.html) | 3 · On the edge |
| Showcase | [epub-room.html](epub-room.html) | 1 · The reading room (recommended as a mode, after 2) |
| | [epub-set.html](epub-set.html) | **2 · Set as a book** (recommended, for Pages) |
| | [epub-lamp.html](epub-lamp.html) | 3 · By lamplight (recommended later, as a mode on Scroll) |
| Turning | [epub-flip-turn.html](epub-flip-turn.html) | 1 · The leaf turns (the spread's, if a book's turn is wanted) |
| | [epub-flip-aside.html](epub-flip-aside.html) | **2 · Set aside** (recommended, for a hand) |
| | [epub-flip-ink.html](epub-flip-ink.html) | **3 · The words turn** (recommended, for a key or a click) |
| | [epub-flip-curl.html](epub-flip-curl.html) | 4 · The curl (asks for an exception: light while a page moves) |

## Decided (2026-10-28)

The owner's choices, from these explorations. The build follows this
section where it and the directions below disagree.

### How the book is drawn

- **Cleaned nodes, not a sandboxed frame.** A chapter's XHTML is read by
  Eien's own parser and kept to a whitelist of elements, then drawn
  element by element, never from HTML. This is the browser extension's
  pipeline (#47), shared rather than copied (Phase 0): `core/html/clean.ts`
  and `ui/draw-clean.ts`, each caller giving its own rules (where a link may
  go, where an image comes from, which parts have names), as
  `core/extension/clean.ts` does for the extension. Nothing in a book can run, and the
  page turns, highlights and Find work on one DOM.
- **Fixed-layout EPUBs aren't supported** (comics, picture books), and the
  publisher's layout is reduced to its structure. Accepted.
- **Pictures are shown,** from the book's own zip, as blob URLs like a
  note's images, in the formats notes support (JPEG, PNG, GIF, WebP, AVIF,
  SVG). Each is held to the image cap and counted against the book's cap.
  - **Calibre's wrapper:** an image wrapped in an `<svg>` frame (Calibre's
    way with covers and plates) is unwrapped to a plain image.
  - **Paged:** a chapter that's only a picture gets a page of its own,
    fitted within the margins; a picture in a chapter fits the measure and
    moves whole to the next page rather than splitting.
  - **Scrolling:** a picture fits the sheet's width. Captions stay with
    their pictures.
- **Room to style the book.** The cleaner gives the book's parts names:
  chapter title, scene break, epigraph, plate, caption, first line. One
  book stylesheet draws them from book tokens of their own, so chapter
  titles, dividers and the like can be tuned in one place without touching
  notes.
- **The book's look is its own.** The book's typeface, size, line spacing,
  width and frame are kept apart from the notes', so changing a note's look
  never changes a book's.
  - **Made from #49's mark:** they're made from the same schema entries #49
    marks `quick`, kept under `epub.<key>`, with no copied entries.
  - **Changed in the quick look:** with a book in front, the Look popover
    (⇧⌘L, LOOK / SHELF) sets them; with a note, the notes' look.
    `look.md` has the rest.
- **Fonts:** always the writer's chosen faces, never the publisher's.

### The sidebar and the vault

- **SHELF**, above TAGS: LIBRARY, FOLDERS, SHELF, TAGS. A lens over the
  folder tree, as explored. Confirmed by the owner, so #49's popover head
  reads LOOK / SHELF.
- **Books are only under SHELF,** never in a folder's note list.
- **Reading state** (place, bookmarks, highlights) in `.eien/reading/`,
  keyed by the book's contents.
- **Each section shows what its folders hold** (decided 2026-10-29;
  **built**, [#126](https://github.com/onlynyans/eien/pull/126)). SHELF
  already lists only the folders with a book somewhere in them; FOLDERS
  lists every folder but those whose contents, at any depth, are books and
  nothing else. FOLDERS is for writing, SHELF for reading.
  - **Judged on the whole subtree:** a folder stays in FOLDERS while any
    folder under it holds a note, so notes are never cut off. A folder
    holding notes and books is in both, as before.
  - **An empty folder is in FOLDERS:** that's where folders are made, and
    a new one never vanishes.
  - **What a book is, said once:** the index's book kinds (`.epub` today),
    so a format added later joins both sections with no other change.
  - **SHELF's folders become folder rows:** they fold and open with the
    tree's twisty and keys, kept per device as FOLDERS' are (open at
    first), and carry the folder's own menu (rename, move, trash), the same
    one FOLDERS opens. Move to… still lists every folder.
  - **When a folder changes sides** (its last note leaves, or its first
    arrives), the keyboard stays near where it was, a chosen folder stays
    chosen in the list until another is chosen, and a drop still lands:
    the tree's path for a row that goes, tested for each.
  - **Speed:** the tree already counts each folder's notes at every depth;
    it counts its books the same way, in the same pass.
  - **Not chosen:** a per-folder "shelf" switch (more state to keep in
    step, and a folder can hold both), and dimming books-only folders in
    FOLDERS (the clutter stays).

### The tools, by what's in sight (decided 2026-10-29; built, [#126](https://github.com/onlynyans/eien/pull/126))

- **A tool shows only while the active page can use it.** A command marked
  for one kind of page (`on` in `chrome/commands.ts`) is set aside, not
  greyed, while the active page is another kind: a book never takes Bold,
  so a greyed Bold says something false. In a split, the bar shows the
  tools of the page you're in: choose the book and the note's go, choose
  the note and they come back (and a book's own, later, the other way).
- **The rows stay; only buttons come and go.** The formatting bar's row
  stays while a note is anywhere in sight, so neither page moves up or
  down; with a book alone, the row goes too.

  | In front | A note's tools | The formatting bar's row |
  |---|---|---|
  | A book alone | set aside | gone |
  | A note beside a book, the book active | set aside | kept, its note-only buttons set aside |
  | A note beside a book, the note active | shown | as before |
  | A note | as before | as before |

- **The tools every page shares keep their place** (Look, Split, the
  panes, later Find), anchored, so only a kind's own group changes; the
  change is instant, never animated. Where a split mode already gives each
  page its own host (Facing pages, Tools that follow), each page's tools
  stay on it.
- **The menu bar greys, never hides** (#120): menus list all the app does,
  as each system's own do; the bars show what applies. A hidden tool's key
  does nothing on a book.
- **A book's own tools** (contents, Pages or Scroll, bookmark) are marked
  `on: 'epub'` and follow the same rule.

### Links in a book (decided 2026-10-29; built, [#123](https://github.com/onlynyans/eien/pull/123))

- **They look like links:** the words' own colour with a quiet underline in
  `--eien-rule-strong` that darkens on hover, as the extension's story
  page draws a link, the reading surface Eien already has. One rule, shared
  by the story page and the book's page (both draw cleaned nodes), never a
  second copy. A note's links in the editor keep their own look.
- **No link card or bar in a book.** #121's card and bar are for writing
  (where a link goes, Edit, Copy, Open), and its Link tooltip setting
  doesn't apply here. On hover or focus, the window's own tooltip names
  where a link goes:

  | A link in a book | Hover or focus | Click or tap |
  |---|---|---|
  | To a chapter or a place in it | "Chapter III" (or "Chapter III · Notes") | goes there, with Back (Phase 2b) |
  | A footnote's mark | "Note 4" | the note over the page (Phase 2b) |
  | To the web or mail | the address, "gutenberg.org/ebooks/1342" | opens in the system's browser |

- **Web and mail links open in the browser,** as a note's do in Reading:
  only `http:`, `https:` and `mailto:`, through the same checked path a
  note's links take; nothing loads inside Eien. Anything else (`javascript:`,
  `data:`, files, out of the zip) stays words only, unstyled.
- **A reading preview** (a chapter's first lines on hover) would be a
  choice of its own, later.

### Paged

- **One leaf with its stacked edges** (Pages 2); **two pages** (Pages 1's
  spread) when the pane has room for two 20em pages.
- **Set as a book** (Showcase 2): justified and hyphenated, a title page
  and its imprint, chapters opening low, a capitals first line, running
  heads and folios. The phone stays ragged.
- **The reading room** (Showcase 1) is built after Pages, as a one-key
  mode.

### Scrolling

- **A chapter a sheet** (Scroll 1).
- **A scroll style setting:**
  - *As a note:* exactly a note's sheet, type and paragraph gaps in the
    Reading view. This is new: the exploration indented paragraphs as a
    book does, so it wasn't quite a note's.
  - *As a book:* indented paragraphs with no gap, as explored.
- **Beside a note** (Scroll 3): the split with a book on one page, once
  pages can hold a book (Phase 0). The split's modes, its pager, the
  phone's ⇄ and Wide screen's rooms all carry it.
  - **Quote's citation:** `— Pride and Prejudice, Chapter III`, with no
    author.
- **By lamplight** (Showcase 3), as a mode on Scroll, later.

### Turning the page

- **One setting, Page turn:** Curl (the default, on the desktop and the
  phone), Slide (the sliding text, as Pages 1 and 2 first turned) and
  Words (Turning 3).
- **Only Curl curls.** Under Slide and Words, a drag or a swipe asks for
  the turn, and the setting's own motion runs.
- **A turn speed setting**, from instant (0) to four times slower; the
  default is twice as slow as designed. It sets the finish after you let
  go and a key's turn. A drag always follows the hand.
- **The curl's light is approved.** Three tokens, used only while a page
  moves, as the exception in `.interface-design/system.md` sets out:
  `--eien-curl-shade`, `--eien-curl-light` and `--eien-curl-through`.

### Marks

- **A marks setting:** *In the list* (Features 2: Contents, Marks, Found;
  the default) or *On the edge* (Features 3's thumb strip).
- **Bookmark:** the same setting as Facing pages' mark (ribbon, dog-ear or
  edge tab), renamed **Page mark** for it (2026-10-30).
  - **The clash:** only in a split in Facing pages mode with a book on one
    page. There the one mark would mean both "the page you're in" and "a
    bookmarked page".
  - **Decided (2026-10-30):** there, the facing mark keeps its meaning, and a
    bookmarked page says "bookmarked" in its folio, with the bookmark tool
    pressed. Everywhere else the bookmark wears the mark.
- **Highlight:** a pencil underline with a tick in the margin (Features 1).
- **Find:** the list's own search field searches the book while it's open.
  ⌘F (Edit → Find) opens the page's own find bar over the book (decided
  2026-10-31), as on a note: two ways in.
- **Phase 5's design, the owner's answers (2026-10-31):**
  - A highlight taken off is put back by **Put back** in the colophon while
    its news shows, or by H on its words, left chosen; ⌘Z isn't wired (the
    Edit menu's Undo is the system's).
  - No Highlight tool in the bars: the selection bar's Highlight, H,
    Format → Highlight (⇧⌘H, which a book's words take too) and the phone's
    ⋯.
- **Page numbers:** the print edition's, from the EPUB's page-list where it
  has one, else steady pages of 1,500 characters.
  - **No real cost:** the page-list is read once with the book, and a
    chapter's page anchors are measured once as it's drawn.
- **Phase 4's design, the owner's answers (2026-10-30):**
  - In Scroll, a bookmark's mark keeps to the top of the sheet in sight.
  - On the edge, the strip shows your place as a mark-wide ink-soft bar
    across it, not a tab, so it never looks like an edge-tab bookmark; the
    page keeps its bookmark mark.
  - Where the strip has no room (Facing pages' narrow margin, Page frame
    Full), it lies over the page's outer margin; on the phone, one space in
    from the screen's edge, clear of Android's Back gesture.
  - A reading file that can't be read is never written over, and Eien says
    so once: its place and bookmarks aren't kept until it's fixed or
    deleted.
  - `]` and `[` to walk the marks come with highlights (Phase 5).

### After Phase 1 (2026-10-29)

The owner's answers to what Phase 1 (#112, #113, #114) and #49's shelf
half left open.

- **A book over 32 MB is refused,** as built: the storage reads a file
  whole, and 32 MB is its cap. Most novels are under 5 MB. Revisited if a
  real book passes it, which means changing the Storage contract.
- **With two panes, the book's contents live under its row,** and choosing
  another row folds them away; a click on the book brings them back. The
  tree shows one list under one row at a time, as it does for folders.
- **In a split, both pages wear the notes' frame** (Page: a sheet on the
  desk, or the whole pane), so Two sheets, Facing pages and Companion draw
  one arrangement with their marks intact. The book keeps everything else
  of its own look: typeface, size, line spacing and width. Alone, a book
  wears its own frame.
- **"All settings" stays in the shelf's quick look,** opening Settings at
  Look, which sets the notes' look. One line under the popover says so:
  "Settings sets notes; this is every book's look." A Shelf section in
  Settings comes only if it's missed.
- **A book's row on SHELF gets a menu:** rename, move and trash (the system
  trash, as a note's).
- **The menu bar greys a note's commands** while a book is in front (they
  already do nothing there).
- **The page the look doesn't change sits back** while the quick look is
  open with a note and a book side by side, in the tone the split already
  gives the page you aren't in. Nothing new is designed.

The row menu, the menu bar, the line under the popover and the page sitting
back are built (2026-10-29; spec §4, Panes and Page, and §6, A quick look;
docs/quick-look.md, "After Phase 1"; docs/page-kinds.md, Tools). Page width stays off the phone (its
page is narrower than any face's measure), and the iOS simulator opening a
book waits for a way to tap.

### Tests

- **Fixture books made by a script**, from public-domain text and pictures
  (*Pride and Prejudice* with Hugh Thomson's 1894 illustrations).
  Eien's own EPUB writer makes the plain ones; hand-made variants cover the
  rest:
  - a picture-only chapter;
  - Calibre's SVG-wrapped plate;
  - EPUB 2 (NCX) and EPUB 3 (nav, with and without a page-list);
  - and the hostile ones: a zip bomb, a path out of the zip, a script and
    an event handler in a chapter.

### The build

Each phase is its own session and pull request, from main.

- **Phase 0, groundwork,** with nothing new to see. **Built** (2026-10-28).
  Three refactors:
  1. The cleaner and its drawing, out of the extension into shared
     modules, used by both: `core/html/clean.ts` and `ui/draw-clean.ts`
     ([#100](https://github.com/onlynyans/eien/pull/100)).
  2. A page holds a note or a book (`PageKind`, `PaneLeaf` in
     `page/page-leaf.ts`; `vault/page-side.ts`, `vault/note-side.ts`), so
     the split, the pager, ⇄ and Wide screen's rooms take a book with no
     special case ([#101](https://github.com/onlynyans/eien/pull/101);
     [page-kinds.md](../../page-kinds.md)).
  3. The split's files back under 300 lines
     ([#103](https://github.com/onlynyans/eien/pull/103)), then the find
     bar apart from CodeMirror (`find/find-bar.ts` over a `FindTarget`,
     `find/find-target.ts`; a page offers its `PageFind`), so a book's Find
     reuses the slip, its keys and its count
     ([#104](https://github.com/onlynyans/eien/pull/104)).

  With them, one `isInside` for a path in a folder
  ([#106](https://github.com/onlynyans/eien/pull/106)), which the zip's
  paths will use.
- **#49's notes half.** **Built**
  ([#105](https://github.com/onlynyans/eien/pull/105);
  [quick-look.md](../../quick-look.md)): the `quick` mark, Line spacing
  (`appearance.leading`), Page width (`page.width`), the Look command
  (⇧⌘L) and its popover, for notes, with `on: 'note'` until a shelf store
  exists. Its shelf half switches on in Phase 1.
- **Phase 1, the shelf and opening a book safely,** in three pull
  requests: **1a, built** (2026-10-28): `core/epub` (the zip reader, its caps
  and paths, the package and contents, DRM refused, a chapter cleaned with
  its parts named, the reading state's file), `platform/inflate.ts`, and the
  fixture books; **1b, built**: books in the index (an `epub` entry kind),
  SHELF, the EPUB's page kind with a chapter and its pictures, the contents
  in the list (under the book's row with two panes), the book's stylesheet
  and its tokens, the reading state kept; **1c, built**: the book's look,
  made from #49's `quick` mark (`epub.<key>`), the quick look's shelf half
  (LOOK / SHELF), worn on the book's page alone. The iOS
  simulator starts with a fixture book in its vault; opening it there needs a
  UI driver the smoke test lacks (backlog).
  - the zip reader (the browser's decompression, in the window, on desktop
    and phone alike);
  - the container, its spine and contents;
  - the caps, and no path out of the zip;
  - SHELF;
  - books in the vault's index;
  - the contents in the list;
  - a chapter drawn from cleaned nodes, with its pictures;
  - the book's look, made from #49's `quick` mark (`epub.<key>`), which
    switches on the quick look's shelf half;
  - the reading state's file;
  - the fixture books.
- **Phase 2, scrolling** (built, 2026-10-29): a chapter a sheet, the scroll style, the place
  kept; Beside a note and Quote. In three pull requests: **2a, built**
  (2026-10-29): a chapter a sheet with the chapters either side at its foot,
  how far through the chapter and the book in the colophon, the scroll
  style (*As a note*, the default, or *As a book*) in the shelf's quick
  look, and the place kept to the line (an offset in the chapter's words,
  in `.eien/reading/`, shown again after a restart, ⇄, a new width and page
  zoom); **2b, built**: the book's links (to its chapters, the place they name
  kept as a marker, never an id, with one step Back in the colophon; to
  the web and mail in the system's browser; each a link to look at, named
  in the window's tooltip, as decided under "Links in a book"), and its footnotes shown over the page (EPUB 3's noterefs, and
  EPUB 2's numbers in a sup), a copy holding its words alone; **2c, built**:
  a book beside a note, proven in each of the split's modes, its pager, ⇄,
  the phone's slip and Wide screen's Two pages with nothing made for books,
  and Quote (the selection bar, Q, a phone's ⋯) into the note beside, or
  the note a phone's one page came from, cited `— Title, Chapter`, one ⌘Z;
  a book opened beside from its SHELF row (⌘-click, ⌘Enter, its menu's Open
  to the Side), as a note's row does.
- **Phase 3, turning pages,** in four pull requests (re-split 2026-10-30
  after the design review, so paging and the place in pages land and are
  measured before the curl):
  - **3a, built:** the turn's engine, nothing a writer sees yet: the curl's
    geometry and light, the spring, a key's bounded arc, Slide and Words,
    the speed and reduced motion, a curl's states (`core/epub/turn/`,
    `ui/epub/turn/`); the curl's three tokens in `tokens.css`, beside the
    shadows (Slate's own pair in `slate.css`; a palette's, as a shadow is,
    never a writer's theme's);
  - **3b, built:** Pages and Scroll (**Read in**, Scroll the default until
    the hand's turn is in): paging in whole lines, the place in pages (the
    same offset as Scroll's), the leaf and its fore-edge, keys, the edges'
    clicks and a touch's taps turning as **Page turn** and **Turn speed**
    move them, the Pages and Scroll tools and View menu; a turn copies the
    page in sight alone (fifty turns of a 600-paragraph chapter, no long
    task, the CPU four times slower too);
  - **3c, built:** a hand's turn: a finger anywhere on the page, a mouse at
    the book's edges, the curl under the hand, the throw, the catch, a tap
    letting a page in flight fly on; under Slide and Words a drag asks;
  - **3d, built:** the spread, and Set as a book. Two pages where the
    pane holds two of 20em of the text with the sheet's margins and the
    gutter (never on a phone or in a split), turned a spread at a time
    under every Page turn, the place kept through one page and two
    (`ui/epub/spread.ts`, `page-columns.ts`); a bookmark's mark on the page
    it marks, the colophon saying both pages. Set as a book in pages alone:
    justified only where the window hyphenates the book's language
    (`hyphens.ts`: a Mac does; Electron on Windows and Linux may not, and
    there it's ragged), ragged on a phone and on a page as narrow; a
    chapter opening four lines low on the text's own line; running heads
    and folios (`running-heads.ts`, the folios the page numbers' labels);
    and Eien's title page and imprint before the first chapter
    (`front-matter.ts`, `core/epub/imprint.ts`), turned back to, never
    opened at, none of the book's words. CHAPTER and its numeral apart, as
    Showcase 2 sets them, are left: a heading's words would be split, and
    the places kept in them moved.
- **The reading room,** after the turn (it was Phase 3b).
- **Phase 4, place, bookmarks and page count:** print pages or steady
  pages; Marks in the list or on the edge. In five pull requests, stacked:
  the page's mark shared, for a bookmark to wear
  ([#132](https://github.com/onlynyans/eien/pull/132)); **4a, built:** page
  numbers, the printed edition's from the page-list, else steady pages of
  1,500 characters, the book counted once in the background, a chapter a
  task and never while a page turns (`core/epub/chapter-count.ts`,
  `page-numbers.ts`; `ui/epub/book-count.ts`); **4b, built:** bookmarks on
  the page: B, the tool, View → Bookmark This Page and the phone's ⋯; the
  Page mark worn, kept to the top of the sheet in sight as it scrolls,
  following a turn once it lands; Facing pages' clash as decided; kept in
  the reading state beside every field it doesn't know, never over a file
  it can't read (`core/epub/bookmarks.ts`, `ui/epub/page-bookmarks.ts`,
  `bookmark.css`); **4c, built:** Marks in the list: Contents and Marks
  under the book's head, the one shown pressed, its bookmarks as rows (their words, page and
  chapter; Delete takes one off), under the book's SHELF row with two panes
  (`list/book-lenses.ts`); **4d, built:** the Marks setting (*In the list*
  or *On the edge*, in the shelf's quick look) and the strip down the page
  pane's edge: chapters, bookmarks, the place as a bar, a slider to the
  keyboard, scrubbed by a finger (`ui/epub/edge-strip.ts`, `book-strip.ts`).
- **Phase 5, highlights and Find,** in four pull requests, stacked on 3d:
  one walk of a chapter's words and the reading file's lists first
  ([#139](https://github.com/onlynyans/eien/pull/139)); **5a, built:**
  highlights on the page, a pencil line under the words painted by the CSS
  Custom Highlight API over the page's own text (no element among the words
  a place counts) and a tick in the margin by each paragraph; H, the
  selection bar's Highlight, Format → Highlight (⇧⌘H, a book's words take a
  note's own command) and the phone's ⋯; taken off, the words left chosen
  and Put back in the colophon while it says so; kept in the reading file
  beside the bookmarks, decided against the file as it is when written
  (`core/epub/highlights.ts`, `ui/epub/page-highlights.ts`, `ink.ts`);
  **5b, built:** highlights among the marks: Marks rows of both kinds in
  the book's order, each saying its kind, Delete taking a highlight off
  with Put back; a highlight a pencil tick on the strip; `]` and `[`
  walking both kinds round the book, said in the colophon, and View →
  Next Mark and Previous Mark (`core/epub/marks.ts`); **5c:** Find,
  the page's own find bar over the book (the owner's answer, 2026-10-31:
  ⌘F opens the bar, as on a note) and the list's field, each a search of
  its own over one engine, its matches in washes: the book's chapters
  read in the background a slice a task, never while a page turns, and
  kept for the book searched (`core/epub/book-text.ts`, `find.ts`;
  `ui/epub/book-search.ts`, `book-find.ts`; `vault/epub-found.ts`,
  `list/found-rows.ts`).
- **Phase 6, by lamplight,** on Scroll.

Each module holds one concept, and none passes about 300 lines: the zip,
the container, paging, each turn, the marks, the book's stylesheet and the
shelf each have their own.

### Testing and CI, for every phase

A large feature with refactors under it, so every phase, Phase 0's
included, is held to the same bar.

**How each phase is done:**

1. **Design first:** a short design note, reviewed against the real code by
   a senior engineer (a Plan review) before building; its fixes adopted.
2. **Built with its tests:** every kind of test the change touches (below),
   in the same pull request, with each behaviour change shown by a test
   that would fail without it.
3. **The diff reviewed** by a second engineer before the pull request.
4. **CI clean:** all of CI's checks green on the pull request.
   - The checks: lint, types and unit tests; end to end on macOS, Windows
     and Linux; the phone's page; the browser extension; the Android build;
     the iOS simulator.
   - Nothing skipped, quarantined or retried until it passes.
   - The coverage floor never lowered (raised as the epub code lands), a
     speed budget never raised, no new dependency, CodeQL clean.
5. **Safety tests shown to fail:** a test that guards a safety rule (caps,
   paths, cleaning) is shown to fail with the rule turned off, then the rule
   is put back.

**What each kind covers in #40:**

| Kind | What it holds |
|---|---|
| Unit (`core/epub`) | The zip reader: stored and deflated entries, data descriptors, the CRC, every cap. The container: OPF, spine, manifest, nav and NCX, page-list. Paths inside the zip. The EPUB's cleaning rules: whitelist, SVG-wrapped pictures, named parts. Page numbers (print and steady). The reading state's file, keyed by the book's contents. The marks |
| Property (fast-check) | On any bytes, the zip reader ends in a book or a reason, never an unchecked throw, never past a cap. No path ever leaves the zip. The cleaner never lets out an element or attribute it doesn't keep. A place survives a round trip to a page and back. Steady page numbers only rise. A key turn's variation stays in its bounds |
| Adversarial | A zip bomb (by ratio and by total), a path out of the zip, duplicate names, a huge chapter, deep nesting. Script, handlers, style, iframe, object and form in a chapter. `javascript:` and remote addresses. Malformed XML. No `container.xml`. A DRM-locked book, refused and said so |
| DOM unit (happy-dom) | SHELF's rows and keys, the contents list, the book page's parts. A turn's states: begin, hold, let go, catch, finish, reduced motion. The settings' controls. The quick look (#49) |
| End to end (Electron, the fixture books in a real vault) | Opening from SHELF, reading, turning by key, click and drag. The place kept across a restart. Bookmarks, highlights, Find. Pictures shown. A book beside a note, Quote and its undo. The book's look apart from the notes'. The hostile books refused safely. Timed and dragging tests `ALONE` |
| Accessibility (axe) | Day and Night, all three layouts, motion reduced: SHELF, the book paged and scrolling, the marks, Find, the quick look |
| Speed budgets | A long book (three thousand pages): its first page drawn, fifty turns, a chapter scrolled, the whole book searched. No long task over 200 ms; measured first, then set with room |
| Resource budgets | Elements in the window with a book open (only the chapter in sight drawn), and the heap after reading many chapters (each released) |
| Phone page (Chromium) | SHELF, reading, turns by tap and swipe, Wide screen's rooms, a book beside a note |
| Android and iOS | The builds on CI; from Phase 1, the iOS simulator opens a fixture book |
| Mutation (weekly) | `core/epub` falls under it already (`src/core/**`); its survivors reviewed after each phase |

**The fixture books** are made by a script into `tests/fixtures/epub/`.
They're small, checked in, and the same each time the script runs.

## What all nine share

- **Books are files in the vault**, `.epub`, in any folder: Cooking holds its
  recipe notes and a cookbook side by side.
- **A sidebar section lists them**: a lens over the one folder tree. It shows
  every book, under the folders that hold one, at their depth. A folder that
  holds none itself shows only as the way to one deeper (Fic → Research). The
  folders aren't reworked: choosing Cooking under FOLDERS lists its notes, as
  now. A book's row counts how far you've read ("41%", "read"). The section
  sits last, after TAGS (the writing first), and folds per device as every
  section does.
- **Opening a book** reads it in the page pane. The note list becomes its
  contents: chapters in the book's order, each with the page it starts on.
  The chosen row is your chapter, with the selected fill and the seal's rule,
  as a note's row has. With the list hidden, the Contents tool or ⌘2 opens
  them as a menu.
- **The views' place holds the book's two**, Pages and Scroll, a pressed pair
  as Live · Source · Reading are. In the pages, the other one opens its
  exploration and keeps your place.
- **Your type, not the publisher's.** The book is set in your Typeface, with
  its size, leading and measure; ⌘+ and ⌘− zoom it as they zoom a note.
  Paragraphs are indented with no gap, as a book sets them. The book's own
  styles keep only its structure (italics, headings, a centred line), never
  its fonts or colours, so it reads by Night.
- **Safely**, as #40 plans: each chapter is drawn in a sandboxed frame, with
  no scripts and no network; the zip is read with sizes capped and no path out
  of it. The book file is never written.
- **What's kept**: your place, bookmarks and highlights, in `.eien/reading/`,
  keyed by the book's contents. A renamed or moved book keeps them, and they
  sync with the vault.
- **Keys**, once the book has the keyboard (a click in it, or ⌘3):
  - paged: → Space PgDn turn on; ← ⇧Space PgUp turn back; Home and End go to
    the chapter's start and end;
  - scrolling: the usual scrolling keys;
  - in the list: ↑ ↓ and Enter.
- **The phone:** the book is a page in the phone's stack, with the shelf
  behind its back bar. Its tools sit where the layout keeps a phone's: A in
  the bar, B a floating slip, C a rail. Paged books turn with a tap in either
  outer third, or a swipe.

### Nothing new in the system's terms

Every value is a token from `.interface-design/system.md`. The one token the
explorations' shared CSS lacked, `--eien-field`, is the app's own (the
field's wash). The marks reuse what the split's Facing pages already decided:

- the **ribbon** (ink-soft, forked, over the sheet's top edge);
- the **dog-ear** (the corner gone to the blotter, the flap in band with a
  rule-strong hairline);
- the **edge tab** (ink-soft, standing out from the outer edge).

Reading marks are pencil and ink, never the seal: the seal keeps its five
places. The current Find match uses the selection's wash, because Find
selects it.

## The section's name (an open question)

"Book" already means a folder marked as a manuscript (the BOOK mark, Export
Book), and LIBRARY is the sidebar's first section. The bar's **Section**
control renames the section in place on every page:

- **SHELF**: short, and a thing on the desk, the interface's own picture
  (desk, blotter, paper). It sits well beside LIBRARY, FOLDERS, TAGS.
- **READING**: says what you do there, but Reading is already a view of a
  note (Live · Source · Reading), so "Reading" would name two things a click
  apart.
- **BOOKSHELF**: plain, but the longest label in the sidebar, and it has
  "book" in it, the word the manuscript folders already own.

The recommendation is **SHELF**.

## Turning pages

| | For | Against |
|---|---|---|
| **1 · The spread** | The most book-like; Eien's own gutter and folios; uses a wide window; the same picture as Facing pages | Needs room: each page 20em, so with three panes at 1440px it closes to one page; a chapter's last spread may be half empty |
| **2 · One leaf, its edges** | The note's own sheet, so nothing to learn and every width works; how far you are shows as the book's fore-edge, in paper and hairlines, before any number | A wide window shows one page with blotter beside it; six edges are coarse |
| **3 · Columns to the pane** | The most words in sight, the calmest (Page frame Full and columns) | Not a book: no page, no edges; the eye runs foot-to-head across a wide screen; the columns change as panes open and shut |

### 1 · The spread

- **What:** one sheet, two pages facing across the gutter, as the split's
  Facing pages lays two notes. Running heads: the book's title over the left
  page, the chapter over the right. Folios at the foot, mirrored. A turn moves
  a spread; the outer margins turn too.
- **Narrow:** below two 20em pages it closes to one page, and the colophon
  says so. The page is never shrunk to fit.
- **Phone:** one page, always.
- **Intent:** the writer with room to open the book flat. *Palette:* paper and
  ink; the gutter is Facing pages' soft hairline. *Depth:* one sheet, one
  shadow, no fold shading (no gradients). *Type:* the text face; heads and
  folios in the machine voice. *Spacing:* the gutter is `--eien-space-8`
  between the text blocks.

### 2 · One leaf, its edges

- **What:** a book opens as a note does: one sheet, the same width and
  margins. Under it lies the rest of the book. The pages still to read stack
  at its right edge, and the pages read at its left, up to six paper edges
  `--eien-mark-w` apart, each in a `--eien-rule` hairline.
- **Turning:** the arrow keys, or click the edges. Hover an edge for "212
  pages to go".
- **Folio:** the chapter's page of its pages, and the book's page.
- **Page frame Full:** no sheet, so no edges; the colophon still counts.
- **Phone:** the fore-edge stays as hairlines down the page's right side.
- **Intent:** one page at a time beside the contents, knowing how far without
  reading a number. *Palette:* paper, blotter, ink; the edges are paper.
  *Depth:* the sheet's shadow on the top leaf alone, the stack in hairlines.
  *Spacing:* the edges are a mark's width apart.

### 3 · Columns to the pane

- **What:** Page frame Full for books. The pane is paper. The chapter flows
  into as many columns of at least 20em as fit (one, two or three), a soft
  hairline between them. A turn moves the whole screen; the side gutters turn
  too.
- **Intent:** the most words in sight. *Depth:* flat, as Full is. *Spacing:*
  `--eien-space-7` gutters.

### Recommendation: 2 · One leaf, opening to 1's spread when there's room

- **One leaf** is the note's own sheet, so a book looks like it belongs in
  Eien. It works at every width and on the phone, and the fore-edge is a
  quiet progress no other reader has.
- **When the page has room for two 20em pages**, open the book to 1's spread.
  That's the same rule Facing pages has, so the window has one idea of "two
  pages"; the edges then stand at the spread's outer sides.
- **3 is Full frame's answer** rather than a direction: in Page frame Full, a
  leaf has no edges, so it reads as one column. Columns could come later as an
  option.

## Scrolling

| | For | Against |
|---|---|---|
| **1 · A chapter a sheet** | Exactly how a note reads; one chapter is one EPUB file is one sandboxed frame, the simplest safe build; the chapter's end is a pause | A press at each chapter's end; progress through a chapter is only the scroll bar and the colophon |
| **2 · One roll** | Reads straight through; the head and the list follow you; time left, plainly | The hardest to build (frames stacked, drawn and dropped, a place that holds while they load); the scroll bar is too fine; a band always over the sheet |
| **3 · Beside a note** | What a writer reads for: the source beside the writing, a quote with its source in one key; nothing new (it's the split) | Two narrower pages; a mode on top of a reading mode |

### 1 · A chapter a sheet

- **What:** a chapter reads as a note does in Reading: one sheet that scrolls.
  At its foot, after a soft rule, the chapters before and after are word
  buttons. Nothing loads or moves until one is pressed.
- **Colophon:** how far through the chapter and the book.
- **Intent:** reading as you read your own notes. *Depth:* the note's sheet.
  *Type:* the text face; "next" in the machine voice.

### 2 · One roll

- **What:** the whole book on one long sheet, chapters running on with their
  headings and a wide space between.
- **Following you:** the sheet's running head stays at its top as a band,
  naming the chapter you're in, and the list's chosen row follows as you
  scroll. The colophon gives the time left at 250 words a minute.
- **Intent:** reading straight through. *Surfaces:* the head is a band
  (system.md's band pattern) over paper.

### 3 · Beside a note

- **What:** a book opens to the side of a note as a second note does: the
  split's Two sheets, the note on the left, the book on the right, scrolling a
  chapter at a time.
- **Tools:** one set, for the sheet you're in.
- **Quote:** select in the book and a small raised menu offers **Quote in the
  note** (`Q`) and Copy. Quote adds a Markdown quote to the note, with
  `— Pride and Prejudice, Chapter III` under it, and never touches the note's
  own words.
- **Phone:** the book and the note are a tap apart, the other's name in the
  back bar's slip (⇄), as the phone keeps the note you came from.

### Recommendation: 1 · A chapter a sheet; 3 after it

- **1 is the build's first phase** (#40: "the shelf and opening a book
  safely; scrolling"). It needs nothing the page doesn't already do, one
  frame at a time, and it's the phone's natural reader.
- **3 is the reason a writer opens a book in Eien rather than elsewhere**: a
  later step, once 1 and the split are both there. Quote with its source is
  small and worth it.
- **2 reads best straight through**, but costs the most to build safely.
  1's chapter buttons could later move on by themselves at the foot, if the
  pause is missed.

## The features

All three do all four: page count, bookmarks, highlights, Find (⌘F, as #41
gives a note). They differ in **where the marks live**, and each tries its
own look for a highlight:

| | Bookmark | Highlight | Find | Page count | Finding a mark again |
|---|---|---|---|---|---|
| **1 · On the page** | The ribbon over the page's top edge | Pencil underline, 2px, and a pencil tick in the margin | A field in the layout's bar; matches in a wash of ink | Folio and colophon; three ways to count, compared | `]` and `[` walk them |
| **2 · In the list** | A dog-ear | A wash of ink | The list's own search field; every match a row in its words | Each row's page; the folio and colophon | Marks and Found, lenses over the list, as rows |
| **3 · On the edge** | A pencil tab on the strip | A pencil bracket in the margin, the words left as printed | The bar's field; every match a dot on the strip | The edge tab's place, the folio, the colophon | The strip: point, click, or its arrow keys |

Shared by all three:

- **B** bookmarks the page (again, takes it off); **H** keeps the selected
  words (on a highlight, takes it off; ⌘Z puts it back).
- **From the keyboard**, `⇧→` selects the page's first sentence, then one
  more each time, and `⇧←` one fewer, so highlighting needs no mouse.
- **`]` and `[`** walk your marks in the book's order.

| | For | Against |
|---|---|---|
| **1 · On the page** | Nothing new opens; every mark in place, like a used paperback; the fewest parts | No list: thirty highlights later, walking is slow; a long underlined passage reads as the book's own emphasis |
| **2 · In the list** | Marks you can read all at once, a commonplace book with pages; every match in its words before you go; in a part Eien already has | Needs the list; the list's search field means the vault's notes or this book (the placeholder says which) |
| **3 · On the edge** | The whole book at a glance; where a word clusters; anywhere in one gesture; the quietest highlight | A new object always beside the page; chapters crowd in a long book; a bracket is by the line, not the word |

### Page count: three ways (Features 1's bar)

- **The screen's** (what Pages 1–3 show): exact for what you see, but it
  changes with the window, the panes and the zoom, so "page 212" means nothing
  tomorrow.
- **Steady:** a page is 1,500 characters of the book, whatever the screen.
  Its number never moves, and it's the same on the phone.
- **Print:** many EPUBs carry the printed edition's pages (a page-list).
  Where one does, its numbers match the paper copy, for citing.
- **Recommended:** Print where the book has it, else Steady, and the screen's
  turns underneath (a page number may then hold for a turn or two).

### Recommendation: 2 · In the list, with 1's marks on the page

- **2's index** (Contents, Marks, Found) is where a writer goes back to what
  they kept. Highlights listed as their own words, each with its page, are a
  commonplace book; Found shows every match in context. It's all in the
  list's own rows.
- **1's marks on the page:**
  - The **ribbon** for a bookmark: the most findable, and already Eien's.
  - The **pencil underline** with its margin tick for a highlight: quieter
    than a wash, and it leaves the wash to Find's matches, so the two never
    look alike (2 has to outline its matches to tell them apart).
  - 1's **page numbers**: Print, else Steady.
- **3's strip** is the most original, and Found's dots on it are the best map
  of a word. It's a lot of new furniture for a first build: keep it for later,
  perhaps as the scroll bar's marks.
- **One thing to settle when building:** in a split in Facing pages mode, the
  active page's mark is a ribbon, dog-ear or tab (`appearance.facingMark`). A
  book there would wear two ribbons. The bookmark should take whichever of
  the three the facing mark isn't, or the book should open beside a note only
  in Two sheets.

## The checks

Run on each page before it was called done:

- **Swap:** with a generic serif and a reader template, every page would
  change. The type is the writer's own face and the machine voice. The
  window is Eien's, with its panes, bands and colophon. The marks are
  Eien's objects.
- **Squint:** nothing jumps. The fore-edge, gutter, ticks and brackets are
  hairlines or pencil; the strongest mark is the ink-soft ribbon or tab, one
  at a time.
- **Signature:** the book as a physical thing, drawn only in Eien's depth:
  - the fore-edge (2 · One leaf);
  - the gutter and mirrored folios (1 · The spread);
  - the ribbon (Features 1);
  - the dog-ear (Features 2);
  - the edge tab and thumb index (Features 3);
  - pencil underline and bracket marginalia.
- **Tokens:** every colour, space, line and radius is a `--eien-*` token, and
  none is new. The local lengths come from them: `--leaf-gap` is a space token,
  and the phone frame copies the split's.

## Showcase

**Added 2026-10-27, after the nine.** The owner asked what could show off the
craft of Eien's design for reading. These three directions are each something
the owner could choose, and each puts one part of the system in front: the
depth (paper on a desk), the type (the writer's face and the machine's
voice), and the calm (Night as inkstone; nothing moves you didn't move). All
three keep to the nine's rules. They use the same window, the same keys, the
phone and all three layouts by Day and Night, and they add no token, shadow,
gradient or accent. The seal stays in its five places.

| | Puts in front | Mode or view |
|---|---|---|
| **1 · The reading room** | Depth: one sheet on the desk, the window stepped back | A mode over a reading view (here Pages 2) |
| **2 · Set as a book** | Type: a compositor's page in the writer's own face; the two voices | How Pages sets the text |
| **3 · By lamplight** | Calm, by Night: your place a lit paragraph on a still line | A mode over Scroll |

### 1 · The reading room

- **What:** press `R` (or the room tool) and the window steps back. The
  sidebar, the list, the bands and their rules go. What's left is the desk
  with one sheet on it, and the book's fore-edge under the sheet. That makes
  two surfaces instead of five. The lights and the seal stay in the corner (the
  app's mark) in every layout's top row. The tools wait where the layout keeps
  them, unseen until the pointer comes: A's on the desk where the band was,
  B's slip, and C's running head with its ground and rule gone. The colophon
  is a line of pencil on the desk: the chapter, the page, and the minutes left
  in the chapter. `Esc`, `R` or the seal brings the window back, with one calm
  cross-fade (none with reduced motion).
- **The sheet's own running head** names the book and the chapter, as a
  printed book's does.
- **Phone:** the page alone, paper edge to edge. A tap in its middle third
  brings the bar and the tools back; the outer thirds still turn.
- **Intent:** the writer, the night's scene done, reading another author's
  chapter in the room where they write. *Palette:* desk, paper, ink; pencil
  for the colophon. *Depth:* the sheet's shadow on the top leaf, the edges in
  hairlines, B's slip the float. *Surfaces:* desk straight to paper ("darker
  is further back"). *Type:* the text face; heads and colophon in label type.
  *Spacing:* the sheet's own margins, `--eien-space-5` of desk above it.

### 2 · Set as a book

- **What:** the book set with a compositor's care, in the writer's own
  Typeface (the bar's Typeface shows all eight). The two voices become a rule
  a reader can see. What the book's author and publisher wrote (the title,
  the author, a chapter's heading, the text) is in the text face. What Eien
  knows and counts (the running heads, the folios, the imprint) is in the
  machine's.
- **The title page** is made from the book's own details, not the
  publisher's page. The title is set high on the page at display size (the
  optical-size axis gives Newsreader and Literata their display cuts), with a
  short hairline under it and the author in the face's capitals. The folder
  it's shelved in is at the foot. `T` or the title-page tool goes there.
- **The imprint**, facing the title page, is Eien's record of this copy in
  the machine voice. It gives the book's length and how it's set, read off
  the page as it is: the face's name in that face, its size on its leading,
  the line's length, justified or ragged. It also says where the book came
  from and where your marks are kept. Change the Typeface and the imprint
  says so.
- **A chapter opens low on its page**, four lines down. CHAPTER is set in the
  face's tracked capitals, the numeral large on two lines, so the opening
  stays on the book's line grid (facing pages line up line for line). The
  first line runs in capitals a step down. None of the bundled faces has small
  capitals of its own (checked: no `smcp` in any of them), so these are
  capitals at 80%, lightly tracked.
- **The text** is justified and hyphenated (`hyphens: auto`,
  `hyphenate-limit-chars: 6 3 2`). `text-wrap: pretty` evens the lines, and no
  line is left alone at a page's head or foot (`widows` and `orphans` 2). The
  bar's Lines sets it ragged, as a note is. Opening quotes hang in the margin
  where `hanging-punctuation` is honoured (WebKit, so the iPhone); Chromium
  ignores it.
- **Running heads and folios:** the book's title on the left page and the
  chapter on the right, in label type, with folios at the outer corners. An
  opening page leaves its head off, and the front matter has neither, as a
  printed book does. Each keeps its line, so the text never moves. Pages are
  counted from the title page, so Chapter I starts on page 3. Two pages show
  when each can have 20em (Facing pages' rule), else one.
- **Phone:** one page, set the same, but ragged right (hyphenated): a phone's
  measure is too short to justify without rivers.
- **Intent:** a writer who cares how a page is set, reading in their own
  face. *Palette:* paper and ink; pencil for heads, folios and imprint;
  rule-soft for the gutter. *Depth:* one open sheet, its shadow, Facing
  pages' soft gutter. *Type:* the two voices, made visible; display optical
  sizes. *Spacing:* every line, the opening included, on `--line` (the
  shared grid); the sink is four lines.

### 3 · By lamplight

- **What:** Eien's own writing tools, Focus mode and typewriter scrolling,
  turned to reading. Your place is a paragraph. It's in full ink, the rest of
  the chapter is in pencil, and it stands on the reading line, a third of the
  way down the pane. `↓`, `J` or `Space` lights the next paragraph and the
  page glides up under it (the calm time; a jump with reduced motion), so the
  eye stays still and the book comes to it. `↑`, `K` or `⇧Space` goes back.
  Past a chapter's end comes the next chapter's first paragraph. `L` or the
  lamp tool (Focus mode's icon) turns it off and on.
- **By Night** (it opens by Night) one paragraph is lit on inkstone; by Day
  it whispers. There's no glow and no new colour: the light is an ink's
  strength, and pencil still passes contrast, so you can always read ahead
  (Focus mode's 0.32 dimming wouldn't).
- **Nothing moves you didn't move:** scroll by hand and the lamp comes to the
  paragraph on the line; click a paragraph and it's lit where it stands; a
  redraw (a layout, a width, Day or Night) keeps your paragraph on the line.
  The sheet's foot runs on so the last paragraph can reach the line.
- **Your place is exact**, a paragraph, whatever the window. The colophon
  counts by it: the paragraph of the chapter's, the minutes left, the share
  of the book.
- **Phone:** the chapter scrolls under the thumb and the lamp follows the
  line; a tap lights a paragraph; the lamp's tool sits beside Contents.
- **Intent:** the writer reading late, tired eyes, wanting never to hunt for
  their place. *Palette:* Night's inkstone; ink for the lit paragraph, pencil
  for the rest. *Depth:* the note's sheet. *Type:* the text face; the
  colophon's counts in the mono. *Spacing:* the reading line at a third; the
  foot's run is two thirds of the pane.

### For and against

| | For | Against |
|---|---|---|
| **1 · The reading room** | Eien's depth plainly: one object, one shadow, hairlines. The calmest a page can be; one key in and out; works over any reading view, later over a note's Reading view too | A mode: the contents and the shelf are a key away. A wide window is mostly empty desk. The tools are found by pointing |
| **2 · Set as a book** | Shows the writer's face as a book face; the two voices as a rule a reader can see; the imprint tells how this copy is set and where your marks are, which nothing else does; costs little to build (styles, and two pages made from the book's details) | Justified text in a narrow pane opens rivers, and hyphenation depends on the system's dictionary. Capitals at 80% are lighter than real small capitals. Two front pages to turn past (the contents skip them) |
| **3 · By lamplight** | Reuses two writing tools: nothing new to learn. A place you never lose. The eye stays on one line; calm for tired eyes, at night, on a phone in bed | Faint by Day. A paragraph is an uneven step. Scrolling only |

### Recommendation: 2 for Pages, then 1, then 3

- **2 · Set as a book is how Pages should set a book**, whichever of the
  first set wins. The opening, the first line in capitals, running heads off
  an opening page, outer folios, the line grid, and the title page with its
  imprint are styles and two generated pages: no new control. Justify only
  where a page is a full measure (Pages on the desktop); ragged on the phone
  and in Scroll, as notes are. Drop the bar's Lines and Typeface (they're
  the explorations' way of comparing; the Typeface setting already exists).
- **1 · The reading room next**, as a mode with one key over both views. It
  needs nothing the window doesn't already do (shut panes, a quiet band),
  and it shows Eien's depth most plainly.
- **3 · By lamplight later**, as a mode on Scroll 1, once Focus mode and
  typewriter scrolling are in the app to share code with. It's the strongest
  case for reading by Night, and the phone's best reader, but it's faint by
  Day.
- **Settle when building:** Set's sink and opening are on the shared `--line`
  grid, so they hold in any face. The imprint's "Your place, bookmarks and
  highlights" line should follow whatever Features decides.

### The checks

- **Swap:** with a generic serif and a reader template, all three change. The
  room is Eien's desk and sheet, the fore-edge and the seal in its corner.
  Set's whole point is the writer's face and the machine's, side by side.
  The lamp is Focus mode's ink against pencil, with Focus mode's icon.
- **Squint:** nothing jumps. The room is two tones and a hairline stack; the
  set page's strongest mark is the numeral, in ink, alone on a quiet page; the
  lamp is one paragraph a step brighter.
- **Signature:** in the room, the seal alone in the corner, the fore-edge and
  the colophon on the desk. In Set, the imprint (the face's name in that
  face), the opening on the grid, and the running head that leaves the
  opening page. In the lamp, the lit paragraph on a still reading line and the
  colophon counting by paragraph.
- **Tokens:** every colour, space, line, radius, shadow and duration is a
  `--eien-*` token. The local lengths come from them or from the pane: the
  sink is `4 × --line`, the numeral `1.5 × --eien-size-title`, the capitals'
  tracking half `--eien-track-label`, and `--lamp-run` two thirds of the
  pane's height. The room's cross-fade is `--eien-calm` on `--eien-ease`.

## Turning: three motions for the page (2026-10-28)

How a page goes when you turn it. All three turn Pages 2's leaf (the
recommended one) so only the motion differs, and each ends with the
fore-edge a step on. The bar's **Speed** shows a motion four times slower,
and **Motion** shows what reduced motion does: the page changes at once, as
Eien's rule asks ("none with reduced motion").

Shared by all three:

- **Asked for, so it moves:** a key, a click on an edge or margin, a tap in a
  phone's outer third, or a drag. Nothing turns that you didn't turn.
- **Never in the way:** a key pressed mid-turn finishes the turn at once and
  starts the next, so fast reading never waits on a motion. The next page is
  laid out under the motion from its first frame.
- **Held by hand** (1 and 2): drag an edge or a margin (anywhere on the
  phone's page) and the motion follows the pointer part way. Let go past a
  third and it turns; short of it, it falls back. This works across a
  chapter's end too.
- **Tokens only:**
  - durations are multiples of `--eien-calm`, on `--eien-ease`, with no
    spring;
  - depth is the two shadows: the sheet's at rest, the float shadow on a
    sheet in your hand;
  - a leaf's back is the band's tone in a rule-strong hairline (the dog-ear's
    flap);
  - no gradient shades a turn.
- **Built** from `_src/epub-flip.js` and `epub-flip.css`. The leaf is
  `epub-stack.*`, now shared with Pages 2.

| | What moves | Time | For | Against |
|---|---|---|---|---|
| **1 · The leaf turns** | The page rises at its outer edge and turns over the spine; past upright, its back; it lies down with the pages read | 2 × calm (440ms) | Unmistakably a book; held by hand; Eien's depth | The longest; 3D in a flat window; on one page it lies down where no left page is (it's the spread's turn) |
| **2 · Set aside** | The page read is lifted (float shadow) and carried off left, out past the blotter; the next lay under it | 2 × calm (440ms) | Eien's own picture, sheets on a desk; flat; the page beneath is still and readable at once | Less of a book; a long way to travel; back is on, mirrored |
| **3 · The words turn** | Nothing but the ink: the words step out a space-2 toward where you go (quick), the next page's step in (calm) | quick + calm (340ms) | The calmest and fastest; works for every direction, width and layout; e-paper's way | The least like a book; nothing to hold on a phone |

### 1 · The leaf turns

- **What:** the page rises at its outer edge and turns over the spine, its
  left edge, in perspective two and a half sheet-widths off. It narrows as
  it rises; past upright you see its back, and it lies down to the left,
  fading. Back, the last page read turns over onto the page.
- **The tail:** on Eien's ease it's upright at nine tenths of the way, about
  half the time. The rest is its back lying down, while the next page is
  already there to read. On one page the back lies over the blotter, where
  no left page is, so in the spread (Pages 1) it would land on the left page
  as in print.
- **Intent:** the reader who wants a book. *Depth:* the float shadow in the
  air, the sheet's at rest. *Palette:* the back is the band and a rule-strong
  hairline.

### 2 · Set aside

- **What:** sheets on a desk, the way Eien draws a note. The page you've
  read is lifted in the first steps (the float shadow, as a dragged row
  wears it) and carried off to the left, out past the blotter's edge. The
  next page was beneath it all along. Back, the top sheet of the read pile
  is carried back over the page and set down.
- **Intent:** Eien's own picture, not a bound book's. *Depth:* a sheet in
  hand floats; the one beneath lies. Nothing turns over or narrows.

### 3 · The words turn

- **What:** the paper never moves. The page's words step out
  `--eien-space-2` toward where you're going, in the quick time. The next
  page's words step in from the other side over the calm time after them, so
  two pages' words never lie on each other.
- **Holding it:** there's nothing to hold. A drag or a swipe asks for the
  turn, as a key does.
- **Intent:** the reader of a long book at night; nothing moves but ink,
  which is all Eien moves in a note.

### Recommendation: 3 for a key or a click, 2 for a hand

- **The motion follows the input.** A key or a click moves no object, so its
  turn is 3's: the words step and the page is readable in a third of a
  second, as calm as everything else in Eien.
- **A hand moves things.** A drag on the desktop, or a finger on the phone,
  takes hold of the sheet as 2 sets it aside: it follows the hand and goes
  where the hand sends it. That's the gesture a phone teaches, in Eien's
  flat depth.
- **1 is the spread's**, if the owner wants a book's turn. It's at its best
  over a gutter, where the leaf has a left page to land on. On one page its
  second half is out of sight.
- **Reduced motion:** all three become an instant change, so the choice
  costs nothing there.

### 4 · The curl (added 2026-10-28)

Asked for after the first three: the tight, held turn of the best EPUB
readers, and what it costs Eien.

- **The geometry:** the page bends.
  - **The corner follows you:** the corner you hold stays under the pointer,
    and the paper rolls over a cylinder whose axis follows it, then lies back
    on itself on top. A top corner peels on a slant; the middle of the edge
    rolls straight.
  - **The roll is round:** drawn in twelve strips of the live page, each laid
    where its part of the cylinder falls, so the free edges curve. The front
    turns away, its words squeezing; then the back comes over. Each strip is
    shaded by how it faces you (edge-on darkest, a glint past the top),
    ramped so the roll reads as one curve. Flat at rest, roundest half way (a
    fifth of the page), flat again as it lands.
  - **The paper can't stretch:** the spine's edge always stays down.
  - **Cuts of the live page:** what stays, the roll's strips, what lies back
    on top (its back showing the words faintly through the paper) and the
    page beneath.
  - **No snapshot:** nothing is pictured, so the book's sandboxed frame could
    be drawn the same way in the app.
- **The physics:** this is where the tightness lives.
  - **One to one:** the corner is wherever the pointer is, every frame.
  - **Let go and your speed decides:** the throw is projected from the
    drag's last 80ms. Past a quarter of the page from the spine it turns; a
    flick turns it from a few centimetres in.
  - **A spring with no bounce:** the finish is critically damped, starting
    at the hand's own speed and landing in about 1.5 × calm. A throw hard
    enough to carry past its mark stops there, so it never bounces back.
  - **Catch it:** a page in flight can be caught and dragged on or back.
  - **Keys and clicks:** a key is a hand's turn. The corner rides an upward
    arc from the outer edge, up and over and down as it lands, and no two
    turns are alike. Four things vary, each by at most a third of its range
    from the last turn's, never past its bounds (turned back at a bound
    rather than held there):
    - where it's taken: 74–94% of the way down the edge;
    - how high it rises: 6–16% of the page;
    - its pace: ±10%;
    - where the arc peaks: a little early or late.

    So the turns differ the way one hand's do, and never jump. Checked over
    40 turns: every value in bounds, no step over a third, every turn rose
    and landed where it was taken, each in about 330–350ms.
  - **Never stuck:** each frame has a timer behind it, so a turn lands even
    where frames stall.
- **The exception it asks for.** A curl reads as paper because of light,
  which `system.md` doesn't allow today. It asks for three tokens, used only
  while a page moves, each a light-dark pair a theme can carry. At rest there
  are no gradients and no third shadow.
  - `--eien-curl-shade`: made from the sheet shadow's ink. It shades the page
    beneath along the fold, the page curving into the fold, and the lifted
    paper's one soft shadow (the third shadow).
  - `--eien-curl-light`: the crest of the roll.
  - `--eien-curl-through`: how much of the words shows through the back
    (12%).

| | For | Against |
|---|---|---|
| **4 · The curl** | The turn people know from the best readers: held, thrown, caught; the paper never trails the finger; live text throughout | Bends two of Eien's rules (gradients, two shadows), if only in motion; fourteen clipped copies of the page per frame cost the most, on a slow phone most of all; the roll is twelve flat strips, faceted up close (a WebGL mesh would be exact, but needs a snapshot the phone can't take of the frame) |

**If it's chosen:** 4 would take 2's place under a hand (a drag, or a finger
on the phone), and keys and clicks would stay 3's quiet step. Its physics
(one to one, the throw, the spring that lands, the catch) could also be
given to 2 alone, keeping Eien's rules whole: most of what feels tight is
there rather than in the bend.

