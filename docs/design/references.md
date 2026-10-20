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

| Surface | Day | Night | Used for |
|---|---|---|---|
| Desk (darkest day tone) | warm grey, clearly below paper | darkest | the sidebar: navigation |
| Blotter | light warm grey | dark | the ground around the page; bands |
| Paper | near-white, warm | lightest panel | the note list and the sheet: content |
| Raised paper | white | one step above paper | menus, the versions panel |

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

These are design decisions; exact values are tuned by eye against the
references and checked by measurement.
