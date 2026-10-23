# The window's corner, in Band and Slip: three explorations

**Chosen on 2026-10-22: offer both 2 and 3, as a setting.** Not built yet.
In Look → Appearance, "Shut sidebar": **The seal alone** (2) or **A strip
of desk** (3), the strip as wide as the bands are tall. 1 stays here for
reference.

In A · Band and B · Slip, shutting the sidebar leaves a 48px strip of desk
(`STRIP` in `src/ui/shell/pane-state.ts`) with the seal, which opens it again.
Two things are awkward:

- **The lights cross the strip's edge.** macOS's lights stand 20 to 72px
  from the window's edge, wider than the strip, so they hang half over the
  desk and half over the list's band, and the seal waits a band lower.
- **Full screen leaves an empty corner.** There are no lights, but the seal
  still waits a band down (`[data-platform="darwin"] .sidebar__strip` in
  `sidebar.css` doesn't know about full screen), alone under nothing.

Windows and Linux have their controls at the right, so their left corner is
the seal's alone. C · Running head isn't affected: its strip across the
window holds the lights.

Each page shows one direction, and **Show → As built now** shows what it
replaces. The bar switches the layout, the system, a window or full screen,
and the sidebar open or shut; **View → All states** shows all six states side
by side. The seal opens and shuts the sidebar, as in the app.

- [corner-title.html](corner-title.html): 1 · A title line
- [corner-stay.html](corner-stay.html): 2 · The seal stays
- [corner-shoulder.html](corner-shoulder.html): 3 · The desk's shoulder

## 1 · A title line

- **What:**
  - A 32px line of desk across the window's top holds the system's controls:
    macOS's lights at its left, Windows' and Linux's at its right. The
    note's name sits in its middle.
  - The panes start under it.
  - Full screen, with no controls to hold, it goes.
  - The seal keeps the sidebar's gutter, open or shut, at the head's height.
- **For:**
  - One home for the controls on every system, so the panes stop keeping
    clear of them: the `--controls-left` and `--controls-right` sums go.
  - It closes 3A's known gap too: Windows' controls no longer sit over
    Band's hidden strip or Slip's blotter.
  - Nothing moves sideways.
- **Against:**
  - 32px of height on every window, on every system: the title bar #1 took
    away comes back as a second band.
  - The lights no longer line up with the panes' heads.
- **In the app:** Band and Slip would fill the `top` slot that Running
  head's strip already uses (`.window-head`).

## 2 · The seal stays

- **What:**
  - Shut, the sidebar goes entirely (no strip), and the seal stays exactly
    where it was in the top row: beside the lights on macOS, at the window's
    left edge in full screen and on Windows and Linux.
  - The list's band starts after it.
- **For:**
  - Nothing jumps: the seal is where your eye left it, in every state, and
    in full screen it is the corner.
  - 48px more for the list and the page.
  - The lights sit on one surface.
  - The least code: `STRIP` becomes 0, and the list's keep-clear sum takes
    the seal's width.
- **Against:**
  - It undoes the decided "strip of desk" (system.md, Shut panes): with no
    desk at the left, only the seal says a sidebar is there.
  - On macOS the list's band gives its first 135px to the lights and the
    seal, so the search field narrows while the sidebar's shut.

## 3 · The desk's shoulder

- **What:**
  - The strip is as wide as the bands are tall (56px, `--band`; the owner's
    change), so its top is a square of desk beside the bands, the seal in its
    middle as in a band.
  - On macOS, at its top it widens into a shoulder of desk just wide enough
    for the lights: 88px, one band tall, its outer corner the layout's large
    radius.
  - The seal tucks under the lights, in the strip.
  - With no lights (full screen, Windows, Linux) there's no shoulder, and
    the seal rises to the strip's top.
- **For:**
  - It keeps the decided strip and mends only what's awkward.
  - The fewest changes.
- **Against:**
  - A new shape, an L of desk, the only one in the window.
  - The strip is 8px wider than today's 48px.
  - On macOS the seal still sits a band below the lights, and moves up and
    down between a window and full screen.

## All three

- **Full screen** needs Eien to know it's full screen. The window doesn't
  follow it today. 3 may get it free, if `env(titlebar-area-x)` reads 0 there
  (to be checked in Electron). Otherwise the main process tells the window on
  `enter-full-screen` and `leave-full-screen`.
- **The seal keeps its role** in all three: it shows and hides the sidebar,
  named "Hide the sidebar" or "Show the sidebar", with `aria-expanded`.

## Building both

- A setting in `src/core/config/schema.ts`, beside the layout: "Shut
  sidebar", The seal alone or A strip of desk, for A · Band and B · Slip (C's
  strip holds the lights already).
- The seal alone: `STRIP` is 0 and the seal stays in the top row (2's "In the
  app").
- A strip of desk: `STRIP` is the band's height, 56px, with the shoulder on
  macOS (3's "In the app").
- Both need the window to know it's full screen (above).

## Recommendation (before the choice)

**2 · The seal stays.** It is the simplest answer to both problems at once:
the corner is always the lights and the seal, in one row, in every state and
on every system, and nothing appears, moves or changes shape. It also gives
the list 48px back.

It does undo the decided strip. If the strip of desk matters to you as the
sign that a sidebar is there, take **3 · The desk's shoulder**, which keeps
it and mends the corner. 1 costs height on every window for a problem that
only shows with the sidebar shut.
