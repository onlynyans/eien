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

**Brought up to date on 2026-10-21, after stage 3:** the Tokens section below
lists every token family as `src/ui/theme/tokens.css` and the layouts define
them, and what the settings set at run time; the patterns describe what
shipped.

## Direction

- **Who:** a writer, often late at night, three scenes into a chapter, who also
  keeps hundreds of notes. What they do most: write the next scene, find a
  note, reorder chapters, seal a version and compare against it, copy a
  chapter to post it.
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
| `--eien-field` | a field at rest: a wash of the ink |
| `--eien-well` | inside a field with the keyboard |
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
  `--band` = space-7 + space-2 (56px); the shut sidebar's strip, `--strip`,
  as wide as the band is tall (none for the seal alone); tree
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
- **Interface font** (the machine's voice), IBM Plex Mono by default: labels 10px in capitals
  tracked 0.12em (`--eien-size-label`, `--eien-track-label`), counts and
  dates 11px with tabular figures (`--eien-size-meta`). Its face is the
  writer's choice too (changed 2026-10-20, #24): the **Interface font**
  setting sets `--eien-face-mono`, so everything in the machine voice
  follows it.
- **Source**: the Source view's raw Markdown, and code, in
  `--eien-face-source` at `--eien-size-source` (14px), set by the **Source
  font** setting apart from the interface (2026-10-22). Both choose from the
  eleven monos (Plex Mono, JetBrains Mono, Fira Code, Cascadia Code, Source
  Code Pro, Iosevka, Commit Mono, Space Mono, Victor Mono, Monaspace Radon,
  Comic Mono) and the eight text faces.
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

## Tokens

Every value comes from a token. The source is `src/ui/theme/tokens.css`
(`docs/design/tokens.css` mirrors it for the mockups). A **theme** overrides
the colour tokens alone, each `light-dark(day, night)`
(`THEME_TOKENS` and `safeTokens` in `src/core/themes/tokens.ts`): a theme
can't touch sizes, faces, corners or space. A **setting** overrides a few
others on `<html>` (`src/ui/settings/look-properties.ts`); a **layout**
overrides the corners and its own lengths (`src/ui/chrome/*.css`).

| Family | Tokens | Values | Set by |
|---|---|---|---|
| Surfaces | `--eien-desk`, `-blotter`, `-band`, `-paper`, `-paper-raised`, `-well`, `-field`, `-selected`, `-hover`, `-press`, `-scrim` | light-dark pairs (Paper) | theme |
| Inks | `--eien-ink`, `-ink-soft`, `-pencil`, `-faded`, `-focus` | four strengths; focus = ink-soft | theme |
| Seal | `--eien-seal`, `-seal-wash`, `-on-seal` (the glyph pressed into it); `--eien-seal-size` 22px (10px small) | vermilion; the glyph the paper's white | theme (one seal colour per theme) |
| Status | `--eien-added`, `-removed` (= `-danger`), `-caution`, each `-wash` | moss, carmine, ochre | theme |
| Lines | `--eien-rule-soft`, `-rule`, `-rule-strong`; `--eien-hairline` 1px; `--eien-mark-w` 2px | ink at three strengths | theme (colours) |
| Depth | `--eien-shadow-sheet`, `--eien-shadow-float` | two shadows, no more | – |
| Corners | `--eien-radius-s`, `-m`, `-l` | A · Band 2/4/8, B · Slip 4/8/14, C · Running head 3/6/10 | layout |
| Icons | `--eien-icon` 16px, `--eien-icon-stroke` 1.25, `--eien-control` 28px (desktop), `--eien-touch` 44px | | – |
| Faces | `--eien-family-*` (nineteen: eleven monos, plex-mono first, and the eight text faces); `--eien-face-text`, `--eien-face-mono`, `--eien-face-source`, `--eien-face-seal` | each voice points at a family | settings: Typeface, Interface font, Source font (all from one FACES list, `src/core/config/faces.ts`) |
| Sizes | `--eien-size-prose`, `-title`, `-heading`, `-row`, `-preview` (each face's own, × `--eien-text-scale`); `--eien-size-label` 10px, `-meta` 11px (the interface font's own), `-source` 14px (the Source font's own) | Newsreader: 22, 36, 23, 16, 14 | settings: Text size (`--eien-text-scale`, 0.9–1.3), the faces |
| Weights | `--eien-weight-tree`, `--eien-weight-list`, `--eien-weight-list-chosen`; `--eien-track-label` 0.12em | 400, 400, 500 | settings: Row weights (chosen = list + 100, at most 700) |
| Space | `--eien-space-1` … `-8` | 4, 8, 12, 16, 24, 32, 48, 72 | – |
| Lengths | `--eien-row-h` 30px × text scale (26 compact), `--eien-row-pad-y`, `--eien-sidebar-w` 264, `--eien-list-w` 316, `--eien-panel-w` 284; `--band` 56px (space-7 + space-2), `--status-h` 40px, `--runhead-h` 40px, `--settings-inset` 64px 112px | | density; C sets `--band` 48px |
| Page rhythm | `--eien-measure` and `--eien-leading-prose` (each face's own: 29–34em, 1.5–1.76, less `--eien-leading-tighten`), `--eien-leading-row` 1.35; `--eien-title-gap`, `-paragraph-gap`, `-scene-gap`; `--eien-sheet-pad-x`, `-sheet-pad-top`, `--eien-page-gutter`; `--eien-list-preview` | comfortable: 32, 16, 1.4em; 72, 48, 24; tighten 0; preview shown. Compact: 16, 8, 0.8em; 48, 24, 8; tighten 0.14; no preview | the faces; density |
| Frame | `--eien-page-ground`, `--eien-sheet-lift` | Sheet: the blotter, the sheet's shadow. Full: paper, none, gutter 0 | setting: Page |
| Layout controls | `--controls-h`, `--controls-ground`; `--controls-left`, `--controls-right`; `--corner`, `--seal-x`, `--strip` | A: `--band` on the band; B: `--band` on the page ground; C: `--runhead-h` on `--runhead-ground`. Left is macOS's traffic lights, right Windows' and Linux's buttons, from the window controls overlay (0 where there are none: full screen, a phone). The corner's three: "A shut sidebar" below | layout; the window |
| Page | `--eien-zoom` (0.5–2), `--eien-dimmed` 0.32 (focus mode's faded paragraphs), `--eien-sheet-edge` | | settings: Page zoom |
| C's strip | `--runhead-ground` | one of the theme's surfaces, the desk by default | setting: Running head ground |
| Motion | `--eien-quick` 120ms, `--eien-calm` 220ms, `--eien-ease` | cubic-bezier(0.2, 0.7, 0.2, 1) | – |

A new token goes in `tokens.css` (and its mirror), named for its role in the
desk-and-paper world, never for a value (`--eien-pencil`, not `--grey-500`);
if a theme should change it, it joins `THEME_TOKENS`.

## Patterns

- **Controls are icons** (changed 2026-10-20, #26; built in stage 3): the
  page's views and tools, the formatting bar, the pane toggles, day or night,
  settings, the panes, the + that makes a folder, tag or note, and the lens's
  filter, sort and Arrange. Each is an `.icon-button` (`--eien-control`
  square) drawn from `ui/icons.ts`, with an accessible name and a tooltip
  with its key. Words stay for labels, counts, a menu's items, and Settings'
  choices.
- **Word button** (`.word-button`), where a word stays: mono label type,
  ink-soft, padding 4px 8px,
  a transparent hairline border. Hover: ink, hover tone (only where a pointer
  hovers). Pressed: press tone, rule-strong border. Chosen in a set
  (`aria-pressed` or `aria-current`): ink in a rule-strong hairline, never the
  seal's colour. Disabled: faded.
- **Seal** (`.seal`): a `--eien-seal-size` square of `--eien-seal`, the glyph
  in `--eien-on-seal` at 0.68 of the side, in `--eien-face-seal`. Its corners
  are a stamp's: `min(--eien-radius-s, 20%)` from the layout it sits in, so a
  small seal still reads square. `.seal--small` (10px) is the square alone.
  The app's icon is Noto Serif JP's 永 as an outline, placed as `.seal` sets
  it (`build/icons/seal.svg`); the window sets the glyph in the first face of
  `--eien-face-seal` it finds (Noto Serif JP where installed, else the
  system's Mincho). Drawing it from the icon's path is on hold
  (`docs/todos/in-app-seal.md`).
- **A name centred by its capitals** (`.tree-row__label`, `.note-row__title`,
  2026-10-22): `text-box: trim-both cap alphabetic`, then half of what's
  left above and half below (`padding-block: calc((1lh - 1cap) / 2)`), so
  the capitals sit in the row's middle for every face, size and density;
  a count beside it keeps to its baseline.
- **Label** (`.label`): mono, 10px, capitals, tracked, pencil.
- **Count** (`.count`): mono, 11px, tabular figures, pencil.
- **Field** (`.field`, changed 2026-10-22): set into the pane, not laid on
  it. At rest `--eien-field` (a wash of the ink) with a transparent hairline,
  `--eien-radius-s`; the hairline turns `--eien-rule` under the pointer;
  focused, the well ground and a 2px focus-ink ring on its own edge, inset,
  so nothing grows round it. Padding 8px 12px, mono 11px in ink, a faded
  placeholder. The search field is the pane's width, so `--eien-radius-m`,
  with the search icon in pencil set into its left.
- **Rename** (`.rename`, 2026-10-22): a name edited where it stands (a
  folder, a new tag, a note): the row's own face, size and weight, no box, no
  ground; the 2px focus mark under the words (a hairline in rule-strong while
  the window is away), the caret in the seal, and the row lit
  `--eien-selected`, so it reads as the row being edited.
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
  ink, one line) and, at its right, the quiet + (New note); under it a meta
  line in label type ("14 NOTES · 33,206 WORDS · BOOK"; "2 OF 14 NOTES"
  while filtered) and the lens's quiet icons (Arrange in Arrange mode, the
  filter, the sort); the lens's chips under that, then the locked line when
  rows can't move.
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
  then the sync status (when Syncthing syncs the vault) and three icons: day
  or night (sun or moon), three panes or two, settings.
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
  is a › in the same spot of the pane beside it. How a sidebar shuts is a
  setting (below, "A shut sidebar").
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
  by its head and resizes by its edges and corners (only the bottom-right
  corner shows itself, and takes the arrow keys), stays in the window, is at
  least 560 × 380, keeps its box per device, and goes back on a
  double-click of its head. On a phone it's a full sheet, its tabs in a
  strip under the head. Built: `src/ui/settings/` (3G).
  - **Categories:** Look (Appearance, Type, Page), Themes (Gallery,
    Custom), Writing (Lists, Editor), This vault (Writing): the
    vault's own settings apart from this device's (#31).
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
    paper with the seal, then the name and a note (no kanji: 2026-10-22).
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
strip ground (`--runhead-ground`: the Running head setting, one of the
theme's surfaces, the desk by default; built in 3G).

## Tables in Live (decided and built 2026-10-22)

From `docs/design/explorations/tables.md`; the page shows it working.

- **Tables in Live** (`table-menus.html`): a GFM table edited in place, the
  file a plain Markdown table.
  - Desktop: a grip at each row's left and over each column, for the row and
    column under the pointer or the caret. Pressed, the row's or column's
    menu (the row menu's style); dragged, the row or column moves, with the
    drop line.
  - A + comes only while the pointer is on a line between two columns or
    rows (or the table's outer edges), with the line where the new one goes.
  - The formatting bar's Table button: pressed with the caret in a table, it
    opens the caret's menus.
  - Phone: the table's tools on one bar docked above the keyboard, 44px
    targets.
  - Keys: Tab, arrows and Enter between cells; ⌥⌘ arrows add, ⌥⌘⌫ removes,
    ⌘Z puts back.

## A shut sidebar (decided and built 2026-10-22)

From `docs/design/explorations/corner.md` ("Building both"): a setting for
A · Band and B · Slip, "Shut sidebar" (`appearance.shutSidebar`, as
`data-shut-sidebar` on `<html>`; none in C).

- **The seal alone** (the default): no strip (`--strip` 0). The seal stays
  where it was in the top row, on `--seal-x` (the gutter past the lights),
  laid over the next pane's band, which starts `--eien-space-4` past it.
- **A strip of desk:** `--strip` is `--band` wide, the seal in its middle. On
  macOS, its top widens into a shoulder of desk (`--controls-left` +
  `--eien-space-2`, one band tall, a rule hairline at its edge, its outer
  corner `--eien-radius-l`) that holds the lights; the seal waits under them,
  and the next band starts `--eien-space-4` past the shoulder.
- **C · Running head:** always the strip, C's `--band` wide (48px), the seal
  at its top; the running head holds the lights.
- **Full screen** has no lights: `env(titlebar-area-x)` is unset there, and
  `data-controls-left` (`shell/controls-left.ts`, from the window controls
  overlay) goes, so the seal is in the top row and there's no shoulder.
- One length says where the corner's things end, `--corner`
  (`shell/shell.css`); every band that could run under them keeps clear of it.

## The split window and New Window (decided 2026-10-23, being built)

From `docs/design/explorations/split.md` and `split-alt.md`; each page there
shows it working, and `docs/split-and-windows.md` is the build's plan. The
split is a setting of four modes (`appearance.split`, as `data-split` on
`<html>`), the way the layouts are: each mode a spec and a stylesheet, its
corners and colours the layout's own.

- **Shared by every mode:**
  - Two notes side by side, never top and bottom (but for the companion when
    narrow). A page is never narrower than `--eien-page-min`.
  - Opening: Open to the Side (a row's menu), ⌘-click or ⌘Enter on a row, a
    row dropped on the page's right edge (a raised-paper preview with a 2px
    ink-soft edge where it lands), ⌘D. ⌘D, split, closes the other side.
  - The active page: a click in it, or ⌘3 (pressed in a page, the other
    one). Formatting, keys and Copy as HTML act on it.
  - The list: the chosen row is the active page's note (the selected fill
    and the seal's rule); the other open note keeps a fainter rule, pencil,
    no fill.
  - Closing (×, or ⌘W while split) never touches a note. Swap is ⇄.
  - One note on both sides is one document: one history, one save, one
    count.
  - A divider is a pane's edge: a hairline in its own column, an
    `--eien-space-2` handle round it, `--eien-rule-strong` under the pointer,
    the focus ink at `--eien-mark-w` while dragged or focused; arrows move
    it, double-click or Enter evens it; ⇄ shows on it on hover.
- **3 · Two sheets** (the default): one set of the layout's tools, one
  formatting bar, one colophon, for the active page. Two sheets on the
  blotter, `--eien-space-5` of blotter round each, the divider between. The
  active sheet has `--eien-shadow-sheet` and a `--eien-rule` edge; the other
  lies flat, a `--eien-rule-soft` edge. In Page frame Full, the divider parts
  two pages of paper and a 2px ink-soft rule tops the active one. Below two
  pages' width, the pair folds into one with a pager naming both.
- **4 · Facing pages:** one sheet opened like a book; the gutter
  (`--eien-space-6`, a `--eien-rule-soft` hairline) is the divider. The
  book's tools where the layout puts them; each note's own (its number,
  words, last seal; Versions, Compare, Copy as HTML, ×, on hover) in a folio
  at its page's foot, a soft rule above, mirrored as page numbers are. The
  active page's mark is a setting (`appearance.facingMark`, as
  `data-facing-mark`), none of them the seal's colour, each with its own
  `--eien-calm` arrival (none with reduced motion):
  - **the ribbon** (the default): an ink-soft silk marker, `--eien-space-2`
    wide and `--eien-space-6` long, over the sheet's top edge in the outer
    margin, its end forked; it drops in.
  - **a dog-ear:** the outer top corner turned down, `--eien-space-5`
    square: the corner gone to the blotter, the flap the paper's back in
    `--eien-band` with a `--eien-rule-strong` hairline; no ink. It folds in.
  - **an edge tab:** an ink-soft index tab standing out from the page's
    outer edge, `--eien-space-7` long, `--eien-radius-s` on its outer
    corners, `--eien-space-6` below the head. It slides out.
  Too narrow for two pages and the gutter, the book closes to the marked
  page, and the facing page's edge stays by the gutter, its name down it in
  label type, to turn to.
- **5 · Companion:** the page keeps every tool it has. The second note sits
  at the window's right edge, where Versions opens, `--eien-companion-w`
  wide (at least `--eien-companion-min`, the page beside it at least
  `--eien-companion-page-min`), its words at row size. Its own head (its
  name, ⇄ to make it the page, ⋯, ×) and foot (words, last seal). The one
  you aren't writing in sits back a step: its paper takes `--eien-band`.
  Narrower than both, it goes under the page, its edge dragged up and down.
- **6 · Tools that follow:** the note list steps aside while split (not
  saved as shut); one set of the page's furniture (A's band, formatting bar
  and colophon; B's slip, resting folded; C's running-head tools and that
  page's crumb in ink-soft) stands on the active page, placed by grid, never
  moved in the DOM. The other page is paper on the blotter, its × on hover.
  Too narrow for two pages beside the sidebar, the split is refused, and
  Eien says why.
- **New Window:** File → New Window (⇧⌘N) and a row's Open in New Window; a
  window opens on the vault and note it was asked from. Its title is its
  note's name. ⌘W closes the active side while split, the window otherwise.
- **The phone:** no split and no New Window; the back bar keeps the note you
  came from a tap away (⇄ and its name, a `--eien-radius-dot` slip at the
  bar's right), each keeping its place.
- **New tokens** (lengths, in `src/ui/theme/tokens.css`, not themed):
  `--eien-page-min` 360px (a page in a split), `--eien-companion-w` 380px,
  `--eien-companion-min` 300px, `--eien-companion-page-min` 400px. Every
  other length above is a space, rule, mark or radius token.

## Built patterns (stage 3, wave 2, 2026-10-21)

As shipped; see `docs/design/explorations/specimen.html`, As built.

- **Row menu** (`ui/menu/`): raised paper, `--eien-radius-m`; the row's name
  as its head (mono, label size, tracked capitals, pencil, `aria-hidden`);
  each choice a grid of icon (16px), word, key (mono, label size, pencil,
  drawn from `data-keys` so the choice's name is its word alone); the trash
  last after a rule, in `--eien-danger`. No keys on a coarse pointer.
- **Name field** (`ui/list/name-field.ts`): laid over the row's name in its
  own face, size and weight (copied from the name), a `.rename`: the 2px
  focus mark under it, caret in the seal, the row under it lit
  `--eien-selected`; a note's `.md` after it in mono,
  meta size, faded. A problem shows under it: label size, mono,
  `--eien-caution` on `--eien-caution-wash`, `--eien-radius-s`.
- **Quiet controls** (`icon-button--quiet`, `chrome/chrome.css`): the + that
  makes something (`ui/add-button.ts`: New folder and New tag at a section
  label's right, New note in the list's head) and the lens's filter, sort and
  Arrange. One rule for every pane: opacity 0 until the row they sit in
  (`.quiet-row`: a sidebar section, the list's head, the sidebar's search row, where two panes put the chosen row's filter and sort, with no head) is
  hovered, or they have the keyboard, are open (`aria-expanded`), pressed or
  on; always shown on `hover: none`. Their own hover, press and focus are the
  icon button's.
- **A tag no note carries**: the name faded and italic; under it a hint in
  meta size, italic, pencil, indented as the row's children are.
- **Chips** (the lens): mono, meta size, ink-soft, a hairline in
  `--eien-rule-strong`, `--eien-radius-s`, an 18px × at the end; a kept-out
  tag struck through in `--eien-removed`. A control that's on carries a 4px
  ink-soft dot at its top right.
- **Three-state box** (the tag filter): 18px, `--eien-radius-s`; left alone
  an empty hairline box; wanted filled ink-soft with a paper tick; kept out a
  carmine hairline with a dash, the name struck through.
- **Locked line**: under a list's head, preview size, italic, pencil, a soft
  rule under it: why rows don't move.
- **Sync status**: a 14px sync icon in `--eien-added` while quiet, pencil
  after another device's change; its words only in the tooltip.
- **Grip**: 12px, pencil, at a row's own left edge (absolutely placed, out of
  the row's columns, so it never covers a nested branch's guide).
- **Tags on the page** (`ui/page/tag-set.ts`, `tag-set.css`): mono words in
  pencil in each layout's tag slot (A's running head, B's slips under the
  title, C's colophon pills; slips at a finger's size on a phone); a × for a
  front-matter tag, on hover or focus, that takes no room till then (in A it
  hangs in the gap after its tag, so the hovered tag never moves); a 4px
  faded dot after a tag typed in the text; the + field's menu is a menu's
  raised paper, the chosen choice on `--eien-selected`, "Make #…" after a
  soft rule.
- **Table editor** (`ui/editor/table-*.ts`, `editor/table.css`, from
  `explorations/table-menus.html`): its controls are the window's own, in a
  layer over the editor (out of its shadow root). A grip is a quiet
  `.icon-button` with the row grip's 12px icon in pencil, over each column
  and at each row's left, on (`is-on`) for the row and column under the
  pointer or caret; carried, it's a dragged row (raised paper, rule-strong
  edge, the float shadow). Its menu is the row menu, a column's alignment a
  radio with the ink dot where a key would be. The + on a line between
  columns or rows is the quiet + (`ui/add-button.ts`), on only while the
  pointer is on that line, with the drop marker across or down the table;
  a moved row or column shows the same marker. Each stands off the table by
  `--eien-space-1`, a row's + one control further out. A phone's table bar
  is a host on the band (its rules `host__rule`, its buttons at
  `--eien-touch`) docked under the sheet. A column's alignment shows: right
  in tabular figures.
- **Formatting bar**: the `format` slot's host. Band's second row on the
  band ground; Slip's own raised slip at the blotter's top left; Running
  head's raised rail down the margin. Its buttons have the icon control's
  states, pressed where the format is on at the caret.
