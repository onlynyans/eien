# Changelog

What changed in each version of Eien, newest first. Versions follow
[Semantic Versioning](https://semver.org) below 1.0: a minor version for
features, a patch for fixes alone. Numbers in brackets are pull requests on
GitHub (`github.com/onlynyans/eien/pull/<number>`). After 0.4.0, each section
is drafted from pull requests' titles by `npm run changelog` (AGENTS.md →
Releases).

0.2.0 and 0.3.0 were set down afterwards, on 2026-10-28, from main's history:
nothing was built or published for them, and each ends at the commit named
under its heading.

## 0.5.0 — 2026-11-01

The EPUB reader: books on a shelf of their own, read in pages or by scrolling,
with bookmarks, highlights and Find, on the desktop and the phone. Tested on a
Galaxy Z Fold 5, and fitted to it.

### Features

- **epub:** read an EPUB: it's opened safely (its zip and its pages checked before anything is shown), and SHELF lists your books, apart from FOLDERS, which keeps to writing (#112, #113, #120, #126)
- **epub:** a book's own look, from the quick look: its typeface, size, spacing and width, apart from your notes' (#114)
- **epub:** read by scrolling, a chapter a sheet, or in pages turned by key, click, tap or a finger's curl; one page or two as the screen allows, set as a printed book with running heads and folios (#122, #129, #130, #131, #138, #143)
- **epub:** a book's links and footnotes work, and its notes open over the page (#123)
- **epub:** a book beside a note, and Quote: chosen words go into the note, cited (#125)
- **epub:** page numbers: the printed edition's where the book has them, else the chapter's own pages, and a shorter colophon that says where you are (#133, #155)
- **epub:** bookmarks and highlights, listed under Marks or down the page's edge, and ] and [ to walk them (#134, #135, #136, #140, #141)
- **epub:** Find in a book, from the list's search or the page's find bar, and Find and Marks among a book's tools (#142, #166)
- **epub:** on a touch screen, a long press chooses words, with Highlight, Quote and Copy in a bar at the page's foot (#157)
- **phone:** a new install opens with two panes; a foldable opened shows the panes at any zoom; back opens shut panes; a swipe turns the chapter while scrolling (#148, #153, #156)
- **editor:** a link's tools in Live, in three styles to choose from (#121)
- **settings:** text size down to 50% (#150)
- **icons:** the quick look's Aa drawn as a serif (#151)

### Fixes

- **epub:** a page turned by a finger on Android, and a turn let go falls back home (#137)
- **epub:** a page turn never flickers, never shifts a line, and turns one page round the gutter on two (#144, #152, #160, #169)
- **epub:** a picture alone never brings a blank page before it, an SVG's included (#159, #170)
- **epub:** a book's page uses the height it's given on a phone, and its head names the book (#163, #164)
- **phone:** a book's tools in every Wide screen room (#154)
- **list:** a book's title runs the whole line, its Contents, Marks and Found on their own row (#161)
- **settings:** Page width is offered only where it changes the page (#162)
- **sidebar:** SHELF's triangle turns as its folder opens (#158)

### Other

- the end-to-end tests run on macOS and Windows in halves, and tests that outgrew the app made whole (#116, #165, #168)
- a long book's search kept quick (#149)
- dependencies updated (#98)

## 0.4.0 — 2026-10-28

The first version built since 0.1.0. The EPUB reader's groundwork is in it;
the reader itself starts in 0.5.0.

### Features

- **extension:** Eien Reader: AO3 and FanFiction.Net on Eien's paper, as a browser extension (#86)
- **editor:** find and replace in the note (#83)
- **phone:** Wide screen, for foldables and tablets: Panes, One at a time, Side by side and Two pages (#84, #93, #95)
- **phone:** Interface zoom: the whole interface smaller or larger, laid out again (#91)
- **list:** a folder's list can show its subfolders' notes too (#82)
- **editor:** Hide tags and IDs (#88)
- **editor:** code blocks: fences out of sight, code at the words' scale (#96)
- **editor:** paste keeps the page's own marks as written (#81)
- toolbars that fit any width: tools that don't fit fold behind a ⋯ (#89)
- **settings:** a quick look for notes: the look's everyday settings in a popover (⇧⌘L), with line spacing and page width (#105)

### Fixes

- panes keep their place when shut and opened again (#77)
- **editor:** a table's grips and + show only where the pointer or caret is (#75)
- a steady top bar while the window resizes (#76)
- **editor:** the find bar in sight, even, and drawn in the set's own hand (#90)
- **sidebar:** a folder opened or closed leaves the tree where it was (#92)
- **sidebar:** the sync icon level (#96)
- **editor:** curly quotes and pasted tables in linear time, a cell's escaped pipe kept (#110)
- a table cell's code shows its pipes in Copy as HTML and exports, and a pasted link keeps its backslashes (#111)

### Other

- explorations: a link's tooltip in Live (#79), reading EPUBs (#80), foldables and tablets (#78), the extension's pages (#87)
- one word for each feature: extension, epub, reader, book (#94)
- the backlog's stage 4, and system.md's tokens and patterns after it
- macOS's end-to-end tests get 30 minutes (#85)
- **epub:** explorations: three motions for turning the page (#97); and for a quick look, anywhere (#99)
- **epub:** one cleaner for a page's HTML, shared by the extension and, later, the EPUB reader (#100)
- **epub:** a page holds a note or an EPUB: the page-kind seam (#101)
- one version from `package.json` for every build, Conventional Commits on pull requests' titles, and this changelog (#102)
- **epub:** the split's files back under 300 lines, and the find bar apart from CodeMirror, so a book can have Find (#103, #104)
- one `isInside` for a path in a folder (#106); the layout in AGENTS.md, one line per module (#107); the docs say Phase 0 is built (#109)
- the word diff's speed test timed against reading the words, not a clock (#108); CodeQL leaves the design explorations alone (#110)

## 0.3.0 — 2026-10-26

Ends at `2491dbd`.

### Features

- **split:** two notes side by side in one window, with Two sheets; the page pane holds pages (#65, #66)
- **split:** Facing pages: the split as one book, with three marks for the page you're in
- **split:** Companion: the second note beside the page, with its own head and foot
- **split:** Tools that follow: the list steps aside, and the page's tools stand over the page you're in
- **phone:** the note you came from, a tap away, keeping its place (#70)

### Fixes

- **split:** the other page's × on its sheet, and the left bar clear of the window's controls

### Other

- explorations: a split window, and New Window (#59)
- three Windows flakes, the tests' own (#73); every file read inside `expect.poll` is quiet (#74)
- the renderer's CSS budget measured again with the split's modes; system.md with the split finished

## 0.2.0 — 2026-10-23

Ends at `ab9a78c`.

### Features

- **editor:** Live hides the marks and draws tables in place, with a Table button; an image dropped or pasted goes into the note's `.assets` (#56)
- **editor:** the table editor in Live: grips, menus, +, keys, and a phone's bar (#58)
- many windows: File → New Window, Open in New Window, Close Window, each folder's vault opened once (#62, #63)
- **editor:** one note, one document: every view of a note shares its text and its history (#64)
- the Interface and Source fonts, softer fields, the seal's corners, a two-pane sidebar, plainer wording (#54)
- **sidebar:** shut, it's the seal alone, or a strip of desk with a shoulder (#57)

### Other

- explorations: tables in Live, and the window's corner (#55)
- system.md's latest tokens and patterns (#60); the quiet icons' opacity read with their fade finished (#71)
- two end-to-end workers on macOS too (#72)

## 0.1.0 — 2026-10-22

The first version: phases 1 to 11 of the spec, and stage 3's design.

### Features

- a vault is a folder of Markdown files, and Eien saves as you write (#2)
- the editor (#3), with scene breaks by Enter, focus mode and typewriter scrolling (#13), and macOS's own spellcheck (#16)
- the design system and settings (#4); Settings over the window: categories, This vault, faces, weights, the Themes tabs (#40)
- the vault's index: previews, tags and search (#5); search in the list (#30)
- organizing notes: rename, move, your order, books, pins, the trash (#7); rename in the row, and a right-click menu of Eien's own (#42)
- panes resized, shut and opened; two panes (#9); the sidebar's sections fold, with guide lines and books (#28)
- seals: ⌘S, Compare, the versions panel (#11)
- Copy for AO3, paste from HTML, curly quotes (#12); Copy as HTML (#53)
- today's words, the book's against its goal, sprints (#14); outline cards (#15)
- **phone:** Eien on Android (#17) and iOS (#24); the phone's layout, one pane at a time (#20)
- **export:** EPUB, Word and PDF, and a Markdown folder imported (#19), with their images (#21)
- installers, portable copies, and where Eien keeps things (#22)
- no title bar, the whole interface zoomed, AltGr-safe headings (#29)
- writer themes: the gallery, your own in `.eien/themes`, the mix (#34)
- three layouts as a setting (#36); the page's tags and the formatting bar (#41); New note is the quiet + (#51)
- the app's icon: the seal, 永 from Noto Serif JP (#35, #53)

### Fixes

- what the adversarial pass found (#6)
- sync: changes while a vault opens, a phone's half-done rename (#18); case twins, synced temp files, iOS's file coordination (#25)
- a Restore under way when another note opens finishes in its own file
- typing beside six thousand rows in the tree; only the rows in sight drawn (#37)

### Other

- the spec, the scaffold, and the design pass (#1)
- property tests on every push, mutation testing every week (#8, #10); DOM unit tests, axe, resource and speed budgets in CI (#37, #39)
- the README, the handbook, the backlog and the design's explorations (#26, #27, #31, #32, #50, #52)
