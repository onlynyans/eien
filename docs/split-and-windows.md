# Plan: New Window and the split window

**Status: approved** (2026-10-23, by the owner), built phase by phase.

**As built** (each phase's pull request; where the build moved something
between phases, it says why):

| Phase | Pull request | Notes |
|---|---|---|
| 1. Many windows in the main process | [#62](https://github.com/onlynyans/eien/pull/62) | As planned. |
| 2. New Window | [#63](https://github.com/onlynyans/eien/pull/63) | As planned. |
| 3. One note, one document | [#64](https://github.com/onlynyans/eien/pull/64) | The open-notes registry and the organizer's sets moved to phase 4, where the pages that hold them are made. |
| 4. The page pane and the pages | [#65](https://github.com/onlynyans/eien/pull/65) | With `vault/open-notes.ts`; `vault-view.ts` from 405 lines to ~300 (note and row actions, the sidebar's actions, the list's lens are their own modules). |
| 5. The split, with Two sheets | [#66](https://github.com/onlynyans/eien/pull/66) | The setting and `chrome/splits.ts` came with phase 6: a setting with one choice isn't one. |
| 6. Facing pages | [#67](https://github.com/onlynyans/eien/pull/67) | The split setting, the spec per mode, each page's own host; all three marks as `appearance.facingMark`. |
| 7. Companion | [#68](https://github.com/onlynyans/eien/pull/68) | The divider moves each mode's *measure* (a share, a companion's width beside or height under). |
| 8. Tools that follow | [#69](https://github.com/onlynyans/eien/pull/69) | The Running head's tools stay in the running head, which spans the window; the colophon and formatting bar follow. |
| 9. The phone's other note | [#70](https://github.com/onlynyans/eien/pull/70) | Adds `--eien-radius-dot`. |

Lengths the arithmetic needs live once, in TypeScript beside it, not as CSS
tokens: `PAGE_MIN` (360, `shell/pane-state.ts`, already there for the panes)
and `COMPANION` (380 / 300 / 400, `shell/split-state.ts`).

**Goal:**
- **New Window:** several windows, each with its own vault, note, panes and
  split.
- **The split:** two notes side by side in one window, as a setting with four
  modes, the way the three layouts are a setting today:
  - **Two sheets** (3), with the revised divider: one hairline, as a pane's
    edge.
  - **Facing pages** (4), with its mark on the active page as a setting of
    its own: the ribbon, a dog-ear or an edge tab (all three kept, the
    owner's call).
  - **Companion** (5).
  - **Tools that follow** (6).

The designs are in [design/explorations](design/explorations/README.md):
[split.md](design/explorations/split.md),
[split-alt.md](design/explorations/split-alt.md), and the pages
`split-sheets.html`, `split-alt-facing.html`, `split-alt-companion.html`,
`split-alt-follow.html` and `split-window.html`. The build follows them
exactly. Where the app and a page differ, the page is the design and the
app's reasons go in its `.md`.

**How it was planned:** an engineering review of how layouts are built, and of
every module a second window or a second page touches, assessed as a whole
before any change. The upstream changes come first, in the order below, so
that no phase leans on a temporary fix.

## What stays as it is

The review found these clean, and the split is built in their image:

- **`src/ui/chrome/`.** Each command is defined once (`commands.ts`), hosts
  know nothing of what a command does (`host.ts`), each layout is data
  (`band.ts`, `slip.ts`, `runhead.ts`), and `layouts.test.ts` holds every
  command to exactly one host. Each split mode becomes one more spec of this
  kind, not a branch in the code.
- **`NoteSession`** (`src/ui/notes/note-session.ts`): a note's save rules,
  writes checked against the file's version. It stays the one save path per
  note.
- **The rest:** `oneAtATime`, the drawer's turn counters, `onDiskChanges`,
  `ownWrites`; the setting on `<html>` (`look.ts`), where `data-split` will
  join `data-layout`; and the page's container query (`page.css`).

## What a split and a second window break

These are the single-page and single-window assumptions. Each is fixed once,
in the phase that needs it:

1. **The main process answers one window.** `ipc.ts` registers each channel
   globally, per window: a second window throws "second handler", and closing
   either removes it for both. This blocks New Window.
2. **A watcher per opened vault** (`open-vault.ts`). Two windows on one vault
   would watch it twice, and recover each other's temp files as strays. This
   is a safety issue, not a cost.
3. **One note, one editor.** `NoteEditor` holds the document and its history
   together (`editor.ts`). CodeMirror can't share one `EditorState` between
   two views.
4. **One listener each** in `WordCount` (`onWrote`, `onCounted` replace each
   other), and today's tally read once and written back
   (`counters.ts`). Two windows, or one note shown twice, would count twice
   or lose words.
5. **`PageView` does three jobs** (`page/page.ts`, 330 lines): the sheet, the
   colophon, and the layout's slots with the Versions panel.
6. **One open note:**
   - `OpenNote`, `pageParts`, `chrome-wiring.ts`;
   - the organizer's `session()`, `closed()` and `freeze`;
   - `follow.ts`;
   - the drawer's `openNote(): string | null`.
7. **Files over the ~300-line rule** that this work would grow:
   `vault-view.ts` (396), `editor.ts` (399), `page.ts` (330). Each is split
   before it's touched, not after.

## Decisions taken in this plan

Change any of these before the phase that builds it:

- **Keys:**
  - **⌘D** opens the note beside itself, and while split, closes the other
    side. It's free in the menu and in the editor. ⌥⌘\\ is CodeMirror's
    Indent Selection, and ⇧⌘D is Compare.
  - **⌘3** goes to the page; pressed in a page, it goes to the other one.
  - **⌘W** becomes Eien's own Close command on every system: while split it
    closes the active side, otherwise it closes the window. Today it's the
    Mac's role only, and Windows and Linux have none.
  - **⇧⌘N** is New Window; it's free.
- **Settings:** the split's mode is a device setting beside the layout
  (`appearance.split`: sheets, facing, companion, follow; Two sheets by
  default), and Facing pages' mark is another (`appearance.facingMark`:
  ribbon, dogear, tab; the ribbon by default). The divider's place is remembered on this device. Which notes are
  split isn't remembered across a restart, just as no open note is today.
- **One note, one document:**
  - In one window, one note shown twice is one document: one history, one
    save, one count.
  - In two windows, it's two sessions, kept apart by the file's version. With
    no edits on the other side the note reloads; if both sides edited, the
    later write goes to a sibling copy, so no words are lost.
  - This goes in spec §3.
- **A new window** opens on the vault and note of the window it was asked
  from. The device's `vault` key stays "the last one chosen". Restoring every
  window at launch is later work, not in this plan.
- **The phone** has no split and no New Window. It gets the back bar's ⇄,
  "the other note", as `split-window.html` shows.

## Phases

Each phase is one pull request, with its tests and docs, merged before the
next starts. Phases 1–4 are the upstream work: a writer sees nothing new
until New Window (2) and the split (5), and the existing suites are the
safety net throughout.

### 1. Many windows in the main process

- **What:**
  - An IPC router: each channel is registered once, at start. Each call finds
    its own window's sessions by sender (`Map<webContents.id, WindowSessions>`)
    and throws for an unknown sender. A window's `closed` event drops its
    entry, never the handler.
  - A vault registry (`vaults.ts`): one `OpenVault` per real path, with one
    index and one watcher, shared by count and sent to each window showing
    it. Strays are recovered when the first window opens the vault, never
    again while another window writes. The registry remembers which window
    wrote each path for `OWN_ECHO_MS`, so another window on this device
    doesn't mistake that write for a sync.
  - A settings broadcast: after a change, every window reloads its settings
    and zoom. Use the focused window where the first one is used today
    (`device-settings.ts`, `main.ts`).
  - Today's tally read and written on each write, and heard across windows
    (`storage` events).
- **Tests:**
  - Unit: the router refuses an unknown sender, and gives each window its own
    sessions.
  - Unit: the registry, over memory storage, shares by count and recovers
    strays once.
  - Architecture: no `ipcMain.handle` outside `ipc.ts`.
  - DOM unit: two counters on one storage add their words together. This
    fails today.
  - End to end: a second window loads. This throws today.
- **Docs:** handbook (the main process), CLAUDE.md's layout table.

### 2. New Window

- **What:**
  - File → New Window (⇧⌘N), and Open in New Window in a note's menu.
  - Close (⌘W) on every system.
  - The window's title is its note's name, so macOS's Window menu lists it.
  - Bridge and preload gain `window.open(note?)`, `window.close()`,
    `window.start()` (returns `{note}`), `onSettingsChanged`, and a "written
    on this device" flag on `onChange`.
- **Tests:** end to end, `window.spec.ts`:
  - ⇧⌘N opens a window on the same vault and note.
  - A save in window A reloads the note in window B.
  - The sync status stays quiet. This fails without the write tagging.
  - Open Vault in B leaves A alone.
  - Day or night set in A reaches B.
  - ⌘W closes a window.
  - **Waiting:** every cross-window test waits on the write itself (the
    file's contents or version, through `launch.ts`'s safe-read poll), never
    on a time. Windows' end-to-end runs are already flaky on tests that wait
    for writes (`arrange.spec.ts:60`, Versions, the image exports), and this
    phase touches the same paths.
  - Resources: the main process holds one index for two windows on one vault.
  - Accessibility: the new menu items and the row menu's new item.
- **Docs:** spec §3 (two windows, one note) and §4; README; the identity
  test, unchanged.

### 3. One note, one document

- **What:**
  - **`editor/note-doc.ts`:** one headless `EditorState` with the text and the
    history.
  - **Views:** each is built with `dispatchTransactions`. A view's change
    goes to the doc, which sends it to the other views as
    `Transaction.remote`, with history off. ⌘Z and ⇧⌘Z run the doc's undo,
    and so does the Edit menu's undo, through the views' `beforeinput`
    `historyUndo` handler, as `history()` does today.
  - **`NoteEditor` becomes a view only:** reload, seal, restore and lock move
    to the doc.
  - **`WordCount`:** sets of listeners, counting once per note.
  - **`OpenNotes`:** one entry per path, counted by the views showing it.
  - **The organizer and `follow`** take a set of open notes.
  - **The split files:** `editor.ts` splits into the doc, the view, and the
    keys and extensions. Each file stays under ~300 lines.
- **Tests:**
  - DOM unit, `note-doc.test.ts`:
    - typing in view A shows in view B;
    - ⌘Z in B undoes A's typing;
    - a `historyUndo` `beforeinput` reaches the doc;
    - a reload resets the history;
    - a seal can't be undone;
    - the tally adds n words, not 2n.
  - Property: random edits from two views leave both views and the session
    holding the same text.
  - The existing editor, Live, table and typing suites, unchanged.
  - The budgets for typing and drawing, unchanged.

### 4. The page pane and the pages controller

- **What:**
  - **`page/page-pane.ts`:** the pane's slots, colophon, Versions panel and
    divider.
  - **`PageView`:** keeps the sheet and its own status.
  - **`pageParts`** splits into per-side parts (Versions, Compare) and
    window-wide parts (counters, Copy as HTML, exports, outline cards).
  - **`vault/pages.ts`:** `sides`, `active`, `open(path, 'active' | 'beside')`,
    `close`, `swap`, `toggle`, `other`, `shown(): {active, other}`.
  - **Through the controller:** `vault-view.ts` hands its page side to it and
    drops under 300 lines. `runCommand`, `chrome-wiring`, the drawer and the
    organizer read the active page and `{active, other}`.
  - **No visible change:** one page, through the new model.
- **Tests:**
  - DOM unit: `pages` with one side; the drawer's `{active, other}`.
  - Every layout, accessibility and budget suite stays green; that's the test
    that nothing moved.

### 5. The split, with Two sheets

- **What:**
  - **The setting and the mode framework:**
    - `appearance.split`, set as `data-split` in `look.ts`.
    - `chrome/splits.ts` lists the modes, as `layouts.ts` does.
    - A `SplitSpec` holds what the pane's tools act on, where each note's
      words and seal go, the per-page hosts, the narrow rule, and whether the
      list steps aside.
    - A pure `fit(spec, width)` decides fold, close, under or refuse.
  - **Two sheets:**
    - `chrome/split-sheets.ts` and `.css`;
    - the divider: one hairline column, an 8px handle, and the swap on hover;
    - the sheet's shadow on the active sheet;
    - the fold below 720px of page, with its pager.
  - **Opening and closing:**
    - ⌘-click and ⌘Enter on a row;
    - Open to the Side in the row's menu;
    - a page drop target in `list/drag.ts`, with the pane drawing the preview;
    - ⌘D, ⌘3 and ⌘W, and the list's fainter rule for the other note.
  - **Remembered:** the divider's place, in a pure `split-state.ts` modelled
    on `pane-state.ts`.
- **Tests:**
  - Unit and property: `split-state` (each side at least 360px; evened on
    double-click) and `fit`.
  - DOM unit: the row's ⌘-click and ⌘Enter, the drag's page target, the keys,
    and swap.
  - Architecture: `layouts.test.ts` across layout × mode, every command in
    exactly one host.
  - End to end, `split.spec.ts`:
    - open each way;
    - the same note on both sides is saved once, with no conflict copy;
    - fold below 720px;
    - the list's two rules;
    - close, then swap.
  - Accessibility: the divider as a separator; each layout by day and night,
    split; the pointer over the divider.
  - Budgets (`ALONE`): switching notes while split, and dragging the divider;
    no long task over 200 ms.
  - Resources: a closed side leaves no view or listener behind.

### 6. Facing pages

- **The mark** is a setting, all three kept: the ribbon, a dog-ear, an edge
  tab (`appearance.facingMark`), as `split-alt-facing.html` draws them.
- **What:**
  - `chrome/split-facing.ts` and `.css`: the book's tools, each note's folio,
    the gutter as the divider, the three marks and their motion (none with
    reduced motion), the mark chosen by `data-facing-mark` on `<html>`.
  - Closed to one page when narrow, with the facing page's edge.
- **Tests:**
  - The layout × mode test.
  - Unit: the setting's three values; DOM unit: each mark drawn for its value,
    and only on the active page.
  - DOM unit: the folio's tools act on their own note.
  - End to end: the book closes and turns.
  - Accessibility, by day and night.

### 7. Companion

- **What:** `chrome/split-companion.ts` and `.css`: the companion at the right
  edge, its head and foot, and its resting tone; under the page when narrow.
- **Tests:**
  - The layout × mode test.
  - End to end: the companion docks under the page, and ⇄ makes it the page.
  - Accessibility; the budget for resizing it.

### 8. Tools that follow

- **What:** `chrome/split-follow.ts` and `.css`.
  - The list steps aside without saving that to the panes' state.
  - The band, the formatting bar and the colophon go to the active column by
    CSS grid (`[data-active]`), never moved in the DOM, so focus is kept.
  - The split is refused below the width, and Eien says why.
- **Tests:**
  - End to end: the list comes back; the split is refused when too narrow,
    and says why.
  - Focus stays put as the tools move.
  - Accessibility.

### 9. The phone's other note

- **What:** the back bar's ⇄: the note you came from, a tap away, with its
  place kept. The split's commands aren't in the phone's menus.
- **Tests:** `tests/mobile`: A, then B, then ⇄ returns to A where you left it;
  ⋯ has no split commands.

## How each phase is built and checked

- Each phase is its own branch from `main`, its own pull request, merged
  before the next starts.
- **Locally:** `npm run typecheck`, `npm run lint`, and Vitest on the changed
  areas (`npx vitest run <paths>`).
- **On CI:** the end-to-end, phone, Android and iOS suites run there, so no
  windows open on the owner's laptop.
- **Merging:** a phase merges when its checks pass. A check that also fails
  on `main` for a known, unrelated reason doesn't hold a phase back. It's
  named in the pull request, and its owner is told.
- **Weight:** every phase is checked against the resource budgets (elements,
  heap after a long session, the renderer's size). New views and listeners
  are made when a side opens and dropped when it closes, never kept for a
  side that isn't shown.
- **Tokens:** every colour, length and duration comes from a token in
  `src/ui/theme/tokens.css`, as `.interface-design/system.md` lists them. The
  new ones (below) are added there once and documented in
  `docs/design/README.md`.

## Known limits, not temporary fixes

- **Today's tally:** two windows writing within the same few milliseconds can
  lose one increment. Reading it fresh on each write, and hearing `storage`
  events, makes that rare; closing the gap fully would need the main process
  to keep the tally.
- **One note in two windows:** typing in both within about a second can still
  make a sibling copy. No words are lost. That's the cost of two sessions,
  and it's rarer than in today's two-device case.

## Not doing

- Moving hosts in the DOM for Tools that follow: that loses focus. Grid
  placement is used instead.
- A second `showVault` for the split: that would duplicate the sidebar and
  the list.
- Two `NoteSession`s for one path in one window: the window would make
  conflict copies of its own writes.
