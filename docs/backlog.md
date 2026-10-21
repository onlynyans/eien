# Backlog

What to do next, collected after phase 11 (from 2026-10-20). Every phase in
the [spec](spec.md#12-phases) is built; these are the fixes, tweaks and
features that came after, and the plan for them (below the table).

- **Type**: *fix*, it's broken or not as designed; *gap*, the spec says it
  and it isn't built; *tweak*, a change to something that works; *feature*,
  something new; *chore*, work that isn't the app's behaviour.
- **Design**: *yes* means the interface-design pass mocks it up and explores
  where it fits before it's built; *port* means the mockup in `docs/design`
  already has it, to be carried over as it is.
- **From**: who raised it. *You* is the owner; *audit* is the design audit of
  2026-10-20 (below).

| # | Task | Type | Area | What and why | Now | Design | From |
|---|---|---|---|---|---|---|---|
| 1 | No title bar | tweak | Window | The window takes the title bar's space, as Claude's does: the traffic lights sit over the app, and the strip drags the window. Icons may go there later. Do this first, before the other interface work. | **Done** ([#29](https://github.com/onlynyans/eien/pull/29)): the traffic lights over the sidebar's head on macOS; the system's controls over the page's band, in its colours, on Windows and Linux; the top bands drag the window | yes, later (what goes in the strip) | you |
| 2 | Zoom the whole interface | tweak | Window | ⌘+ and ⌘− scale every pane, as a browser zooms. With the keyboard in the page, they zoom the page alone, as now. | **Done** ([#29](https://github.com/onlynyans/eien/pull/29)): the whole window outside the page, the page alone inside it; Interface zoom in Settings → Layout | – | you |
| 3 | Sections fold | fix | Sidebar | LIBRARY, FOLDERS and TAGS fold and open when their label is clicked, with the twisty, as the mockup's `.section__label` does. | **Done** in #28 | port | you, audit |
| 4 | A quiet + for a new folder or tag | tweak | Sidebar | A + at the right of FOLDERS and TAGS, shown on hover or keyboard focus, in place of the NEW FOLDER word button. The + beside TAGS makes a tag with no notes yet, named in place (kept in `.eien/tags.json`). | A NEW FOLDER button; no way to make a tag here | yes: [tags](design/explorations/tags.md) | you |
| 5 | Tree guide lines | fix | Sidebar | The hairline down an open folder's children (`.tree [role='group']::before` in `docs/design/desktop.css`). | **Done** in #28 | port | you, audit |
| 6 | BOOK mark | fix | Sidebar | The BOOK mark beside a folder that's a book (`.book-mark`). | **Done** in #28 | port | you, audit |
| 7 | Pinned in sight | tweak | Sidebar | Pinned always under Library, even with nothing pinned, as the mockup shows it, and a way to pin that can be found without right-clicking. | Pin and Unpin are on a note's right-click menu; the Pinned row appears only once a note is pinned | yes: [overall](design/explorations/overall.md) | you |
| 8 | Icons at the sidebar's foot | tweak | Sidebar | DAY and NIGHT become one toggle with sun and moon icons, as Otaku's; SETTINGS, 3 PANES and 2 PANES become icons. | Words | yes | you |
| 9 | "1 NOTES" | fix | Sidebar | The foot says "1 NOTES" for one note; the list's head already says "1 NOTE". | **Done** in #28 | – | review |
| 10 | Sync status | gap | Sidebar | A sync icon at the sidebar's foot, with a tooltip: "Synced · Syncthing, 4m ago", or "Changed on another device 4m ago". Nothing at all when the vault isn't a Syncthing folder (no `.stfolder` marker). | Not built (spec §4 has it) | yes: [overall](design/explorations/overall.md) | audit, you |
| 11 | Search in the list | tweak | List | The search field at the top of the list pane, above its heading, as in the mockup, searching only the notes that list holds. With two panes, or the list shut, it's in the sidebar and searches there. | **Done** ([#30](https://github.com/onlynyans/eien/pull/30)): on the list's band, that list's notes; in the sidebar with no list in sight (and on a phone), the whole vault | yes | you |
| 12 | Your order, and a lens over it | feature | Sidebar, list | One system for both panes. Every list keeps your order, written to the vault: folders, subfolders, notes, tags, All Notes. Drag to reorder folders and tags, and drag a folder out of its parent. A sort (newest, title A–Z or Z–A) or a filter is a lens laid over your order, like a spreadsheet's filter: cleared to get your order back. Dragging reorders only while no lens is on. | Each list sorts by Order (the default), Title or Modified; dragging reorders only in a folder sorted by Order; folders and tags can't be reordered | yes: [order](design/explorations/order.md) | you |
| 13 | Tags on the page | feature | Page | The note's tags at the top right of the sheet, as the mockup has them (#fic/aot #posted), with a way to add and remove one there. | Tags are typed: `#tag` in the text, or `tags:` in front matter. The sidebar lists them; the page doesn't show them | yes | you |
| 14 | Formatting bar | feature | Page | A bar of the formatting commands (bold, italic and the rest) that can be shown or hidden. Where it sits is the design pass's to find, after #16. | The keys, the Format menu, and the selection bar, which shows only over selected text | yes | you |
| 15 | Chevrons to shut panes | tweak | Panes | The page bar's SIDEBAR and LIST words go. A chevron shows at a pane's edge on hover, and shuts or opens it. | SIDEBAR and LIST words in the page's control strip | yes | you |
| 16 | The control strip hides | tweak | Page | The page's control strip (views, Compare, Seal, Versions) shows or hides, from a control near where the tags sit. Shown, it takes the space above the sheet; hidden, the sheet reaches the top of the pane. | Always there; its words show on hover | yes | you |
| 17 | View icons | tweak | Page | LIVE, SOURCE and READING as icons: a text-edit icon, a code icon, a book icon. | Words | yes | you |
| 18 | Settings in Eien's voice | fix | Settings | The settings screen was built without a mockup (`docs/design` has none), and doesn't read as Eien: bold black headings where the design uses mono labels in graphite, and one long column in a box. Rework it in the design's voice. | A box over the window, one long column | yes | you, audit |
| 19 | AltGr and the heading keys | fix | Keys | On Windows and Linux, Ctrl+Alt is AltGr, so Ctrl+Alt+1–3 (headings) may take characters that some layouts type with AltGr (², ³ on a German keyboard). Check what Electron does; keep ⌘⌥1–3 on macOS and choose other keys elsewhere, then update spec §4. | **Done** ([#29](https://github.com/onlynyans/eien/pull/29)): Ctrl+Shift+1–3 on Windows and Linux; ⌘⌥1–3 on macOS | – | review |
| 20 | Writer themes | feature | Themes | Build them (spec §7): themes in `.eien/themes/`, a gallery of Eien's own beside Washi and Otaku, a maker, and files. | **Done** ([#34](https://github.com/onlynyans/eien/pull/34)): the gallery (Washi, Kinari, Aizome, Koke, Rōsoku, Sumi, Sakura-nezumi, Otaku); your own themes as files in `.eien/themes/`, each mixed from four choices and fitted to Eien's contrast; listed under Settings → Palette. The Themes tabs and the mix panel come with 3G | yes: [themes](design/explorations/themes.md) | audit, you |
| 21 | App icon | feature | Install | Eien's own icon for the installers and the phone (the seal would be the natural one). | Electron's and Capacitor's icons | yes | AGENTS.md |
| 22 | Smaller downloads | tweak | Install | The Mac download is 546 MB: Chromium twice, for Apple Silicon and Intel. Separate Apple Silicon and Intel downloads, and Chromium's text in English only, would about halve it. Left as it is for now, by your choice. | One universal `.dmg` | – | installers session |
| 23 | First release | chore | Install | No version is tagged yet, so there's nothing to download from Releases. Tag one (AGENTS.md → Releases), then publish the draft. | No release | – | docs check |
| 24 | The machine voice's face | feature | Settings | The face for everything in the machine voice (counts, labels, buttons, the status line, the Source view) becomes a setting: IBM Plex Mono (the default) or any of the eight text faces. One list of faces feeds both face settings, so a face added later is one entry, not a change in two places. Each face gets its own machine sizes, as it has its own text sizes. | IBM Plex Mono, always | yes: [settings](design/explorations/settings.md) | you |
| 25 | Row names' weight | feature | Settings | Two settings, 400 to 700 each: the sidebar's names and the list's titles. A selected list title is 100 heavier than its setting, at most 700 (so 500 at the default, as in the mockup). Whether the sidebar's chosen name is heavier too is the design pass's call (it recommends not). | 400; the selected list title isn't heavier (the mockup's is 500) | yes: [settings](design/explorations/settings.md) | you |
| 26 | Icons for controls | tweak | Everywhere | Controls become icons: one set, one style, set by the design pass, then used by #8, #15, #16 and #17. Labels, counts and a menu's items stay words. | Every control is a word | yes, first | you |
| 27 | Corners | tweak | Everywhere | Not everything square: a radius scale (`--eien-radius-s`, `-m`, `-l`) set by the layout chosen (#28), never fixed: A 2/4/8, B 4/8/14, C 3/6/10. Paper (panes, list, sheet) stays square, except B's sheet (3px). | Everything square (`--eien-radius: 0`) | done in design: [specimen](design/explorations/specimen.md) | you |
| 28 | Three layouts, as a setting | feature | Window | A · Band, B · Slip and C · Running head, the writer's choice (Settings / Look / Appearance). One framework: commands once, hosts that draw them, a small module per layout ([overall.md](design/explorations/overall.md)). Each layout sets its own corners (#27), and its own phone bottom. | One layout | done in design: [overall](design/explorations/overall.md) | you |
| 29 | Rename in place, and a right-click menu of Eien's own | fix | Sidebar, list | Notes, folders and tags rename the same way, in their row (F2, double-click, the menu); a taken name says so under the row. The menu: raised paper, an icon and a word each, its key, the trash last in carmine. | A note's rename jumps to its title; a folder's is in its row; a tag can't be renamed | done in design: [overall](design/explorations/overall.md) | you |
| 30 | Focus mode in the toolbar | tweak | Page | A control for Focus mode (⇧⌘↵) in the page's toolbar, in every layout and on the phone. | In the View menu only | done in design | you |
| 31 | This vault's settings | tweak | Settings | The vault's own settings (chapter numbers, AO3's scene break) in a category of their own, "This vault", apart from this device's. | Mixed in with the rest | yes | you |
| 32 | The three-way filter on the sidebar's TAGS | feature | Sidebar | A tag row can be wanted or kept out (with a modifier click), as in the list's filter, if it costs nothing in speed with thousands of notes. | Choosing a tag shows its notes | yes | you |
| 33 | A lens in the two-pane tree | feature | Sidebar | With two panes the tree lists notes; a sort or filter acts there as it does in the list. | Sorts apply to the list only | – | you |

## Plan

Drafted 2026-10-20. Three stages. Stage 1 and the design pass start
together: stage 1 builds what needs no new design while the pass draws the
rest. Nothing in stage 3 is built before you approve its design. Each step
is one pull request with its tests; CI runs the suites; the spec changes in
the pull request that changes the behaviour.

### Stage 1: no new design needed (start now)

Three sessions at once, each in a worktree of its own; their files don't
overlap.

| Step | Items | Where |
|---|---|---|
| 1A Window and keys (done, [#29](https://github.com/onlynyans/eien/pull/29)) | #1 no title bar, #2 zoom the whole interface, #19 AltGr | `src/app/electron` (the window, the menu), the panes' top bands |
| 1B The sidebar, as the mockup has it | #3 sections fold, #5 guide lines, #6 BOOK mark, #9 "1 NOTES": **done** in #28 | `src/ui/sidebar` |
| 1C Search in the list (done, [#30](https://github.com/onlynyans/eien/pull/30)) | #11 | `src/ui/list`, the sidebar's search, a search within one list's notes |
| 1D Type settings, after 1B and 1C (they share the row styles) | #24 the machine voice's face, #25 row names' weight | `src/core/config` (two settings), the tokens, today's Settings screen |

1A on macOS: the traffic lights sit over the sidebar's head
(`titleBarStyle: 'hiddenInset'`) and the panes' top bands drag the window.
On Windows and Linux the system's own minimize, maximize and close are drawn
over the page's band (`titleBarOverlay`), in the band's colours. The phone
is untouched.

### Stage 2: the design pass (alongside stage 1)

Explorations made on 2026-10-20, in [`docs/design/explorations`](design/explorations/README.md),
for you to choose from. Stage 1 runs meanwhile (1A, 1B and 1C as their own
sessions).

The interface-design skill, working from `.interface-design/system.md`,
brings `docs/design` up to the current design, a part at a time, each for
you to approve:

1. **The system:** the icon set and its style (#26), the radius scale (#27).
2. **The page:** the strip that hides (#16), view icons (#17), tags on the
   page (#13), the formatting bar (#14), chevrons to shut panes (#15).
3. **The sidebar:** the foot's icons (#8), the + (#4), Pinned (#7), the sync
   status (#10).
4. **The list:** the sort laid over your order (#12).
5. **Settings** (#18), with #24 and #25 in it.
6. **The title bar's strip** (what goes there, #1) and **the app's icon** (#21).

The phone's mockup changes wherever a change reaches the phone.

### Stage 3: build what's approved

The designs are decided (`.interface-design/system.md`, "Decided patterns",
and `docs/design/explorations`). Built in two waves, one session per step,
each step's files apart from the others' in its wave.

**Wave 1**, at once:

| Step | Items |
|---|---|
| 3A The layouts | #28 the framework and all three layouts as a setting; #26 the icons; #27 corners per layout; #15 chevrons and the seal strip; #16 the strip that hides; #17 view icons; #30 Focus; #8 the foot's icons; #1 what goes in C's strip |
| 3B Themes (done, [#34](https://github.com/onlynyans/eien/pull/34)) | #20: the gallery's themes, your own in `.eien/themes/`, the mix (fitted to Eien's contrast); the theme applied as tokens |
| 3C The app's icon | #21: the seal, for the installers and both phones |

**Wave 2**, once 3A has merged (they build on its framework and icons):

| Step | Items |
|---|---|
| 3D The page | #13 tags in the running head (slips under the title on the phone); #14 the formatting bar, drawn icons |
| 3E The sidebar | #4 the +; #7 Pinned; #10 sync status; #29 rename in place and the right-click menu; #32 the three-way filter on TAGS |
| 3F Your order | #12 your order and the lens, Arrange mode, the list's three-way tag filter; #33 the lens in the two-pane tree |
| 3G Settings | #18 over the window, categories and tabs; #31 This vault; #24 and #25; Themes' tabs (with 3B); C's strip ground |

Then #23, the first release.

### Later

#22 smaller downloads (left for now).

### Answers needed, and before what

All the earlier ones are answered. Next: your choice among the
explorations, before stage 3 builds each part.

## Decided

- **AO3 scene break**: AO3's spacer, rule, spacer
  (`<p><br /></p><hr /><p><br /></p>`), an empty paragraph each side of the
  rule so the sections breathe. It was already the default; decided
  2026-10-20.
- **The note list's default order**: your own (#12), decided 2026-10-20.
- **Controls are icons, not words** (#26), decided 2026-10-20: "a control is
  a word" was approved by mistake.
- **Not everything is square** (#27), decided 2026-10-20.
- **Two type settings** (#24, #25), decided 2026-10-20. Two voices stay: the
  text face for what a person wrote, the machine voice for the rest.
- **All three layouts, as a setting** (#28), each with its own corners (#27)
  and phone bottom; **the seal is the app's icon** (#21); **a theme may
  change the seal's colour**, one per theme; **this vault's settings get a
  category** (#31); **tags on the phone are slips under the title**; **the
  sidebar's TAGS take the three-way filter** if it costs no speed (#32);
  **the two-pane tree takes the lens as the list does** (#33); **removing a
  tag in the header never edits the text**. All decided 2026-10-21.

## Questions for you

None open: every exploration is decided (2026-10-21).

## Design audit, 2026-10-20

`src/ui` against the approved design in `docs/design` (there's no
`.interface-design/system.md`; the design's README and tokens are the
system).

- **Tokens hold.** The app's styles take every colour, size and space from
  the tokens: no stray colours, no shadows beyond the two, and round corners
  only on dots.
- **The drift is in structure.** Pieces of the mockup that were dropped or
  rebuilt differently: folding sections (#3), guide lines (#5), BOOK marks
  (#6), Pinned always in Library (#7), the sync status (#10), the search in
  the list pane (#11), the tags at the top right of the sheet (#13).
- **Settings had no mockup** (#18): `desktop.html`'s Settings button says
  "not in this mockup", so the screen was built without one.
