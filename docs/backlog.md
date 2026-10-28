# Backlog

What to do next, collected after phase 11 (from 2026-10-20). Every phase in
the [spec](spec.md#12-phases) is built; these are the fixes, tweaks and
features that came after, and the plan for them (below the table).

- **Type**: *fix*, it's broken or not as designed; *gap*, the spec says it
  and it isn't built; *tweak*, a change to something that works; *feature*,
  something new; *chore*, work that isn't the app's behaviour.
- **Design**: *yes* means the interface-design pass mocks it up and explores
  where it fits before it's built; *port* means the mockup in `docs/design`
  already has it, to be carried over as it is.
- **From**: who raised it. *You* is the owner; *audit* is the design audit of
  2026-10-20 (below).

| # | Task | Type | Area | What and why | Now | Design | From |
|---|---|---|---|---|---|---|---|
| 1 | No title bar | tweak | Window | The window takes the title bar's space, as Claude's does: the traffic lights sit over the app, and the strip drags the window. Icons may go there later. Do this first, before the other interface work. | **Done** ([#29](https://github.com/onlynyans/eien/pull/29), [#36](https://github.com/onlynyans/eien/pull/36)): the traffic lights over the sidebar's head on macOS; the system's controls over the page's band, in its colours, on Windows and Linux; the top bands drag the window. In Running head, one 40px strip across the window holds the lights, the panes' icons, the breadcrumb and every page tool | yes, later (what goes in the strip) | you |
| 2 | Zoom the whole interface | tweak | Window | ⌘+ and ⌘− scale every pane, as a browser zooms. With the keyboard in the page, they zoom the page alone, as now. | **Done** ([#29](https://github.com/onlynyans/eien/pull/29)): the whole window outside the page, the page alone inside it; Interface zoom in Settings → Layout | – | you |
| 3 | Sections fold | fix | Sidebar | LIBRARY, FOLDERS and TAGS fold and open when their label is clicked, with the twisty, as the mockup's `.section__label` does. | **Done** in #28 | port | you, audit |
| 4 | A quiet + for a new folder or tag | tweak | Sidebar | A + at the right of FOLDERS and TAGS, shown on hover or keyboard focus, in place of the NEW FOLDER word button. The + beside TAGS makes a tag with no notes yet, named in place (kept in `.eien/tags.json`). | **Done** ([#43](https://github.com/onlynyans/eien/pull/43)): a + at the right of FOLDERS and TAGS, in sight on hover or focus; a tag made there is named in place, kept in `.eien/tags.json` until notes carry it, listed faded with a line saying how to give it notes, and taken back out from its menu | yes: [tags](design/explorations/tags.md) | you |
| 5 | Tree guide lines | fix | Sidebar | The hairline down an open folder's children (`.tree [role='group']::before` in `docs/design/desktop.css`). | **Done** in #28 | port | you, audit |
| 6 | BOOK mark | fix | Sidebar | The BOOK mark beside a folder that's a book (`.book-mark`). | **Done** in #28 | port | you, audit |
| 7 | Pinned in sight | tweak | Sidebar | Pinned always under Library, even with nothing pinned, as the mockup shows it, and a way to pin that can be found without right-clicking. | **Done** ([#43](https://github.com/onlynyans/eien/pull/43)): Pinned is always under Library, with its pin; empty, its list says how to pin; ⇧⌘P (Ctrl+Shift+P) on a row pins or unpins it ([#42](https://github.com/onlynyans/eien/pull/42)) | yes: [overall](design/explorations/overall.md) | you |
| 8 | Icons at the sidebar's foot | tweak | Sidebar | DAY and NIGHT become one toggle with sun and moon icons, as Otaku's; SETTINGS, 3 PANES and 2 PANES become icons. | **Done** ([#36](https://github.com/onlynyans/eien/pull/36)): the count, then a sun-or-moon toggle, three panes or two, and settings, as icons | yes | you |
| 9 | "1 NOTES" | fix | Sidebar | The foot says "1 NOTES" for one note; the list's head already says "1 NOTE". | **Done** in #28 | – | review |
| 10 | Sync status | gap | Sidebar | A sync icon at the sidebar's foot, with a tooltip: "Synced · Syncthing, 4m ago", or "Changed on another device 4m ago". Nothing at all when the vault isn't a Syncthing folder (no `.stfolder` marker). | **Done** ([#44](https://github.com/onlynyans/eien/pull/44)): a sync icon at the sidebar's foot when a `.stfolder` marks the vault (or, on the desktop, a folder it's in); "Synced · Syncthing" in the added ink, "Changed on another device 4m ago" in pencil for 15 minutes after a note changes that this window didn't change; nothing without Syncthing | yes: [overall](design/explorations/overall.md) | audit, you |
| 11 | Search in the list | tweak | List | The search field at the top of the list pane, above its heading, as in the mockup, searching only the notes that list holds. With two panes, or the list shut, it's in the sidebar and searches there. | **Done** ([#30](https://github.com/onlynyans/eien/pull/30)): on the list's band, that list's notes; in the sidebar with no list in sight (and on a phone), the whole vault | yes | you |
| 12 | Your order, and a lens over it | feature | Sidebar, list | One system for both panes. Every list keeps your order, written to the vault: folders, subfolders, notes, tags, All Notes. Drag to reorder folders and tags, and drag a folder out of its parent. A sort (newest, title A–Z or Z–A) or a filter is a lens laid over your order, like a spreadsheet's filter: cleared to get your order back. Dragging reorders only while no lens is on. | **Done**: the lens ([#45](https://github.com/onlynyans/eien/pull/45)); folders and tags in your order ([#46](https://github.com/onlynyans/eien/pull/46)); All Notes in your order and Arrange mode ([#49](https://github.com/onlynyans/eien/pull/49)). Tags move by keys, not a drag | yes: [order](design/explorations/order.md) | you |
| 13 | Tags on the page | feature | Page | The note's tags at the top right of the sheet, as the mockup has them (#fic/aot #posted), with a way to add and remove one there. | **Done** ([#41](https://github.com/onlynyans/eien/pull/41)): in Band's running head, Slip's slips under the title, Running head's colophon, a phone's slips; + or # adds one from the vault's tags (or makes one), × takes a front-matter tag off; only front matter's `tags:` changes, and a #tag in the words has a dot and no × | yes | you |
| 14 | Formatting bar | feature | Page | A bar of the formatting commands (bold, italic and the rest) that can be shown or hidden. Where it sits is the design pass's to find, after #16. | **Done** ([#41](https://github.com/onlynyans/eien/pull/41)): the Format menu's commands as drawn icons, pressed where they're on at the caret; Band's second row, Slip's own slip, Running head's rail; its control in the page's toolbar, View → Formatting Bar, ⇧⌘B (a device setting); not on a phone | yes | you |
| 15 | Chevrons to shut panes | tweak | Panes | The page bar's SIDEBAR and LIST words go. A chevron shows at a pane's edge on hover, and shuts or opens it. | **Done** ([#36](https://github.com/onlynyans/eien/pull/36)): a chevron at each pane's head (Band) or a tab at its edge (Slip), the way back in the same spot of the pane beside it; a shut sidebar's strip keeps the seal. Running head: the strip's icons | yes | you |
| 16 | The control strip hides | tweak | Page | The page's control strip (views, Compare, Seal, Versions) shows or hides, from a control near where the tags sit. Shown, it takes the space above the sheet; hidden, the sheet reaches the top of the pane. | **Done** ([#36](https://github.com/onlynyans/eien/pull/36)): Band's strip hides to a lip, Slip's slip folds to its fold; kept per device | yes | you |
| 17 | View icons | tweak | Page | LIVE, SOURCE and READING as icons: a text-edit icon, a code icon, a book icon. | **Done** ([#36](https://github.com/onlynyans/eien/pull/36)): Live, Source and Reading as drawn icons, one choice | yes | you |
| 18 | Settings in Eien's voice | fix | Settings | The settings screen was built without a mockup (`docs/design` has none), and doesn't read as Eien: bold black headings where the design uses mono labels in graphite, and one long column in a box. Rework it in the design's voice. | **Done** ([#40](https://github.com/onlynyans/eien/pull/40)): Settings over the window, moved by its head and resized by its edges and corners, its box per device; categories in the machine voice (Look, Themes, Writing, This vault) and a breadcrumb head; a full sheet on the phone | yes | you, audit |
| 19 | AltGr and the heading keys | fix | Keys | On Windows and Linux, Ctrl+Alt is AltGr, so Ctrl+Alt+1–3 (headings) may take characters that some layouts type with AltGr (², ³ on a German keyboard). Check what Electron does; keep ⌘⌥1–3 on macOS and choose other keys elsewhere, then update spec §4. | **Done** ([#29](https://github.com/onlynyans/eien/pull/29)): Ctrl+Shift+1–3 on Windows and Linux; ⌘⌥1–3 on macOS | – | review |
| 20 | Writer themes | feature | Themes | Build them (spec §7): themes in `.eien/themes/`, a gallery of Eien's own beside Paper and Slate, a maker, and files. | **Done** ([#34](https://github.com/onlynyans/eien/pull/34)): the gallery (Washi, Kinari, Aizome, Koke, Rōsoku, Sumi, Sakura-nezumi, Otaku); your own themes as files in `.eien/themes/`, each mixed from four choices and fitted to Eien's contrast; Settings → Themes: Gallery, and Custom with the mix panel ([#40](https://github.com/onlynyans/eien/pull/40)) | yes: [themes](design/explorations/themes.md) | audit, you |
| 21 | App icon | feature | Install | Eien's own icon for the installers and the phone (the seal would be the natural one). | **Done** ([#35](https://github.com/onlynyans/eien/pull/35)): the seal, from one SVG (`build/icons/seal.svg`, `npm run icons`): the macOS rounded template, Windows' `.ico`, Linux's PNGs, Android's adaptive and themed icons, iOS's 1024 px square | yes | AGENTS.md |
| 22 | Smaller downloads | tweak | Install | The Mac download is 546 MB: Chromium twice, for Apple Silicon and Intel. Separate Apple Silicon and Intel downloads, and Chromium's text in English only, would about halve it. Left as it is for now, by your choice. | One universal `.dmg` | – | installers session |
| 23 | First release | chore | Install | No version is tagged yet, so there's nothing to download from Releases. Tag one (AGENTS.md → Releases), then publish the draft. | No release | – | docs check |
| 24 | The machine voice's face | feature | Settings | The face for everything in the machine voice (counts, labels, buttons, the status line, the Source view) becomes a setting: IBM Plex Mono (the default) or any of the eight text faces. One list of faces feeds both face settings, so a face added later is one entry, not a change in two places. Each face gets its own machine sizes, as it has its own text sizes. | **Done** ([#40](https://github.com/onlynyans/eien/pull/40)): Settings → Look → Type → Machine voice: IBM Plex Mono or any of the eight, from one FACES list (`core/config/faces.ts`), each face with its own machine sizes | yes: [settings](design/explorations/settings.md) | you |
| 25 | Row names' weight | feature | Settings | Two settings, 400 to 700 each: the sidebar's names and the list's titles. A selected list title is 100 heavier than its setting, at most 700 (so 500 at the default, as in the mockup). Whether the sidebar's chosen name is heavier too is the design pass's call (it recommends not). | **Done** ([#40](https://github.com/onlynyans/eien/pull/40)): Settings → Look → Type: Sidebar names and List titles, 400–700; a chosen list title a step heavier (at most 700), the sidebar's chosen name not | yes: [settings](design/explorations/settings.md) | you |
| 26 | Icons for controls | tweak | Everywhere | Controls become icons: one set, one style, set by the design pass, then used by #8, #15, #16 and #17. Labels, counts and a menu's items stay words. | **Done** ([#36](https://github.com/onlynyans/eien/pull/36)): Eien's own icons (`ui/icons.ts`), every control a command drawn by the layout's hosts, each with its name and a tooltip with its key | yes, first | you |
| 27 | Corners | tweak | Everywhere | Not everything square: a radius scale (`--eien-radius-s`, `-m`, `-l`) set by the layout chosen (#28), never fixed: A 2/4/8, B 4/8/14, C 3/6/10. Paper (panes, list, sheet) stays square, except B's sheet (3px). | **Done** ([#36](https://github.com/onlynyans/eien/pull/36)): `--eien-radius-s/-m/-l`, set by the layout chosen | done in design: [specimen](design/explorations/specimen.md) | you |
| 28 | Three layouts, as a setting | feature | Window | A · Band, B · Slip and C · Running head, the writer's choice (Settings / Look / Appearance). One framework: commands once, hosts that draw them, a small module per layout ([overall.md](design/explorations/overall.md)). Each layout sets its own corners (#27), and its own phone bottom. | **Done** ([#36](https://github.com/onlynyans/eien/pull/36)): Settings → Appearance → Layout; commands once (`ui/chrome`), hosts per layout, each layout's phone bottom | done in design: [overall](design/explorations/overall.md) | you |
| 29 | Rename in place, and a right-click menu of Eien's own | fix | Sidebar, list | Notes, folders and tags rename the same way, in their row (F2, double-click, the menu); a taken name says so under the row. The menu: raised paper, an icon and a word each, its key, the trash last in carmine. | **Partly done** ([#42](https://github.com/onlynyans/eien/pull/42)): notes rename in their row (F2, a double-click on the name, the menu) in the list and the tree, with the taken-name line; folders as before (F2, the menu); the right-click menu is Eien's own (head, icons, keys, the trash in carmine). Still to do: renaming a tag (comes with #4's tags.json) | done in design: [overall](design/explorations/overall.md) | you |
| 30 | Focus mode in the toolbar | tweak | Page | A control for Focus mode (⇧⌘↵) in the page's toolbar, in every layout and on the phone. | **Done** ([#36](https://github.com/onlynyans/eien/pull/36)): in every layout's toolbar, and every phone bottom | done in design | you |
| 31 | This vault's settings | tweak | Settings | The vault's own settings (chapter numbers, the scene break in copied HTML) in a category of their own, "This vault", apart from this device's. | **Done** ([#40](https://github.com/onlynyans/eien/pull/40)): a category of their own, This vault (Writing), saying they're kept in `.eien/config.json` | yes | you |
| 32 | The three-way filter on the sidebar's TAGS | feature | Sidebar | A tag row can be wanted or kept out (with a modifier click), as in the list's filter, if it costs nothing in speed with thousands of notes. | **Done** ([#48](https://github.com/onlynyans/eien/pull/48)): ⇧-click wants a tag in the list's filter, ⌥-click keeps it out (⇧Enter, ⌥Enter); the row shows its state; within the speed budget with 3,000 notes | yes | you |
| 33 | A lens in the two-pane tree | feature | Sidebar | With two panes the tree lists notes; a sort or filter acts there as it does in the list. | **Done** ([#45](https://github.com/onlynyans/eien/pull/45)): with two panes, the chosen row's lens is in the sidebar, acting on the tree's notes | – | you |
| 34 | Speed with thousands of notes | fix | Sidebar, list | Two panes with 3,000 notes drew 6,000 rows: laying them out held the window for most of a second on a slow machine, and CI's timing test failed on macOS. Draw only the rows in sight, keep the keyboard through every row, and hold the common actions to a time in CI. | **Done** ([#37](https://github.com/onlynyans/eien/pull/37)): long lists draw the rows in sight (`ui/shell/windowed-rows.ts`); the speed budgets (`tests/e2e/budgets.spec.ts`): no task over 200 ms | – | you |
| 35 | The keyboard kept through a long list's redraw | fix | List | With a long note list (200 notes or more, drawn by the rows in sight), a redraw that moves the note with the keyboard out of sight (a sync makes it the newest) drops the keyboard to nowhere. `renderList` asks which row had it only after `WindowedRows.set` has handed it to the list, then puts the list back, which loses it. Read the row first; `src/ui/list/render-list.test.ts` has the test, marked `.fails` until then. | **Done** ([#49](https://github.com/onlynyans/eien/pull/49)): `renderList` reads which row has the keyboard before the long list is given its rows | – | test foundation |
| 36 | A narrow band on Windows | fix | Page | Band's views and tools need about 290 px, and Windows' controls take 138 px at its right end: a page under about 450 px (three panes in a 1000 px window) runs the tools under the controls. Since the split, nothing covers a control (the folded pager's names give way first), but the band has no second row to go to. | **Done**: tools that don't fit fold behind a ⋯ in every layout (`ui/chrome/fold.ts`) | yes | review |
| 37 | Paste keeps plain text as typed | fix | Editor | Markdown copied from Sublime pasted with backslashes (`\[[1](…)…\]`). Likely the editor's styled HTML copy beside the plain text, which Eien prefers: check the clipboard's flavours first. Take the plain text when the HTML is only styled spans of it, and escape `[ ] * < ~ ^` only where they'd really form Markdown, so HTML from a web page still pastes as it should. | **Done** ([#81](https://github.com/onlynyans/eien/pull/81)): the backslashes were Google's answer's HTML (Sublime's plain Copy holds no HTML); the page's marks are escaped only where Eien's parser reads them as marks (`core/html/marks-in-words.ts`); Google's wrapped list items and Sublime's Copy as HTML paste as they should | – | you |
| 38 | A link's tooltip in Live | feature | Editor | Hovering a link in Live shows where it goes, and lets you edit it or open it. Three HTML explorations first (interface-design). | Open | yes: 3 explorations | you |
| 39 | Table grips and + on hover only | fix | Editor | The table editor's + and grips show over every row and column; they should show only over the row or column divider, or the cell, under the pointer. Suspect a hiding rule overridden by the icon button's own `display`, as the split's × was. | **Done** ([#75](https://github.com/onlynyans/eien/pull/75)): the sheet's hover (a quiet row, for its ×) lit every quiet control in it; a row's hover now lights its own, not those of a layer that turns its own on (`.quiet-own`, the table's) | – | you |
| 40 | Reading EPUBs | feature | Vault, sidebar, page | Books are `.epub` files in the vault, in any folder (Cooking can hold notes and cookbooks); SHELF, above TAGS, lists them, a lens over the one folder tree, so the folders aren't reworked. Scrolling and turning pages, both. Place, bookmarks and highlights kept in `.eien/reading/`, keyed by the book's contents. No new dependency: a zip reader of Eien's own over the browser's decompression, in the window, on the desktop and the phone alike; sizes capped against zip bombs, no path out of the zip. A chapter is drawn from cleaned nodes, as the browser extension draws a story (no frame, nothing that can run), its pictures from the zip; fixed-layout books aren't supported. | Decided ([epub.md](design/explorations/epub.md#decided-2026-10-28)); building in phases: 0 groundwork (the shared cleaner, a page that holds a note or a book, the find bar apart from CodeMirror); 1 the shelf and opening a book safely; 2 scrolling, and a book beside a note; 3 turning pages (Curl, Slide, Words), then 3b the reading room; 4 place, bookmarks and page count; 5 highlights and Find; 6 by lamplight. Every phase: a design review before, a review of the diff after, every kind of test it touches, all of CI green ([epub.md](design/explorations/epub.md#testing-and-ci-for-every-phase)) | yes: [epub.md](design/explorations/epub.md) | you |
| 41 | Find and replace in the note | feature | Editor | ⌘F (Ctrl+F) finds in the open note, with replace. CodeMirror's own search, in Eien's look. | **Done**: a slip at the page's top right (Find, its count, Match case, Whole word, Pattern, previous and next; Replace unfolded by the twisty or ⌥⌘F, Ctrl+H off the Mac); Edit → Find; the phone's ⋯ → Find; each replace one step of the note's history; on the active page of a split | – | you |
| 42 | Notes in subfolders | feature | List | A toggle: a folder lists its subfolders' notes too. Your order holds: each subfolder's notes a group under its name, in your folder order, each in its own order; Arrange reorders within a group, and moving to another group is a move. | **Done**: Include subfolders, a quiet toggle in the list's head, per folder on this device; each subfolder's notes under a head in label type, in your folder order; a drag into another group moves the note there; search, the filter, long lists and the keyboard take in the groups | – | you |
| 43 | Panes keep their place | fix | Panes | Shutting and opening a pane brings it back scrolled to the top; it should keep its place. | **Done**: the same rows in sight, a short list or a long one, the tree with three panes or two; ⌘1 or ⌘2 goes back to the row the keyboard left; kept for the window's session | – | you |
| 44 | A steady top bar while the window resizes | fix | Window | Resizing the window makes the top bar's controls jitter and jump. | **Done** ([#76](https://github.com/onlynyans/eien/pull/76)): the corner's insets from the overlay's width, which a Mac's resize doesn't move (its `x` jumped 13px each step); the panes fit a resized window at once, the slide kept for opening and shutting; the split's pager only shown or hidden by a resize, not made again | – | you |
| 45 | Hide tags and IDs | feature | Editor | A setting to hide the front matter's `tags:` and `id:` lines in Live, Source and Reading, so they aren't edited by accident; kept and saved as they are. | **Done**: Settings → Writing → Editor → Hide tags and IDs (a device setting, off at first); the lines out of sight in every view, the `---` lines kept with them (the whole front matter when it holds nothing else); the writer's edits go round them, find skips them, a copy leaves them out; the tags still on the page | – | you |
| 46 | Foldables and tablets | feature | Phone | On a foldable's or a tablet's wider screen, the room tablet apps use, as an option, never forced: more than one pane at a time, from the layouts already built. Three explorations first. | **Done**: all three, as Wide screen (Panes, One at a time, Side by side, Two pages) | yes: [tablet](design/explorations/tablet.md) | you |
| 47 | Read on AO3 and FanFiction.Net in Eien's look | feature | Browser extension | A browser extension that shows a story from AO3 or FanFiction.Net on Eien's sheet, in its typefaces and themes, by day and night: its story page over the site's, its settings Eien's own (spec §14). | **Built** (Chrome, Edge, Brave and Firefox; loaded unpacked from CI's `eien-reader-extension`). Next: check it against the live sites (its tests use pages written from their markup, as the sites weren't reachable from where it was built); a list of the work's chapters to jump to; the stores (Chrome Web Store, Firefox Add-ons); Safari, on the Mac and iPhone | – | you |
| 48 | The divider while two pages are short of room | tweak | Phone | With Two pages when narrow, two pages under a mode's own room share it evenly, and the divider can't move them: it still takes the keyboard and says "Drag to resize". Say it's pinned (or leave it out of the tab order) until there's room. | Open | no | review of Two pages when narrow |
| 49 | A quick look, anywhere | feature | Window, page | One control, always in reach, opens a small popover of the look's everyday settings (Day or Night, the text's size, the typeface, line spacing, the page's width and frame), so they're changed without opening the sidebar and Settings. With a book open it sets the book's own look, apart from the notes'; with a note, the notes'. Three explorations first, then built from the settings' schema, so a setting added later appears there by marking it, not by building it again. | Open | yes: 3 explorations | you |

## Plan

Drafted 2026-10-20. Three stages. Stage 1 and the design pass start
together: stage 1 builds what needs no new design while the pass draws the
rest. Nothing in stage 3 is built before you approve its design. Each step
is one pull request with its tests; CI runs the suites; the spec changes in
the pull request that changes the behaviour.

### Stage 1: no new design needed (start now)

Three sessions at once, each in a worktree of its own; their files don't
overlap.

| Step | Items | Where |
|---|---|---|
| 1A Window and keys (done, [#29](https://github.com/onlynyans/eien/pull/29)) | #1 no title bar, #2 zoom the whole interface, #19 AltGr | `src/app/electron` (the window, the menu), the panes' top bands |
| 1B The sidebar, as the mockup has it | #3 sections fold, #5 guide lines, #6 BOOK mark, #9 "1 NOTES": **done** in #28 | `src/ui/sidebar` |
| 1C Search in the list (done, [#30](https://github.com/onlynyans/eien/pull/30)) | #11 | `src/ui/list`, the sidebar's search, a search within one list's notes |
| 1D Type settings, after 1B and 1C (they share the row styles) | #24 the machine voice's face, #25 row names' weight | `src/core/config` (two settings), the tokens, today's Settings screen |

1A on macOS: the traffic lights sit over the sidebar's head
(`titleBarStyle: 'hiddenInset'`) and the panes' top bands drag the window.
On Windows and Linux the system's own minimize, maximize and close are drawn
over the page's band (`titleBarOverlay`), in the band's colours. The phone
is untouched.

### Stage 2: the design pass (alongside stage 1)

Explorations made on 2026-10-20, in [`docs/design/explorations`](design/explorations/README.md),
for you to choose from. Stage 1 runs meanwhile (1A, 1B and 1C as their own
sessions).

The interface-design skill, working from `.interface-design/system.md`,
brings `docs/design` up to the current design, a part at a time, each for
you to approve:

1. **The system:** the icon set and its style (#26), the radius scale (#27).
2. **The page:** the strip that hides (#16), view icons (#17), tags on the
   page (#13), the formatting bar (#14), chevrons to shut panes (#15).
3. **The sidebar:** the foot's icons (#8), the + (#4), Pinned (#7), the sync
   status (#10).
4. **The list:** the sort laid over your order (#12).
5. **Settings** (#18), with #24 and #25 in it.
6. **The title bar's strip** (what goes there, #1) and **the app's icon** (#21).

The phone's mockup changes wherever a change reaches the phone.

### Stage 3: build what's approved

The designs are decided (`.interface-design/system.md`, "Decided patterns",
and `docs/design/explorations`). Built in two waves, one session per step,
each step's files apart from the others' in its wave.

**Wave 1**, at once:

| Step | Items |
|---|---|
| 3A The layouts (done, [#36](https://github.com/onlynyans/eien/pull/36)) | #28 the framework and all three layouts as a setting; #26 the icons; #27 corners per layout; #15 chevrons and the seal strip; #16 the strip that hides; #17 view icons; #30 Focus; #8 the foot's icons; #1 what goes in C's strip |
| 3B Themes (done, [#34](https://github.com/onlynyans/eien/pull/34)) | #20: the gallery's themes, your own in `.eien/themes/`, the mix (fitted to Eien's contrast); the theme applied as tokens |
| 3C The app's icon (done, [#35](https://github.com/onlynyans/eien/pull/35)) | #21: the seal, for the installers and both phones |

**Before wave 2**: the performance foundation (#34), so wave 2's tree and
list work starts on lists that draw only the rows in sight, and with the
speed budgets in CI.

**Wave 2**, once 3A has merged (they build on its framework and icons):

| Step | Items |
|---|---|
| 3D The page (done, [#41](https://github.com/onlynyans/eien/pull/41)) | #13 tags in the running head (slips under the title on the phone); #14 the formatting bar, drawn icons |
| 3E The sidebar | #4 the +; #7 Pinned; #10 sync status; #29 rename in place and the right-click menu; #32 the three-way filter on TAGS |
| 3F Your order | #12 your order and the lens, Arrange mode, the list's three-way tag filter; #33 the lens in the two-pane tree |
| 3G Settings (done, [#40](https://github.com/onlynyans/eien/pull/40)) | #18 over the window, categories and tabs; #31 This vault; #24 and #25; Themes' tabs (with 3B); C's strip ground |

Then #23, the first release.

### Stage 4 (drafted 2026-10-27)

#37 to #46. Each line is its own session and pull request, from main.

| Wave | Items | Notes |
|---|---|---|
| 1, now, side by side | #37 paste, #39 table controls, #43 panes' place, #44 resize jitter; the explorations for #38 (3), #40 (9, in one session so the three sets share one look) and #46 (3) | The fixes touch different files; the explorations are docs only |
| 2, as wave 1 lands | #41 find and replace, then #45 hide tags and IDs (both in the editor: one after the other); #42 subfolders | |
| 3, once you've chosen the designs | #38 the link tooltip; #40 the EPUB reader, in its phases; #46 foldables and tablets | |

### Stage 5 (drafted 2026-10-28)

| Wave | Items | Notes |
|---|---|---|
| 1, side by side | #49's three explorations (docs only); #40 Phase 0: the shared cleaner, beside a page that holds a note or a book, then the find bar apart from CodeMirror | The explorations touch no code; the refactors change nothing a writer sees |
| 2, once #49 is chosen | #49 built; #40 Phase 1, the shelf and opening a book | #49 reads the settings' schema; Phase 1 adds the book's look settings to it |
| 3 on | #40 Phases 2 to 6, one at a time | Each phase its own pull request |

### Later

#22 smaller downloads (left for now).

### Answers needed, and before what

All the earlier ones are answered. Next: your choice among the
explorations, before stage 3 builds each part.

## Decided

- **HTML scene break**: spacer, rule, spacer
  (`<p><br /></p><hr /><p><br /></p>`), an empty paragraph each side of the
  rule so the sections breathe. It was already the default; decided
  2026-10-20.
- **The note list's default order**: your own (#12), decided 2026-10-20.
- **Controls are icons, not words** (#26), decided 2026-10-20: "a control is
  a word" was approved by mistake.
- **Not everything is square** (#27), decided 2026-10-20.
- **Two type settings** (#24, #25), decided 2026-10-20. Two voices stay: the
  text face for what a person wrote, the machine voice for the rest.
- **All three layouts, as a setting** (#28), each with its own corners (#27)
  and phone bottom; **the seal is the app's icon** (#21); **a theme may
  change the seal's colour**, one per theme; **this vault's settings get a
  category** (#31); **tags on the phone are slips under the title**; **the
  sidebar's TAGS take the three-way filter** if it costs no speed (#32);
  **the two-pane tree takes the lens as the list does** (#33); **removing a
  tag in the header never edits the text**. All decided 2026-10-21.

## Questions for you

- **#38: does a plain click follow a link in Live?** Now ⌘-click (Ctrl-click)
  does in Live and Source, a plain click in Reading; the explorations can
  show both.

## Design audit, 2026-10-20

`src/ui` against the approved design in `docs/design` (there's no
`.interface-design/system.md`; the design's README and tokens are the
system).

- **Tokens hold.** The app's styles take every colour, size and space from
  the tokens: no stray colours, no shadows beyond the two, and round corners
  only on dots.
- **The drift is in structure.** Pieces of the mockup that were dropped or
  rebuilt differently: folding sections (#3), guide lines (#5), BOOK marks
  (#6), Pinned always in Library (#7), the sync status (#10), the search in
  the list pane (#11), the tags at the top right of the sheet (#13).
- **Settings had no mockup** (#18): `desktop.html`'s Settings button says
  "not in this mockup", so the screen was built without one.
