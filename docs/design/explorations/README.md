# Design explorations, stage 2

The design pass for [the backlog](../../backlog.md)'s interface items. These
are explorations to choose from, not the app: each HTML page is interactive
and stands alone (its CSS and JS inside it), and each has an `.md` beside it
with its directions, trade-offs and a recommendation. Existing elements
follow [`.interface-design/system.md`](../../../.interface-design/system.md);
new ones go beyond it where it says nothing yet.

To view them, serve `docs/design` (the fonts don't load from `file://`):

```bash
python3 -m http.server 4173 --directory docs/design
```

Then open <http://127.0.0.1:4173/explorations/overall.html>.

The pages in the first table are built (stage 3, October 2026); each `.md`
keeps the reasoning, and [specimen.html](specimen.html) ends with the
components as they shipped. Those under "Not built yet" are still to choose.

| Page | What it explores | Backlog |
|---|---|---|
| [overall.html](overall.html) · [md](overall.md) | The whole window, desktop and phone, in three explorations: A · Band, B · Slip, C · Running head. Focus mode, rename in place, and how one framework carries all three | #1, #3–#8, #10, #11, #13–#17, #25, #27 |
| [specimen.html](specimen.html) · [md](specimen.md) | The icon set, the control's states, three corner scales, the machine voice in every face, row weights | #24–#27 |
| [settings.html](settings.html) · [md](settings.md) | Settings over the window (chosen): moved and resized, a breadcrumb, category labels, Themes as a category | #18, #20, #24, #25 |
| [tags.html](tags.html) · [md](tags.md) | Tags on the page: the running head (chosen), label slips, the note's card; a tag with no notes yet | #4, #13 |
| [themes.html](themes.html) · [md](themes.md) | Six new themes beside Washi; Gallery and Custom; contrast checked live | #20 |
| [order.html](order.html) · [md](order.md) | Your order and a lens over it, across both panes; moving folders out; drag anytime or Arrange mode; a three-way tag filter | #12 |

## A link in Live (2026-10-27): for the owner to choose

Backlog #38: hovering a link, or the caret in it, shows where it goes, and
lets you edit and open it. Each page also answers "should a plain click follow
a link in Live?" with a switch. [links.md](links.md) has the trade-offs and
recommends 1 on the desktop with 3's bar on the phone, and a plain click that
places the caret, as today.

| Page | Direction | For | Against |
|---|---|---|---|
| [link-card.html](link-card.html) · [md](links.md) | **1 · A card under the link** (recommended): a note link's card is its row in the list (crumb, title, first line, words); a web link's, its address; four tools, and Edit as two fields | Answers "which chapter is that?" on a hover; the same for hover and caret | Covers the lines under the link; a new surface |
| [link-inline.html](link-inline.html) · [md](links.md) | **2 · In place**: the caret opens that link's own Markdown where it stands, as Rename opens a name; the colophon says where it goes | Nothing floats; you edit what the file holds | The line reflows under the pointer; hover only in the colophon |
| [link-bar.html](link-bar.html) · [md](links.md) | **3 · A bar with the caret** (on the phone): the selection bar's sibling over the link's line; a hover gets the window's tooltip | Nothing new to learn; docks above a phone's keyboard | Covers the line above; a hover shows only the address |

## Reading EPUBs (2026-10-27): for the owner to choose

Backlog #40, nine pages in three sets: turning pages, scrolling, and the
features. Each works by Day and Night, in all three layouts, from the
keyboard, and on the phone. The bar's Section control offers the books'
section as SHELF, READING or BOOKSHELF. [reader.md](reader.md) has every
direction's trade-offs and recommends **Pages 2** (opening to 1's spread
when there's room), **Scroll 1** (then 3), and **Features 2** with 1's marks
on the page.

| Set | 1 | 2 | 3 |
|---|---|---|---|
| Pages | [The spread](reader-spread.html) | [One leaf, its edges](reader-leaf.html) | [Columns to the pane](reader-columns.html) |
| Scroll | [A chapter a sheet](reader-chapter.html) | [One roll](reader-roll.html) | [Beside a note](reader-beside.html) |
| Features | [On the page](reader-margin.html) | [In the list](reader-index.html) | [On the edge](reader-edge.html) |

## Split window (2026-10-23): for the owner to choose

Six directions for two notes side by side in one window, each working in all
three layouts, and one page for New Window and the phone. All six use ⌘D to open
a note beside itself (⌥⌘\\ is the editor's Indent Selection). [split.md](split.md)
has 1–3, recommending 3 · Two sheets on one blotter;
[split-alt.md](split-alt.md) has 4–6, recommending 5 · A companion, and
compares all six.

| Page | Direction | For | Against |
|---|---|---|---|
| [split-apart.html](split-apart.html) · [md](split.md) | **1 · Two whole pages**: each page its own band, slip or half of the running head, formatting bar and colophon; a 2px ink-soft rule tops the active one | Every tool beside the page it acts on | Twice the furniture; C's running head splits |
| [split-shared.html](split-shared.html) · [md](split.md) | **2 · One set of tools**, acting on the active page; the other page's words soften | The calmest; nothing new to learn | A tool's target isn't always beside it; a quiet cue |
| [split-sheets.html](split-sheets.html) · [md](split.md) | **3 · Two sheets on one blotter** (recommended): one set of tools; the active sheet lies on top, with the sheet's shadow | Eien's own picture and depth; a pane's edge between | 48px of blotter between; a subtle cue by Night |
| [split-alt-facing.html](split-alt-facing.html) · [md](split-alt.md) | **4 · Facing pages**: one sheet opened like a book, the gutter the divider; each note's own tools in its folio; a ribbon marks the active page | The tools split by what they act on; the strongest cue, by Night too | A second status line on each page; a new mark |
| [split-alt-companion.html](split-alt-companion.html) · [md](split-alt.md) | **5 · A companion** (recommended of 4–6): the second note at the window's right edge, narrower and set smaller; the one you aren't in takes the band's tone | The page stays exactly as it is; one idea for narrow windows and the phone | Not symmetrical: two chapters make one the companion |
| [split-alt-follow.html](split-alt-follow.html) · [md](split-alt.md) | **6 · Tools that follow**: the list steps aside; one set of the page's tools moves to the page you're in | Every tool beside its page, one of each; wider pages | The window changes when you split; refused below about 990px |
| [split-window.html](split-window.html) · [md](split.md) | **New Window and the phone**, once for all three: File → New Window (⇧⌘N), Open in New Window; the phone's "other note" | | |

## Foldables and tablets (2026-10-27): for the owner to choose

Backlog #46: three directions for a foldable's open screen and a tablet, each
on a phone, a foldable folded and open (with its fold), and a tablet upright
and sideways, by Day and Night, in all three layouts, touch first.
[tablet.md](tablet.md) has the trade-offs and recommends 2 · The stack,
opened out.

| Page | Direction | For | Against |
|---|---|---|---|
| [tablet-desk.html](tablet-desk.html) · [md](tablet.md) | **1 · The desk, at a finger's size**: the desktop's panes at 44px; Panes gains One at a time | Nothing new to learn; closest to today | Dense; a 360px page on the open fold |
| [tablet-stack.html](tablet-stack.html) · [md](tablet.md) | **2 · The stack, opened out** (recommended): the phone's stack, the step you came from beside the one you're in, cut on the fold; Side by side | It's the phone, opened; the smallest build | Never three panes; the desktop's bands don't come |
| [tablet-book.html](tablet-book.html) · [md](tablet.md) | **3 · An open book**: the ⇄ note faces the one you're in, the fold the gutter; the contents slide over; Facing pages | The room goes to writing | The list is a drawer away; a split on touch |

## Tables and the window's corner (2026-10-22, built in #57 and #58)

Two sets of three, a page per direction. Each set's `.md` has the trade-offs
and the choice. **Chosen:** for tables, 3 · Menus with 1's + on the desktop
and 2's bar on the phone ([table-menus.html](table-menus.html) shows it
whole); for the corner, both 2 and 3, as a setting, 3's strip as wide as the
bands are tall; C's shut sidebar a strip as wide as its own bands, 48px.

| Page | Direction | For | Against |
|---|---|---|---|
| [table-handles.html](table-handles.html) · [md](tables.md) | **Tables in Live, 1 · Handles** (its +, lighter, joins 3): a tab on each row and column, a + on each line between them, quiet until you point | One click where you mean it; nothing floats over the words | Lives in the margins, which a phone hasn't got; small targets |
| [table-toolbar.html](table-toolbar.html) · [md](tables.md) | **Tables in Live, 2 · Toolbar** (chosen for the phone): one bar of table tools while the caret's in a cell, over the table or in the formatting bar's row | Quietest at rest; every tool in one place; docks above a phone's keyboard | Two steps per change; floats over what's above unless a gap is kept |
| [table-menus.html](table-menus.html) · [md](tables.md) | **Tables in Live, 3 · Menus** (chosen for the desktop, with 1's + and the Table button; 2 on its phone): a grip per row and column, its menu on a press, a move on a drag; right-click a cell for both | The only one that reorders; every action named in Eien's menu | Two steps per change; a grip reads as "drag", not "menu" |
| [corner-title.html](corner-title.html) · [md](corner.md) | **The window's corner, 1 · A title line**: a 32px line across the window holds the system's controls; the panes start under it | One home for the controls on every system; the keep-clear sums go | 32px on every window: the title bar comes back |
| [corner-stay.html](corner-stay.html) · [md](corner.md) | **The window's corner, 2 · The seal stays** (offered, as "The seal alone"): shut, the sidebar goes entirely and the seal stays in the lights' row | Nothing moves; 48px back; one rule on every system | Undoes the decided strip of desk; the list's search narrows on macOS |
| [corner-shoulder.html](corner-shoulder.html) · [md](corner.md) | **The window's corner, 3 · The desk's shoulder** (offered, as "A strip of desk"): a strip as wide as the bands are tall, widening at its top to hold the lights, the seal under them | Keeps the strip; the fewest changes | A new L-shaped corner; the seal still moves up and down |

## Building

The pages are built from `_src/` by `python3 _build.py`, which puts the
shared tokens, icons and face list (`_src/shared.css`, `_src/shared.js`)
inside each page, and a family's own shared files where a page asks for them
with `/*@include:name*/` (the tables' `table.*`, `table-edges.*` and
`table-bar.*`, the corners' `corner.*`, the split's `split.*`, the links' `link.*`, the reader's `reader.*` and its text, `reader-text.js`, the tablets' `tablet.*`; `layouts.css`,
`seal-button.css` and `keys.js` shared between families). Edit
`_src/` and build; don't edit the built pages.
