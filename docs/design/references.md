# References: what reads well, and why

Five screenshots the client finds easy (or hard) to read, and what Eien takes
from each. The verdict at the end is the brief for the second pass.

## 1. Eien, first pass — too flat

The sidebar, the note list and the ground around the page are one sand tone
(`--eien-desk`), and the sheet is only a few points lighter. With nothing to
tell ground from content, the eye has to work out where it is on every glance,
and a whole window of warm sand tires it. Selected rows add a pink wash to the
sand, which muddies rather than marks.

What works and stays: the two voices and the hairlines; the type hierarchy;
the colophon; words for controls; the seal used sparingly.

## 2. Otaku — depth, but not enough

- **Three tones, cool around warm.** A slightly darker cool-grey rail, a lighter
  cool-grey contents panel, a cool-grey desk, and a warm near-white page. The
  temperature change does as much as the lightness change: chrome is cool,
  content is warm, so the page reads as *the* object.
- **The page is a real object**: near-white, a 1px edge, large, with generous
  margins. A tinted band at its foot holds the composer.
- **One strong ink action**: Send is solid ink, the only filled control.
- **Weakness**: the three greys sit within a few points of each other; the rail
  and the panel nearly merge.

## 3. Notable — you always know where you are

- **Navigation and content are different worlds**: a dark slate sidebar with
  light text, against a white list and a white editor. One glance places you.
- **Content is white with near-black text**: the highest contrast available,
  so reading costs nothing.
- **A light-grey toolbar band** with bordered buttons caps the content area.
- **The selected list row is a neutral grey fill**, with no colour at all —
  calm, and impossible to miss against white.
- **List and editor are separated by one hairline**, not by tone.

## 4. Supabase table — structure from hairlines on white

- **White ground; the container is lifted** by a 1px border and a very soft,
  wide shadow. Nothing else casts one.
- **Header rows are a light-grey band** (a few points below white) — the band
  says "this is a heading" without colour.
- **Pairs of ink strengths**: a column's name dark, its type muted, side by
  side. Hierarchy from contrast, not size.
- **Rows divided by hairlines**, never by alternating fills.
- **Quiet controls** are white with a hairline border; **the one primary
  action** is filled.

## 5. Supabase docs — monospace labels on white

- **Uppercase monospace section labels** (ENVIRONMENTS, ON THIS PAGE) — the
  same idea as Eien's typewriter labels, and they read crisply because they sit
  on white with real contrast.
- **The active item**: a vertical bar beside it plus darker or coloured text.
- **Groups divided by hairlines** in the nav.
- **A menu floats**: white, hairline edge, soft shadow — clearly above the page.
- **Long text on white**, large, with generous leading.

## What they share

1. **Content sits on the lightest surface**, with near-black text. Reading
   happens on white (or near-white), never on a tint.
2. **Navigation is visibly not content**: darker (Notable, Otaku's rail) or set
   apart by a hairline and space on white (Supabase).
3. **At least three clearly separate tones**: chrome, a band for headings and
   toolbars, and the content surface — each step large enough to see at a
   glance, not only side by side.
4. **Shadows only for what floats or is the object**: one soft shadow on the
   page or container, one on menus. Panes cast none.
5. **Selection is quiet**: a neutral fill or a bar. Colour, if any, sits on the
   bar, not on the whole row.

## Second-pass direction: lift the paper

The book-on-a-desk idea stays; the desk just becomes clearly *not* the paper.

| Surface | Token | Day | Night | Used for |
|---|---|---|---|---|
| Desk | `--eien-desk` | `#d9d2c8` warm grey, clearly below paper (OKLCH L 0.87) | `#110e0b` darkest (L 0.17) | the sidebar: navigation |
| Blotter | `--eien-blotter` | `#eae5dd` light warm grey (L 0.92) | `#1a1713` (L 0.21) | the ground around the sheet |
| Band | `--eien-band` | `#f4f1ea` between blotter and paper (L 0.96) | `#201d19` (L 0.23) | the list's head, the page's control strip, the colophon |
| Paper | `--eien-paper` | `#fdfbf7` near-white, warm (L 0.99) | `#28241f` lightest panel (L 0.26) | the note list and the sheet: content |
| Raised paper | `--eien-paper-raised` | `#ffffff` white | `#312d28` one step above paper (L 0.30) | menus, the versions panel |
| Well | `--eien-well` | `#f9f7f3` | `#24201c` | inside a field, on the band |
| Selected | `--eien-selected` | `#ede9e3` (darker than paper, lighter than desk) | `#38332e` | the chosen row, with the seal's rule |

Shadows: `--eien-shadow-sheet` (1px/2px and 6px/24px, warm umber at 6% and
8% by day; black at 40% and 45% by night) and `--eien-shadow-float` (2px/6px
and 14px/36px, 8% and 16% by day; 45% and 60% by night). Night's hairlines are
stronger than day's (`--eien-rule` at 14% against 13%), since its tone steps
are smaller.

Measured contrast (WCAG), lowest of each ink across every surface above plus
the desk and paper under hover:

| Ink | Day | Night |
|---|---|---|
| ink `#23201c` / `#e9e2d4` | 10.0 (desk, hovered) · 15.7 on paper | 9.7 (selected) · 12.0 on paper |
| ink-soft `#51473c` / `#c3b9a7` | 5.6 (desk, hovered) · 8.8 on paper | 6.4 (selected) · 7.9 on paper |
| pencil `#5d5348` / `#a7a095` | 4.6 (desk, hovered) · 5.0 on desk · 7.3 on paper | 4.8 (selected) · 6.0 on paper |
| faded (3:1) `#766d62` / `#837c73` | 3.1 (desk, hovered) | 3.0 (selected) |

The Otaku palette (`themes/otaku.css`) takes the same model: its rail becomes
the desk (`#cfd4d2` / `#0c0f0e`), its desk the blotter (`#e4e8e7` /
`#141817`), its band, paper and open-field tones the band, paper and raised
paper, each step spread to read as clearly as these.

- **The sidebar is the desk**: a clear step darker than everything else in day
  mode — enough to see at a glance (aim for a visible difference, not a hint).
- **The note list is paper**, white-ish with near-black text, divided from the
  sidebar by tone and from the page by a hairline.
- **The page pane is the blotter**, and **the sheet is paper on it** with a
  hairline edge and one soft shadow — the only static thing that casts one.
- **Bands**: the list's header, the page's control strip and the colophon sit on
  a band tone between blotter and paper, capped by a hairline (Supabase's
  header row, Notable's toolbar).
- **Selected rows**: a neutral fill plus the seal's rule. The seal wash is kept
  for text selection only.
- **Night** keeps the same order — darker means further back: desk darkest,
  then blotter, then paper, then raised. Separation at night comes mostly from
  hairlines and lightness steps, with shadows deepened.
- **Contrast**: text stays ≥ 4.5:1 on every surface it appears on, including
  the desk.

These are design decisions; the values in the table were tuned by eye against
the references and checked by measurement. To keep pencil at 4.5:1 on the
darker desk, pencil, faded, moss and ochre each moved a little toward the ink
by day (pencil `#685f53` → `#5d5348`), and pencil and faded a little toward
the light by night.
