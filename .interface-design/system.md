# Eien — interface system

Extracted on 2026-10-20 from the approved desktop mockup:
`docs/design/desktop.html`, with `desktop.css`, `base.css` and `tokens.css`.
The design's reasons are in `docs/design/README.md`. The app's tokens, with
the same names, live in `src/ui/theme/tokens.css`, now their source. Every
value below is a token or made from tokens; new work uses the tokens, never a
raw value.

**Changed on 2026-10-20, by the owner:** controls are icons, not words; not
everything is square; the machine voice's face is a setting; row names'
weight is a setting. Each is marked below, and in `docs/backlog.md` (#24–#27).
Where this file and the mockup disagree, this file wins.

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
- **Corners: not everything is square** (changed 2026-10-20, #27). Three
  steps, `--eien-radius-s` (what you press), `-m` (what floats), `-l` (what
  covers the window), set by the layout (see "Layouts"). Paper stays square,
  but for B's sheet. Dots stay round.
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
- **Machine voice**, IBM Plex Mono by default: labels 10px in capitals
  tracked 0.12em (`--eien-size-label`, `--eien-track-label`), counts and
  dates 11px with tabular figures (`--eien-size-meta`). Its face becomes the
  writer's choice too (changed 2026-10-20, #24): `--eien-face-mono` is set
  by that setting, so everything in the machine voice follows it.
- Weights: 400; 500 for a note's title and the list's heading; 600 for the
  vault's name and `strong`. A label is never bold: it's quiet by size,
  tracking and pencil ink.
- **Row names' weight is a setting** (changed 2026-10-20, #25): the
  sidebar's names (`.row__name`) and the list's titles (`.note-row__title`),
  each 400–700, apart. A selected list title is 100 heavier than its
  setting, at most 700 (400 gives the mockup's 500).

## Motion

`--eien-quick` 120ms (hover, press), `--eien-calm` 220ms (a pane opening, a
view changing), easing `--eien-ease`, cubic-bezier(0.2, 0.7, 0.2, 1). Nothing
moves the writer didn't ask to move. None with reduced motion.

## Patterns

- **Controls are icons** (changed 2026-10-20, #26): the page's views and
  tools, the pane toggles, day or night, settings and the panes. Each has an
  accessible name and a tooltip with its key. The icon set and its style
  are the design pass's to set, in the machine voice: ink-soft, at a label's
  size, with the word button's states. Words stay for labels, counts, a
  menu's items, and wherever the design pass finds a word clearer.
- **Word button** (`.word-button`), where a word stays: mono label type,
  ink-soft, padding 4px 8px,
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
- **Sidebar foot:** a soft rule above; the vault's count in label type,
  then the sync status's place and three icons: day or night (sun or moon),
  three panes or two, settings.
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

## Decided patterns (design pass, 2026-10-21)

From the explorations in `docs/design/explorations` the owner chose; each
page there shows them working.

- **Icons** (#26): Eien's own set, drawn on a 16-unit grid with round ends
  and joins, stroke `--eien-icon-stroke` (1.25), in `currentColor`, as
  inline SVG (`ICONS` in `explorations/_src/shared.js`; `ui/icons.ts` in the
  app). Controls are a 28px `.icon-button` square with the word button's
  states; each has an accessible name and a tooltip with its key. The
  formatting bar's bold, italic, underline and strikethrough are drawn too,
  never letters. The seal stays itself as the Seal control.
- **Tooltip:** raised paper, `--eien-radius-s`, the machine voice, the key
  after the word in pencil, after a short hover.
- **Seal button:** no background; a hairline border, transparent until
  hover, then `--eien-rule`.
- **Shut panes:** a pane's ‹ (on hover, at its head) shuts it; the way back
  is a › in the same spot of the pane beside it. A shut sidebar leaves a
  strip of desk with the traffic lights and the seal, which opens it.
- **Page parts each have a row** (`.page`: bar, formatting bar, scroll,
  status), and the status bar has a fixed height (`--status-h`, 40px), so
  nothing grows into a hidden part's space.
- **Focus mode** is a control in the page's toolbar: three lines, only the
  middle one in full ink. It dims every paragraph but the caret's.
- **Tags on the page** (#13): mono words at the right of the running head,
  a + on hover and the # key to add, a field with the vault's tags and
  "Make #…"; a tag typed in the text shows with a dot and no ×.
- **Rename in place:** for notes, folders and tags alike. The name becomes
  its own field (same face, size, weight; selected; a focus-ink hairline
  under it; a note's `.md` faded after it). Enter keeps, Esc puts back,
  leaving keeps; a taken name shows as an ochre line under the row. It
  starts from the right-click menu, F2 or a double-click.
- **Right-click menu:** raised paper, `--eien-radius-m`, the row's name as a
  mono head, an icon and a word per choice, the key in pencil; the trash
  last, in carmine, after a rule.
- **Settings over the window** (#18): a sheet at `--settings-inset`
  (64px 112px), `--eien-radius-l`, the float shadow, on the scrim. It moves
  by its head and resizes by its right edge, bottom edge and corner, stays
  in the window, is at least 560 × 380, keeps its box per device, and goes
  back on a double-click of its head.
  - **Breadcrumb head:** `SETTINGS / CATEGORY / TAB` in the machine voice,
    slashes faded, the last part ink-soft.
  - **Category label** (new element): mono capitals, tracked, faded, with a
    12px icon: a part title. Its tabs sit under it in the text face; the
    chosen tab has the selected fill and the seal's rule, as a row does.
  - A setting is its name (text face), a description (pencil), then its
    control: a segmented well of words or icons, face cards set in each
    face, swatches of theme surfaces, or a stepper.
- **Themes:** a category of two tabs.
  - **Gallery:** Eien's own themes as cards: desk | paper with ink | night
    paper with the seal, then the name, its kanji, a note.
  - **Custom:** the writer's own, one named file each in `.eien/themes/`,
    as the same cards, plus a dashed "New theme" card. The chosen one opens
    a mix panel on the band: its name as an in-place field, its file in
    mono, the trash; day and night strips (surfaces, the three inks, the
    seal); four knobs (paper, warmth, ink, seal) whose tracks show the
    colours they choose between (the one place a gradient carries meaning);
    a contrast verdict; saved as it changes. Each ink is fitted to Eien's
    contrast (`fitInk`), so every mix passes, by day and night.
- **Your order and a lens over it** (#12): every list keeps your order; a
  sort or the tag filter is a lens shown as a chip with ×. Arranging is a
  setting: drag anytime (default) or only in Arrange mode (the grip icon in
  a pane's head). The grip sits at a row's own left edge.
  - **Drop line:** in the tree, a 2px ink-soft marker at the target's
    depth (it steps out a level to leave a folder); in the list, a 2px
    ink-soft line the list's full width.
  - **Three-way tag filter:** each tag left alone (empty box), wanted
    (filled, ticked) or kept out (carmine, struck through); one press moves
    it on, ⌥ keeps it out; All of / Any of for two or more wanted.

## Layouts (decided 2026-10-21)

All three layouts are offered, as a setting (`appearance.layout`: band,
slip, runhead, as `data-layout` on `<html>`), carried by one framework:
commands defined once, hosts that draw a list of them, a small module and
stylesheet per layout. Each layout sets its own radius scale on `:root`
(`--eien-radius-s/-m/-l`: A 2/4/8, B 4/8/14, C 3/6/10) and its own phone
bottom (A a top bar, B a floating slip, C a tool rail). Nothing hardcodes a
radius; components use the three tokens.

Built in the app (backlog #28, 3A): `appearance.layout` in `core/config`;
the commands in `ui/chrome/commands.ts`, the icons in `ui/icons.ts`, each
layout's hosts in `ui/chrome/band.ts`, `slip.ts`, `runhead.ts` with a
stylesheet each (its corners on `:root[data-layout=…]`). The slots wave 2
fills: the formatting bar's row (`page.slots.format`, the `format` slot),
the sync icon's place at the sidebar's foot (`SidebarFoot.sync`), and C's
strip ground (`--runhead-ground`, the desk until it's a setting).

Built in 3D (#13, #14): the tag set (`ui/page/tag-set.ts`, `tag-set.css`) in
each layout's tag slot, slips under the title on a phone; the formatting bar
as the `format` slot's host: Band's second row on the band ground, Slip's own
raised slip at the blotter's top left, Running head's raised rail down the
margin, each with the word button's states, pressed where its format is on.
