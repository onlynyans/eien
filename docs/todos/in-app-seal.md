# Draw the in-app seal from the icon's path

Status: on hold (2026-10-22). The owner wants to keep the seal as it is for now.

## Why

The app icon's 永 is now Noto Serif JP's outline, stored as a path in
`build/icons/seal.svg` (PR #53). The seal inside the window is still text:
永 set in `--eien-face-seal`. Noto Serif JP comes first in that stack, but
few machines have it installed. A Mac falls back to Hiragino Mincho and
Windows to Yu Mincho, so the window's seal differs a little from the icon,
and the difference depends on the system.

`docs/design/README.md` already says the app should ship the seal as an SVG
so it looks the same everywhere. This would make that true.

## Where the seal is drawn now

- `src/ui/sidebar/sidebar.ts:138`: the sidebar's seal button (show and hide).
- `src/ui/welcome/welcome.ts:35`: the welcome screen (`welcome__seal`).
- `src/ui/chrome/host.ts:106`: a command whose icon is `seal`.
- `src/ui/theme/base.css:32`: `.seal` sets the font, at 0.68 of the square.
  `.seal--small` is the 10 px square with no glyph.
- Styling elsewhere: `sidebar.css`, `chrome.css` and `versions.css`
  (`.seal-line .seal`, with stamping and hidden states).

Leave `src/ui/settings/themes.css:59` alone. That's `.theme__kanji`, the
themes' names in kanji, not the seal, so it keeps `--eien-face-seal` (or
moves to a CJK text stack of its own).

## Plan

1. **One source for the path.** Add `src/ui/seal.ts`, which builds the seal
   as an inline SVG: `viewBox="0 0 1024 1024"`, one `<path>` with
   `fill="currentColor"`, and `aria-hidden="true"`. The path already carries
   the 0.68 scale and the centring, so the SVG just fills the `.seal` square.
2. **Keep it in step with the icon.** Add a unit test that reads the glyph's
   `d` from `build/icons/seal.svg` and checks it equals the path in
   `seal.ts`. Changing one without the other then fails CI. A build step
   that generates `seal.ts` would be the alternative, but the project has no
   codegen, so the test is the lighter choice.
3. **Swap the three call sites** to the helper. They keep their classes
   (`seal`, `welcome__seal`) so the existing CSS still applies.
4. **CSS.** In `.seal`, drop `font-family`, `font-size` and `line-height`
   and give the SVG `width: 100%; height: 100%`. `.seal--small` hides the
   SVG instead of using `font-size: 0`. Check that the sidebar's and the
   chrome's `:active` press, and the Versions panel's stamping, still
   apply. The CSP allows no inline styles, so set attributes, not
   `style=""`.
5. **Tokens.** Once nothing draws the seal from a font, drop the
   "Noto Serif JP" entry from `--eien-face-seal`, or rename the token to fit
   what's left (the theme kanji). Update `docs/design/tokens.css` and the
   comment beside it to match.
6. **Docs.** Update the seal line in `docs/design/README.md` (the mockups
   still use the system Mincho), AGENTS.md's `src/ui` map (the new
   `seal.ts`), and `docs/handbook.md` if it mentions the seal.

## Checks

- A DOM unit test: the seal renders one `svg > path` with the icon's `d`,
  `aria-hidden`, and nothing readable to a screen reader.
- Look at it in the running app: the sidebar seal, the welcome screen, the
  Running head layout's seal command, and the Versions panel's stamp, in Day
  and Night, at 100% and 200% zoom.
- Locally, run only lint, typecheck and the tests touched or added. CI runs
  the end-to-end suites. Any e2e test that finds the seal by its text 永
  needs another selector: grep `tests/e2e` for `永` first.

## Open questions for the owner

- Should the welcome screen's large seal use the same path, or keep a
  bigger, display-sized treatment?
- Should the Versions panel's stamping animation change with the shape, or
  stay as it is?
