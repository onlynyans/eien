# Backlog

What to do next, collected after phase 11 (from 2026-10-20). Every phase in
the [spec](spec.md#12-phases) is built; these are the fixes, tweaks and
features that came after. When the list is long enough, it becomes a plan.

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

## Decided

- **AO3 scene break**: AO3's spacer, rule, spacer
  (`<p><br /></p><hr /><p><br /></p>`), an empty paragraph each side of the
  rule so the sections breathe. It was already the default; decided
  2026-10-20.
- **The note list's default order**: your own (#12), decided 2026-10-20.

## Questions for you

- #4: what should + under TAGS do? Add a tag to the open note, or make a tag
  with no notes yet?
- #7: should Pinned show while nothing is pinned (empty, with a hint)?
- #10: what should the sync status say? Eien doesn't talk to Syncthing; it
  can tell when a change last came from another device.
- #20: keep writer themes, or drop them from the spec?

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
