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

## Split window (2026-10-23): for the owner to choose

Three directions for two notes side by side in one window, each working in all
three layouts, and one page for New Window and the phone. [split.md](split.md)
has the trade-offs; the recommendation is 3 · Two sheets on one blotter.

| Page | Direction | For | Against |
|---|---|---|---|
| [split-apart.html](split-apart.html) · [md](split.md) | **1 · Two whole pages**: each page its own band, slip or half of the running head, formatting bar and colophon; a 2px ink-soft rule tops the active one | Every tool beside the page it acts on | Twice the furniture; C's running head splits |
| [split-shared.html](split-shared.html) · [md](split.md) | **2 · One set of tools**, acting on the active page; the other page's words soften | The calmest; nothing new to learn | A tool's target isn't always beside it; a quiet cue |
| [split-sheets.html](split-sheets.html) · [md](split.md) | **3 · Two sheets on one blotter** (recommended): one set of tools; the active sheet lies on top, with the sheet's shadow | Eien's own picture and depth; no new line | 24px of blotter between; a subtle cue by Night |
| [split-window.html](split-window.html) · [md](split.md) | **New Window and the phone**, once for all three: File → New Window (⇧⌘N), Open in New Window; the phone's "other note" | | |

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
`table-bar.*`, the corners' `corner.*`, the split's `split.*`; `layouts.css`,
`seal-button.css` and `keys.js` shared between families). Edit
`_src/` and build; don't edit the built pages.
