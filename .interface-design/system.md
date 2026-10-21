# Eien — interface system

Extracted on 2026-10-20 from the approved desktop mockup:
`docs/design/desktop.html`, with `desktop.css`, `base.css` and `tokens.css`.
The design's reasons are in `docs/design/README.md`. The app's tokens, with
the same names, live in `src/ui/theme/tokens.css`, now their source. Every
value below is a token or made from tokens; new work uses the tokens, never a
raw value.

## Direction

- **Who:** a writer, often late at night, three scenes into a chapter, who also
  keeps hundreds of notes. What they do most: write the next scene, find a
  note, reorder chapters, seal a version and compare against it, copy a
  chapter for AO3.
- **Feel:** a book on a desk at night. Calm, warm, paper and ink. The
  interface is never louder than the page.
- **Signature:** the seal, a vermilion square with 永 pressed into it. It
  appears in five places only: the app's mark, each sealed version, "▪ sealed
  …" in the status line, the short rule beside the selected row, and the caret
  with the selection it makes. Nothing else is vermilion.

## Surfaces

Darker is further back, by day and by night (night is inkstone: the same warm
hues darkened, never grey-blue).

| Token | Where |
|---|---|
| `--eien-desk` | the sidebar |
| `--eien-blotter` | the page pane around the sheet |
| `--eien-band` | the list's head, the page's control strip, the colophon, a panel's head |
| `--eien-paper` | the note list and the sheet |
| `--eien-paper-raised` | what floats: menus, the versions panel, a row being dragged |
| `--eien-well` | inside a field |
| `--eien-selected` | the chosen row, beside the seal's rule |
| `--eien-hover`, `--eien-press` | a row or button under the pointer, and pressed |

Ink in four strengths: `--eien-ink` (the writing, titles), `--eien-ink-soft`
(rows, buttons), `--eien-pencil` (counts, dates, labels), `--eien-faded`
(placeholders, disabled only). Status: `--eien-added` (moss),
`--eien-removed` (carmine, delete too), `--eien-caution` (ochre, a conflict),
each with a `-wash`.

## Depth

Surface tone plus hairlines, and exactly two shadows. In the mockup: 21
hairline borders, 4 shadows (the sheet's once, the float three times).

- Hairlines (`--eien-hairline`, 1px) in ink at three strengths:
  `--eien-rule-soft` inside a pane, `--eien-rule` between panes and under a
  band, `--eien-rule-strong` for a field's edge, a floating thing's edge, and a
  pressed or chosen button.
- `--eien-shadow-sheet`: the sheet alone, the object lying on the blotter.
- `--eien-shadow-float`: whatever floats above the window.
- Panes, bands and rows cast none. No gradients.
- Corners are square (`--eien-radius: 0`); only dots are round (50%).
- A mark, not a rule, is `--eien-mark-w` (2px): the seal's rule, the caret,
  the focus ring.

## Spacing

Base 4px. Scale: `--eien-space-1` to `-8` = 4, 8, 12, 16, 24, 32, 48, 72.
Used in the mockup: 4 (41×), 8 (32×), 16 (27×), 12 (13×), then 24, 32, 72
and 48 rarely.

- 4: icon gaps, a dot's size. 8: inside a control. 12: row padding.
  16: pane gutters. 24: between groups.
- Layout lengths, made from tokens: the band that tops all three panes,
  `--band` = space-7 + space-2 (56px); the shut sidebar's strip, 48px; tree
  indent 16px a level; the twisty 12px; a row `--eien-row-h` 30px (26px
  compact); sidebar 264px, list 316px, versions panel 284px; a touch target at
  least `--eien-touch` 44px.
- Density (Comfortable or Compact) changes only tokens: the sheet's margins,
  gaps, row heights and the list's preview line. No component asks which
  density it's in.

## Type

Two voices. Ask: *could a person have written it?* The text face. *Did the
machine count it, or do you press it?* The mono.

- **Text face**, the writer's choice of eight (Newsreader by default;
  Literata; IBM Plex Sans, Source Sans 3, Atkinson Hyperlegible Next,
  Schibsted Grotesk, Hanken Grotesk, Instrument Sans). Each face sets its own
  sizes, leading and measure so all eight read alike. Newsreader's: prose
  22px, title 36px, list heading 23px, row 16px, preview 14px.
- **Machine voice**, IBM Plex Mono always: labels 10px in capitals tracked
  0.12em (`--eien-size-label`, `--eien-track-label`), counts and dates 11px
  with tabular figures (`--eien-size-meta`).
- Weights: 400; 500 for a note's title, the list's heading and the selected
  row's title; 600 for the vault's name and `strong`. A label is never bold:
  it's quiet by size, tracking and pencil ink.

## Motion

`--eien-quick` 120ms (hover, press), `--eien-calm` 220ms (a pane opening, a
view changing), easing `--eien-ease`, cubic-bezier(0.2, 0.7, 0.2, 1). Nothing
moves the writer didn't ask to move. None with reduced motion.

## Patterns

- **Word button** (`.word-button`): mono label type, ink-soft, padding 4px 8px,
  a transparent hairline border. Hover: ink, hover tone (only where a pointer
  hovers). Pressed: press tone, rule-strong border. Chosen in a set
  (`aria-pressed` or `aria-current`): ink in a rule-strong hairline, never the
  seal's colour. Disabled: faded.
- **Label** (`.label`): mono, 10px, capitals, tracked, pencil.
- **Count** (`.count`): mono, 11px, tabular figures, pencil.
- **Field** (`.field`): full width, well ground, a rule hairline, padding
  8px 12px, mono 11px in ink, a faded placeholder; on focus the border turns
  to the focus ink, with no ring.
- **Section label** (`.section__label`): LIBRARY, FOLDERS, TAGS. A button the
  row's height, label type, pencil (ink-soft on hover). Clicking folds the
  section; its twisty shows on hover, focus, or while folded.
- **Twisty**: a 12px triangle in faded ink that turns 90° rather than
  swapping (quick).
- **Tree row** (`.row`): the row's height, indent 16px a level, ink-soft; name
  in the text face; ordinal, BOOK mark and count on one baseline. A hairline
  guide (rule) runs down each open branch, from the twisty's centre. A tag
  row's `#` is mono 11px in pencil.
- **BOOK mark** (`.book-mark`): the word BOOK in label type, in a rule hairline
  box, like a stamped label, set close to the count.
- **Selected row:** the neutral selected fill plus the seal's 2px rule on the
  left. Two signals, never colour alone.
- **Band:** band ground with a rule hairline beneath (or above, for the
  colophon). The list's search band and the page's control strip share the
  height `--band`, so the three panes' tops line up.
- **List head:** search on its own band; then the title (heading size, 500,
  ink, one line), the sort as a word button with a menu (ORDER ▾), and a meta
  line in label type ("14 NOTES · 33,206 WORDS · BOOK").
- **Note row:** padding 12px above and below (`--eien-row-pad-y`, 8px compact)
  and 16px at the sides, a soft rule beneath; title in
  row size, count or date in mono at the right; a line of preview in pencil
  (gone in compact); a book's rows numbered i, ii, iii in a 32px column, and
  dragged by grabbing.
- **Menu:** raised paper, a rule-strong hairline, the float shadow, padding 4px;
  its items are word buttons, the chosen one with a small ink dot.
- **Page control strip:** a band whose words show only while the pointer is
  over the page or a control has focus, and never while typing.
- **Sheet:** paper with a rule hairline and the sheet's shadow, on the
  blotter; width the measure plus 72px each side, margins narrowing in a
  narrow pane.
- **Running head:** at the sheet's top, the breadcrumb in label type (FIC /
  BENEATH THE WALLS / IV) on the left, the note's tags in mono 11px on the
  right; then the title.
- **State line:** a band across the sheet's top saying what it shows
  (comparing, a seal, a conflict in caution ink on its wash).
- **Colophon:** the status line at the page's foot: a band, mono 11px
  capitals, items joined by a faded "·", optional ones dropped in a narrow
  pane.
- **Sidebar foot:** a soft rule above; the vault's count and sync status
  (a moss dot) in label type; the DAY and NIGHT pair with SETTINGS; the
  3 PANES and 2 PANES pair.
- **Panel** (versions): raised paper beside the page, a rule hairline on its
  left, the float shadow, a band head of `--band` height with a label and
  CLOSE.
- **Pane edge:** a transparent 8px handle over the hairline; rule-strong on
  hover; the focus ink at 2px while dragged or focused.
- **Dragged row:** raised paper, a rule-strong outline, the float shadow; the
  rest at 72% opacity; a hairline drop marker with a dot.
- **Empty:** centred, the text face in italic, ink-soft.

## States

Every control has hover, pressed, keyboard focus and disabled. Focus is a 2px
ring in the focus ink (inset on rows). Hover styles apply only where a pointer
hovers, so a tapped control doesn't stay lit on touch.

## Open for the design pass

Decisions the approved design doesn't settle yet, from `docs/backlog.md`:

- **Words or icons.** The approved design says "a control is a word, not an
  icon" (the mockup has 39 word buttons and no icons). The owner now asks
  for icons in some places: sun and moon for day or night, settings and the
  panes (#8), chevrons to shut panes (#15), and the three views (#17). The
  pass should set an icon style that keeps the machine voice, for example
  hairline strokes in ink-soft at the label's size, chosen like a word button
  is, and say which controls stay words.
- **Settings** (#18) has no mockup or pattern yet.
- **The title bar's strip** (#1): what, if anything, sits beside the traffic
  lights.
- **Tags on the page** (#13), **the formatting bar** (#14) and **the strip
  that hides** (#16) need places on the page.
