# Specimen: icons, corners, the two type settings

[specimen.html](specimen.html) shows what the design pass adds to the system,
large enough to judge. Switch day and night, and the icon stroke, in the bar.

## Icons (#26)

- **One set, drawn for Eien:** 52 icons, the formatting bar's bold, italic,
  underline and strikethrough among them, on a 16-unit grid, with round ends and
  joins, stroked in `currentColor`. They're inline SVG; there's no icon font
  and nothing is fetched. In the app they'd live in one module (`ui/icons.ts`)
  with the same names.
- **Why drawn, not borrowed:** a borrowed set (Lucide, Phosphor) would be a
  dependency, and would look like every other app. Drawn at Eien's hairline
  weight, they look like pen lines on the page.
- **Stroke:** 1.25 at 16px by default. The bar tries 1 (closer to the
  hairlines) and 1.5 (sturdier on Windows' rendering). 1.25 holds up in both
  schemes.
- **The seal** stays itself, as the Seal control: a small vermilion square,
  not an outline. It's still one of the seal's five places.
- **Words stay** for labels, counts, a menu's items, and the choices inside
  Settings.
- **Tooltip:** a word in the machine voice, with the key in pencil, after a
  short hover delay.

## Corners (#27)

- **The rule:** paper stays square (the panes, the list, the sheet), because
  it's paper.
- **The scale:** `--eien-radius-s` for what you press (buttons, fields,
  chips), `-m` for what floats (menus, popovers, the tool slip), and `-l`
  for what covers the window (Settings over it, the phone's bottom sheet).
  Dots stay round.
- **Three strengths:** 2/4/8, 4/8/14 and 3/6/10, one per exploration.

## The machine voice's face (#24)

- **One list of faces drives both settings.** In the app it's one entry per
  face in `core/config`, with its fonts and tuning in `tokens.css`. A face
  added later appears in both choices with nothing else to change, which is
  the refactor you asked for.
- **Found here:** at the mono's 10–11px, the sans faces read smaller than
  Plex Mono does. So each face will need its own machine sizes
  (`--eien-size-label`, `--eien-size-meta`), as each already has its own
  text sizes. Counts keep `tabular-nums`: all nine faces have tabular
  figures (measured in the page, `1111` as wide as `0000`).

## Row names' weight (#25)

- Four columns show 400 to 700 with a chosen row. The chosen list title is
  100 heavier, up to 700.
- At 700 it can't get heavier, and the seal's rule and the fill carry it
  alone. That's fine: colour was never the only signal, and weight wasn't
  either.
