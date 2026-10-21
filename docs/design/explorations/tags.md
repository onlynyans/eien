# Tags on the page: three approaches

[tags.html](tags.html). Try:

- the + beside the note's tags, or the # key while the page has focus;
- type to filter, then ↓ ↑ and Enter;
- ⌫ in an empty field takes the last tag off;
- × on a tag removes it;
- the sidebar's + beside TAGS.

## What all three share

- **Two kinds of tag:**
  - Tags in the note's front matter (`tags:`) are the ones added and removed
    here.
  - A tag typed in the text (`#draft` mid-sentence) shows with a small dot,
    since it lives in the words. It has no ×; choosing it scrolls to where it
    is.
- **One field and menu:**
  - The menu lists the vault's tags with their counts, leaving out those the
    note already has.
  - It ends with "Make #…" for a tag that doesn't exist yet.
  - Counts in the sidebar follow at once.
- **The sidebar's + beside TAGS** (#4) names a tag in place. It has no notes
  yet, so it's set in faded italic, with a line saying how to give it some:
  add it from a note's head, or drop notes on it.
  - Such a tag has to live somewhere, since tags are found in notes. It would
    be kept in `.eien/tags.json`, the same file the tag tree's order would use
    (see [order.md](order.md)).

## A · In the running head

- **What:** the tags are mono words at the right of the breadcrumb, as the
  approved mockup had them. A + appears on hover.
- **For:** it's what the mockup promised. It costs no height, and reads as a
  running head does: where this note is, and what it's about.
- **Against:** the tags are small and far from where you look while writing.
  A note with many tags runs into the breadcrumb.

## B · Label slips under the title

- **What:** each tag is a small slip of band-coloured paper under the title.
  The + slip opens the field.
- **For:** it's the easiest to see and to hit, and touch-friendly on the
  phone. It sits with the title, which is what tags describe.
- **Against:** it pushes the text down by a line, on every note.

## C · The note's card

- **What:** a folded line above the title (tags · folder · words) that opens
  into a small card: tags, folder, words and the last seal. The tags field is
  in the card, and # opens the card.
- **For:**
  - It leaves room for more than tags: a note's facts, later its status or
    its AO3 link.
  - When folded, it's one quiet line.
- **Against:** it's one more thing on the page, and tags take two steps
  (open, then add).

## Recommendation

**A, with B's slips on the phone.** The running head is quiet and keeps the
page clean, and # makes adding a tag a keystroke. On a phone, where hover
doesn't exist and targets need 44px, B's slips under the title work better.
If you expect notes to grow facts (status, posted date, word goal), C is the
one to grow into.

## Open

- Should removing an inline tag from the head offer to take it out of the
  text? It's off for now: the head never edits your words.
- Renaming a tag everywhere, from its row's right-click in the sidebar, is
  not shown here.
