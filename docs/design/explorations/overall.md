# The whole window: three explorations

[overall.html](overall.html) shows the desktop window and the phone (Show →
Phone), with three ways to carry the backlog's interface changes. Switch
between them in the bar at the top. Hover a pane to see its controls; every
control has a tooltip. Try: the Syncthing switch (Set up, Changed elsewhere,
None), the sidebar's + on FOLDERS and TAGS, folding LIBRARY, FOLDERS or TAGS,
the formatting bar, hiding the page's controls, and the two weight sliders.

## Intent

- **Who:** a writer, often late at night, three scenes into a chapter, with
  hundreds of notes.
- **What they do most:** write the next scene; then find a note, reorder
  chapters, seal and compare, copy for AO3.
- **Feel:** a book on a desk at night. Every control recedes until the
  pointer or the keyboard asks for it. The page is the brightest, quietest
  thing on the screen.

## Domain

- **Domain:** a writing desk and its things: the blotter, washi, sumi, an
  inkstone, the seal and its red paste, a book's contents page and running
  head, a colophon, label slips, a ribbon bookmark, a pen's line.
- **Colour world:** washi's warm off-white, sumi's brown-black, the inkstone's
  near-black, the blotter's grey-beige, the seal's vermilion, moss and ochre
  for what changed. Nothing blue, nothing neon.
- **Signature:** the seal, plus one new one: icons drawn as pen lines on a
  16-unit grid, with round ends, in the ink of whatever they sit in. They
  read like the hairlines and the struck-through words of Compare, not like
  another app's glyphs.
- **Defaults turned down:**
  - A grey title bar, which becomes the panes' own bands.
  - A toolbar always in sight, which shows on hover, can hide, or floats.
  - Rounded cards everywhere, replaced by paper that stays square, with
    corners only on what you press or what floats.

## What all three share

These are fixed in all three, from your answers and `system.md`:

- **No title bar** (#1). The traffic lights sit over the sidebar's head, and
  the panes' top bands drag the window. In C they sit in a strip of their
  own.
- **Icons for controls** (#26), from one set (see
  [specimen.html](specimen.html)), each with a tooltip naming it and its key:
  - the views as edit, code and book (#17);
  - day and night as one sun/moon toggle, the panes as one icon that shows
    the current layout, and settings (#8).
- **The sidebar:**
  - Its sections fold from their label (#3), with guide lines (#5) and BOOK
    marks (#6).
  - A quiet + appears on hover beside FOLDERS and TAGS (#4). The one by TAGS
    names a tag in place, with no notes yet.
  - Pinned is always in Library (#7), with a ribbon icon.
- **Sync status** (#10): one sync icon at the sidebar's foot, in moss.
  - Its tooltip says "Synced · Syncthing, 4m ago", or "Changed on another
    device 4m ago" in pencil ink.
  - Nothing shows when the vault isn't a Syncthing folder. Eien can tell from
    the `.stfolder` marker Syncthing puts in every folder it shares.
- **Search in the list** (#11), already being built in 1C.
- **Row weights** (#25): the list's chosen title is 100 heavier. Whether the
  sidebar's chosen row is too differs: A no, B and C yes.

## A · Band

The approved mockup, carried forward.

- **Page controls:** they stay in the page's band, as icons on hover. The
  chevron at the band's end hides the band (#16); a small lip at the top of
  the blotter brings it back.
- **Formatting bar** (#14): a second row in the band.
- **Tags** (#13): at the running head's right, as the mockup had them, with a
  + on hover.
- **Shutting panes** (#15): a chevron at the pane's top right, on hover. A
  shut pane leaves a thin edge that shows ›.
- **Corners:** 2 / 4 / 8px, barely there. The sheet stays square.
- **Phone:** the page's top bar carries the view and ⋯.
- **Trade-off:** the least change, and the most familiar. The band costs
  56px above the sheet while it shows.

## B · Slip

The page loses its band.

- **Page controls:** they sit on a raised paper slip, floating at the top
  right of the blotter, which folds to a single chevron (#16). The sheet
  reaches the top of the pane.
- **Formatting bar:** a second slip at the sheet's top edge.
- **Tags:** label slips just under the title, like paper tabs.
- **Shutting panes:** small tabs that stick out from a pane's edge at its
  middle, on hover.
- **Corners:** 4 / 8 / 14px, softer. The sheet takes 3px.
- **Phone:** a floating slip at the bottom right.
- **Trade-off:** the most room for the page, and the most "object on a desk".
  The slip floats over the blotter's corner, so on a narrow page it sits
  near the text.

## C · Running head

One strip across the whole window, like a book's running head. It's the
title bar with useful icons in it, as in Claude's window.

- **The strip holds:**
  - the traffic lights;
  - the pane toggles, which are always there here, so no hover chevrons (#15);
  - the breadcrumb, centred;
  - the views, Compare, Seal, Versions and the formatting toggle.
- **Panes:** they have no head of their own.
- **Formatting bar:** a vertical rail in the page's left margin.
- **Tags:** pills in the colophon, by the counts.
- **Corners:** 3 / 6 / 10px, with round pills for tags.
- **Phone:** a tool rail at the bottom.
- **Trade-off:**
  - Every control is in one predictable line, and the strip is where the
    title bar was, so no height is lost.
  - It's the furthest from the approved design: the panes stop being three
    objects with their own heads.

## Recommendation

**A's structure, with B's corners and C's always-there pane toggles** for
whoever wants them. In more detail:

- Keep the band, since it's the approved design and the least surprising.
- Take B's softer corner scale (4 / 8 / 14) for controls and floating things,
  and keep the sheet square: paper is paper.
- Put tags in A's running head; [tags.md](tags.md) explores them further.
- The formatting bar sits in the band's second row.
- The sidebar's chosen row stays at its weight. Its seal rule and fill
  already mark it, and a heavier name would shift the tree's text as you
  move.

Your call; each piece is independent, so a mix works too.

## Open

- Which exploration, or which mix.
- The phone: the three bottoms (top bar, floating slip, bottom rail) are
  rough. The chosen one gets its own pass.
