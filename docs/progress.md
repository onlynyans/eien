# Progress: stage 3, wave 2, and the foundations under it

Written 2026-10-21, at the end of the run in which the owner handed the rest
of the backlog to Claude to finish without review. For how Eien is built and
how to carry on, see [handbook.md](handbook.md).

## In short

- **All of stage 3 is built:** the page's tags and formatting bar (3D), the
  sidebar's + and Pinned, rename in place, Eien's own menu and the sync
  status (3E), your order with a lens over it, Arrange mode and the
  three-way tag filter (3F), and Settings over the window (3G). Wave 1 (the
  three layouts, themes, the app icon) was already in.
- **Two foundations came first:** long lists draw only the rows in sight,
  with speed budgets held in CI; and a test foundation (DOM unit tests,
  accessibility checks, resource budgets, CodeQL, Dependabot, a coverage
  floor).
- **Main was red on Windows** after the three layouts merged; that was a real
  bug (a Restore finishing in the wrong note on a slow disk), fixed.
- **Every change came with tests:** 1,661 unit tests (155 files), about 390
  end-to-end tests on macOS, Windows and Linux, 46 on the phone's page, axe
  over every layout by day and night, and eight speed budgets with 3,000
  notes.
- **The first release (#23) is prepared, not published:** see Release below.

## What was done, by pull request

| PR | What | Backlog |
|---|---|---|
| [#37](https://github.com/onlynyans/eien/pull/37) | Long lists draw only the rows in sight (from 200 notes), the keyboard reaching every row; speed budgets in CI; the long-task measure fixed (it read before Chromium reported) | #34 |
| [#38](https://github.com/onlynyans/eien/pull/38) | Windows: a Restore under way when another note opens finishes in its own file; the e2e harness kills a hung app's whole tree | – |
| [#39](https://github.com/onlynyans/eien/pull/39) | Test foundation: DOM unit tests (happy-dom), axe-core in CI, resource budgets (elements, heap, first list, bundle size), a coverage floor, `npm audit`, CodeQL, Dependabot | – |
| [#40](https://github.com/onlynyans/eien/pull/40) | Settings over the window: categories, This vault, the machine voice's face, row weights, the Themes tabs (Gallery and Custom), the Running head's strip ground | #18, #24, #25, #31 |
| [#41](https://github.com/onlynyans/eien/pull/41) | The page: tags in its head (slips on the phone), the formatting bar of Eien's icons | #13, #14 |
| [#42](https://github.com/onlynyans/eien/pull/42) | Rename in the row (F2, a double-click, the menu), Eien's own right-click menu, ⇧⌘P to pin | #29 |
| [#43](https://github.com/onlynyans/eien/pull/43) | The quiet + for folders and tags; tags made before notes carry them (`.eien/tags.json`); Pinned always in sight | #4, #7 |
| [#44](https://github.com/onlynyans/eien/pull/44) | The sync status at the sidebar's foot (Syncthing's `.stfolder`; another device's change told from the window's own) | #10 |
| [#45](https://github.com/onlynyans/eien/pull/45) | The lens: a sort and a three-way tag filter laid over every list as chips; the two-pane tree's lens | #12, #33 |
| [#46](https://github.com/onlynyans/eien/pull/46) | Folders and tags in your order: keys, menus and drag | #12 |
| [#47](https://github.com/onlynyans/eien/pull/47) | Main's accessibility and size checks pass again (where #39 met #40) | – |
| [#48](https://github.com/onlynyans/eien/pull/48) | The three-way filter from the sidebar's TAGS (⇧ wants, ⌥ keeps out) | #32 |
| [#49](https://github.com/onlynyans/eien/pull/49) | All Notes in your order; Arrange mode; the organizer's small files in their own module; a long list's redraw keeps the keyboard | #12, #35 |
| This PR | This summary, the handbook, the README, the specimen's As built section, the design tokens, the spec's duplicate Layouts section | – |

#42 to #49 and this one are stacked, each on the one before, so each
includes the ones below it until they merge; they're squash-merged in order
as their checks pass.

## How it was run

- Four sessions ran side by side at first (the Windows fix, the test
  foundation, 3D, 3G), each in its own worktree. The rest (3E, 3F, the fixes
  between) were built in the orchestrating session.
- Every PR has Auto-fix and squash auto-merge on, and merges only when all
  seven required checks pass.
- Locally, each change ran lint, types, its own tests and the specs it
  touched, the phone suite where the page changed, and the speed budgets
  where lists changed. The whole desktop suite ran before the last 3F PR.

## Decisions taken without the owner

The owner asked for the work to go on without review. These are the choices
made where the designs left room, to look over:

- **Where your order lives:** each folder's `.eien-folder.json` lists its
  folders, then its notes, and the vault's own `.eien-folder.json` holds the
  top folders. `order.md` had a separate `.eien/order.json` for top folders
  and tags; one rule for every folder is simpler. `.eien/order.json` holds
  only All Notes' order, and the tags' order goes in `.eien/tags.json` beside
  the tags made there.
- **All Notes in your order** shows notes not placed yet at the top, newest
  first, so a new note is never lost at the bottom. With nothing placed it
  looks as before.
- **Arrange mode** blocks only drags: ⌥↑ ⌥↓ and the menus still move rows, as
  they're on purpose, and the tree's folders move by keys and menus. The
  setting isn't offered on a phone, which never drags.
- **Rename:** a double-click renames a note's name, but not a folder's, since
  a click opens a folder and the next shuts it. On a phone Rename still goes
  to the page's title.
- **Renaming a tag that notes carry** isn't built. It would rewrite every
  note holding it, and the design left it open. A tag made with the + can be
  removed from its menu.
- **The TAGS filter:** ⇧ and a click wants a tag in the filter of the list
  showing, ⌥ keeps it out, and a plain click still chooses the tag.
- **The sync status** counts a change as another device's when this window
  didn't write that note in the last 5 seconds. It says so in pencil for 15
  minutes.
- **The key for pinning** is ⇧⌘P (Ctrl+Shift+P), free in every layout.
- **Settings' category labels** are in pencil, not faded: faded didn't reach
  4.5:1 on the desk.
- **The renderer's size budget** was measured again as features landed
  (+10%, the numbers beside it). The speed budgets were never raised.
- **Modules past 300 lines** were split (the sidebar's row keys, lens slot and
  long lists; the organizer's small files). `vault-view.ts`, which wires
  everything, is left at about 360.

## Tests made steady

The changes surfaced flaky end-to-end tests. Each was traced, not retried:
the long-task observer read before Chromium reported (#37); a rename test
raced the move's two steps; a hover sometimes didn't land (on main too, 1 in
5); the two-pane search typed before its field had moved; a test waited for
Pinned to appear, which it now always does; a Band choice was ambiguous
between Layout and the strip ground. Still flaky on CI's runners at times,
listed in the handbook: the Settings window's move and resize, naming a
seal on Linux, and the platform storage tests' 5 s limit on Windows.

## Release

#23, the first release, is ready to cut once the stack has merged and main
is green: `version` is `0.1.0` in `package.json`. To release:

```bash
git fetch origin && git tag v0.1.0 origin/main && git push origin v0.1.0
```

The Release workflow builds and tries the three installers and attaches them
to a **draft** release. Publishing it makes Eien public, so that last click is
the owner's. Signing isn't set up (see the handbook).

## What's left

- Publish the first release (#23), and if wanted, set up signing.
- #22, smaller downloads (left by the owner's choice).
- Renaming a tag across notes (needs a design), and dragging tags.
- Visual QA by eye of everything stage 3 built, across the three layouts and
  both phones. The tests check structure, keyboard, files, accessibility and
  speed, not taste.
- Smaller debt: `vault-view.ts` could lose its sidebar actions to a module;
  the design's `tokens.css` mirrors the app's by hand.
