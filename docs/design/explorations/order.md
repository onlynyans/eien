# Your order, and what's laid over it

[order.html](order.html). Decided on 2026-10-21: A (lens chips) by default,
with C's Arrange mode as a setting, and a three-way tag filter on the list.

Try:

- dragging a folder onto another (it goes inside);
- dragging a folder to the left of its own row (it comes out of its folder);
- dragging tags, and notes in the list;
- with a row focused, ⌥↑ ⌥↓ to move, ⌥← out of its folder, ⌥→ into the
  folder above;
- a sort, the tag filter, and the Arranging switch in the bar.

## One model

- **Every list has your order:** the top folders, each folder's subfolders
  and notes, the tags, All Notes.
- **Your order is written to the vault, so it syncs:**
  - Within a folder it's in the folder's `.eien-folder.json`, as now.
  - The top folders, the tags (with tags that have no notes yet) and All
    Notes go in one `.eien/order.json`.
- **A lens is laid over your order:** a sort, or the tag filter.
  - It belongs to this device, per list, as sorts do now, and never changes
    your order.
  - Each part of a lens is a chip in the pane's head, with its ×.

## Arranging: one setting, two ways

Settings / Writing / Lists, **Arranging**:

- **Drag anytime** (the default): rows drag whenever your order is showing.
  While a lens is on they don't, and a line under the head says so.
- **In Arrange mode:** order changes only on purpose.
  - The grip icon in a pane's head (Arrange) starts it. Grips show on every
    row, and any sort or filter is set aside, so your order shows.
  - Done brings them back, as they were.
  - Outside it, nothing drags out of place.

In code it's one rule, the same for the tree and the list:

```js
const how = (pane) => (arranging[pane] ? 'yours' : lens[pane]);  // what order shows
const canDrag = (pane) => !lensOn(pane) && (setting === 'drag' || arranging[pane]);
```

## The tag filter: wanted, kept out, or left alone

- **What:** the filter icon in the list's head opens the vault's tags, each
  in one of three states:
  - **left alone:** an empty box;
  - **wanted:** a filled box with a tick;
  - **kept out:** a carmine box with a dash, the name struck through.
- **How:**
  - One press moves a tag on to the next state; ⌥ and a press keeps it out
    at once.
  - With two or more wanted, **All of** (the default) or **Any of** decides.
  - A note shows if it has the wanted tags and none of the kept-out ones.
- **Shown in the head:** each state is a chip, `#draft ×`, with a kept-out
  one struck through in carmine. "Every note" clears them all.
- **Why three states:** "everything posted, but not the drafts" is one look,
  not two. Carmine and a strike for "kept out" are the same marks Compare
  uses for removed words, so they read at once.

## Third pass

- **The grip** sits at a row's own left edge, so it never covers the guide
  line of a nested branch.
- **The list has a drop line too:** a 2px line in ink-soft (`--eien-mark-w`,
  `--eien-ink-soft`), the list's full width, above or below the row you're
  over, as the tree's marker is.

## Open

- **The two-pane tree** lists notes too. A lens there would act as it does
  in the list. Not shown here.
- **Whether the tag filter belongs on the tree's TAGS as well,** where a
  tag row could be wanted or kept out with a modifier click.
