# Settings: three placements

[settings.html](settings.html). Click the settings icon at the sidebar's
foot. Every choice changes the window behind it, live: day or night, face,
machine voice, text size, row weights, density, page frame.

## What all three share

The current screen (backlog #18) failed because it didn't speak in Eien's
voice. All three placements share one fix:

- Group names are labels: mono capitals, tracked, in pencil ink, never bold.
- A setting's name is in the text face, with its description below in
  pencil.
- Choices are a segmented control: a pressed well with the chosen word
  raised on paper.
- Faces are cards showing the face itself. The machine voice's cards show a
  count set in each face, so you see it as it will look.
- The two new settings are in the same voice:
  - **Machine voice** (#24) uses the same cards, built from the same list of
    faces.
  - **Weight of names** (#25) is two rows, 400 to 700, each with a sample;
    the list's sample shows the chosen title, 100 heavier.
- The settings are data, drawn by one function per kind. It's the same model
  as `core/config/schema.ts`, so a new setting is one entry.

## A · Popover

- **What:** a raised panel anchored to the settings icon, with the groups as
  tabs.
- **For:** it's quick, and the whole window stays in sight, so every change
  shows as you make it.
- **Against:** it's narrow: face cards wrap to two columns, and a long group
  scrolls. It covers the sidebar it came from.

## B · In the page

- **What:** Settings becomes the page you're reading, a sheet like any note,
  with its groups as a contents line. The sidebar and list stay usable, and
  Esc or × goes back to the note.
- **For:** it's the most "Eien": settings are a page in the book, read and
  set in the same type as your writing. It has room for two columns: the
  name and description, then the choice.
- **Against:** the note leaves the page while you choose, so a face change
  shows in the list and sidebar but not in your own text.

## C · Over the window

- **What:** a sheet over the dimmed window, with the groups listed on a desk
  strip at its left, and a line of sample text at the top that updates as you
  choose.
- **For:** it's the most familiar (as macOS's own settings are), and it has
  the most room.
- **Against:** it hides the very window the choices change; the sample line
  stands in for it.

## Recommendation

**B, in the page.** Settings that change how the page reads are best judged
on a page. It's also the only placement that never covers the panes, so the
sidebar's and list's weights show live beside it. Add a small sample
paragraph at the top of the Appearance group, so a face change shows in
running text too.

## Open

- Whether Settings gets a key besides ⌘, on Windows and Linux (Ctrl+,).
- Where the vault's settings (chapter numbers, AO3) sit against this
  device's. The spec keeps them apart; B could give each its own contents
  line.
