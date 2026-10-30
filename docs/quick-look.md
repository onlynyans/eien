# A quick look: the notes' half

**Backlog #49**, as built (2026-10-28; the design reviewed against the code
before building, its fixes taken), as decided in
[look.md](design/explorations/look.md#decided-2026-10-28) (1 · On the bar)
and `.interface-design/system.md`'s "A quick look". This half is the notes':
the `quick` mark, two new settings, the Look command and its popover. The
shelf's half (an EPUB's own look) is #40 Phase 1's; this one leaves it a seam
and nothing more.

## The schema: a mark, two settings

`Common` in `core/config/schema.ts` gains

```ts
/** In the quick look (#49): one value for every page, or a page's own, by its kind. */
readonly quick?: 'window' | 'page';
```

- `'window'`: `appearance.scheme`.
- `'page'`: `appearance.face`, `appearance.textSize`, the new
  `appearance.leading`, the new `page.width`, `appearance.frame`. Today the
  notes' value is the setting itself; Phase 1 keeps the shelf's under
  `epub.<key>` in this device's file, from the same entry (one label, one
  list of choices, one check).
- **Line spacing**, `appearance.leading` (Type): `tight` Tight, `set` As
  set, `loose` Loose; default `set`.
- **Page width**, `page.width` (Page): `narrow` Narrow, `set` As set, `wide`
  Wide; default `set`. Marked `wide`: a phone's page is already narrower
  than any face's measure. Narrow also narrows a sheet that fills its pane;
  Two sheets and Facing pages lay each page to its half, which it doesn't
  change. In the schema before `appearance.frame`, so the
  popover's order (the schema's) is the decided one: Day or night, Typeface,
  Text size, Line spacing, Page width, Page.

`ui/settings/places.ts` gains `quickIn(platform, phone)`: the marked
settings offered here (`offeredOn`), in the schema's order. A setting marked
later shows in the popover with nothing else to build.

## Worn: two multipliers

`ui/settings/look-properties.ts` sets `--look-lead` (0.9 / 1 / 1.12) and
`--look-width` (0.84 / 1 / 1.18) on `<html>`, taken off at As set, as
`--runhead-ground` is. No design token: they multiply each face's own
`--eien-leading-prose` and `--eien-measure` where the page uses them:

- the editor's line height (`editor/theme.ts`: Live, Source, Reading), and
  Compare's, which stands in its place (`versions/versions.css`);
- the sheet's width and the empty page's (`page/page.css`);
- Settings' Type sample (`settings/settings.css`), so a change shows there.

Each face keeps its own tuning; the writer's step goes over it.

## The command

`ui/chrome/commands.ts`: `{ id: 'look', icon: 'look', label: 'Look', key:
'Mod-Shift-l', sends: 'look', on: 'note' }`.

- `look` is a new `MenuCommand`; the menu bar's View → Look… sends it with
  CmdOrCtrl+Shift+L (`app/electron/menu.ts`). ⇧⌘L is free (look.md).
- No `on` (#40 Phase 1c dropped the `on: 'note'` this half had): a book's
  page has its own look, the shelf's.
- The icon, `look` in `ui/icons.ts`: the exploration's Aa (a capital and a
  small letter), on the 16-unit grid.
- Where it's drawn, the page's last tool after a hairline:
  - A: `band-tools` `[…, 'format-bar', 'focus', '|', 'look', 'strip']` (the
    strip stays last: it's the band's way out, not a tool);
  - B: `slip` `[…, 'focus', '|', 'look', 'strip']`;
  - C: `runhead-tools` `[…, 'format-bar', 'focus', '|', 'look']`;
  - the phone: before the ⋯ in `phone-band`, `phone-slip` and `phone-rail`
    (no hairline, as the mockup's), and in the ⋯ (`phone/more-menu.ts`),
    after the writing tools.
- `TOOL_FOLDS`: after `focus`, before the views: `versions, compare,
  format-bar, focus, look, view.*, seal`.
- `host.ts`: `aria-haspopup="dialog"` for it, and `CommandLook` gains
  `expanded`, written as `aria-expanded` (only on a command that has it), so
  the control says it's open and a quiet bar stays in sight while it is
  (`.page__bar:has([aria-expanded="true"]) .host`, in band.css and
  slip.css). `Chrome` gains `inSight(id)`: the button in sight for a
  command, or the ⋯ it folded behind (what `mount` already works out).

## The popover: `ui/quick-look/`

- `quick-look.ts`, `QuickLook`: `open(subject, opener)`, `close()`,
  `toggle(subject, opener)`, `isOpen`. A `LookSubject` is whose look:
  `{ crumb, every, store }` (NOTES, *every note*, the settings). The wiring
  keeps one per page kind: the note's, and the epub's (SHELF, *every book on
  the shelf*, the `epub.<key>` store, #40 Phase 1c). A
  `role="dialog"` named "Look: Notes". It draws:
  - the head: Settings' breadcrumb, LOOK / NOTES, *every note* in pencil;
  - a row per `quickIn` setting, each `settingRow` from
    `settings/controls.ts` (the same well, face cards and stepper; its ids
    under a prefix of the popover's, `settingRow(setting, set, 'quick')`, as
    Settings has drawn the same rows already), its
    description hidden by the popover's style (names only), Day or night with
    *every page* in pencil beside its name;
  - the foot: All settings (⌘,), which closes it and opens Settings at Look
    (a new `MenuCommand`, `settings:look`, answered in `app.ts` by
    `SettingsScreen.open('Look')`, the category's first tab shown; the
    popover closes first, so Settings gives the keyboard back to the
    control; ⌘, closes any menu first); on the phone, Done.
  - A value that can't be kept is logged, as the foot's sun does.
  - A change goes to the store for the page's kind and shows at once: each
    row's `show(values)` redraws it in place on the settings' `onChange`.
    The store is an interface the notes' `SettingsState` already is
    (`values`, `set`, `onChange`); Phase 1 passes the shelf's.
- It floats with `menu/menu.ts`'s `float`, so it's the one thing open (a
  menu opening closes it, and the phone's back closes it, by `closeMenu`),
  closes on a click elsewhere, and gives the keyboard back to what had it
  when it opened (the control, if clicked; the ⋯, from the fold's menu; the
  page, from the key). The opener is always passed, the phone's too (its
  sheet ignores the place). `float` changes three ways, none a menu sees:
  `end` lines its end up with the opener's (worked out once measured); a
  pointerdown on the opener doesn't close it, so a click on the control is
  a toggle (a menu's opener opens a new one, which closes the last, as
  now); and the keyboard goes back only if it was in the panel or nowhere,
  so ⌘3 into the other page keeps it there. The popover's height is held
  inside the window by its own max-height.
- `quick-keys.ts`: the keyboard, as look.md has it.
  - On open, the keyboard goes to the first setting's chosen value.
  - Each setting is one stop: a group's buttons but the chosen one are
    `tabindex=-1`; Tab and ⇧Tab go round the stops and All settings (and
    Done), wrapping.
  - Arrows in a choice or the faces choose at once (↑ ↓ a row in the faces'
    grid, rows found by `offsetTop`); in the stepper they move between − and
    +, which Enter and Space press; a button disabled at the end hands the
    keyboard to the other. The stops are set again after every `show`.
  - Esc, or the key again, closes it.
- `quick-look.css`: what floats (raised paper, rule-strong hairline,
  `--eien-radius-m`, the float shadow), `--eien-list-w` wide, fading in once
  by `--eien-quick` (none with reduced motion). On the phone it's the sheet:
  `--eien-radius-l` top corners, no scrim, at `--eien-touch`, the faces one
  row that scrolls sideways.

## The wiring: `vault/look-wiring.ts`

Made by `vault/chrome-wiring.ts`, in a module of its own since #40's "After
Phase 1".

- The menu bus's `look` toggles the popover for the kind of the page the
  layout's tools act on (a companion's page itself, made the active one).
- The anchor: the look control in sight (`chrome.inSight('look')`), else the
  ⋯ of its bar it folded behind, else (the band or slip put away) the
  strip's control; passed on the phone's way too (`phone.stack.phone`), so
  a press on the control toggles the sheet.
- The keyboard leaving it for somewhere else (⌘3 into the other page, a
  companion's) closes it, the keyboard left there.
- Choosing the other page closes it (the next `refresh` finds the active
  page changed).
- `command-looks.ts` gives `look` its `expanded` (`LooksOf.lookOpen()`); the
  popover's close refreshes the chrome.
- The page it doesn't change sitting back came with #40's shelf half: see
  "After Phase 1" below.

## Tests

- Unit: the mark (exactly the six, the right kinds, the schema's order);
  the new settings' defaults and checks (`config.test.ts`); `quickIn`
  (`places.test.ts`); the multipliers (`look-properties.test.ts`); the
  menu's item and key; `float`'s `end`, its opener and where the keyboard goes back (`menu.test.ts`).
- Layouts: `look` in every layout after a hairline, in every phone host and
  the ⋯, folding after Focus mode (`layouts.test.ts`, `fold.test.ts`).
- DOM: the popover's head, rows from the mark, names only, a change set and
  shown, Esc and the key again closing with the keyboard back, Tab round
  the stops, arrows choosing, the stepper's ends, the phone's sheet with
  Done, the active page changing closing it, and no View → Look… on a page
  of another kind.
- End to end: open by click, ⇧⌘L and View → Look… in each layout; a change
  shows on the page at once (line height, a lone page's sheet width,
  scheme); folded, from the ⋯.
- Phone: from the bar and the ⋯ as a sheet in each layout; Wide screen's
  Panes as a column, One at a time as a sheet.
- Accessibility: the popover open, by Day and Night, in every layout (and the
  phone's sheet).

## The shelf's half (#40, Phase 1c, built)

- `core/config/epub-look.ts`: `PAGE_LOOK`, the settings marked `page`, and
  `EPUB_LOOK`, each again under `epub.<key>` on this device, the same entry
  with its key and scope rewritten: `settingOf`, `checkSetting`,
  `readSettings`, `withDefaults` and the settings store take them as any
  setting; Settings never draws them (it draws `SETTINGS`). `SettingKey` and
  `SettingValues` carry them by type (`EpubLookKey`). `epubLook(values)` is
  the values a book wears.
- `ui/quick-look/epub-store.ts`: the shelf's `LookStore` over the window's
  settings: a page setting read from and kept under its `epub.` key, any
  other the window's. The wiring's subjects are now `{ note, epub }`, the
  shelf's LOOK / SHELF, *every book on the shelf*; Look lost its `on:
  'note'`, so the control, ⇧⌘L, View → Look… and the phone's ⋯ work with a
  book in front.
- The book's page wears it (`EpubPage.wear`, from `Side.follow`): its leaf
  always carries `data-face` and `data-frame`, and `--eien-text-scale`,
  `--look-lead` and `--look-width` (`leafLook`, beside `lookProperties`,
  with the same steps). The frame's tokens are set on `[data-frame]` as on
  `<html>` (the density's gutter is `--eien-sheet-gutter` now), and the
  book's leaf paints its own ground.
- In a split, both pages lie in the window's frame (one arrangement of the
  pane, which Two sheets' and Facing pages' marks read): the book keeps its
  own face, size, line spacing and width there (`ui/page/split.css`).
- All settings, from the shelf's look, opens Settings at Look, which sets the
  notes': the shelf's look is set in the quick look alone.

## After Phase 1 (#40, built 2026-10-29)

From epub.md, "After Phase 1"; the design reviewed against the code before
building, its fixes taken.

- **The line at the foot.** `LookSubject.line`: the shelf's says "Settings
  sets notes; this is every book's look." It's the foot's first line, over
  All settings (and Done), in the popover's own words voice, as *every
  book on the shelf* (`.quick-look__every, .quick-look__line`: the text
  face, preview size, italic, pencil); the dialog is described by it. The
  notes' look has none.
- **The page it doesn't change sits back.** `look-wiring.ts`'s `sitBack`
  sets `data-back` on each page's leaf while the look is open, two pages
  show and the page's kind isn't the look's; the popover's `changed` and
  the chrome's `refresh` call it. Its paper takes `--eien-band`, as the
  companion's page you aren't in does (`page/split.css`): the sheet, or the
  leaf where the leaf is the paper (Facing pages, Page: Full), with the calm
  transition. Two notes, or two books, never sit back. With a companion,
  the menu's Look (which acts on the page itself) makes that page the
  active one first, so the page sitting back is the one you aren't in, which
  the companion's own rule already paints.

## A book's own settings (#40, Phase 2, built)

A book has a setting with no note's to copy: the **scroll style** (*As a
note*, *As a book*), `epub.scroll` in the schema, marked `quick: 'shelf'`.
`quickIn(platform, phone, kind)` offers it only for the shelf's subject
(`LookSubject.kind`, `'epub'`), after the page settings in the schema's
order; `settingsIn` leaves it out of Settings, which sets notes. The
shelf's store keeps it under its own name (it isn't a page look's key), and
the book's leaf wears it as `data-scroll`.
