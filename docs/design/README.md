# Eien — design

The look and feel of Eien, and the rules the interface code follows. The
mockups here are how to see it; `tokens.css` is the source of every value.

| File | What it shows |
|---|---|
| [specimen.html](specimen.html) | Every colour, the four text faces side by side and the mono, the seal, rows and their states, the diff style, the spacing scale — day and night side by side |
| [desktop.html](desktop.html) | The app window: three panes, two-pane mode, collapsing and resizing, the page's views, Compare, Seal, Versions |
| [phone.html](phone.html) | The phone: contents → index → page, one at a time, controls behind ⋯ |
| [tokens.css](tokens.css) | The theme contract: every `--eien-*` token, day and night |
| [fonts.css](fonts.css), [fonts/](fonts/) | Newsreader, Literata, IBM Plex Sans, Archivo and IBM Plex Mono, bundled (SIL Open Font License) |
| [base.css](base.css) | The pieces every screen shares: the seal, labels, word-buttons, fields, focus |

To view them, serve this folder (fonts don't load from `file://`):

```bash
python3 -m http.server 4173 --directory docs/design
```

then open <http://127.0.0.1:4173/specimen.html>.

## Who it's for

A writer, often late at night, three scenes into a chapter, who also keeps
hundreds of notes. What they do most: write the next scene, find a note,
reorder chapters, seal a version and compare against it, copy a chapter for
AO3. The interface must never be louder than the page.

## Direction: a book on a desk at night

*Eien* (永遠) means "forever". Eien's first rule is that words are never lost,
so permanence is the theme.

- **The window is the desk.** Sidebar, note list and the space around the page
  share one ground, divided only by hairlines.
- **The note is a sheet of washi paper** laid on the desk: the brightest thing
  on screen, square-cornered, lifted by tone alone.
- **Words are sumi ink**, in four strengths: ink, iron-gall, graphite, faded.
- **Night is inkstone**: the same warm hues darkened, never grey-blue.

### The seal

The signature. A vermilion square with 永 pressed into it. ⌘S *seals* the
note: it keeps this version for good. The seal appears in exactly these
places, and its rarity is its meaning:

1. the app's mark, top-left (and the way home on the phone)
2. each sealed version in a note's versions
3. "▪ sealed 2h ago" in the status line
4. the short rule beside the selected row
5. the caret, and the text selection it makes

Nothing else is vermilion: a chosen button is ink in a hairline, keyboard
focus is an ink ring, and removed words are carmine (the editor's pencil), not
the seal.

Words: a checkpoint is a **seal**; a named version is a **named seal**.

### Two voices

| Voice | Face | For |
|---|---|---|
| Text | Newsreader (the default), Literata, IBM Plex Sans or Archivo: the writer's choice | Anything a person wrote: note text, titles, folder and note names, previews |
| Machine | IBM Plex Mono, always | Anything the machine counts or you press: counts, dates, labels (in capitals), buttons, the status line, the Source view |

The test: *could a person have written it?* The text face. *Did the machine
count it, or do you press it?* The mono.

- **The text face is the writer's choice.** Everything a person wrote uses
  it, whichever it is; the machine voice is always mono and never changes
  with it.
- The choice is `data-face` on `<html>`: `newsreader` (or no attribute),
  `literata`, `plex-sans`, `archivo`. Each face carries its own sizes,
  prose leading and measure in `tokens.css`, tuned by eye so the page reads
  at the same size and about 75 characters a line in all four (Newsreader's
  x-height is small, so it is set larger; the two sans-serifs' are large, so
  they are set smaller). Every mockup has a FACE control, kept in
  `localStorage`.

### Structure

- **The sidebar reads like a book's contents page**: names in the text face,
  counts in mono figures, no folder or tag icons. A folder can be marked
  as a book.
- **The note list reads like an index.** In a book folder, notes are numbered
  i, ii, iii in chapter order, and dragging reorders them.
- **The status line is a colophon**: words, today's words, sprint, last seal,
  zoom.
- **Controls are words** — LIVE · SOURCE · READING, COMPARE, SEAL, VERSIONS —
  hidden until the pointer is over the page or focus is in it. On the phone
  they live behind one ⋯.

## Rules for the interface code

1. Every colour, face, size, space and duration is a token from `tokens.css`.
   A theme overrides tokens and nothing else.
2. Depth is surface tone plus hairlines. No shadows, no gradients, square
   corners (only dots are round).
3. One accent: the seal, in its five places only. Status colours mean status:
   moss for added words, carmine for removed words and delete, ochre for a
   conflict.
4. Colour is never the only signal. A selected row has the seal rule and the
   wash; a removed word is struck through and tinted; a conflict says
   "conflict".
5. Text reaches 4.5:1 contrast on desk and paper in both schemes (checked;
   see the specimen). Faded is only for placeholders and disabled things.
6. Every control has hover, pressed, keyboard focus and disabled states, and
   works from the keyboard. Touch targets are at least 44px.
7. Nothing moves the writer didn't ask to move. Transitions are quick and
   quiet, and none with reduced motion.

## Known gaps

- IBM Plex Mono, as bundled (Latin and Latin Extended), has `·` but no `←`,
  `≡`, `⋯`, `▸`, `▾` or `⁂` (checked in the font files' cmaps). `⁂` lies inside
  the Latin file's range, so Plex Mono itself lacks it; the others lie outside
  both files' ranges. None of the four text faces has them either. The
  mockups fall back to a system face for them; the app will draw these marks
  (CSS or small SVGs in ink), not rely on a fallback font.
- The seal's 永 is set in the system's Mincho here (`--eien-face-seal`); the
  app ships the seal as an SVG so it looks the same on every system.

## In phase 3

`tokens.css`, `fonts.css`, `base.css` and the fonts move into
`src/ui/theme/`, and the token list becomes `docs/themes.md` (spec §7). The
mockups' behaviour is a guide, not code to copy: the app's interface is built
fresh, in modules, against the spec.
