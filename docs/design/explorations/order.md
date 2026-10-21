# Your order, and what's laid over it

[order.html](order.html). Order and filter as one system across both panes,
which is what you asked for in backlog #12. Try:

- dragging a folder onto another (it goes inside);
- dragging a folder to the left of its own row (it comes out of its folder);
- dragging a tag;
- dragging notes in the list;
- with a row focused: ⌥↑ ⌥↓ to move, ⌥← out of its folder, ⌥→ into the
  folder above;
- a sort or filter, then dragging again.

## One model

- **Every list has your order:** the top folders, each folder's subfolders
  and notes, the tags, All Notes.
- **Your order is written to the vault, so it syncs:**
  - Within a folder it's in the folder's `.eien-folder.json`, as now.
  - The top folders, the tags (with tags that have no notes yet) and All
    Notes go in one `.eien/order.json`.
- **A lens is laid over it:** a sort (newest, oldest, title A–Z, Z–A) or a
  filter (only #draft).
  - The lens belongs to this device, as sorts do now, and never changes your
    order.
  - Taking it off gives your order back, exactly.
- **While a lens is on, dragging can't reorder**, since there's no "between"
  in a sorted list. A line under the head says so. Dragging into a folder
  still works.
- **Moving a folder out of its parent** is a drag to the left past its own
  indent: the marker steps out a level and says "Out of its folder".
- **All of it is undoable,** like every move now.

## A · Lens chips

- **What:** each pane head has a sort icon (and a filter icon in the list).
  An active lens shows as a chip in the head, NEWEST ×, and the icon gets a
  small dot.
- **For:** you always see that a lens is on and how to take it off, and it
  costs nothing when it's off.
- **Against:** two icons in the list's head, though both hide until hover
  like every control.

## B · Filter strip

- **What:** the spreadsheet's way. One filter icon opens a strip under the
  list's head with every sort and filter in sight at once.
- **For:** it's discoverable, nothing hides in menus, and it suits combining
  a sort and a filter.
- **Against:** the strip is wide; at 360px the sorts already wrap. It takes
  room from the notes while open.

## C · Arrange mode

- **What:** order is set on purpose. A grip icon in a head starts arranging
  that pane: grips show on every row and the sort is set aside. Done returns
  to the sort you had. Outside arrange mode, a drag only ever moves something
  into a folder.
- **For:** no accidental reorders, and the sort can stay on all the time.
- **Against:** it's one more step, and order is something writers change all
  the time in a book.

## Recommendation

**A.** Your order is the default and dragging works whenever no lens is on,
which is most of the time. The chip makes a lens impossible to forget. Take
B's strip only if filters grow past a couple of tags (by status, by date).
C fits people who sort constantly, and that isn't the writer in `system.md`.

## Open

- The two-pane tree lists notes too. A lens on a folder there would act as
  it does in the list. Not shown here.
- Whether a lens is per list (this folder newest, that one yours) or one for
  every list. Per list matches today's sorts.
