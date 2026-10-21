# Writer themes

The Themes category in Settings has two tabs (decided 2026-10-21):
**Gallery**, Eien's own, and **Custom**, your own named themes in
`.eien/themes/`, each made from four choices. "From a file" is gone: Custom
writes the files. They're in [settings.html](settings.html) under Settings /
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
- **B · Custom:** four choices (the paper's hue and warmth, the ink's hue,
  the seal's hue), and Eien works out all ten colours for day and night.
  - The inks keep their hue, saturated enough to see by day. Each is then
    fitted to Eien's contrast (`fitInk`): it starts where it should sit and
    steps darker by day, or lighter by night, until every surface reaches
    4.5:1 (3:1 for faded).
  - I checked 2,880 mixes (paper and ink hues in 15° steps, warmth 0 to 40
    in steps of 10): every one passes, by day and night.
  - Each custom theme is a named file in `.eien/themes/`, which syncs with
    the vault. Settings / Themes / Custom lists them as cards and mixes
    them (see [settings.md](settings.md)).
- **"From a file" was dropped** on 2026-10-21: Custom writes the files, so
  there's nothing to type by hand.

## Recommendation

- **One category of two tabs:** Settings / Themes, with Gallery and Custom
  (decided 2026-10-21).
- **Ship the gallery's themes first.** They need nothing but tokens, the
  same mechanism Otaku already uses.

## Open

- Whether a theme may change the seal's colour. The rule has been "nothing
  else is vermilion". Here the seal changes with the theme (persimmon, rose),
  but there's still exactly one seal colour per theme.
- Whether themes carry anything besides colours, such as a default face. The
  spec says colours only, and that keeps a theme from breaking the layout.
