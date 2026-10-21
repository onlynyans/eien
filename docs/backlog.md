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
| 1 | No title bar | tweak | Window | The window takes the title bar's space, as Claude's does: the traffic lights sit over the app, and the strip drags the window. Icons may go there later. Do this first, before the other interface work. | A standard title bar saying "Eien" | yes, later (what goes in the strip) | you |
| 2 | Zoom the whole interface | tweak | Window | ⌘+ and ⌘− scale every pane, as a browser zooms. With the keyboard in the page, they zoom the page alone, as now. | ⌘+ and ⌘− zoom the page only | – | you |
| 3 | Sections fold | fix | Sidebar | LIBRARY, FOLDERS and TAGS fold and open when their label is clicked, with the twisty, as the mockup's `.section__label` does. | Plain labels that don't fold | port | you, audit |
| 4 | A quiet + for a new folder or tag | tweak | Sidebar | A + at the right of FOLDERS and TAGS, shown on hover or keyboard focus, in place of the NEW FOLDER word button. | A NEW FOLDER button; no way to make a tag here | yes | you |
| 5 | Tree guide lines | fix | Sidebar | The hairline down an open folder's children (`.tree [role='group']::before` in `docs/design/desktop.css`). | Missing | port | you, audit |
| 6 | BOOK mark | fix | Sidebar | The BOOK mark beside a folder that's a book (`.book-mark`). | A book isn't marked in the sidebar | port | you, audit |
| 7 | Pinned in sight | tweak | Sidebar | Pinned under Library as the mockup shows it, and a way to pin that can be found without right-clicking. | Pin and Unpin are on a note's right-click menu; the Pinned row appears only once a note is pinned | yes | you |
| 8 | Icons at the sidebar's foot | tweak | Sidebar | DAY and NIGHT become one toggle with sun and moon icons, as Otaku's; SETTINGS, 3 PANES and 2 PANES become icons. | Words | yes | you |
| 9 | "1 NOTES" | fix | Sidebar | The foot says "1 NOTES" for one note; the list's head already says "1 NOTE". | Always "notes" | – | review |
| 10 | Sync status | gap | Sidebar | Spec §4 puts a sync status at the sidebar's foot ("● SYNCED 4M AGO" in the mockup). | Not built | yes | audit |
| 11 | Search in the list | tweak | List | The search field at the top of the list pane, above its heading, as in the mockup, searching only the notes that list holds. With two panes, or the list shut, it's in the sidebar and searches there. | In the sidebar, searching the whole vault (⇧⌘F) | yes | you |
| 12 | Your own order; sorts as filters | feature | List | Notes keep the order you give them, by default. Newest, and title A–Z or Z–A, work like a spreadsheet's filter: laid over your order, and cleared to get it back. Dragging reorders only while no sort is on. | Each list sorts by Order (the default), Title or Modified; dragging reorders only in a folder sorted by Order | yes (the sort control) | you |
| 13 | Tags on the page | feature | Page | The note's tags at the top right of the sheet, as the mockup has them (#fic/aot #posted), with a way to add and remove one there. | Tags are typed: `#tag` in the text, or `tags:` in front matter. The sidebar lists them; the page doesn't show them | yes | you |
| 14 | Formatting bar | feature | Page | A bar of the formatting commands (bold, italic and the rest) that can be shown or hidden. Where it sits is the design pass's to find, after #16. | The keys, the Format menu, and the selection bar, which shows only over selected text | yes | you |
| 15 | Chevrons to shut panes | tweak | Panes | The page bar's SIDEBAR and LIST words go. A chevron shows at a pane's edge on hover, and shuts or opens it. | SIDEBAR and LIST words in the page's control strip | yes | you |
| 16 | The control strip hides | tweak | Page | The page's control strip (views, Compare, Seal, Versions) shows or hides, from a control near where the tags sit. Shown, it takes the space above the sheet; hidden, the sheet reaches the top of the pane. | Always there; its words show on hover | yes | you |
| 17 | View icons | tweak | Page | LIVE, SOURCE and READING as icons: a text-edit icon, a code icon, a book icon. | Words | yes | you |
| 18 | Settings in Eien's voice | fix | Settings | The settings screen was built without a mockup (`docs/design` has none), and doesn't read as Eien: bold black headings where the design uses mono labels in graphite, and one long column in a box. Rework it in the design's voice. | A box over the window, one long column | yes | you, audit |
| 19 | AltGr and the heading keys | fix | Keys | On Windows and Linux, Ctrl+Alt is AltGr, so Ctrl+Alt+1–3 (headings) may take characters that some layouts type with AltGr (², ³ on a German keyboard). Check what Electron does; keep ⌘⌥1–3 on macOS and choose other keys elsewhere, then update spec §4. | Ctrl+Alt+1–3 on every system | – | review |
| 20 | Writer themes | gap | Themes | Spec §7: a theme as a JSON file in `.eien/themes/`, only known tokens accepted. Build it, or take it out of the spec. | Not built; Washi and Otaku are built in | – | audit |
| 21 | App icon | feature | Install | Eien's own icon for the installers and the phone (the seal would be the natural one). | Electron's and Capacitor's icons | yes | AGENTS.md |
| 22 | Smaller downloads | tweak | Install | The Mac download is 546 MB: Chromium twice, for Apple Silicon and Intel. Separate Apple Silicon and Intel downloads, and Chromium's text in English only, would about halve it. Left as it is for now, by your choice. | One universal `.dmg` | – | installers session |
| 23 | First release | chore | Install | No version is tagged yet, so there's nothing to download from Releases. Tag one (AGENTS.md → Releases), then publish the draft. | No release | – | docs check |
| 24 | The machine voice's face | feature | Settings | The face for everything in the machine voice (counts, labels, buttons, the status line, the Source view) becomes a setting, as the text face is. IBM Plex Mono stays the default. | IBM Plex Mono, always | yes (its place in Settings, #18) | you |
| 25 | Row names' weight | feature | Settings | Two settings, 400 to 700 each: the sidebar's names and the list's titles. A selected list title is 100 heavier than its setting, at most 700 (so 500 at the default, as in the mockup). | 400; the selected list title isn't heavier (the mockup's is 500) | yes (its place in Settings, #18) | you |
| 26 | Icons for controls | tweak | Everywhere | Controls become icons: one set, one style, set by the design pass, then used by #8, #15, #16 and #17. Labels, counts and a menu's items stay words. | Every control is a word | yes, first | you |
| 27 | Corners | tweak | Everywhere | Not everything square: a small radius scale, and which surfaces take which step. | Everything square (`--eien-radius: 0`) | yes, first | you |

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
| 1A Window and keys | #1 no title bar, #2 zoom the whole interface, #19 AltGr | `src/app/electron` (the window, the menu), the panes' top bands |
| 1B The sidebar, as the mockup has it | #3 sections fold, #5 guide lines, #6 BOOK mark, #9 "1 NOTES" | `src/ui/sidebar` |
| 1C Search in the list | #11 | `src/ui/list`, the sidebar's search, a search within one list's notes |
| 1D Type settings, after 1B and 1C (they share the row styles) | #24 the machine voice's face, #25 row names' weight | `src/core/config` (two settings), the tokens, today's Settings screen |

1A on macOS: the traffic lights sit over the sidebar's head
(`titleBarStyle: 'hiddenInset'`) and the panes' top bands drag the window.
On Windows and Linux the system's own minimize, maximize and close are drawn
over the page's band (`titleBarOverlay`), in the band's colours. The phone
is untouched.

### Stage 2: the design pass (alongside stage 1)

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

One pull request each, 3A first, since the rest use it:

| Step | Items |
|---|---|
| 3A Icons and corners | #26, #27: one icon module (inline SVGs), the radius tokens, the word buttons that become icons |
| 3B The page | #13, #14, #15, #16, #17 |
| 3C The sidebar | #4, #7, #8, #10 |
| 3D Your own order | #12 |
| 3E Settings | #18, with #24 and #25 moved into it |
| 3F The app's icon, then the first release | #21, then #23 |

### Later

#20 writer themes (your call) and #22 smaller downloads (left for now).

### Answers needed, and before what

- #24 and #25: before 1D.
- #4, #7 and #10: before the design pass reaches the sidebar (2.3).
- #12: before 3D.
- #20: any time.

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

## Questions for you

- #4: what should + under TAGS do? Add a tag to the open note, or make a tag
  with no notes yet?
- #7: should Pinned show while nothing is pinned (empty, with a hint)?
- #10: what should the sync status say? Eien doesn't talk to Syncthing; it
  can tell when a change last came from another device.
- #20: keep writer themes, or drop them from the spec?
- #12: what's "your own order" in All Notes, and in a tag, whose notes come
  from many folders? One order for each, kept in the vault so it syncs? Or
  your own order in folders only?
- #24: which faces may the machine voice take: IBM Plex Mono and the eight
  text faces? Counts keep their figures in columns where a face allows it.
- #25: does the sidebar's chosen row get 100 heavier too, or only the list's?

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
