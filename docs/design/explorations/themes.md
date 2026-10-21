# Writer themes

The three approaches are kept, all of them, as the three tabs of the Themes
category in Settings: **Gallery**, **Mix your own** (the maker, renamed) and
**From a file**. They're in [settings.html](settings.html) under Settings /
Themes, where choosing one paints the whole window; this page keeps the
larger preview and the full contrast table.

[themes.html](themes.html) has six new themes beside Washi, and three ways to
make your own. The preview is a small window painted only by the theme's
tokens. Day and night switch in the bar, and every choice is checked live
against Eien's contrast rule.

## The themes

Each comes from the same world as Washi: paper, dye, ink, a seal. Each keeps
Eien's order of surfaces (darker is further back), by day and by night. All
seven pass the contrast check in both schemes: ink-soft and pencil reach
4.5:1, and faded reaches 3:1, on the desk, band, paper and selected
surfaces.

| Theme | | What it is |
|---|---|---|
| Washi 和紙 | Eien's own | Paper and sumi ink, the vermilion seal |
| Kinari 生成り | unbleached cloth | Yellower paper, brown-black ink, a persimmon seal |
| Aizome 藍染 | indigo dye | Cool paper, blue-black ink, vermilion on indigo |
| Koke 苔 | a moss garden | Green-grey desk, quiet ink, a muted red seal |
| Rōsoku 蝋燭 | candlelight | Amber at night with no blue in it, for writing late |
| Sumi 墨 | for tired eyes | The most contrast there is, pure black and white |
| Sakura-nezumi 桜鼠 | cherry-grey | Pinkish grey, plum ink, a rose seal |

Otaku stays as it is beside them.

## Three ways to make one

- **A · Gallery:** choose from the themes. It's the simplest, and what most
  writers need.
- **B · Mix your own:** three choices (the paper's hue and warmth, the ink's hue,
  the seal's hue), and Eien works out all ten colours for day and night.
  - The surfaces keep their steps, so contrast holds whatever you pick. I
    checked across the range of hues and warmth: every result passes.
  - **Save to .eien/themes** writes it as a file (it opens approach C with
    the result).
- **C · From a file:** the spec's format (§7) as JSON, typed or pasted.
  - It's checked as you type: only Eien's tokens, and only colours written
    `light-dark(#day, #night)`.
  - Anything else is named and left out, never applied. A missing token
    falls back to Washi's.
  - A theme in `.eien/themes/` syncs with the vault to every device.

## Recommendation

- **All three, as one category:** Settings / Themes, with Gallery, Mix your
  own and From a file as its tabs (decided 2026-10-21).
- **Ship the gallery's themes first.** They need nothing but tokens, the
  same mechanism Otaku already uses.

## Open

- Whether a theme may change the seal's colour. The rule has been "nothing
  else is vermilion". Here the seal changes with the theme (persimmon, rose),
  but there's still exactly one seal colour per theme.
- Whether themes carry anything besides colours, such as a default face. The
  spec says colours only, and that keeps a theme from breaking the layout.
