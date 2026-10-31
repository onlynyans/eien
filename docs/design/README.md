# Eien — design

The look and feel of Eien, and the rules the interface code follows. Every
value is a token: the app's `src/ui/theme/tokens.css` is their source, and
this file documents them.

> **A snapshot:** the mockups below (specimen, desktop and phone, with their CSS, JS and `tokens.css`) are the design as approved on 2026-10-20, kept for their reasoning and never copied from. Eien's look now is [.interface-design/system.md](../../.interface-design/system.md) (AGENTS.md → Rules → How something looks).

| File | What it shows |
|---|---|
| [specimen.html](specimen.html) | Every colour and surface, the depth stack, every ink's contrast on every surface, the four text faces side by side and the mono, the seal, rows and their states, the diff style, the spacing scale — day and night side by side |
| [desktop.html](desktop.html) | The app window: three panes, two-pane mode, collapsing and resizing, the page's views, Compare, Seal, Versions |
| [phone.html](phone.html) | The phone: contents → index → page, one at a time, controls behind ⋯ |
| [tokens.css](tokens.css) | The mockups' tokens, day and night, in the Washi palette: a snapshot of the design pass at stage 3 (#54), frozen. The source is the app's `src/ui/theme/tokens.css`, which has the tokens added since; the snapshot keeps the mockups' own font names and the old `--eien-radius` |
| [themes/otaku.css](themes/otaku.css) | The Otaku palette: Otaku's colours on Eien's colour tokens, day and night |
| [choices.js](choices.js) | The mockups' settings — FACE, PALETTE (Washi · Otaku), DENSITY (Comfortable · Compact), PAGE (Sheet · Full) and CHAPTERS (i ii iii · 1 2 3): sets `data-face`, `data-palette`, `data-density`, `data-frame` and `data-numerals` before the page draws and keeps each choice |
| [fonts.css](fonts.css), [fonts/](fonts/) | Newsreader, Literata, IBM Plex Sans, Source Sans 3, Atkinson Hyperlegible Next, Schibsted Grotesk, Hanken Grotesk, Instrument Sans and IBM Plex Mono, bundled (SIL Open Font License) |
| [base.css](base.css) | The pieces every screen shares: the seal, labels, word-buttons, fields, focus |
| [references.md](references.md) | The reference screenshots, what reads well in each, and the surface values that came of it |
| [explorations/](explorations/README.md) | The design passes after these mockups (stages 2 and 3): the three layouts, Settings, tags, themes, your order; the components as built at the end of [explorations/specimen.html](explorations/specimen.html). Then editing a table in Live ([tables.md](explorations/tables.md)) and the window's corner in Band and Slip ([corner.md](explorations/corner.md)), chosen and built; and the split window's four modes ([split.md](explorations/split.md), [split-alt.md](explorations/split-alt.md)), chosen and built |

To view them, serve this folder (fonts don't load from `file://`):

```bash
python3 -m http.server 4173 --directory docs/design
```

then open <http://127.0.0.1:4173/specimen.html>.

## Who it's for

A writer, often late at night, three scenes into a chapter, who also keeps
hundreds of notes. What they do most: write the next scene, find a note,
reorder chapters, seal a version and compare against it, copy a chapter to
post it. The interface must never be louder than the page.

## Direction: a book on a desk at night

*Eien* (永遠) means "forever". Eien's first rule is that words are never lost,
so permanence is the theme.

- **The sidebar is the desk**: navigation, a clear step darker than anything
  else by day, so one glance tells you where you are.
- **The note list and the note are washi paper**: near-white, with near-black
  ink. Reading always happens on the lightest surface.
- **The sheet lies on a blotter**, the light warm grey of the page pane. It is
  square-cornered, with a hairline edge and one soft shadow: the object on the
  desk.
- **Bands** — the list's head, the page's control strip, the colophon — sit on
  a tone between blotter and paper, capped by a hairline.
- **What floats is raised paper**: menus and the versions panel, white, with
  their own soft shadow.
- **Words are sumi ink**, in four strengths: ink, iron-gall, graphite, faded.
- **Night is inkstone**: the same warm hues darkened, never grey-blue, in the
  same order — darker is further back.

| Surface | Token | Where |
|---|---|---|
| Desk | `--eien-desk` | the sidebar (on the phone, the contents) |
| Blotter | `--eien-blotter` | the page pane around the sheet; the ground of these mockups |
| Band | `--eien-band` | the list's head, the page's control strip, the colophon, Compare's strip |
| Paper | `--eien-paper` | the note list (the phone's index) and the sheet |
| Raised paper | `--eien-paper-raised` | menus, the versions panel, the phone's bottom sheet, a row being dragged |
| Field | `--eien-field` | a field at rest: a wash of the ink, so it's set into the pane (2026-10-22) |
| Well | `--eien-well` | inside a field with the keyboard |
| Selected | `--eien-selected` | the chosen row, beside the seal's rule |

### The seal

The signature. A vermilion square with 永 pressed into it. ⌘S *seals* the
note: it keeps this version for good. The seal appears in exactly these
places, and its rarity is its meaning:

1. the app's mark, top-left (and the way home on the phone)
2. each sealed version in a note's versions
3. "▪ sealed 2h ago" in the status line
4. the short rule beside the selected row (the row itself takes a neutral
   fill, `--eien-selected`)
5. the caret, and the text selection it makes (`--eien-seal-wash`, the one
   use of the wash)

Nothing else is vermilion: a chosen button is ink in a hairline, keyboard
focus is an ink ring, a selected row's ground is neutral, and removed words
are carmine (the editor's pencil), not the seal.

Words: a checkpoint is a **seal**; a named version is a **named seal**.

### Two voices

| Voice | Face | For |
|---|---|---|
| Text | Newsreader (the default) or Literata; or the sans-serifs IBM Plex Sans, Source Sans 3, Atkinson Hyperlegible Next, Schibsted Grotesk, Hanken Grotesk or Instrument Sans: the writer's choice | Anything a person wrote: note text, titles, folder and note names, previews |
| Machine | IBM Plex Mono (by default: a setting since 2026-10-20, see below) | Anything the machine counts or you press: counts, dates, labels (in capitals), buttons, the status line, the Source view |

The test: *could a person have written it?* The text face. *Did the machine
count it, or do you press it?* The mono.

- **The text face is the writer's choice.** Everything a person wrote uses
  it, whichever it is; the machine voice keeps its own face (a setting of
  its own) and never changes with it.
- The choice is `data-face` on `<html>`: `newsreader` (or no attribute),
  `literata`, `plex-sans`, `source-sans`, `atkinson`, `schibsted`, `hanken`,
  `instrument`. Each face carries its own sizes, prose leading and measure in
  `tokens.css`, tuned by eye so the page reads at the same size and line length
  in all eight (Newsreader's x-height is small, so it is set larger; the
  sans-serifs' are large, so they are set smaller). Every mockup has a FACE
  control; `choices.js` keeps it, with the faces' names in one list.
- The sans-serifs, and why each: IBM Plex Sans (engineered, the mono's own
  family), Source Sans 3 (warm and open, made to sit beside a book face; the
  widest language coverage), Atkinson Hyperlegible Next (letters that can't be
  mistaken for each other, for tired eyes), Schibsted Grotesk (a newspaper
  sans, editorial, a partner to Newsreader), Hanken Grotesk (soft and rounded),
  Instrument Sans (crisp and modern).

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
  they live behind one ⋯. (Changed 2026-10-20: controls are icons. See
  "Changed since approval" below.)

## Rules for the interface code

1. Every colour, face, size, space and duration is a token from
   `src/ui/theme/tokens.css`.
   A theme or palette overrides tokens and nothing else.
2. Depth is surface tone plus hairlines, and exactly two shadows: the sheet
   casts `--eien-shadow-sheet`, because it is the object you work on and must
   read as lying on the blotter; and whatever floats above the window — a
   menu, the versions panel, the phone's bottom sheet, a row being dragged —
   casts `--eien-shadow-float`, because it covers what is under it and must
   read as above it. Panes, bands and rows cast none. No gradients, square
   corners (only dots are round). (Changed 2026-10-20: not everything is
   square. See below.)
3. One accent: the seal, in its five places only. Status colours mean status:
   moss for added words, carmine for removed words and delete, ochre for a
   conflict.
4. Colour is never the only signal. A selected row has the seal rule and a
   neutral fill; a removed word is struck through and tinted; a conflict says
   "conflict".
5. Text reaches 4.5:1 contrast on every surface it sits on — desk, blotter,
   band, well, paper, selected, raised — in both schemes and every palette
   (checked; the specimen measures it live). Faded is only for placeholders
   and disabled things, and reaches 3:1.
6. Every control has hover, pressed, keyboard focus and disabled states, and
   works from the keyboard. Touch targets are at least 44px.
7. Nothing moves the writer didn't ask to move. Transitions are quick and
   quiet, and none with reduced motion.

## Palettes and schemes

Two separate choices, and every combination works:

- **A palette is a set of colours.** Washi, Eien's own, is the default:
  `tokens.css` with no attribute. Otaku (`themes/otaku.css`) sets
  `data-palette="otaku"` on `<html>` and overrides only the colour tokens —
  surfaces, shadows, inks, rules, the seal and status. Faces, sizes, spaces
  and motion stay Eien's.
- **The app's gallery** (spec §7, `src/core/themes`) adds Linen, Indigo,
  Moss, Candlelight, Ink and Blossom (and names Washi Paper, Otaku Slate), and the writer's own themes in
  `.eien/themes/`, mixed from four choices. Those are worn as overrides of
  the colour tokens on `<html>` (`data-palette` is the theme's id, or
  `mine`): the surfaces, inks, seal and status inks, with the rules,
  washes, hover, press, raised and well worked out from them. Each theme
  has its own seal colour, and still nothing else is that colour.
- **A scheme is day, night or the system's.** It is `color-scheme` on the root
  (`data-theme="light"` or `"dark"`, or neither to follow the system), and each
  colour token is written as `light-dark(day, night)`.
- **Every palette defines both schemes**, keeps the same surface order (darker
  is further back), and meets the same contrast rules. A palette borrowed from
  elsewhere keeps its colours but takes Eien's depth: its steps are spread until
  the sidebar, the list and the page read apart at a glance.

In the mockups, WASHI · OTAKU sits beside the theme control (the desktop's
mockup bar, the phone page's top and its Settings sheet, the specimen's title
page) and is remembered in `localStorage`.

## Density

A setting with two values: **Comfortable** (the default) and **Compact**,
`data-density="compact"` on `<html>`. Compact keeps the type at its size and
takes away space: narrower sheet margins, a thinner blotter round the sheet,
tighter paragraphs and lines (each face's leading less 0.14), shorter rows,
and the note list without its line of preview. It's expressed only in tokens
(`--eien-sheet-pad-x`, `--eien-sheet-pad-top`, `--eien-sheet-gutter`,
`--eien-title-gap`, `--eien-paragraph-gap`, `--eien-leading-tighten`,
`--eien-row-h`, `--eien-row-pad-y`, `--eien-list-preview`), so no component
asks which density it's in.

## Page frame

A setting separate from density, so it works with either: **Sheet** (the
default) lays the page on the blotter with a hairline edge and the sheet's
shadow; **Full** (`data-frame="full"`) takes the frame away, so the third pane
is paper from edge to edge, with no gap, edge or shadow, and the text keeps its
line length, centred. Tokens: `--eien-page-ground`, `--eien-page-gutter` (the
density's `--eien-sheet-gutter` with a sheet, none full), `--eien-sheet-edge`,
`--eien-sheet-lift`. A book's page (#40) wears its own frame: the tokens are set
on `[data-frame]` as on `<html>`, and its leaf (always marked) paints its own
ground.

A book's page wears the rest of its own look the same way, on its leaf: its
`data-face` (always set, so it never takes the notes'), and
`--eien-text-scale`, `--look-lead` and `--look-width`, from the shelf's
settings (`epub.<key>`, set in the quick look with a book in front).

## Line spacing and page width

Two settings (#49, the quick look), each a step either side of the face's own
tuning, so all eight faces still read alike: **Line spacing** (Tight, As set,
Loose: × 0.9, 1, 1.12 of `--eien-leading-prose`) and **Page width** (Narrow,
As set, Wide: × 0.84, 1, 1.18 of `--eien-measure`). No design token: two local
multipliers on `<html>`, `--look-lead` and `--look-width`, set by
`ui/settings/look-properties.ts` and taken off at As set, as `--runhead-ground`
is. The editor's lines (every view), Compare's and Settings' Type sample take
the first; the sheet's width (Narrow also narrows a sheet that fills its pane)
and the empty page's the second.

## An EPUB's parts

An EPUB's chapter (#40) is drawn from cleaned nodes, its parts named by the
cleaner (`data-part`): chapter title, scene break, epigraph, plate, caption,
first line. One stylesheet, `ui/epub/epub.css`, draws them from tokens of
their own, each made from a note's, so a book's look is tuned without
touching notes: `--eien-epub-title-size` (the list's heading size),
`--eien-epub-title-gap` (a note's title gap), `--eien-epub-paragraph-gap`,
`--eien-epub-break-gap` (a scene break's), `--eien-epub-epigraph-indent`
(space-6), `--eien-epub-plate-gap` (space-5), `--eien-epub-caption-ink`
(pencil), `--eien-epub-first-line-track` (half the label's tracking: the
first line in capitals at 80%, as the bundled faces have no small capitals),
and for the scroll style *As a book* (Phase 2) `--eien-epub-indent`
(space-6), a paragraph's indent with no gap, a step less (space-5) on a page
under 520px (a phone's).
The book is set in the writer's own faces, never the publisher's; its
colours are the theme's, so it reads by Night.

Ink over a book's words (Phase 5, `ui/epub/ink.css`), painted by the CSS
Custom Highlight API over the page's own text: a highlight is
`--eien-epub-highlight-ink` (pencil), `--eien-epub-highlight-w` thick (a
mark's width), `--eien-epub-highlight-offset` (0.22em) under the words, and
a tick in the margin in the same ink and width, `--eien-epub-tick-inset`
(space-4) before the block's lines, its ends `--eien-epub-tick-trim` (0.35em)
in from the block's top and foot, so it spans the lines' ink and not their
leading. Find's matches are washes, never the pencil line, so the two never
look alike: every match `--eien-epub-found` (the chosen row's
`--eien-selected`), the one Find is on `--eien-epub-found-current` (the
selection's `--eien-seal-wash`).

## A page turning

A book's page turns (#40, Phase 3) by the Page turn setting: Curl, Slide or
Words. At rest every page is flat paper, as Depth asks. While a page turns as
a curl, and only then, it carries light, Depth's one exception
(`.interface-design/system.md`), from three tokens in `tokens.css`:

- `--eien-curl-shade` (by day the sheet shadow's own ink at 0.18, by night
  black at 0.5): where paper bends away, the roll's shadow on the page
  beneath, and the lifted paper's one soft shadow (`drop-shadow` at
  `--eien-space-2`), a third shadow there only while the page moves;
- `--eien-curl-light` (white at 0.6 by day, the night's ink at 0.1): the
  crest of the roll catching the light, and the glint past it;
- `--eien-curl-through` (0.12): how much of the words shows through the
  paper's back.

Like the shadows, the two inks are a palette's (`slate.css` has its own
pair), never a writer's theme's: a theme's night ink is pale, and a shade
made from it would lighten the page. The gradients are these inks ramped across the roll's strips
(`core/epub/turn/light.ts`), each stop `color-mix` of the ink and
transparent, never a colour of their own; the washes along the fold run
`--eien-space-6` (the shadow) and `--eien-space-5` (the crest). Every time is
the calm or quick time: the curl lands in 1.5 × `--eien-calm`, Slide takes
`--eien-calm`, Words `--eien-quick` out and `--eien-calm` in, a
`--eien-space-2` step; each times the Turn speed. With reduced motion the
times are 0, so the page changes at once. The approved motion is
[explorations/epub-flip-curl.html](explorations/epub-flip-curl.html).

## Chapter numbers

A book numbers its chapters in the note list and the breadcrumb: roman
(i, ii, iii — the default) or plain numbers (1, 2, 3), a setting
(`data-numerals="arabic"` in the mockups). The words stay in the mono either
way; only the figures change. One helper makes every number
(`eienChapterNumber` in `choices.js`; in the app, one function in `core`).

## Known gaps

- IBM Plex Mono, as bundled (Latin and Latin Extended), has `·` but no `←`,
  `≡`, `⋯`, `▸`, `▾` or `⁂` (checked in the font files' cmaps). `⁂` lies inside
  the Latin file's range, so Plex Mono itself lacks it; the others lie outside
  both files' ranges. None of the four text faces has them either. The
  mockups fall back to a system face for them; the app will draw these marks
  (CSS or small SVGs in ink), not rely on a fallback font.
- The seal's 永 is set in the system's Mincho here (`--eien-face-seal`); the
  app ships the seal as an SVG so it looks the same on every system.

## Since phase 3

The app's tokens, base styles and fonts live in `src/ui/theme/`, which is
now their source (since phase 5 with every face, compact density, the full
page and the Otaku palette); this folder keeps the design as it was approved. The
mockups' behaviour is a guide, not code to copy: the app's interface is
built fresh, in modules, against the spec.

## Changed since approval

On 2026-10-20 the owner changed four decisions. The mockups here still show
the approved design; `.interface-design/system.md` holds the current one,
and the design pass brings the mockups up to it. Each is in
[the backlog](../backlog.md).

- **Controls are icons, not words** (#26). "A control is a word" was approved
  by mistake. Labels, counts and a menu's items stay words, in the mono.
- **Not everything is square** (#27). A small radius scale, set by the
  design pass. Dots stay round. Built: `--eien-radius-s`, `-m` and `-l` in
  `tokens.css` (Band's 2/4/8), and `--eien-radius-dot` for what's fully round
  (a pill, the phone's other-note slip), each layout setting its own in its stylesheet
  (`src/ui/chrome/*.css`); with them, the icons' tokens `--eien-icon`,
  `--eien-icon-stroke` and `--eien-control`.
- **The machine voice's face is a setting** (#24), Interface font, IBM Plex
  Mono by default; the Source view's is another, Source font (2026-10-22).
  Built: each bundled face's family is one token, `--eien-family-<id>`
  (eleven monos, `plex-mono` … `comic-mono`, then `newsreader` …
  `instrument`); `--eien-face-mono`, `--eien-face-source` and each
  `[data-face]`'s `--eien-face-text` name one. Interface font sets
  `--eien-face-mono` and two machine sizes (`--eien-size-meta`, `-label`);
  Source font sets `--eien-face-source` and `--eien-size-source`, each from
  the face's own (`src/core/config/faces.ts`).
- **Row names' weight is a setting** (#25): the sidebar's names and the
  list's titles, 400–700 each. A selected list title is 100 heavier, at most
  700. Built: `--eien-weight-tree`, `--eien-weight-list` and
  `--eien-weight-list-chosen` (400, 400, 500 in `tokens.css`).
