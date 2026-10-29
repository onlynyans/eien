# A page holds a note or an EPUB

**Backlog #40, Phase 0, the second refactor** (built 2026-10-28, reviewed
before and after). Nothing a writer sees changes: no EPUB can be opened yet.
The page pane's pages carry what they hold without asking what it is, so
Phase 1's EPUB page drops in beside the note page, and "an EPUB beside a
note" (with Quote into the note) needs no special case in the split, its
pager, swap, the phone's ⇄ or Wide screen's rooms.

The word in code is **epub** (CLAUDE.md, Words): "book" is a manuscript
folder. The UI's word (SHELF, "book") is Phase 1's.

## Before

`Side` was `{ page: PageView, note: OpenNote, versions: VersionsUI }`, and
every page was one. The pane took `PageView`, a note's sheet and editor, and
the controller's readers reached `side.note.path`, `side.page.editor` and
`side.versions` directly.

## The seam

### What the pane asks of a page: `page/page-leaf.ts`

`PageKind` (`'note' | 'epub'`) and `PaneLeaf`, which extends the frame
(`PageLeaf`: element, head, folio) with what the pane, the row and the
window ask of any page: its `name` (the pager, the closed book's edge, its
label), `runningCrumbs`, `aside` (a note's versions panel), `under` (a
note's table bar), `foot`, `find`, `tipped` (its controls with tooltips: its ×, a
note's tags' +), `focus`, `key` (a key on the pane: a note's #) and
`dispose`.

`LeafFoot` is a page's own colophon items, in the colophon's order round the
window's: `lead` (a note's tags), `figures` (its words and save), the
window's counters, `trail` (its last seal), the zoom and news, `said`. Where
the split gives each page its own foot, `figures` and `trail` go there. This
is the seam for **an EPUB's own colophon items**.

`PageView` implements it, its colophon items `page/note-foot.ts`'s
`NoteFoot`; `PagePane` and `PagesRow` take `PaneLeaf`.

### Find on a page: `PaneLeaf.find`

The menu's Find, Find and Replace, Find Next and Find Previous (and a
phone's ⋯ → Find) go to the active page's `find` (`PageFind`: `open(replace)`,
`next`, `previous`), whatever it holds: Find is a page's command, not a
note's, so the menu greying by `on` (Phase 1) leaves it on. A note's does
nothing where its text isn't on the page (outline cards, a seal compared).

The find bar (`find/find-bar.ts`, set apart from CodeMirror in Phase 0's
third refactor) searches nothing itself. What it searches is a `FindTarget`: `open`,
`close`, `chosen`, `valid`, `query(query, narrow)`, `next`, `previous`,
`count`, and, where the text can change, `replace` (`one`, `all`,
`locked`); without `replace` the bar draws no Replace. It tells the bar
`shown(open)` and `changed()`. A note's is `editor/find.ts`'s `NoteFind`,
CodeMirror's search as it was. Phase 5's EPUB page makes a `FindBar` over
its own target, a matcher over its drawn chapters, and gives a `PageFind`
over it. Its keys: Esc and Enter in the bar are the bar's own; the
target's `key` (optional) comes first (a note's: CodeMirror's find keymap,
Shift as held for ⇧⌘G). An EPUB's bar gets ⌘F, ⌘G and ⇧⌘G on the desktop
through the Electron menu; a phone with a hardware keyboard has no menu, so
⌘G in its bar needs a `key` on the EPUB's target or a key matcher of the
bar's own, and
`PaneLeaf.key` can take ⌘F outside a field. Playwright's key presses never
reach the native menu, so Phase 5's end-to-end tests can't test that route
by keyboard.

### What the controller holds per page: `vault/page-side.ts`

- `Place`: `{ path, name }`, where a page was in what it showed and what it
  called it then; the phone's ⇄ names it and goes back there. A note's
  (`NotePlace`) adds its caret and scroll.
- `Side`: `kind`, `page`, `path`, `place`, `left` (what the page showed
  before: the same object until it leaves another, as ⇄ tells a new one by
  it), `open(path, place?)` (nothing once disposed), `clear()` (what it shows
  went to the trash), `follow(values)` and `dispose()`.
- `PageKindOf`: a kind's `holds(path)` and `make(hooks, left)`, and its
  upkeep over its pages: `flush`, `diskChanged`, `followMoves`, `sync` and
  `stop`, each given `sides`, the pane's pages of that kind now (one kind
  per `PageKind`). The upkeep is the kind's, not each page's, because what
  its pages hold can outlive them: a note's page closed within the save's
  pause holds its note till saved, and only the kind's `flush` (the window's
  open notes, every one) reaches it, so a quit waits for those words even
  with another kind's page in its slot. `sync` runs on every redraw; not
  every kind needs it (a note's seals do), but as a hook the controller
  never reaches into a kind's parts.

`vault/note-side.ts` is one note's page: `NoteSide` (adding `page: PageView`,
`note`, `versions`), `isNote`, and `makeNoteSide`. `vault/note-pages.ts` is
the note's kind over all its pages: `noteKind`, which holds every file no
other kind does, with its upkeep (count the words, then save every open
note; the open notes and each page's seals told of the disk; the open notes
follow moves; each page's seals synced and stopped), and `NotePages`, what
the window asks of notes alone. A note's page, closed, **holds its note till
its words are saved**, then lets it go (a save that fails tries again, and
the note is let go once one works), and is told nothing more meanwhile:
before this, a page closed (⌘W, its ×, a phone's room closing the page
beside) within the pause before a save dropped the last words typed.

### The controller: `vault/pages.ts`

- `PagesOf.kinds`: the kinds besides a note's, the first that holds a file
  showing it. None in the app today; Phase 1 passes the EPUB's; the tests
  pass a stand-in (`vault/stand-in-kind.ts`).
- `open(path, beside, place)`: a page beside is made of `path`'s kind; the
  page it lands on, if of another kind, is **replaced in its slot** by one of
  that kind, which starts with the old one's place as its `left` (so ⇄ goes
  back across kinds). The pane lays it out first (its running crumbs, table
  bar and aside swapped for the new page's, the page beside never moved, the
  furniture not made to arrive again), then the old one lets go, and the
  keyboard goes to the new one if the old one had it.
- Every page, made, follows the settings and becomes active when the writer
  goes into it.
- The arrangement, whatever the pages hold: `active`, `other`, `sides`,
  `shown()` (the paths the list marks), `activate`, `toggle`, `focusOther`,
  `close`, `swap`, `closed`; and `flush`, `diskChanged`, `followMoves`,
  `sync` and `stop`, each the kinds' upkeep (`flush` all at once, so one
  kind's save never waits for another's), then the pane's or the shared
  parts' own. `activeNote` is the active page when it holds a note, which
  every reader of a note's parts goes through.
- `pages.notes` (`NotePages`), a note's alone: `sessions`, `session`,
  `freeze`, `amendOpen` and `flushWords`, for the organizer, the counters
  and Copy as HTML. They stay a note's: only a note has a session to wait
  for before a move, words to hold still while it moves, or a text Eien
  amends (a seal's id).

### Tools: `chrome/commands.ts`

`CommandDef.on?: PageKind`, the kind of page a command acts on; without it,
any page or the window. `on: 'note'`: the views, Compare, Seal, Versions,
Copy as HTML, Focus mode, the companion's ⋯ and every `format.*`.
`actsOn(id, kind)` is the one rule:

- **The layout's hosts** (shared, for the page the tools act on,
  `chrome-wiring.ts`'s `target`; how each looks, `vault/command-looks.ts`,
  the window's apart from a note's): a command for another kind looks disabled,
  never hidden, as `Host.fold` owns `hidden` and its ⋯ already skips what's
  disabled. Phase 1 adds the EPUB's tools with `on: 'epub'` to the layouts'
  host lists, disabled on a note's page as a note's are on an EPUB's.
- **A page's own host** (`page-hosts.ts`: Facing pages' folio, a companion's
  head): the mode's commands for its page's kind only, so an EPUB in Facing
  pages has its × alone until Phase 3 adds its own to the mode's list.
- **The menu's commands** (`vault/commands.ts`): a note's command with
  another kind active does nothing.
- **The menu bar and the phone's ⋯** (after Phase 1): `menuOff(kind)`
  beside `actsOn` is every control's `sends` whose `on` is another kind,
  and the menu's own commands a note's page alone has (every format, Export
  HTML… and Export Note, Outline Cards, Typewriter Scrolling, Show Markdown
  Marks). The phone's ⋯ greys by it; the window sends it to the main process
  (`WindowBridge.greyMenu`, `window:grey-menu`) when the kind in front
  changes, and `[]` as it stops. The main process (`app/electron/
  menu-grey.ts`) takes only the bar's own commands (each item's id is its
  command), keeps each window's, wears the focused window's, greys a submenu
  whose commands all are (Export Note) but never a menu of the bar, and
  greys nothing once the last window closes. `tests/menu-off.test.ts` holds
  every command `menuOff` names to an item of the bar on each system.

Quote into the note (Phase 2) is an EPUB command whose target is the other
page when it holds a note: `pages.other` and `isNote`.

## Phase 1: the EPUB's kind (built, 1b)

`ui/epub/epub-kind.ts` is the second kind, passed to `Pages` as
`kinds: [epubs.kind]` by `vault/epub-wiring.ts`; nothing in `pages.ts`
changed. Its upkeep:

- `flush` waits for the place last kept (the reading state's file);
- `diskChanged` reads a book again when its file changed and is still there;
- `followMoves` follows a book this window moved, a folder above it
  included: the organizer tells the kind `moved(from, to)` (a new, optional
  `OrganizeContext.moved`), and the next `followMoves` applies it. Nothing
  holds a book still while it moves: a page with nothing to type into needs
  no `freeze`;
- `sync` lets a page go whose book is no longer in the vault;
- `stop` forgets the moves told.

`isEpub(side)` tells an EPUB's page from the tests' stand-in, which shares the
name 'epub'. The phone's ⋯ disables a note's own choices with a book in
front (`MoreState.kind`).

## Still to come

- The companion's ⋯ for an EPUB (Phase 2), and the words 'This note', 'More
  for this note', 'No note' and the phone's "other note" for a page that
  holds a book.
- Outline cards, Copy as HTML, the exports and the book's count act on a
  note's page; with an EPUB in front they do nothing.

## Tests

DOM unit tests through the real `Pages`, with the stand-in kind
(`vault/page-kinds*.test.ts`): a page of another kind beside a note and a
note beside it (the row, labels, colophon, running head); a page replaced in
its slot (the page beside never moved, the old one's parts gone, its note
its `left`, the keyboard carried, outline cards put away, racing opens);
swap, close, its own ×, the settings, the trash; each kind handed its own
pages alone, and a closed note page still saving waited for by a flush with
the stand-in in its slot (`page-kinds-upkeep.test.ts`); the pager folded and the
closed book's edge; Facing pages' and a companion's own hosts by kind; ⇄
across kinds, each where it was left; Two pages, One at a time and a room
with one page; a drop on its page; the layout's tools and the menu's
commands with it in front. `pages-split.test.ts` shows a closed page saving
the words typed on it.
