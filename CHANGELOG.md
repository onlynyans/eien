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

## Unreleased

Proposed as 0.4.0, the first version built since 0.1.0; the owner decides when.

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

### Fixes

- panes keep their place when shut and opened again (#77)
- **editor:** a table's grips and + show only where the pointer or caret is (#75)
- a steady top bar while the window resizes (#76)
- **editor:** the find bar in sight, even, and drawn in the set's own hand (#90)
- **sidebar:** a folder opened or closed leaves the tree where it was (#92)
- **sidebar:** the sync icon level (#96)

### Other

- explorations: a link's tooltip in Live (#79), reading EPUBs (#80), foldables and tablets (#78), the extension's pages (#87)
- one word for each feature: extension, epub, reader, book (#94)
- the backlog's stage 4, and system.md's tokens and patterns after it
- macOS's end-to-end tests get 30 minutes (#85)
- **epub:** explorations: three motions for turning the page (#97); and for a quick look, anywhere (#99)
- **epub:** one cleaner for a page's HTML, shared by the extension and, later, the EPUB reader (#100)
- **epub:** a page holds a note or an EPUB: the page-kind seam (#101)
- one version from `package.json` for every build, Conventional Commits on pull requests' titles, and this changelog

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
