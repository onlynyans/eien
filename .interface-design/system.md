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
Where this file and the mockup disagree, this file wins: the mockups in
`docs/design/` are a 2026-10-20 snapshot, kept for their reasoning and never
copied from. How something looks is this file first, then each exploration's
Decided section (`docs/design/explorations/*.md`), then the code (AGENTS.md →
Rules).

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
- **One exception, the curl's light** (approved 2026-10-28, #40; built,
  Phase 3a, #129): while a book's page turns as a curl, and only then, the
  paper may carry light. At rest every page is flat, with two shadows and
  no gradients.
  - The light comes from three tokens in `tokens.css` (docs/design/README.md,
    "A page turning"; Phase 3a), beside the shadows: the two inks a
    light-dark pair each, which a palette's sheet carries with its shadows
    (`slate.css`), not a writer's theme (a shadow isn't a theme's either);
    the third a fraction:
    - `--eien-curl-shade`: the sheet shadow's own ink, where paper bends
      away;
    - `--eien-curl-light`: the crest of the roll;
    - `--eien-curl-through`: how much of the words shows through the back,
      12%.
  - The gradients are those tokens ramped across the roll, and the lifted
    paper casts one soft shadow in `--eien-curl-shade`: a third shadow,
    there only while the page moves.
  - Nothing else may use these tokens. The motion is
    `docs/design/explorations/epub-flip-curl.html`.
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
- **Source**: the Source view's raw Markdown in `--eien-face-source` at
  `--eien-size-source` (14px), set by the **Source font** setting apart from
  the interface (2026-10-22). Code on the page (Live and Reading) is at
  0.86em of the words, so it reads at the text's scale and follows Text size
  (2026-10-28): a fenced block in the Source face on the well ground, its
  fences out of sight but on the caret's line, each fence's line a margin
  of the ground one code line high, without its leading; `` `code` `` in a line in the interface mono. Both
  choose from the
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
(`docs/design/tokens.css` is the mockups' snapshot, frozen at stage 3). A **theme** overrides
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
| The curl's light | `--eien-curl-shade`, `--eien-curl-light`, `--eien-curl-through` | the sheet shadow's ink (0.18 by day, black 0.5 by night); white 0.6 by day, the night's ink 0.1; 0.12 | – (Depth's exception: only while a page turns as a curl) |
| Corners | `--eien-radius-s`, `-m`, `-l` | A · Band 2/4/8, B · Slip 4/8/14, C · Running head 3/6/10 | layout |
| Icons | `--eien-icon` 16px, `--eien-icon-stroke` 1.25, `--eien-control` 28px (desktop), `--eien-touch` 44px | | – |
| Faces | `--eien-family-*` (nineteen: eleven monos, plex-mono first, and the eight text faces); `--eien-face-text`, `--eien-face-mono`, `--eien-face-source`, `--eien-face-seal` | each voice points at a family | settings: Typeface, Interface font, Source font (all from one FACES list, `src/core/config/faces.ts`) |
| Sizes | `--eien-size-prose`, `-title`, `-heading`, `-row`, `-preview` (each face's own, × `--eien-text-scale`); `--eien-size-label` 10px, `-meta` 11px (the interface font's own), `-source` 14px (the Source font's own) | Newsreader: 22, 36, 23, 16, 14 | settings: Text size (`--eien-text-scale`, 0.9–1.3), the faces |
| Weights | `--eien-weight-tree`, `--eien-weight-list`, `--eien-weight-list-chosen`; `--eien-track-label` 0.12em | 400, 400, 500 | settings: Row weights (chosen = list + 100, at most 700) |
| Space | `--eien-space-1` … `-8` | 4, 8, 12, 16, 24, 32, 48, 72 | – |
| Lengths | `--eien-row-h` 30px × text scale (26 compact), `--eien-row-pad-y`, `--eien-sidebar-w` 264, `--eien-list-w` 316, `--eien-panel-w` 284; `--band` 56px (space-7 + space-2), `--status-h` 40px, `--runhead-h` 40px, `--settings-inset` 64px 112px | | density; C sets `--band` 48px |
| Page rhythm | `--eien-measure` and `--eien-leading-prose` (each face's own: 29–34em, 1.5–1.76, less `--eien-leading-tighten`), `--eien-leading-row` 1.35; `--eien-title-gap`, `-paragraph-gap`, `-scene-gap`; `--eien-sheet-pad-x`, `-sheet-pad-top`, `--eien-sheet-gutter` (the density's blotter round a sheet, which `--eien-page-gutter` takes with a sheet frame); `--eien-list-preview` | comfortable: 32, 16, 1.4em; 72, 48, 24; tighten 0; preview shown. Compact: 16, 8, 0.8em; 48, 24, 8; tighten 0.14; no preview | the faces; density |
| Frame | `--eien-page-ground`, `--eien-page-gutter`, `--eien-sheet-lift` | Sheet: the blotter, the sheet's shadow, the density's gutter. Full: paper, none, gutter 0 | setting: Page; a book's leaf its own (`[data-frame]`) |
| A book's parts | `--eien-epub-title-size`, `-title-gap`, `-paragraph-gap`, `-break-gap`, `-epigraph-indent`, `-plate-gap`, `-caption-ink`, `-first-line-track`; `--eien-epub-indent` (Phase 2) | each from a note's: the heading size, the title, paragraph and scene gaps, space-6, space-5, pencil, half the label's tracking; As a book's indent space-6, space-5 under a 520px page | – (declared on `:root, [data-face]`, so a book in its own face resolves them in it) |
| Layout controls | `--controls-h`, `--controls-ground`; `--controls-w`, `--controls-left`, `--controls-right`; `--corner`, `--seal-x`, `--strip` | A: `--band` on the band; B: `--band` on the page ground; C: `--runhead-h` on `--runhead-ground`. `--controls-w` is how wide the window's own controls stand: from the overlay's width, not where its free area starts (a Mac's resize moves that), and measured once still, never mid-resize (#44); `data-controls-left` puts them at the left. Left is macOS's traffic lights, right Windows' and Linux's buttons, from the window controls overlay (0 where there are none: full screen, a phone). The corner's three: "A shut sidebar" below | layout; the window |
| Page | `--eien-zoom` (0.5–2), `--eien-dimmed` 0.32 (focus mode's faded paragraphs), `--eien-sheet-edge` | | settings: Page zoom |
| Split | `--split-gap`, `--leaf-x`, `--pager-gap` | the divider's track a hairline (Facing pages: the book's gutter, `--eien-space-6`); a facing leaf's side margin, clamp(space-4, 7%, space-7); half of space-1 between a folded split's pager names | the split's mode |
| C's strip | `--runhead-ground` | one of the theme's surfaces, the desk by default | setting: Running head ground |
| Motion | `--eien-quick` 120ms, `--eien-calm` 220ms, `--eien-ease` | cubic-bezier(0.2, 0.7, 0.2, 1) | – |

A new token goes in `src/ui/theme/tokens.css` alone, named for its role in the
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
- **Group head** (backlog #42, a folder's list with its subfolders' notes):
  a section, not a card. The subfolder's path below the folder in label type
  ("ARC 2 / CUT", never bold, one line), on the paper, 24px above (between
  groups), 8px below, the row's 16px at its sides; the row above's soft rule
  closes the group before. No ground, no rule of its own, no count, and no
  stop for the keyboard.
- **A toggle in the list's head** (Arrange while arranging, Include
  subfolders): a quiet icon; on, ink on the selected ground in a rule-strong
  hairline (`aria-pressed`). A lens control that's on has the dot instead.
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
  or night (sun or moon), three panes or two, settings, all on the row's
  middle.
- **Panel** (versions): raised paper beside the page, a rule hairline on its
  left, the float shadow, a band head of `--band` height with a label and
  CLOSE.
- **Pane edge:** a transparent 8px handle over the hairline; rule-strong on
  hover; the focus ink at 2px while dragged or focused.
- **Dragged row:** raised paper, a rule-strong outline, the float shadow; the
  rest at 72% opacity; a hairline drop marker with a dot.
- **Empty:** centred, the text face in italic, ink-soft.
- **Find slip** (`.find`, `find/find.css`, 2026-10-27): find and replace
  on a slip laid at the page's top right (`--eien-space-2` down,
  `--eien-space-4` in), as wide as the list plus 48px each side and no wider
  than the page allows. Raised paper in a rule-strong hairline,
  `--eien-radius-m`, and no shadow: it lies on the page, quieter than the
  words. A twisty (turning, as the tree's) unfolds Replace's row under Find's.
  The fields are the softer field at `--eien-control` height, the options
  (match case, whole word, pattern) inside the field's row as quiet icons,
  the count in pencil, in caution's ink for a pattern that can't be read.
  With no match, the moves and replaces fade. Under 520px of page the options
  and count drop under the field.
- **A list's group head** (`.note-group`, 2026-10-27): with Include
  subfolders on, each subfolder's notes under its name. A section, not a
  card: label type on the paper, never bold, one line with an ellipsis,
  padding space-5 above, space-2 below, space-4 at the sides. The row above's
  soft rule closes the group before. The heads all stand at one height, so a
  long, windowed list can lay them out.
- **A bar that folds** (`chrome/fold.ts`, 2026-10-27): tools that don't fit
  their bar fold behind one ⋯, the bar's last control, rather than run past
  the page, the screen or the window's controls. A bar folds as one, across
  its hosts, in the order the layout's `folds` lists give (the views as one
  step); what no list names never folds (the strip's toggle, the way back
  from a shut band). In C, the breadcrumb gives way first, then the tools.

## States

Every control has hover, pressed, keyboard focus and disabled. A tool the
active page can't use isn't disabled but set aside, out of its bar (#40,
"The tools, by what's in sight"); disabled is for one that applies but
can't act now (Compare with no versions). Focus is a 2px
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

## The split window and New Window (decided 2026-10-23, built)

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
  - A page's own × only where its mode has no other: Two sheets (each
    sheet's top right, on hover) and Tools that follow (the other page's).
    Facing pages' × is in the folio, a companion's in its head: never two
    on one page.
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
  pages' width, the pair folds into one with a pager naming both, before
  the tools: each name a word button in a control's square (`--eien-control`
  high, at least as wide), the active one pressed. Short of room the names
  give way to an ellipsis, down to two squares and no further; the band's
  views and tools keep their width, so a control never lies over another.
  The band hidden (#16) takes the pager with it.
- **4 · Facing pages:** one sheet opened like a book; the gutter
  (`--eien-space-6`, a `--eien-rule-soft` hairline) is the divider. The
  book's tools where the layout puts them; each note's own (its number,
  words, last seal; Versions, Compare, Copy as HTML, ×, on hover) in a folio
  at its page's foot, a soft rule above, mirrored as page numbers are. The
  active page's mark is a setting, **Page mark** (`appearance.facingMark`,
  as `data-facing-mark`; one look in `page/page-mark.css`, which a book's
  bookmark wears too, #40 Phase 4, at the page's outer edge, `data-edge`),
  none of them the seal's colour, each with its own
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
  Over the left page the bar keeps no room for the system's window
  controls: they stand over the right one.
  Too narrow for two pages beside the sidebar, the split is refused, and
  Eien says why.
- **New Window:** File → New Window (⇧⌘N) and a row's Open in New Window; a
  window opens on the vault and note it was asked from. Its title is its
  note's name. ⌘W closes the active side while split, the window otherwise.
- **The phone:** no split and no New Window; the back bar keeps the note you
  came from a tap away (⇄ and its name, a `--eien-radius-dot` slip at the
  bar's right), each keeping its place. Wider, Wide screen's rooms (below) may show
  two pages.
- **Lengths** (as built): the ones the arithmetic needs live once, in
  TypeScript beside it, not as CSS tokens: a page in a split at least 360px
  (`PAGE_MIN`, `src/ui/shell/pane-state.ts`); a companion 380px, at least
  300, the page beside it at least 400 (`COMPANION`,
  `src/ui/shell/split-state.ts`). One token is new, `--eien-radius-dot`
  (fully round: the phone's other-note slip, the theme cards' pills). Every
  other length above is a space, rule, mark or radius token.
- **Short of room** (decided and built 2026-10-28, #36): a bar's tools
  that don't fit fold behind one ⋯ at its end (`ui/chrome/fold.ts`, the
  "priority+" way): an `.icon-button` with the `more` icon, named "More
  tools", its menu the row menu's (icon, word, key; Focus mode a toggle's
  check, the views one choice with the dot), in the bar's order. Fit means every control inside the bar's content box,
  whose padding keeps clear of the corner and the system's controls. The
  order is `TOOL_FOLDS` (`ui/chrome/layout-spec.ts`); the strip never folds.
  Floating format slips wrap instead.

## Wide screen: foldables and tablets (decided 2026-10-27, built)

From `docs/design/explorations/tablet.md`: the owner chose all three, as one
setting of the phone's, **Wide screen** (`appearance.room`, as `data-room` on
the shell; the rules in `src/ui/phone/room.ts`). Under 520px (a phone held
upright) the phone is the phone; Panes needs the desktop's 600px; the desktop
is always Panes.

- **Panes** (the default): the desktop's panes and split, as built. Where a
  finger is the pointer (`pointer: coarse`), `--eien-control` and
  `--eien-row-h` are `--eien-touch` on the shell (a compact row
  `--eien-touch` less `--eien-space-2`), a pane's edge is `--eien-touch` wide
  to take hold of, its hairline in the middle, the page's tool bars scroll
  rather than run past the screen, and Running head's strip
  grows to `--eien-space-7` to hold them; the views' well keeps its inner
  buttons a step smaller, as the phone's bar does. The seal's button keeps its
  size and place, its reach a finger's.
- **One at a time:** the phone's stack at any width.
- **Side by side:** the phone's stack with the pane before in sight
  (`data-sight`): the pane beside (`data-beside`) as wide as its pane is
  (`--pane-sidebar`, `--pane-list`), dragged by its pane edge under the bar,
  a `--eien-rule` hairline at its right, the bar across both. Back names the
  pane it brings into sight.
- **Two pages:** the page always in sight; the notes or the contents slide
  over it from the left: `--eien-paper-raised`, a `--eien-rule-strong` edge,
  `--eien-shadow-float`, `min(85%, --eien-list-w + --eien-space-7)` wide, on
  the scrim, the page inert under them. A second page is the split, as the
  Split setting lays it out: the second note chosen from a list opens beside the first,
  and ⇄ opens the other note beside. The page isolates its stacking, so its
  scrim dims all it holds and never the notes over it. Folded, the split's
  pager stands in the phone's bar, before its tools. With Two pages when
  narrow, nothing folds: every mode's `least` is 0 (`splitSpecOf`), and
  under it the two share the room evenly.
- Settings shows a `wide` setting only while the room has panes, live.

## A quick look (decided 2026-10-28, #49; built: notes' half #105, shelf's half #114, after #40 Phase 1 #120; docs/quick-look.md)

From `docs/design/explorations/look.md` (`look-bar.html`): 1 · On the bar.

- **The control:** **Aa** (the `look` icon), the page's last tool after a
  hairline, in A's band, B's slip and C's running head; on the phone, the
  bar, slip or rail as the layout keeps them, and the ⋯. Named "Look", key
  ⇧⌘L, View → Look…; it folds last of the tools.
- **The popover:** what floats: raised paper, a `--eien-rule-strong`
  hairline, `--eien-radius-m`, the float shadow; as wide as the list
  (`--eien-list-w`), under the control, its end lined up with it. On the
  phone, a sheet from the screen's foot (`--eien-radius-l` at its top, no
  scrim, controls at `--eien-touch`, the faces one row that scrolls).
  - Its head is Settings' breadcrumb, LOOK / NOTES or LOOK / SHELF, with
    *every note* or *every book on the shelf* in pencil.
  - Then the settings marked `quick` in the schema, as Settings draws them,
    names only; Day or night says *every page*. All settings (⌘,) at its
    foot.
  - A change shows at once. Esc, the key again or a click outside closes
    it. Each setting is one stop for Tab; arrows choose within it.
- **Two pages:** while it's open with a note and a book side by side, the
  page it doesn't change sits back, in the tone the split already gives the
  page you aren't in (decided 2026-10-29; two notes wear the one look, so
  only a book beside a note needs it). Built (#120): `data-back` on its
  leaf (`vault/look-wiring.ts`), its paper `--eien-band`, the companion's
  page-you-aren't-in tone (`page/split.css`): the sheet, or the leaf in
  Facing pages and Page: Full, with `--eien-calm`'s transition. With a
  companion, Look makes the page it sets the one you're in, so the
  companion's own rule paints the other.
- **With a book in front,** one line at the popover's foot, in pencil:
  "Settings sets notes; this is every book's look." All settings opens
  Settings at Look, the notes' (decided 2026-10-29). Built (#120):
  `.quick-look__line`, the foot's first line, in the voice of
  `.quick-look__every` (the text face, `--eien-size-preview`, italic,
  `--eien-pencil`); the dialog is described by it.
- **Words and the sun:** an EPUB's look is the shelf's (SHELF, never
  BOOKS: a book is a writer's manuscript). The sidebar foot's sun stays,
  one press for Day or Night, beside the popover's.

## Reading EPUBs (decided 2026-10-28, #40; built: Phase 1, #112–#114; after Phase 1, #120; Phase 2, #122, #123, #125; FOLDERS for writing, SHELF for reading, #126; Phase 3, turning pages: the turn #129, pages #130, a hand #131, two pages and set as a book, 3d; Phase 4, page numbers, 4a; bookmarks, 4b; Marks in the list, 4c; on the edge, 4d; Phase 5, highlights, 5a; among the marks, 5b; Find, 5c)

From `docs/design/explorations/epub.md` ("Decided" and "After Phase 1").
Later phases add paging and the turn (Phase 3), marks, highlights and Find
in the book, each recorded here as it's built.

- **SHELF** (`sidebar/shelf-rows.ts`): a sidebar section between FOLDERS and
  TAGS, a lens over the one folder tree. A folder holding a book is
  FOLDERS' own folder row (the tree's twisty, focus ring, hover and drop
  target), its name in pencil, no count; it shuts and opens (open at first,
  kept per device) and has the folder's menu. A book's row is in ink-soft,
  and opens on the page. Books are never in a folder's note list.
- **FOLDERS for writing, SHELF for reading** (decided 2026-10-29): FOLDERS
  leaves out a folder of books alone (at any depth), which is on SHELF
  only; a folder of both is in both. Nothing dims: a section shows what its
  folders hold.
- **A book's row menu** (#120): the Row menu (Built patterns), the book's
  title its head: Rename (F2), Move to…, and the trash last in
  `--eien-danger` after a rule. Right-click, the menu key or Shift+F10 open
  it; F2 or a second click on the name renames in place with the Name
  field, the book's `.epub` faded after it as a note's `.md`.
- **The tools, by what's in sight** (decided 2026-10-29, replacing #120's
  greying in the bars): a tool shows only while the active page can use
  it. With a book active, a note's tools are set aside in the bars, never
  greyed (a greyed Bold says something false); the shared tools (Look,
  Split, the panes) keep their places, and the change is instant. The
  formatting bar's row keeps its height while a note is in sight, so
  neither page moves; with a book alone it goes. The phone's ⋯ and the
  menu bar grey the same commands (#120): a menu lists all the app does. A
  menu of the bar is never greyed, only its items.
- **A book's contents** (`list/contents-list.ts`): in the list pane while a
  book is open, a chapter's row a note's row without its preview or date
  (`.contents-row`), a part's chapters stepped in by `--eien-space-4` a
  level, the chapter you're in marked as a chosen note is. With two panes,
  under the book's row in SHELF, as an open folder's notes are; choosing
  another row folds them away.
- **The book's page** (`ui/epub/epub.css`): a chapter on the sheet, in the
  writer's own faces and the theme's colours, never the publisher's. The
  cleaner's named parts (`data-part`) are drawn from "A book's parts"
  tokens: the chapter title centred at the heading size, weight 500; the
  first line in capitals at 80%, tracked (the faces have no small
  capitals); a scene break centred in pencil; an epigraph indented and
  italic; a plate centred, never split, its caption smaller in pencil.
  Its paragraphs as the scroll style sets them (Phase 2): *As a note*, a
  note's in Reading, the gap between; *As a book*, no gap, a paragraph
  indented `--eien-epub-indent` only after another plain one, the first
  after a heading, a break, a picture or a centred line flush, and a named
  part's own gap kept. A book setting, in the shelf's quick look alone.
- **A chapter a sheet** (Phase 2): the chapter scrolls on the note's sheet.
  At its foot, the sheet's turns (`.sheet__turns`, shared with the
  extension's story page): a `--eien-rule-soft` hairline, `--eien-space-7`
  above it and `--eien-space-4` under, the chapters before and after as word
  buttons (label type, an arrow beside the name, `--eien-touch` high on a
  phone), the last one at the right; "The end" in label type at the last
  chapter. The colophon's items: "3 of 61", the page (Phase 4a: "page 212
  of 2,450", "page xii"; `.colophon__page`, a count, gone while none is
  known), "40% of the chapter", "12% of the book", the two percents
  dropped first under a 560px page pane, the page kept. In Facing pages
  they're the book's folio, as a note's figures are.
- **A bookmark** (Phase 4b, `epub/bookmark.css`): the Page mark's own look
  (`page/page-mark.css`: the ink-soft ribbon, the dog-ear with no ink, or
  the ink-soft edge tab), `.page__mark--bookmark`, at the sheet's outer top
  (`data-edge="right"`), the ribbon centred in the sheet's own margin
  (`--pad-x`). It hangs from a holder of no height that sticks to the top
  of the sheet in sight (`.epub-sheet__mark`), so scrolling it keeps to the
  page you see. In pages the edge tab stands past the fore-edge's pages
  still to read (`--edges-after` × `--eien-mark-w`); with Page frame Full,
  inside the page's edge. It arrives with the mark's own `--eien-calm`
  motion as it appears, none with reduced motion, and is hidden while a
  page curls (the turning page is a copy, which leaves it out). The word
  "bookmarked" is heard (visually hidden) where it isn't seen. **The
  clash** (decided 2026-10-30): with Facing pages and two pages, the mark
  says "the page you're in", so a bookmark wears none and the book's folio
  says "bookmarked" in its figures (`.colophon__bookmarked`, shown there
  alone). The tool, a ribbon icon pressed on a bookmarked page ("Take the
  bookmark off"), is a book's own (`on: 'epub'`), among the page's tools
  before Look; in Facing pages, in each page's folio. Its icon is a page
  with the ribbon over its top edge, filled while pressed: the page tells
  it from Pinned's banner.
- **A highlight** (Phase 5a, `epub/ink.ts`, `ink.css`; Features 1): a
  pencil line under the words (`--eien-epub-highlight-ink`, a mark's width,
  0.22em below, ink not skipped) and a pencil tick in the margin
  `--eien-epub-tick-inset` before each paragraph it touches, a border so
  forced colours keep it, in its own column's margin on a spread. Quieter
  than a wash, which is Find's. Painted over the page's own text by name
  (`::highlight(epub-highlight)`), never an element among the words; a turn's
  copy carries the same ink in elements of its own. The selection bar's
  first word is **Highlight**, "Take off the highlight" on words in one;
  taken off, the colophon's news offers **Put back** (a word button, last
  among the figures) while it shows. "highlighted" is heard, never seen, as
  "bookmarked" is (`.colophon__heard`).
- **Marks in the list** (Phase 4c, `list/book-lenses.ts`, `.css`): under
  the book's head in the list, Contents and Marks as word buttons, each
  with its count in a `.count`, the one shown pressed (every chosen word
  button's look: ink in a `--eien-rule-strong` hairline), as the views are
  a chosen one of a set. A bookmark's row is a contents row: its words in
  the text face at row size, the list's weight and leading, two lines at
  most; its page a count at the right; its chapter in pencil at preview
  size under them, and its kind after a middle dot ("Chapter III ·
  highlight", Phase 5b): a highlight's row is a bookmark's, its words
  those highlighted. None kept: the list's empty line, italic in pencil.
  With two panes the buttons are a line of their own (not a row) under the
  book's SHELF row, its bookmarks tree rows with their page as the count,
  and none kept the tree's own hint.
- **Find in a book** (Phase 5c): the window's own find bar (Built
  patterns, Find) over the book's page, unchanged, with no Replace. Every
  match in the chapter drawn is `--eien-epub-found` (the chosen row's
  `--eien-selected`), the one it's on `--eien-epub-found-current` (the
  selection's `--eien-seal-wash`): washes, never the highlight's pencil
  line; forced colours the system's Mark and Highlight. Scrolling, the
  match stands clear of the bar.
- **Found in the list** (Phase 5c, `list/found-rows.ts`): a third lens,
  Found, after Contents and Marks, disabled (no count) with nothing
  searched. A match's row is a Marks row: its words with the match marked
  as a note's Find match is (`--eien-selected` over a `--eien-rule-strong`
  hairline, `--eien-radius-s`), its page a count, its chapter in pencil. The
  search's line is the list's empty line, italic in pencil; it's a status
  only once the search is through. With two panes, tree rows under the
  book's SHELF row, the line the tree's hint.
- **Marks on the edge** (Phase 4d, `epub/edge-strip.ts`, `.css`): the
  whole book down the page pane's outer edge, `--eien-space-5` wide,
  `--eien-space-4` in from it (the system's scroll bar keeps its own),
  `--eien-space-5` from the pane's top and foot; in pages the pane keeps
  room for it beside the fore-edge. A `--eien-rule-strong` hairline
  `--eien-space-2` long for each chapter, `--eien-space-3` in pencil each
  tenth; each bookmark a pencil tab (`--eien-paper` in a pencil hairline,
  `--eien-space-1` × `--eien-space-3`, its outer corners
  `--eien-radius-s`); each highlight a pencil tick past the tabs (Phase 5b:
  the margin tick's ink and width, `--eien-space-2` high, a border); the place an ink-soft bar `--eien-mark-w` high
  across the strip, never a tab (decided 2026-10-30, so it's never taken
  for an edge-tab bookmark), moving with `--eien-calm`. Pointing, the
  tooltip's look beside the point (raised paper, a rule-strong hairline,
  the float shadow, label type). Focused, the focus ink's outline (as a
  pane's edge's, kept by forced colours). On a touch screen,
  `--eien-touch` wide with a `--eien-rule` hairline down its middle, and
  in pages the pane keeps that much room. On Facing pages' left page it
  stands at the left. The list shows the contents alone.
- **The place is kept to the line**, never drawn: a page put back, laid out
  anew or zoomed shows the same line at its top.
- **A note over the page** (Phase 2b, `ui/epub/note-over.ts`): a note's
  reference pressed floats the note under it as a menu floats (`.menu`:
  raised paper, a `--eien-rule-strong` hairline, `--eien-radius-m`, the
  float shadow), as wide as the list at most, `--eien-space-2` round the
  note's words in the book's own face (`data-face`); **Go to the note**, a
  word button, under them. A dialog that takes the keyboard; Esc, a click
  elsewhere or the page scrolling closes it.
- **A link in a book** looks as a link on the extension's story page does,
  one rule for both (`page/page.css`, `.prose a[href]`, `.epub-chapter
  a[href]`): the words' own colour, a `--eien-rule-strong` underline 0.18em
  below them, `currentColor` under the pointer. The window's tooltip names
  where it goes. A link kept as words alone has no look of one.
- **Back** after a link: a word button first in the colophon's figures
  ("Back to Chapter I"), there only while there's a step back.
- **Quote** (Phase 2c): words chosen in a book show the selection bar
  (spec §4's, `.selection-bar`: raised paper above the selection, the
  float shadow) with its commands as words, **Quote in the note** and
  **Copy**; never on a touch screen, whose own callout is over the words
  (the page's ⋯ has Quote). The quote arrives in the note as Markdown, `>`
  and the citation in an em dash: `— Pride and Prejudice, Chapter III`.
  What happened is said in the colophon ("Quoted in At the Assembly.").
- **A note's reference and a note** are named (`note-ref`, `note`) to open
  the note over the page, and drawn as the book sets them: the reference
  in the publisher's own superscript, the note as its paragraphs. No style
  of their own (Phase 2b); one comes if they're missed.
- **The book's look is the shelf's:** its typeface, text size, line spacing,
  width and frame, set in the quick look with a book in front, worn on its
  leaf (`data-face`, `data-frame`, `--eien-text-scale`, `--look-lead`,
  `--look-width`), never on `<html>`. Day or night stays the window's.
- **In a split,** both pages lie in the window's frame (the notes' Page), so
  the modes' marks read as one arrangement; the book keeps the rest of its
  look (decided 2026-10-29).
- **Pages** (Phase 3b, Pages 2's leaf): the sheet fills the pane, the
  chapter in pages as tall as the whole lines they hold, its paragraphs a
  book's, its foot gone (turning goes on). The fore-edge lies under the
  sheet's sides, up to six paper edges in `--eien-rule` hairlines on
  `--eien-paper`, `--eien-mark-w` apart, in sixths of the book read and to
  go; none in Page frame Full. Each side, `--eien-space-3` wide beside the
  sheet, is a button (Previous page, Next page) with the `e-resize` and
  `w-resize` cursors. The book's own tools, Pages and Scroll (a page with
  its corner, a sheet that scrolls), stand in the views' place, a note's
  set aside with a book, and theirs with a note.
- **The turn** (Phase 3a, 3b): Curl (the default), Slide or Words, each
  as the approved explorations move them, on `--eien-ease`, each time a
  multiple of `--eien-calm` (or `--eien-quick`) times the Turn speed,
  instant with reduced motion. The curl's light is the one exception
  under Depth: its pieces are copies of the page in sight, clipped to the
  pane.

- **Two pages** (Phase 3d, Pages 1's spread, `ui/epub/epub-spread.css`):
  where the pane holds two pages of 20em of the text, with the sheet's
  margins and the gutter, the sheet widens to two pages, each at most the
  measure (Page width still narrows them), the text blocks
  `--eien-space-8` apart and Facing pages' `--eien-rule-soft` hairline down
  the gutter's middle. One sheet, its one shadow, no fold shading. Never on
  a phone (one pane at a time) or in a split. A turn moves the spread.
  Under Curl one page turns round the gutter (decided 2026-10-31), its
  running head and folio with it: on, the right page; back, the left; the
  other lies still until it lands. The fore-edge stands at its outer sides
  (Previous pages, Next pages). A bookmark's mark sits on the page it
  marks: the verso's at its left, its edge tab past the pages read
  (`--edges-before`). The colophon says "pages 212–213 of 2,450".
- **Set as a book** (Phase 3d, Showcase 2, `ui/epub/epub-set.css`), in
  pages alone: justified and hyphenated (`hyphenate-limit-chars: 6 3 2`),
  `text-wrap: pretty`, widows and orphans 2; ragged but hyphenated on a
  phone and on a page under 520px; ragged where the window can't hyphenate
  the book's language (`ui/epub/hyphens.ts`). A chapter opens four lines
  low (two on a phone), on the text's own line (`--line`). The running
  heads in label type, off an opening page: the chapter's over one page;
  the book's title over the verso and the chapter's over the recto. The
  folios in counts at the outer corners, the page numbers' own labels.
  Each keeps its line when empty; in pages they take the folders' crumbs'
  place. Before the first chapter, Eien's **title page** (the title at 1.5 ×
  the title size, a `--eien-space-7` hairline in `--eien-rule` under it, the
  author in tracked capitals at preview size in ink-soft, the folders at the
  foot in label type) and, facing it, the **imprint** at its foot: "This
  copy" in label type, then its lines in the mono at meta size in pencil,
  the title in italic and the face's name in the text face. Neither is the
  book's words: never chosen, counted or marked.

## A link in Live (decided 2026-10-29, #38; built)

From `docs/design/explorations/links.md`: all three, as one setting of the
editor's, **Link editing** (`editor.links`): the Card by default on the
desktop, the Bar on a phone (`phoneDefault`). A plain click places the caret;
⌘-click follows; the tools' Open is the plain way. A link stays as Live draws
it: ink, a `--eien-rule-strong` underline, no colour of its own.

- **Card** (`.link-card`): what floats, as a menu: raised paper, a
  `--eien-rule-strong` hairline, `--eien-radius-m`, the float shadow; the
  list's width (`--eien-list-w`), a phone's sheet less `--eien-space-4` each
  side. Its body is the note row's anatomy, `--eien-space-3` round: the
  folders in label type, the title (text face, 500), the first line in pencil
  at preview size, the words as a count; a web link's site in the mono in ink
  and the rest in pencil; a note not made yet, NO NOTE YET and its name in
  italic. Its tools after a `--eien-rule-soft` rule: Open, Edit, Take off, and
  "⌘-click opens" in label type. Edit turns it into two `.field`s, Words in
  the text face and Goes to in the mono, ↩ keeps, Esc puts back, leaving
  keeps. On `hover: none` the tools are 44px with their words.
- **In place**: no surface. The caret's link opens its own marks
  (`linkInPlace`), the address in `--eien-face-source`, Rename's 2px focus
  mark under the part with the caret, ↗ a step short of a control after it
  (its reach a finger's on a phone). A hover is said in the colophon.
- **Bar** (`.link-bar`): the selection bar's surface exactly; the kind's icon
  in pencil, where it goes (a note's title in the text face, an address in
  the mono, cut at 26ch), a rule, Open, Edit, Take off. A hover gets a
  tooltip in the window's own look. On `hover: none` it docks over the
  colophon on the band, a rule above, no shadow, 44px, as the table's bar.
- **Every way:** ⌥↩ opens, ⌘K edits, ⌥F10 to the tools (one tab stop, the
  arrows along them), Esc back; they step aside while you type; a screen
  reader hears where a link goes as the caret reaches it.

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
  (`.quiet-row`: a sidebar section, the list's head, the sidebar's search row, where two panes put the chosen row's filter and sort, with no head; the sheet, for its ×) is
  hovered, or they have the keyboard, are open (`aria-expanded`), pressed or
  on; always shown on `hover: none`. A layer that turns its own on
  (`.quiet-own`: the table editor's) isn't lit by the row round it. Their own
  hover, press and focus are the icon button's.
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
- **Find** (`ui/find/find-bar.ts`, `find/find.css`, #41): a slip laid
  at the page's top right (under a companion's head), `--eien-space-2` from
  its top, `--eien-space-4` from its edge: raised paper in a `--eien-rule-strong`
  hairline, `--eien-radius-m`, and no shadow (borders only: it lies on the
  page, quieter than the words). Its rows: the quiet twisty (Find and
  replace, turning 90°), the Find field (`.field`, a control high), the
  count (`.count`; caution ink for a pattern that can't be read), the three
  options as quiet toggles (Match case, Whole word, Pattern; on is the icon
  button's pressed state), then previous, next and close; unfolded, the
  Replace field under them and Replace and Replace all under the moves. A
  narrow page drops the count and options under the field. In the text, a
  match is `--eien-selected` over a `--eien-rule-strong` hairline; the
  current one is the selection, `--eien-seal-wash` over a `--eien-mark-w`
  mark in the focus ink.
- **Formatting bar**: the `format` slot's host. Band's second row on the
  band ground; Slip's own raised slip at the blotter's top left; Running
  head's raised rail down the margin. Its buttons have the icon control's
  states, pressed where the format is on at the caret.

## The browser extension (Eien Reader)

The extension (spec §14) shows a story from AO3 or FanFiction.Net in Eien's
look, out of the same tokens, faces and pieces; its own styles are
`src/ui/extension/story-page.css` and `popup-page.css`.

- **The page:** Band's furniture without the panes: a band of `--band`
  (the seal and the site's name in label type at its left; previous and
  next chapter, a hairline, day or night and × as icon controls at its
  right), the blotter with the sheet, and the colophon (words · chapter ii
  of 12 · 41% read, the dots faded).
- **The sheet:** the app's own (`page/page.css`): the running head in label
  type (FANDOM / TITLE / II), the title, then "by Rook" in the text face at
  row size in ink-soft. What the site says of the work is a fold, "About
  this work" in label type, its facts a two-column list: the labels in
  label type, the values in the text face at preview size, joined by " · ".
- **The site's notes** (a summary, the author's notes, before and after a
  chapter): a hairline in `--eien-rule` at their left, the name in label
  type above, the words at row size in ink-soft, so the story's own words
  stay the loudest thing on the sheet.
- **A chapter:** its number centred in label type (CHAPTER IV, in the
  chosen numerals), its own title under it in the text face at heading
  size, 500. The words at the face's prose size, leading and measure,
  paragraphs `--eien-paragraph-gap` apart; a rule is Eien's scene break; a
  quote has a 2px `--eien-rule-strong` mark; a link is ink, underlined in
  `--eien-rule-strong`; where the site centres or right-aligns a block, so
  does the sheet. The turns to the chapters beside are word buttons at the
  sheet's foot, after a soft rule.
- **On the site's page:** the seal itself, 44px (a touch target), in the
  page's bottom-right corner, 16px from its edges, in the theme's seal colour
  by day or night with the glyph in `--eien-on-seal`'s colours, the
  stamp's 2px corners. It is the reader's way in, so it is the seal: the
  mark of the app.
- **The popup:** a band head with the seal and "Eien Reader"; the page's
  story and Read in Eien; then the settings as Settings draws them (theme
  cards two to a row, face cards, the segmented wells, the stepper), names
  only: the app's descriptions speak of the app.

