# Split window: three more explorations

**For the owner to choose (2026-10-23).** Nothing is built. These three sit
beside the first three in [split.md](split.md), and each is different from
them in three ways: where the second note lives, where the controls go, and how
the page you're writing in is shown.

Each page shows one direction, working, in all three layouts (A · Band,
B · Slip, C · Running head), by Day and Night, with the sidebar open or shut,
the formatting bar on or off, and the window as wide or narrow as you like (the
Window slider):

- [split-alt-facing.html](split-alt-facing.html): 4 · Facing pages
- [split-alt-companion.html](split-alt-companion.html): 5 · A companion
- [split-alt-follow.html](split-alt-follow.html): 6 · Tools that follow

| | Where the second note lives | Where the controls go | How the active page shows |
|---|---|---|---|
| 1 · Two whole pages | The page pane, cut in two | Each page has its own | A 2px rule across its top |
| 2 · One set of tools | The page pane, cut in two | One set, where the layout puts it | The other page's words soften |
| 3 · Two sheets | Two sheets on one blotter | One set, where the layout puts it | The sheet's shadow |
| **4 · Facing pages** | One sheet, opened like a book | The book's at the top; each note's in its folio | A ribbon in its outer margin |
| **5 · A companion** | Beside the page pane, where Versions opens | The page keeps all its own; the companion has a few | The other one sits back a step, to the band's tone |
| **6 · Tools that follow** | The list's place: the list steps aside | One set, which moves to the page you're in | Where the band, slip or running-head tools are |

## What all three share

- **Opening a split:**
  - a note's right-click menu, **Open to the Side**;
  - **⌘-click** a row, or **⌘Enter** on it;
  - drag a row onto the page's right edge, with a preview of where it lands
    (dropped on a page, it opens there);
  - **⌘D** opens the note beside itself. Pressed while split, it closes the
    other side.
- **Why ⌘D:** it's free in `menu.ts` and in the editor.
  - ⌘\\ is Toggle Sidebar.
  - **⌥⌘\\**, which 1–3 first proposed, is CodeMirror's Indent Selection in
    `defaultKeymap` (`@codemirror/commands` 6.11.1), which Eien's editor
    loads. The menu would take it first, so nothing breaks, but the editor
    quietly loses a key. 1–3 now use ⌘D too, so all six agree.
  - ⌘D splits a pane in terminals, so some writers already know it.
  - ⌥⌘N was tried too and dropped: on Windows, Ctrl+Alt+N is AltGr+N, which
    types ń on a Polish keyboard.
- **Changing the active page:** a click in it, or **⌘3** (Go to Page), which,
  pressed in a page, goes to the other one.
- **The list:** the chosen row is the active page's note. The other open note
  keeps a rule at hairline strength, with no fill.
- **Choosing a note** in the list (or in the tree) opens it in the active page.
- **Closing** never touches a note: it's in the list as it was. ⌘W in a side
  closes that side first.
- **The same note on both sides** is one document. Type in one and it shows in
  the other. The seals, the counts and the undo are the note's.
- **A narrow bar** keeps its spare tools (Compare, Copy as HTML, Outline
  cards, Swap) behind one ⋯, which shows only then.
- **No split on a phone.** Each direction says what it does instead.

## 4 · Facing pages

- **What:** the page pane keeps one sheet, opened like a book. The two notes
  face each other across the gutter, and the gutter is the divider.
  - **The book's tools** stay where the layout puts them and act on both
    pages: the views, Focus mode, Outline cards, the formatting bar, Swap.
  - **Each note's own** sit in its folio, at the foot of its page: its
    number, words and last seal, then Versions, Compare, Copy as HTML and its
    ×, on hover. The left page's folio runs from the left, the right's from
    the right, as page numbers do.
  - C's running head names both pages, each over its own, as a book's verso
    and recto do. C's tags move to the page's own head, because a folio is
    too short to hold them.
- **Active:** a ribbon, the book's marker, hangs over the sheet's top edge
  into the outer margin of the page you're in. It's ink-soft, not the seal.
- **The mark, all three kept as a setting** (the owner's call, 2026-10-23;
  Ribbon, in the page's bar). None is the seal's colour, and each arrives with its own short
  motion (none with reduced motion):
  1. **The ribbon**, as first drawn: the book's silk marker over the sheet's
     top edge, in the outer margin, its end forked. Ink-soft. It drops in.
  2. **A dog-ear**: the page's outer top corner turned down. The corner is
     gone to the blotter, and the flap shows the paper's back in the band's
     tone, with a hairline round it. The quietest: no ink at all. It folds in.
  3. **An edge tab**: an index tab standing out from the page's outer edge
     into the blotter, near its head. Ink-soft, and the easiest to find at a
     glance. It slides out.
- **Narrow:** two pages need 752px of sheet, about 1,370px of window with both
  panes open. Below that, the book closes to the ribbon's page, and the facing
  page's edge stays by the gutter with its name, to turn to.
- **Top and bottom:** not offered. A book opens sideways.
- **Phone:** one page. The facing note is named in the folio, and tapping it
  turns to it.
- **For:**
  - It's a picture the writer already has: a chapter facing its notes.
  - The tools are split by what they act on, so none is far from its target.
  - The ribbon can't be mistaken for focus or the seal, and it holds by Night.
- **Against:**
  - The folio is a second status line on each page.
  - The ribbon is a new mark, though a small one.
  - The gutter and the shared margins make each page narrower, so the book
    closes sooner than the others fold.

## 5 · A companion

- **What:** the page pane isn't split. The second note opens as a companion
  at the window's right edge, where Versions opens. It's narrower (380px, at
  least 300), and its words are set smaller (row size).
  - **The page** keeps every tool it has, in the layout's place, and they act
    on the page.
  - **The companion** has its own head (its name, ⇄ to make it the page, ⋯,
    ×) and foot (its words and last seal). The ⋯ has its views, Seal,
    Versions, Compare, Copy as HTML and Open in New Window.
  - The formatting bar is the page's, and it formats whatever words the caret
    is in, the companion's too, as the keys do.
- **Active:** the caret. The one you aren't writing in sits back a step: its
  paper takes the band's tone, because darker is further back.
- **Narrow:** with less than 700px of page pane (about 1,280px of window with
  both panes), the companion goes under the page. This is the only top and
  bottom of the six.
- **Phone:** the companion is a sheet pulled up from the page's foot by its
  name, the same idea as under the page.
- **For:**
  - It fits how a chapter and its notes are used: one is written, the other
    consulted. The page is never cut in half.
  - The page is Eien's page, exactly. There's no second set of tools.
  - Its narrow answer is the phone's answer.
- **Against:**
  - It isn't symmetrical. Two chapters side by side make one of them the
    companion, set smaller.
  - The band's tone is a quiet cue, and the only one besides the caret.
  - Versions, while open, lies over the companion.

## 6 · Tools that follow

- **What:** when a second note opens, the note list steps aside, and the two
  pages take its room. The sidebar's tree lists the book's notes, as with two
  panes. There's one set of the page's furniture, and it goes where you are.
  - A: the band, the formatting bar under it, and the colophon.
  - B: the slip rests folded on the page you're in, and opens under the
    pointer. The formatting slip goes under it, as a narrow page's does.
  - C: the running head's tools, and that page's crumb in ink-soft.
  - The other page is paper on the blotter, with its × on hover.
  - The list comes back with › at the first page's top left, or ⇧⌘\\.
- **Active:** the page with the furniture. Moving to the other page moves it
  across, with a fade (none with reduced motion).
- **Narrow:** two pages need 720px beside the sidebar, a window of about
  990px with it open. **Below that the split is refused**, and Eien says why
  ("shut the sidebar"). A split window narrowed past it shows the page you're
  in, and the colophon says the other one waits.
- **Top and bottom:** not offered.
- **Phone:** one page. The phone's bar is already one set of tools, and the
  other note waits behind the back bar's ⇄.
- **For:**
  - Every tool is beside the page it acts on, and there's one of each.
  - Two pages get real width: at 1,440px, two 588px pages instead of two
    430px ones.
  - The cue is the band, the slip, the running head, which a writer already
    reads as "the page".
- **Against:**
  - The list leaving changes the window when you split, and you need to know
    how to get it back.
  - The furniture moves when the writer moves. It's motion they asked for,
    but it is motion.
  - A refused split is honest, but it's a no.

## Recommendation

**5 · A companion.**

- It's the smallest change. The page stays exactly as it is, and the
  companion takes a place the window already has: the right edge, where
  Versions opens.
- It suits the real case, a chapter and its notes: the writer writes in one
  and reads the other. The companion's smaller hand says which is which
  without a mark.
- Its cue is Eien's own depth rule, darker is further back, and it adds no new
  mark or colour.
- One idea covers the narrow window and the phone: the companion goes under
  the page.

**How they compare with the first three:**

- If two equal pages matter more than the chapter-and-notes case, **3 · Two
  sheets** is still the best of the symmetrical ones. 4 is its closest
  relative: one sheet instead of two, and a ribbon instead of a shadow.
- **4's ribbon** is the strongest cue of the six for the active page. It
  holds by Night, and it would hold in Page frame Full too, because it doesn't
  need the sheet's edge, where 3's shadow fades. If 3 is chosen, the ribbon
  could replace 3's 2px rule in Full.
- **6** answers the weakness that 2 and 3 share, a tool's target not being
  beside it, without 1's doubled furniture. But it changes the window round
  the split, and the other five don't.
- **5** gives up symmetry, which 1, 2, 3, 4 and 6 all have, for a calmer page.

## Open

- Whether a companion should be offered as well as a symmetrical split, for
  two chapters (5 and 3 could share the keys: ⌘D for the companion, a menu
  item for two equal pages).
- Whether 6's list should step aside on its own, or only when there's no room
  for it.
