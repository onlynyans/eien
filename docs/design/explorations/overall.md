# The whole window: three explorations

[overall.html](overall.html) shows the desktop window and the phone (Show →
Phone), with three ways to carry the backlog's interface changes. Switch
between them in the bar at the top. Hover a pane to see its controls; every
control has a tooltip. Things to try:

- the Syncthing switch: Set up, Changed elsewhere, None;
- the sidebar's + on FOLDERS and TAGS;
- folding LIBRARY, FOLDERS or TAGS;
- the formatting bar, and Focus mode;
- hiding the page's controls;
- shutting and reopening panes;
- right-clicking a row, or F2, or double-clicking a name;
- the two weight sliders, and C's strip ground.

## Second pass (2026-10-21)

- **Fixed: the pane chevrons.** In A and B the ‹ that shuts a pane spanned
  the pane's width: it took the pane's `min-width` meant for its contents.
  It's 28px now.
- **The way back from a shut pane:**
  - **A shut sidebar keeps a strip of desk**, in all three. The strip holds
    the traffic lights and the seal, and the seal opens it again, as the
    spec has it ("the seal shuts and opens it"). A › shows under the seal on
    hover.
  - **A shut list's way back** is a › in the same spot its ‹ was, in the
    pane beside it: the page band's left end in A, a tab on the page's left
    edge in B. Both show on hover, as every control does. In C, the running
    head's pane icons do both, always in sight.
- **Fixed: the status bar's height.** Zoomed out, the colophon grew to fill
  the space under a short sheet. The page grid gave a hidden part's row to
  the next part. Each part of the page now has its own row, and the status
  bar is a fixed `--status-h` (40px).
- **Focus mode** is in every toolbar: A's band, B's slip, C's running head,
  and the phone's foot.
  - Its icon is three lines with only the middle one in full ink. It dims
    every paragraph but the one with the caret, and its key is ⇧⌘↵ as in the
    spec.
- **C keeps the sidebar's own head** at the top left, above LIBRARY: the
  seal and the vault's name, the same height as the running head beside it.
  Shut, it's the strip with the seal. The running head starts after the
  sidebar.
- **C's strip ground** is a setting: one of the theme's own surfaces (desk,
  blotter, band, paper, selected) as `--runhead-ground: var(--eien-…)`. It
  follows any theme or scheme and is never a fixed colour. Try it in the bar
  here, and in Settings / Look / Appearance.
- **Rename, in the row** (see below).

## Renaming, made one thing

- **The incoherence:** today, Rename on a note opens the note and moves you
  to its title on the page, while Rename on a folder edits in its row, and a
  tag can't be renamed at all. So one word does two things, in two places.
- **Now there's one way, in place, for notes, folders and tags:**
  - It starts from the row's right-click (Rename, F2), with F2 on a focused
    row, or with a double-click on a name.
  - The name itself becomes the field: same face, size and weight, its words
    selected and a hairline under it in the focus ink. A note's `.md` shows
    after the field, faded, so it's plain that it stays.
  - Enter keeps it, Esc puts the old name back, and leaving the field keeps
    it.
  - A name that's taken (case aside, as the storage counts it) shows as a
    small ochre line under the row as you type, and the field stays open.
- **Renaming a note by its title on the page** stays, as a second way.
- **The right-click menu becomes Eien's own:**
  - raised paper, the row's name as its head, an icon and a word for each
    choice, its key in pencil;
  - "Send to the trash" in carmine, after a rule.

## Intent

- **Who:** a writer, often late at night, three scenes into a chapter, with
  hundreds of notes.
- **What they do most:** write the next scene; then find a note, reorder
  chapters, seal and compare, copy for AO3.
- **Feel:** a book on a desk at night. Every control recedes until the
  pointer or the keyboard asks for it.

## The three explorations

- **A · Band:** the approved mockup, carried forward.
  - The page's controls sit in its band, and the band hides to a lip.
  - The formatting bar is the band's second row; tags are in the running
    head.
  - Corners are 2 / 4 / 8.
- **B · Slip:** the page loses its band.
  - The tools float on a raised slip, the formatting bar on a second slip.
  - Tags are label slips under the title, and panes have edge tabs.
  - Corners are 4 / 8 / 14.
- **C · Running head:** one strip beside the sidebar's head, holding the
  pane toggles, the breadcrumb and every page tool.
  - The formatting bar is a rail in the margin; tags are pills in the
    colophon.
  - Corners are 3 / 6 / 10.

Recommendation, unchanged: A's structure with B's corners. With tags already
decided as A (the running head), A is the shortest step. C is the strongest
if the window should feel like one object with a title strip of its own.

## Can one framework carry all three?

Yes, cleanly, and the app is most of the way there. The three explorations
don't differ in what the controls are or what they do; they differ only in
where the controls sit. So the framework separates three things.

1. **Commands, once.** Each control is a command:
   - its id, its icon, its label, its key, what it does, and whether it's on;
   - examples: `view.live`, `seal`, `versions`, `focus`, `format-bar`,
     `pane.sidebar`.

   The app already has most of this: `MenuBus` carries commands from the
   menu bar and the phone's ⋯, and `core/format`'s `FORMAT_COMMANDS` is the
   same idea. One `ui/chrome/commands.ts` lists them, about 100 lines of
   data.
2. **Hosts, dumb.** A host is an element that draws a list of command ids as
   icon buttons, with their tooltips and pressed states, and nothing else.
   One `ui/chrome/host.ts`, about 80 lines.
3. **Chromes, small.** A chrome says which hosts exist and which commands
   each holds:
   - Band: the page band, plus the formatting bar's row.
   - Slip: the slip and the format slip.
   - Running head: the strip and the margin rail.

   Each is a short module (`chrome/band.ts`, `slip.ts`, `runhead.ts`, about
   60 lines each) plus its own stylesheet. The choice is a device setting
   (`appearance.chrome`) set as `data-chrome` on `<html>`. Switching it
   unmounts one chrome's hosts and mounts the other's. Nothing else changes.

The pieces that move between chromes are components already: the tag set
(running head, colophon or slips), the pane toggles, and the sync icon. Each
chrome names a slot for them.

**Why it stays simple:**

- There are three chromes, as a fixed union, not a plugin system.
- Commands don't know where they're drawn.
- Hosts don't know what's in them.
- CSS stays per chrome, so no rule asks "which chrome am I in?" inside a
  component.

**Tests:**

- a unit test that every command is in exactly one host per chrome, so none
  is lost when switching;
- one e2e per chrome that each command is reachable from the keyboard.

**The cost:** the work is moving today's page bar and sidebar foot onto
commands, the same work the icons (#26) need anyway. Building the framework
first and the chromes second costs less than building one chrome and
refactoring later.

## Open

- Which exploration, or which mix. The framework above makes "all three, as
  a setting" a real option.
- The phone's three bottoms (top bar, floating slip, bottom rail) are still
  rough; the chosen one gets its own pass.
