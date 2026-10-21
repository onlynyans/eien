# Settings: over the window (chosen)

[settings.html](settings.html). You chose C, "over the window", on
2026-10-21. This page is now that one placement, with your changes.

## What it is

- **A sheet over the dimmed window.** It's raised paper with the largest
  corner, `--eien-radius-l`, and the float shadow.
- **Its inset is larger:** `--settings-inset` went from 48px 72px to 64px
  112px, so more of the window shows round it.
- **It moves and resizes:**
  - Drag the head to move it, and an edge or the corner to resize it.
  - It stays inside the window, and never gets smaller than 560 × 380.
  - It keeps its place per device (as a window would); double-click the head
    to put it back.
  - In the app it would remember its box in this device's settings.
- **The head is a breadcrumb in the machine voice**, like a note's:
  `SETTINGS / LOOK / TYPE`. The last part is in ink-soft, the slashes in
  faded.
- **NEW: category labels.** The contents column holds categories, each a
  label in the machine voice (mono capitals, tracked, faded) with a small
  icon. Under each are its tabs, in the text face; the chosen tab gets the
  seal's rule and the selected fill, as a row does.
  - It's the same structure as a book's contents page: part titles, then
    chapters.
- **The categories:**

  | Category | Tabs |
  |---|---|
  | Look | Appearance, Type, Page |
  | Themes | Gallery, Mix your own, From a file |
  | Writing | Lists, Editor |

- **The voice:**
  - A setting's name is in the text face, with its description in pencil.
  - Choices sit in a segmented well.
  - Faces are cards set in each face.
  - The Type tab opens with a line of running text, so a face, size or
    weight change shows in prose as well as in the window behind.
- **New settings here:**
  - **Running head** (Look / Appearance): C's strip ground, as swatches of
    the theme's own surfaces.
  - **Machine voice** and **Weight of names** (Look / Type).
  - **Arranging** (Writing / Lists): Drag anytime, or In Arrange mode (see
    [order.md](order.md)).
  - **Focus mode** (Writing / Editor).
- **Themes** are three tabs, and choosing a theme paints the whole window
  behind, live:
  - **Gallery:** Eien's own themes, side by side.
  - **Mix your own:** the four-knob maker, renamed, with a line that says
    whether the mix keeps Eien's contrast.
  - **From a file:** the JSON, checked as it's typed. A contrast shortfall
    is named here too.
- **Underneath, it's data:** categories, tabs and settings in one list, each
  setting drawn by its kind (choice, swatches, faces, stepper, weights). It's
  the same shape as `core/config/schema.ts` plus a `category` and `tab` per
  setting.

## Open

- **"Mix your own"** is the name for the maker. Others that fit Eien's
  world: "Grind your own" (as ink is ground on the inkstone), or "Your own
  colours". It's your call.
- **Whether the vault's own settings** (chapter numbers, AO3 scene breaks)
  get their own category, "This vault". The spec keeps them apart from this
  device's settings, and the category label is where that could show.
