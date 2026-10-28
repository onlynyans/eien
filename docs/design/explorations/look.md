# A quick look, anywhere: three explorations

**Decided (2026-10-28): 1 · On the bar.** Backlog #49. Nothing is built yet.
Changing Day or Night, or the text's size, now takes the sidebar's foot (Day
or Night only) or Settings, behind the sidebar. Each direction puts one control
in reach in every layout and on the phone. It opens a small popover of the
look's everyday settings:

- Day or night;
- the typeface;
- the text's size;
- line spacing;
- the page's width;
- the page's frame.

With a note in front it sets the notes' look. With an EPUB from SHELF (#40) it
sets the shelf's own look, kept apart, so a note's typeface never changes a
book you're reading.

Each page works by Day and Night, in A · Band, B · Slip and C · Running head,
with the sidebar open or shut and the list shown or hidden. The window can be
as wide or as narrow as you like. Each also works from the keyboard and on the
phone (the bar's Device). The bar's **Open** shows both states: a note, an
EPUB, or both side by side (the split's Two sheets). In the third, the page
you're in decides which look the control changes. The window, the EPUB and the
phone are the EPUB explorations' own (`_src/epub.*`); the quick look adds
`_src/look.*`.

| Page | Direction | Where the control lives | How you tell which look |
|---|---|---|---|
| [look-bar.html](look-bar.html) | **1 · On the bar** (chosen) | **Aa**, the page's last tool: A's band, B's slip, C's running head | The popover's head: LOOK / NOTES or LOOK / SHELF |
| [look-colophon.html](look-colophon.html) | 2 · In the colophon (recommended) | The colophon's right end, which reads the look out: NOTES · NEWSREADER · 100% | The readout, always in sight, before you open it |
| [look-page.html](look-page.html) | 3 · On the page | **Aa** at each page's top outer corner, quiet until you point at that page | By place: it's on the page it changes |

## Decided (2026-10-28)

The owner chose **1 · On the bar**. The build follows this section and "In
all three" below where they and the other directions disagree.

- **The control:** a command in `ui/chrome/commands.ts`, `look`, icon
  **Aa** (`ui/icons.ts`), named "Look", key ⇧⌘L (Ctrl+Shift+L), and the
  menu's View → Look…. It's the last of the page's tools, after a hairline:
  - A's band;
  - B's slip;
  - C's running head;
  - the phone's bar (A), floating slip (B) or rail (C), and the phone's ⋯.
- **Folding:** it joins `TOOL_FOLDS` (`ui/chrome/layout-spec.ts`), folding
  last of the tools, before the views. Folded, the ⋯ menu's Look opens the
  popover from the ⋯.
- **The popover:** the column, under the control, its end lined up with the
  control's. On the phone it's the sheet from the screen's foot. Its head
  names whose look it is: LOOK / NOTES or LOOK / SHELF.
- **Which settings:** the `quick` mark in the schema, as below. The shelf's
  values are #40 Phase 1's look settings, made from the mark.
- **When it's built:** beside #40, after the phase that lets a page hold an
  EPUB. #40's session places it in its phases.

## In all three

- **What's in it.** The six settings, drawn as Settings draws them: a
  segmented well, face cards set in each face, a stepper. Names only, as the
  browser extension's popup has them: the descriptions stay in Settings.
  - A change shows on the page at once; there's nothing to confirm or cancel.
  - **All settings** (⌘,) at its foot opens Settings at Look.
- **The popover** follows `system.md` for what floats:
  - raised paper, a `--eien-rule-strong` hairline, the float shadow;
  - the layout's `--eien-radius-m` (2/4/8, 4/8/14, 3/6/10);
  - as wide as the list (`--eien-list-w`), so two face cards stand side by
    side at Settings' own size.
  - Its head is Settings' breadcrumb, LOOK / NOTES or LOOK / SHELF, with *every
    note* or *every book on the shelf* in pencil.
  - Nothing in it is the seal's colour: the chosen choice is ink in a
    rule-strong hairline.
  - It fades in once (`--eien-quick`); a change redraws it in place, still.
    There's no motion with reduced motion.
- **The page it doesn't change sits back** while it's open, when two pages
  show: its paper takes `--eien-band`, as a companion's does.
- **By Day and Night:** by Night the raised paper is the lighter step, as
  menus are. Choosing Day or Night in the popover turns the window at once,
  with the popover open; *System* stays System.
- **The key:** ⇧⌘L (Ctrl+Shift+L), View → Look…, opens it for the page
  you're in.
  - The keyboard goes to the first setting's chosen value.
  - The key again, or Esc, closes it and gives the keyboard back where it
    was. Opened by a click, Esc gives it back to the control.
  - ⇧⌘L is free: it's in neither Eien's menu nor its keymaps (CodeMirror's
    search keymap binds it, but Eien doesn't load that keymap).
- **From the keyboard:** each setting is one stop, as a radio group is.
  - Tab and ⇧Tab go round the settings and All settings.
  - Arrows choose within a setting, at once; ↑ and ↓ move a row in the faces.
  - Enter or Space presses the stepper's − and +.
- **Closing:** Esc, the key again, or a click outside. Choosing the other page
  also closes it.
- **The phone:** the popover is a sheet from the screen's foot.
  - `--eien-radius-l` at its top corners, the float shadow, and no scrim, so
    the words above show each change.
  - Its controls are at `--eien-touch`; the faces are one row that scrolls
    sideways. Done closes it.
  - The phone's ⋯ has Look too.
  - Page: Sheet lays the phone's page on a margin of blotter; Full is the
    phone as it is.
- **Wide screen** (`appearance.room`):
  - **Panes** is the desktop's window at a finger's size. The control is
    where the desktop has it, and always shown (no hover on touch).
  - **One at a time** is the phone's.
  - **Side by side** keeps the phone's bar across both panes; the control is
    with the page's.
  - **Two pages** is the split: the look is the active page's, as on the
    desktop. The notes' drawer over the page has no look of its own.
- **The sidebar's sun stays** at its foot: one press for Day or Night, where
  it always was.

## Built from the schema: a mark, not a list

Which settings appear is a mark on each setting in
`src/core/config/schema.ts`, beside `wide` and `platforms`:

```ts
interface Common {
  // …
  /** In the quick look (#49): one value for every page, or the notes' and the shelf's apart. */
  readonly quick?: 'window' | 'page';
}
```

- **`'window'`:** one value for every page. Only `appearance.scheme`.
- **`'page'`:** the notes' value under the setting's own key, and, from the
  same entry, the shelf's under `epub.<key>` in this device's file. Both use
  one label, one list of choices, and one rule that checks them. Marked
  `'page'`:
  - `appearance.face`;
  - `appearance.textSize`;
  - the new `appearance.leading`;
  - the new `page.width`;
  - `appearance.frame`.
- **The popover** lists what's marked, in the schema's order, where Settings
  offers it (`offeredOn`). A setting marked later shows there with nothing
  else to build.
- **The shelf's values** are what #40 Phase 1 adds ("the book's look
  settings"). The mark makes them, rather than five new entries that copy
  the notes'.
- **Two new settings**, each a step either side of the face's own tuning:
  - **Line spacing:** Tight, As set, Loose (× 0.9, 1, 1.12 of the face's
    leading).
  - **Page width:** Narrow, As set, Wide (× 0.84, 1, 1.18 of its measure).
  - Each face keeps its own leading and measure, so all eight still read
    alike.
- **The notes' Text size is the app's,** as today: it scales rows and titles
  too. The shelf's scales the EPUB's words alone.

The pages draw from a `SCHEMA` list holding the mark (`_src/look.js`); its
unmarked entries (Layout, Interface font, Density) never show.

## 1 · On the bar (chosen)

**Aa** is the page's last tool, after a hairline: A's band, B's slip, C's
running head, and the phone's bar, slip or rail. Its tooltip is "Look ⇧⌘L".
The popover hangs under it, a column.

- **For:**
  - It's where a writer looks for a page's tool, with a tooltip and a key, as
    every control has.
  - It's the smallest build: one command in `chrome/commands.ts` that every
    host already draws. The bar's folding (`fold.ts`) takes it like any tool.
- **Against:**
  - It adds an icon to bars that already fold when narrow.
  - The bars are quiet until the pointer is over the page.
  - It says which look it changes only once it's open.
  - It's the tallest popover, over the page's top right.

## 2 · In the colophon (recommended; not chosen)

The colophon already says what the machine knows about the page. Now it also
reads out the page's look at its right end: whose, then the face and size
(NOTES · NEWSREADER · 100%, or SHELF · LITERATA · 100%). The readout is the
control, a word button in the colophon's own voice. Its tooltip, above it, is
"Look ⇧⌘L". The popover rises from it as a strip twice the list's width: the
faces beside the other settings, over the page's foot rather than the middle
of the words. Narrower than the strip, it falls back to the column. Narrow,
the readout keeps NOTES and drops the face and size; it never goes. On the
phone, which has no colophon, the page gets a line at its foot for the
readout, a finger high.

- **For:**
  - It's always in sight, in every layout: the colophon is never quiet.
  - It answers "which am I changing?" before you open it. With two pages, it
    changes as you move between them.
  - It adds nothing to the bars, so nothing folds.
  - The strip leaves the words you're reading in sight as they change.
- **Against:**
  - A control in the machine's quiet line is less found than a bar's icon.
    The tooltip and View → Look… help.
  - The phone gains a line at the page's foot.
  - The strip is the widest popover (632px).

## 3 · On the page

A look belongs to the page that wears it, so its control is on the page.
**Aa** sits at the sheet's top outer corner, `--eien-space-3` in, inside its
margin. It's quiet until the pointer is on that page, and always shown on
touch. Two pages have two controls. Its tooltip, to its left, is "This page's
look ⇧⌘L".

- **Where it sits in the split's modes:**
  - Two sheets: left of a sheet's ×.
  - Facing pages: at each page's outer corner.
  - Companion: in a companion's head.
- **For:**
  - It's the plainest answer to which look: the one on this page.
  - It's the same in every layout and split mode, and the bars keep their
    tools.
  - It reaches the other page's look without moving into it.
- **Against:**
  - It puts a control on the paper, which so far holds only the words, the
    running head and a split's ×.
  - It's quiet until hover, so it's easy to miss.
  - On touch it covers a corner of the words.
  - Two controls side by side read as two of the same thing at first.

## Recommendation

**2 · In the colophon.** The owner's two asks are to keep it in reach always
and to show which look you're changing. Only 2 answers both without opening
anything: the readout is never quiet, never folds, and says NOTES or SHELF in
the same breath as the face and size. Its weakness is being found, which the
key, View → Look… and the phone's ⋯ cover. The strip keeps the words you're
reading in sight. If the owner would rather the control be an icon like every
other, 1 is the fallback: the same popover in a column, under the page's
last tool.

## Questions for you

- **SHELF or BOOKS in the head?** The EPUB's look says SHELF, after #40's
  section. In Eien a book is a writer's own manuscript, whose chapters are
  notes and wear the notes' look, so LOOK / BOOKS would read as theirs.
- **Day or Night in the popover and at the sidebar's foot,** both? The
  explorations keep the sun, a single press where it always was.

## Checks (interface-design)

- **Swap:** with a generic settings popover (sliders, a font dropdown,
  toggles) it would be someone else's app. Here are Settings' own wells, face
  cards and stepper, and the breadcrumb head. 2's readout is the colophon's
  voice, which only Eien has.
- **Squint:** blurred, the page stays the loudest thing. The popover is one
  raised step with the float shadow; the chosen values are ink in a hairline,
  and nothing is coloured. The page that sits back drops by one surface step,
  not a dim.
- **Signature:** the seal isn't used: the quick look isn't one of its five
  places. Eien's own marks carry it instead:
  - the breadcrumb head in the machine voice, its slash faded;
  - face cards set in each face;
  - the colophon's readout in mono capitals with a faded "·";
  - Two sheets' flat and lifted paper;
  - the band's tone for the page that sits back.
- **Tokens:** no new design token. Three local multipliers, `--look-scale`,
  `--look-lead` and `--look-width`, carry the settings' values to the page,
  as `--eien-text-scale` and `--eien-zoom` do. In the app they would be set
  by `ui/settings/look-properties.ts`.
