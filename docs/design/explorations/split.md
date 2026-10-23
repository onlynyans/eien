# Split window: three explorations

**For the owner to choose (2026-10-23).** Nothing is built. New Window comes
first (several windows, each with its own vault and note), then the split: two
notes side by side in one window.

Each page shows one direction, working, in all three layouts (A · Band,
B · Slip, C · Running head), by Day and Night, with the sidebar open or shut,
the formatting bar on or off, and the window as wide or narrow as you like (the
Window slider):

- [split-apart.html](split-apart.html): 1 · Two whole pages
- [split-shared.html](split-shared.html): 2 · One set of tools
- [split-sheets.html](split-sheets.html): 3 · Two sheets on one blotter
- [split-window.html](split-window.html): New Window and the phone, shown once,
  the same whichever split is chosen

Three more, 4 · Facing pages, 5 · A companion and 6 · Tools that follow, are in
[split-alt.md](split-alt.md), with a table comparing all six.

## Design intent

- **Intent:** a writer late at night with a chapter beside the one before it,
  or beside its notes, checking continuity and keeping on writing. The page
  stays the loudest thing, and the second note is a second sheet of paper,
  not a second app.
- **Palette:** Eien's own: desk, blotter, paper and ink. No colour marks the
  active page; the seal keeps its five places, so it never marks a side.
- **Depth:** hairlines and the two shadows only. The active page is told by
  ink (1), by ink strength (2) or by the sheet's shadow (3), never by a fill or
  a hue.
- **Surfaces:** as the layout has them. Nothing new is raised but the menus,
  the drop preview's label and the divider's ⇄.
- **Type:** the writer's face at its own prose and title sizes, leading and
  measure (the mock is drawn at real size); the machine voice for crumbs,
  counts and keys.
- **Spacing:** Eien's 4px scale. The divider is a hairline column with an 8px
  handle, as a pane's edge is; 3's gap is 24px of blotter.

## What all three share

- **Side by side, with a divider.**
  - Drag it, or use ← → on it; double-click (or Enter) evens it.
  - Neither page goes narrower than 360px.
  - **Top and bottom isn't offered.** Prose wants its measure, and two short
    pages of it read worse than one tall one.
- **Opening a split:**
  - a note's right-click menu, **Open to the Side**;
  - **⌘-click** a row in the list, or **⌘Enter** on it;
  - drag a row onto the page's right edge, with a drop preview where the new
    page will stand. Dropped on a page instead, it opens there.
  - **⌘D** opens the note beside itself. Pressed while split, it closes the
    other side. It's free: ⌘\\ is Toggle Sidebar, ⇧⌘\\ Toggle Note List, and
    ⌥⌘\\ is taken too, by the editor's Indent Selection (CodeMirror's
    default keymap, which Eien's editor loads).
- **Which page is active:**
  - A click in a page makes it active.
  - **⌘3** (Go to Page) goes to the page; pressed in a page, it goes to the
    other one.
  - The list's chosen row (the selected fill and the seal's rule) is the
    active page's note. The other page's note keeps a fainter rule, in pencil
    and with no fill, so both open notes can be found.
- **Choosing a note** in the list, or in the sidebar with two panes, opens it
  in the active page.
- **Closing a side:**
  - its × on hover;
  - **⌘W** in it: while split, the window's ⌘W closes the active side first;
  - ⌘D for the other side.

  The note is closed, not touched, so no words are at stake.
- **Swapping the sides:** the ⇄ on the divider (on hover or focus), or the
  row's menu.
- **The same note on both sides** is one document: typing in one shows in the
  other at once (try ⌘D with one note open). The seals, the counts and the
  undo are the note's, not the page's.
- **Narrow windows:**
  - Below 720px of page (the window less the panes beside it), the two pages
    fold into one, with a pager naming both. ⌘3 or the pager turns between
    them.
  - Shutting the sidebar or the list unfolds them. With both panes open, that
    is a window under about 1,300px.
  - The split is never refused, only folded.
- **The active page owns the commands:** Copy as HTML, Seal, Versions, Compare,
  Outline cards, Find and the formatting keys all act on it.

## 1 · Two whole pages

- **What:** each page has all its own parts, as if the page pane were cut in
  two.
  - A: its own band (views, tools, its ×).
  - B: its own slip.
  - C: its own half of the running head, a crumb and the tools over each page.
  - Each also has its own formatting bar (A: under its band; B: a slip at its
    top left; C: a rail in its margin) and its own colophon.
  - Tags go where the layout puts them, on each page.
  - Versions lays its panel over the other page, so the page it's about stays
    in sight. Outline cards fill the page that asked.
- **Active:** a 2px ink-soft rule across the top of the active page, and the
  caret. Each page's tools come up while the pointer is over it.
- **For:**
  - Nothing to guess: every control sits on the page it acts on.
  - Each side is Eien's page unchanged.
- **Against:**
  - Twice the furniture: two bands, two formatting bars, two colophons.
  - On a narrow side, A's band crowds.
  - C's running head stops being one line across the window.

## 2 · One set of tools, for the active page

- **What:** the page pane keeps its one set of tools where the layout puts
  them (A's band, B's slip, C's running head), and they act on the active page.
  - One formatting bar.
  - One colophon, the active note's: its number first, its words, today's
    tally, its last seal.
  - Tags stay on each sheet in A and B. In C, the colophon shows the active
    note's.
  - Versions opens at the window's right edge as now. Outline cards take the
    active page's place.
- **Active:** the other page's words soften to ink-soft. The colophon and C's
  crumb name the active note, and the caret is in it.
- **For:**
  - The calmest of the three, and nothing new to learn.
  - C keeps its single running head.
- **Against:**
  - A tool's target isn't always beside it: A's views sit over the left page
    while you write in the right.
  - Softened ink is a quiet cue, quieter still by Night.

## 3 · Two sheets on one blotter

- **What:** the page pane isn't cut in two. It's one blotter with one set of
  tools, one formatting bar and one colophon, as in 2.
  - The two notes are two sheets lying side by side on it.
  - The 24px of blotter between them is the divider; a hairline shows only
    while it's handled.
  - The × sits at a sheet's top right corner, on hover.
- **Active:** the sheet on top.
  - The active sheet has the sheet's shadow, the object you work on; the other
    lies flat, its hairline only.
  - In Page frame Full there are no sheets, so a 2px ink-soft rule tops the
    active page instead.
- **For:**
  - It's Eien's own picture, two papers on a desk.
  - Its cue is depth Eien already has: no colour and nothing new.
  - As calm as 2, and the split adds no line to the window, only a gap of
    blotter.
- **Against:**
  - The gap between the sheets costs 24px.
  - A shadow is a subtle signal, and Full needs its own.
  - As in 2, a tool's target isn't always beside it.

## New Window (shown once, on split-window.html)

- **File → New Window**, **⇧⌘N** (free: ⌘N is New Note). It opens on the
  vault and note this window shows; File → Open Vault… in it changes its vault.
  Each window is its own: its vault, its note, its panes, its split.
- **Open in New Window** sits in a note's right-click menu, beside Open to the
  Side.
- **Close Window**, ⌘W. While split, ⌘W closes the active side first.
- macOS's Window menu lists each window by its note.
- Two windows on one vault see each other's saves as they land, as Eien sees
  any change to the vault's folder.

## The phone

- **No split and no New Window:** a phone shows one page, and the split's
  commands aren't in its menus.
- **Instead, the other note:** the back bar keeps the note you came from a tap
  away, at its right (⇄ and its name). A tap switches, and both keep their
  places, so working between a chapter and its notes is one tap.

## Recommendation

**3 · Two sheets on one blotter.**

- It's as calm as 2: one set of tools in their usual place, one formatting
  bar, one colophon, and C's running head kept whole.
- Its cue for the active page is Eien's own: the sheet you're working on lies
  on top, with the sheet's shadow.
- It adds no new mark and no new line. The split is a gap of blotter between
  two papers.

1 is clearer about what each tool acts on, but it doubles every bar, which
Eien's "never louder than the page" argues against. If the shadow proves too
subtle by Night, 3 can borrow 1's 2px rule, as it already does in Page frame
Full.

## Open

- Whether ⌘W should close a side while split (as editors' tabs do) or always
  the window. The pages assume the side.
- Whether two windows may hold the same vault. The pages assume yes, since
  the vault is one folder Eien already watches.
