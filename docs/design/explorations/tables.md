# Tables in Live: three explorations

**Chosen on 2026-10-22: 3 · Menus with 1's + on the desktop, 2's bar on the
phone**, and the Table button in the formatting bar. Not built yet: the table
editor comes after the Live-mode table fixes and the formatting bar's Table
button (another session's work, in `src/ui/editor/live-preview.ts`).
[table-menus.html](table-menus.html) shows the choice whole.

In Live mode a GFM table is edited in place, as a word processor's table is,
and the file stays a plain Markdown table. Each page shows one direction,
working:

- [table-handles.html](table-handles.html): 1 · Handles on the edges
- [table-toolbar.html](table-toolbar.html): 2 · A toolbar with the caret
- [table-menus.html](table-menus.html): 3 · A menu and a grip per row and
  column, now with 1's + and 2's phone bar (the choice)

Beside each table is the file as it would be saved, redrawn as you type; the
lines that change flash moss. The bar at the top switches Day and Night, each
layout's corners, a phone's width (with no hover), and Tidy pipes (each column
padded to its widest cell) or Compact (`| a | b |`).

## What all three share

- **The table at rest is a book's table:** rules across, none down; the head
  row in weight 500; a right-aligned column in tabular figures. The rules
  down show only while the caret is in the table, to show where one cell ends.
- **A cell is typed in like the page**, the caret in the seal's colour. The
  cell under the caret has a hairline in `--eien-rule-strong`.
- **The same keys in all three:**
  - Tab and Shift-Tab move to the next and previous cell; Tab in the last
    cell adds a row.
  - Arrows cross into the next cell at a cell's edge; ↑ and ↓ always do.
  - Enter adds a row under this one; Esc leaves the table.
  - ⌥⌘↑ ↓ ← → add a row or column on that side.
  - ⌥⌘⌫ removes the row, ⌥⇧⌘⌫ the column.
- **Words are never lost.** Removing a row or column that held words says so
  in the colophon ("Row 3 removed · ⌘Z puts it back"), and ⌘Z puts it back.
  In the app that's the editor's own undo, as each change is one transaction.
- **What a Markdown table can't do, it says:**
  - The head row can't be removed (GFM always has one), nor the last column.
  - A cell is one line: pasted lines join with spaces, Shift-Enter says so.
  - A `|` typed in a cell is saved as `\|`.
- **Alignment is per column:** left (written `---`), centre (`:-:`) or right
  (`--:`).
- **Every control has a name** for a screen reader, a tooltip with its key,
  and a way from the keyboard (below, per direction).

## 1 · Handles on the edges

- **What:** pointing at the table, or putting the caret in it, wakes its
  edges.
  - A tab over each column holds its alignment and its ×; a tab beside each
    row holds its ×.
  - A faint dot sits on every line between rows and between columns, and
    turns to + under the pointer, with a 2px line across the table showing
    where the new row or column goes (your order's drop line).
  - The row or column a × would take lights up before it goes.
  - ⌥F10 from a cell reaches its column's tab.
- **For:**
  - One click, at the place you mean: the owner's "add and remove rows and
    columns with a click", literally.
  - Nothing to learn and nothing floating over the words.
  - Quiet at rest: only faded dots until you point.
- **Against:**
  - The handles live in the sheet's margins, which a narrow pane or a phone
    doesn't have; on a phone the table steps in from the margin while it's
    edited.
  - The most hit targets to aim at, small ones, close together on a narrow
    column.
  - No reordering (3's grip could be the row's tab).
- **On a phone:** the caret's row and column keep their tabs, finger-sized,
  with a + on each side.

## 2 · A toolbar with the caret

- **What:** nothing on the table at rest or on hover. When the caret goes
  into a cell, one bar of icons comes, and goes when the caret leaves:
  - rows (above, below, remove);
  - columns (left, right, remove);
  - the column's alignment;
  - where the caret is.

  It floats over the table's top left, in a gap kept for it, or, by the
  page's Bar switch, joins the formatting bar's row, where the Table button
  is. ⌥F10 moves to it and the arrows along it, as rich editors do.
- **For:**
  - The quietest table and the most familiar control: every tool in one
    place, always in the same order.
  - Joined to the formatting bar, it's the formatting bar growing a table
    section, one idea instead of two.
  - The best on a phone.
- **Against:**
  - Two steps for each change: put the caret in the row or column, then
    press.
  - A floating bar covers whatever's above the table unless the table keeps
    a gap for it.
  - In the formatting bar it's only there if that bar is on (a setting).
- **On a phone:** the bar docks at the foot, above the keyboard, as the
  phone's formatting row: one row of 44px targets that scrolls sideways.

## 3 · A menu and a grip per row and column

- **What:** a grip at each row's left and over each column, as a list's rows
  have, showing for the row and column under the pointer or the caret.
  - Press a grip for that row's or column's menu, in the right-click menu's
    style: its name at the head; an icon, a word and a key per choice; remove
    last, in carmine. A column's menu has its alignment, with a dot by the
    one it has now.
  - Drag a grip to move the row or column, with the drop line.
  - Right-click a cell, or Shift-F10, for both menus at once.
  - ⌥↑ ↓ move the caret's row, as they move a line elsewhere in the editor.
- **For:**
  - The only one that reorders, and the most complete: every action named,
    with its key, in Eien's own menu.
  - Few things on screen: one grip each.
- **Against:**
  - Every change is two steps (grip, then choice), and adding a row isn't
    one click.
  - A grip says "drag me" more than "I have a menu".
  - Long menus for a cell.
- **On a phone:** the caret's row and column keep their grips; a tap on a
  grip, or a long press on a cell, opens the menu as the phone's bottom
  sheet; a long press on a grip and a drag moves the row.

## The choice: 3, with 1's +, and 2 on a phone

- **Desktop:** 3's grips and menus, and drag to move rows and columns.
  1's +, lighter: no dots and nothing at rest. Point at a line between two
  columns or rows, or at the table's outer edges, and a + comes at the line's
  end, with the line showing where the new one goes.
- **The formatting bar's Table button:** with the caret in a table it's
  pressed, and opens the caret's menus; elsewhere it makes a table.
- **Phone:** 2's bar above the keyboard, with no grips or + to aim at. A long
  press on a cell still opens its menus, as the phone's bottom sheet, for
  moving and aligning.
- **Dragging** listens on the whole document and ends however the press
  ends: released, the pointer's capture lost, or the browser taking the press
  for its own drag. Only Esc puts the row or column back. The first version
  could miss the release, which left the column lifted and the drop undone.

## Recommendation (before the choice)

**1 · Handles on the desktop, with 2's docked bar on the phone.** It is what
was asked for, a click at the place you mean, and quiet until you point.
Everything else is a key away for the keyboard. Its weak spot is the phone,
with no hover and no margins, which is exactly where 2's bar above the
keyboard is best.

If reordering matters, let the row's tab double as 3's grip (drag it, or
press it for 3's menu) rather than adding a third kind of control. If you'd
rather have one control everywhere, 2 joined to the formatting bar is the
simplest to build and explain.

## Open

- Pasting several lines into a cell could fill the cells under it, as
  spreadsheets do. Here they join into one line.
- Tidy pipes rewrite every line of a table when a column widens: the file
  reads well in Source, but a git diff, and maybe a seal's comparison (to
  check against `core/versions`' word diff), shows the whole table changed.
  Compact touches only the line you edit.
- Inline formatting in a cell (bold, a link) renders as Live does elsewhere;
  not shown here.
