# Design explorations, stage 2

The design pass for [the backlog](../../backlog.md)'s interface items. These
are explorations to choose from, not the app: each HTML page is interactive
and stands alone (its CSS and JS inside it), and each has an `.md` beside it
with its directions, trade-offs and a recommendation. Existing elements
follow [`.interface-design/system.md`](../../../.interface-design/system.md);
new ones go beyond it where it says nothing yet.

To view them, serve `docs/design` (the fonts don't load from `file://`):

```bash
python3 -m http.server 4173 --directory docs/design
```

Then open <http://127.0.0.1:4173/explorations/overall.html>.

All of these are now built (stage 3, October 2026); each `.md` keeps the
reasoning, and [specimen.html](specimen.html) ends with the components as
they shipped.

| Page | What it explores | Backlog |
|---|---|---|
| [overall.html](overall.html) · [md](overall.md) | The whole window, desktop and phone, in three explorations: A · Band, B · Slip, C · Running head. Focus mode, rename in place, and how one framework carries all three | #1, #3–#8, #10, #11, #13–#17, #25, #27 |
| [specimen.html](specimen.html) · [md](specimen.md) | The icon set, the control's states, three corner scales, the machine voice in every face, row weights | #24–#27 |
| [settings.html](settings.html) · [md](settings.md) | Settings over the window (chosen): moved and resized, a breadcrumb, category labels, Themes as a category | #18, #20, #24, #25 |
| [tags.html](tags.html) · [md](tags.md) | Tags on the page: the running head (chosen), label slips, the note's card; a tag with no notes yet | #4, #13 |
| [themes.html](themes.html) · [md](themes.md) | Six new themes beside Washi; Gallery and Custom; contrast checked live | #20 |
| [order.html](order.html) · [md](order.md) | Your order and a lens over it, across both panes; moving folders out; drag anytime or Arrange mode; a three-way tag filter | #12 |

The pages are built from `_src/` by `python3 _build.py`, which puts the
shared tokens, icons and face list (`_src/shared.css`, `_src/shared.js`)
inside each page. Edit `_src/` and build; don't edit the built pages.
