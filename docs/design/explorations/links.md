# A link in Live: three explorations

Backlog #38. In Live, hovering a link or putting the caret in it should show
where it goes, and let you edit it (its words and its address) and open it.
Each page shows one direction, working, in Day and Night, in all three
layouts, from the keyboard, and on a phone:

- [link-card.html](link-card.html): 1 · A card under the link
- [link-inline.html](link-inline.html): 2 · In place, the link's Markdown
  opened where it stands
- [link-bar.html](link-bar.html): 3 · A bar with the caret, the selection
  bar's sibling

The note is a planning note with two kinds of link: `[[wiki links]]` to
chapters (one with other words, `[[What the Recruits Say|chapter iv]]`, and
one to a note not made yet) and web links. Beside the page is the file as it
would be saved, redrawn as you type; the lines that change flash moss. The
bar at the top switches Day and Night, the layout (its corners, its page
tools and where its formatting bar goes), a phone's width (no hover), the
formatting bar, and **A plain click**: *Places the caret* (today) or
*Follows*, so each direction can answer the owner's question in the page
itself.

## What all three share

- **A link looks as Live draws it now** (`editor/theme.ts`): its words in ink,
  underlined in `--eien-rule-strong`. No colour of its own: nothing but the
  seal is vermilion, and colour is never the only sign. The caret's link
  underlines in `--eien-ink-soft`, so the card or bar is plainly its.
- **A note not made yet has a dotted underline** (new), the wiki's old "red
  link" without the red, and its tools offer to make the note in place of
  opening it.
- **Where it goes, typed, says what kind of link it is.** An address
  (`https://…`, `www.…`, `example.org/…`) makes `[words](address)`; a note's
  name makes `[[note|words]]`, or `[[note]]` when the words are its name. A
  note's name is finished from the vault as you type (the rest faded; Tab
  or → takes it).
- **Words are never lost.** Taking a link off keeps its words. Typing over a
  link's words takes the link only with the last of them, and the colophon
  says so with ⌘Z. Every change is one step of the history.
- **The keys, the same in all three:**
  - The arrows into a link: its tools come with the caret, and a screen
    reader hears where it goes and the keys below.
  - ⌥↩ opens the caret's link; ⌘-click (Ctrl-click) opens any link.
  - ⌘K with the caret in a link edits it; with words selected, makes them a
    link and asks where it goes. Today ⌘K toggles, so in a link it would take
    the link off; here that's the tools' Take off. The formatting bar's Link
    is pressed in a link and does the same as ⌘K.
  - ⌥F10 from the text to the link's tools (as the table explorations
    reached their bar); Esc back to the caret.
- **Never while typing.** What shows for the caret steps aside while you
  type in a link's words, and comes back when you move.
- **Every control has a name** for a screen reader and a tooltip with its
  key, the window's own tooltip.

## 1 · A card under the link

- **What:** point at a link for a moment (400 ms), or put the caret in it,
  and a card comes under it: raised paper, a rule-strong hairline, the float
  shadow, `--eien-radius-m`, as a menu is, and as wide as the note list.
  - A note link's card reads as that note's row in the list: its crumb
    (FIC / BENEATH THE WALLS / III), its title, its first line in pencil, its
    words and last seal in the mono.
  - A web link's card is its address: the site in ink, the rest in pencil.
  - A note not made yet: NO NOTE YET, its name in italic, as Eien's empty
    things are.
  - Then four tools: Open (or Make), Edit, Copy, Take off, and the pointer's
    way to open it (⌘-CLICK OPENS) in label type.
  - Edit turns the card into two fields, Words and Goes to (Eien's field: a
    wash of ink, a 2px focus ring inside its edge). ↩ keeps, Esc puts back,
    leaving keeps, as renaming does.
- **For:**
  - It answers "which chapter is this?" without leaving the page: the first
    line and the place in the book are there on a hover. With chapters named
    i, ii, iii, that's the question a writer asks most.
  - The most discoverable, and the most familiar: a word processor's link
    card.
  - The same card for hover and caret, with the marks shown or hidden.
  - The card is what would make a plain click safe to follow (below).
- **Against:**
  - It covers the two or three lines under the link while it's there.
  - The most new surface of the three: a new floating thing with its own
    anatomy.
  - Its Words field repeats the words on the page.
- **A plain click:** either works. *Places the caret*: the card comes under
  the click, so opening is one more click, just below. *Follows*: the card is
  still there on hover to edit, and the keyboard reaches every link;
  ⌥-click puts the caret in one.
- **On a phone:** a tap puts the caret in the link and the card comes under
  it, the sheet's width, its tools at 44px with their words beside them, as
  there are no tooltips. With Follows, a tap opens and a long press places
  the caret.

## 2 · In place

- **What:** nothing floats. With the caret in a link, that link's own
  Markdown opens where it stands, as a name opens for Rename:
  `[words](address)` or `[[note|words]]`, the marks faded as Live shows them,
  the address in the Source font, the 2px focus mark under whichever part
  has the keyboard, the caret in the seal. → at the end of the words walks
  into the address, and on out; ⌘K selects the address (or opens a note
  link's name before its words). One small control follows the link while
  it's open: ↗ to open it, or + to make the note.
  - On hover, the colophon (the page's status line) says where it goes,
    "→ III · BELOW THE GATE · ⌘-CLICK OPENS", as a browser's status line
    does; with the caret in a link it stays said there.
- **For:**
  - The most honest: you edit the Markdown the file holds, nothing else, and
    the page and the file say the same thing.
  - Nothing new over the words and no new surface: Live's marks, the Rename
    pattern and the colophon, all three already Eien's.
  - With Show Markdown marks on, Live already opens the whole line. This
    narrows that to the link, which reads better.
- **Against:**
  - The line reflows when a link opens: a long address pushes the words
    after it down. `links.ts` follows ⌘-click on the press for exactly that
    reason, "a caret on the link's line would … slide the words from under
    the pointer". This direction does it on purpose, to every link the caret
    reaches.
  - Hover says where it goes only in the colophon, far from the eye, and
    shows nothing of a note but its name.
  - The Markdown is in the writer's face: the marks hidden setting exists
    because some writers don't want them.
- **A plain click:** this one wants *Places the caret*. Opening in place is
  what the click does, and following is ⌘-click, ⌥↩ or the ↗. With
  *Follows*, a link opens in place only from the keyboard or ⌥-click, and
  nothing on the page teaches that.
- **On a phone:** a tap opens the link in place; the ↗ after it has a
  finger's reach without making the line taller; the colophon says where it
  goes. A long address wraps where it must.

## 3 · A bar with the caret

- **What:** the selection bar's sibling. With the caret in a link, a small
  bar sits over its line, as the selection bar sits over a selection, in that
  bar's own surface (raised paper, a rule hairline, `--eien-radius-m`, the
  float shadow, 4px round): an icon for the kind (a page or the web), where
  it goes (a note's number and title in the text face, or the address in the
  mono), then Open, Edit, Copy, Take off. Pressing where it goes, Edit or ⌘K
  turns it into a field in the bar. The words you edit on the page, where
  they are.
  - A hover gets only the window's tooltip (450 ms, as every control's):
    "→ ii · Rations  ⌘-click".
- **For:**
  - Nothing new to learn: the selection bar's place, look and behaviour.
  - The smallest thing over the page, and one row of tools in the same order
    every time.
  - The best on a phone: docked above the keyboard on the band, as the
    table's bar is, at 44px.
- **Against:**
  - It covers the line above the link.
  - A hover shows only the address: no note's first line, no place in the
    book.
  - With text selected inside a link, the selection bar and this one want
    the same place, and one must give way. This page draws only the link's;
    the app would have to choose.
- **A plain click:** *Places the caret* (today): the bar comes over the line
  you clicked, its Open a short reach up. *Follows*: the bar comes only from
  the keyboard or ⌥-click, and editing a link by pointer takes a modifier
  that nothing on the page teaches.
- **On a phone:** docked at the foot, above the keyboard; where it goes
  takes the room the tools leave. Nothing floats over the words a thumb is
  in.

## Side by side

| | 1 · A card | 2 · In place | 3 · A bar |
|---|---|---|---|
| Hover shows | The note's row: crumb, title, first line, words | Where it goes, in the colophon | The address, in a tooltip |
| Caret shows | The same card | The link's Markdown, opened | A bar over the line |
| Edits the words | In the card's field (or on the page) | On the page | On the page |
| Edits where it goes | In the card's field | In the line, as Markdown | In the bar's field |
| Covers | Two or three lines under the link | Nothing; the line reflows | The line above |
| New to Eien | The card | Nothing (marks, Rename, colophon) | Little (the selection bar's twin) |
| Phone | The card, the sheet's width | In place, the colophon says where | Docked above the keyboard |
| A plain click | Either; the card makes Follows safe | Places the caret | Places the caret |

## Should a plain click follow a link in Live?

**Recommendation: no, keep today's rule.** A plain click places the caret in
Live and Source and follows in Reading; ⌘-click (Ctrl-click) follows
everywhere; ⌥↩ follows from the keyboard; and now the link's tools have Open.

- Live is where you write. A click in a paragraph is how you put the caret
  in it, and a link is mid-sentence: a click that leaves the page, or opens a
  browser, mid-thought, loses the writer's place.
- A link's words are what you most often fix in a draft. With Follows, every
  edit to a link starts with a modifier (⌥-click) or the keyboard, and
  nothing on the page teaches it.
- With a card or a bar, opening is one press away from the click anyway,
  right under or over it.
- Reading is where a page behaves like a page: a plain click follows there,
  as now.

If the owner would rather have plain clicks follow, direction 1 is the one
that makes it safe, as its card still gives Edit on hover. That would be a
setting, Live's "A click on a link: places the caret / follows", not a
change of the default.

## Recommendation

**1 · A card on the desktop, with 3's docked bar on the phone. A plain
click places the caret.** The same split the tables chose.

- The card answers the question a writer asks of a `[[link]]`, "which
  chapter is that?", on a hover, with the note's own row: its place, its
  first line, its words. Neither 2's colophon nor 3's tooltip can.
- It works the same for hover and caret, with Markdown marks shown or
  hidden, and in every layout (its corners are the layout's `--eien-radius-m`).
- On a phone there's no hover to make the card worth its room, and the
  keyboard takes the bottom half: 3's bar above the keyboard is the phone's
  way already (the formatting row, the table's bar).
- From 2, keep one thing: the screen reader hears where a link goes as the
  caret reaches it, and the colophon names the caret's link ("LINK 3 OF 6 ·
  TO A NOTE"), as all three pages do.

If the owner prefers less on the page, 3 everywhere is the simplest to build:
it is the selection bar with other buttons. 2 is the purest, but its reflow
is the very thing `links.ts` was written to avoid.

## Intent, and the checks

Each page's choices, from `.interface-design/system.md`:

- **All three.**
  - Intent: the system's writer, late at night in a planning note full of
    chapter links and a web reference or two. They want to see where a link
    goes, fix it, and open it, without losing the line they're on.
  - Palette: Washi's tokens only. A link is ink and a rule-strong underline;
    the only vermilion is the caret (one of the seal's five places).
  - Depth: surface tone and hairlines; the float shadow only on what floats
    (two shadows, no more).
  - Typography: the two voices. A link's words, a note's title and first
    line are in the text face, because a person wrote them. Addresses,
    crumbs, counts and keys are in the mono, because the machine keeps them.
  - Spacing: the 4px scale. A card's padding is the row's 12px, a control's
    inside 8px, icon gaps 4px.
- **1 · A card.** Surface: raised paper over the sheet's paper ("what
  floats"); its fields set in as the field wash. Its body is the note row's
  anatomy, so a note link's card reads as that note in the list. Its width
  is the list's (`--eien-list-w`).
- **2 · In place.** Surface: none but the sheet's paper and the colophon's
  band. Rename's pattern: no box and no ground, the 2px focus mark under the
  part being edited, the caret in the seal. The marks are faded as Live's
  are, and the address is in the Source font (`--eien-face-source`,
  `--eien-size-source`).
- **3 · A bar.** The built selection bar's surface exactly (`editor.css`:
  raised paper, `--eien-rule`, `--eien-radius-m`, the float shadow, 4px). The
  window's tooltip for hover. On a phone, the table bar's dock (band ground,
  44px targets).

The checks, run on each page before calling it done:

- **Swap:** with the text face swapped for a system sans, the card's note
  row and the bar's title lose the "person wrote it" voice and read as a
  generic link preview. The two voices are doing work. Swap the card's
  anatomy for a generic link preview (favicon, page title, image) and it
  stops being a note's row: that's the default it replaces.
- **Squint:** at rest, nothing but underlines. With a card or bar up, the
  page still leads: one raised surface, hairlines, no colour, no heavy edge.
  In 2, nothing rises at all.
- **Signature:** the seal stays in its five places. Here it's the caret in
  every field and in the text (the cards and bars carry none of it). The
  places a link's design belongs to Eien are the note's row in the card, the
  crumb in label type, the machine voice for addresses and keys, the
  colophon's line, and Rename's focus mark in 2.
- **Token:** every colour, edge, corner, space and size is an `--eien-*`
  token. `link.css` adds tokens.css's own `--eien-field`,
  `--eien-size-source` and `--eien-list-w`, which `shared.css` predates; the
  one length that isn't a token is the bar's address, cut at 26 characters.

## Open

- **Following a note not made yet:** here it says so, and the tools offer
  Make. Opening it could make it at once (as some apps do), but a stray
  click shouldn't make files.
- **Reference links** (`[words][ref]`) and **autolinks** (`<https://…>`, a
  bare address): the card would show the address the reference defines, and
  editing would edit the definition's line. Not shown here.
- **A link round formatted words** (`[**the gate**](…)`): the Words field
  would show the words plain and keep their marks. Not shown here.
- **A wiki link's case:** `[[below the gate]]` finds Below the Gate here, as
  titles are matched without case. Check against the app's lookup.
- **Hover timing:** 400 ms for the card, 450 ms for the tooltip (the
  window's), 120 ms for the colophon. Tune in the app.
