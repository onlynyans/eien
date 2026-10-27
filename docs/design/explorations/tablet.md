# Foldables and tablets: three explorations

**Chosen (2026-10-27), backlog #46: all three, built** as one setting of
the phone's, **Wide screen** (`appearance.room`; spec §10): **Panes** (1, the
default: today's panes at a finger's size), **One at a time**, **Side by side**
(2) and **Two pages** (3: the second page laid out as the Split setting says,
Facing pages for the book). What the build changed from these pages, after a
senior review: the room is the phone build's (its platform), not the pointer's,
so a trackpad doesn't close pages mid-session; Page alone (2) is left to One at
a time; the facing page opens when ⇄ is tapped, not on its own as the screen
unfolds (nothing moves the writer didn't ask to move); folding closes the page
you're not in and keeps it as ⇄. The pages below are the explorations as
proposed. On a
foldable's open screen or a tablet, Eien may use the room tablet apps use,
with more than one pane at a time, built from the panes and layouts that
already exist. It's an option and never forced: the one-pane phone layout
stays available on every screen.

Each page shows one direction working on five screens: a phone; a foldable
folded (its cover screen) and open (with the fold down its middle); and a
tablet upright and sideways. Each works by Day and Night and in all three
layouts (A · Band, B · Slip, C · Running head). Every target is 44px, and
nothing waits for a hover. Each page shows where the option to turn it on or
off lives (its Settings tab opens on it), and its notes say what each screen
does.

- [tablet-desk.html](tablet-desk.html): 1 · The desk, at a finger's size
- [tablet-stack.html](tablet-stack.html): 2 · The stack, opened out
- [tablet-book.html](tablet-book.html): 3 · An open book

To view them, serve `docs/design` (see [README.md](README.md)) and open
<http://127.0.0.1:4173/explorations/tablet-stack.html>.

## Where things stand today

- A window under 600px is a phone's: one pane at a time
  (`src/ui/phone/phone-stack.ts`, `NARROW`).
- **Anything wider gets the desktop's panes at the desktop's size**, with
  28px controls and 30px rows. That includes a foldable's open screen (about
  720px: a 264px contents, a 316px list and a page of about 140px), a tablet,
  and a phone turned sideways (spec §10).
- So #46 is two things. The wider screen should be **made for a finger**, and
  how much it shows should be **the writer's choice**, never forced.

## The screens, in CSS pixels

| Screen | Size | What it stands for |
|---|---|---|
| Phone | 390 × 844 | an iPhone or a Pixel |
| Folded | 360 × 800 | a foldable's cover screen (a Galaxy Z Fold's is narrow and tall) |
| Open | 720 × 820, the fold at 360 | a foldable's inner screen, held like a book |
| Tablet upright | 820 × 1180 | an 11-inch iPad, or an Android tablet |
| Tablet sideways | 1180 × 820 | the same, turned |

A phone turned sideways (844 × 390) is wide enough too. Each direction's
setting decides what it gets; see "Open" below.

## What all three share

- **Under 600px, nothing changes.** The phone is the phone, as built: the
  contents, a folder's notes, the page, the back bar, the ⋯, the layout's
  phone tools, and the other note's ⇄.
- **Touch first.** `--eien-control` and `--eien-row-h` become
  `--eien-touch` (44px) on a touch screen. A tap lights a control only while
  it's pressed. A finger never lifts a row: a long press gives the note's
  menu (Move up, Move down, Move to…), as on the phone.
- **The fold is never an accident.** Where two panes or pages meet on the
  open screen, their edge is the crease, so nothing important sits across it.
  The glass is seamless, so words may cross it when one page takes the whole
  screen.
- **Folding and unfolding keep your place.** The note, its scroll and what
  you came from all stay. Only how much is shown changes.
- **The option is per device** (scope `device`, like every look setting), so
  a tablet and the Mac can differ. It's offered on every touch screen, the
  folded phone too: a foldable is one device at two widths, so the writer can
  set what unfolding does before they unfold. Today's Panes setting is
  wide-only, so this is a change.
- **Built from what exists.** Only the tokens, the surfaces, the seal's five
  places, the phone bar, the panes, the sheet, Facing pages' ribbon and folio,
  the row menu and Settings over the window. No new colour, shadow or token.

## 1 · The desk, at a finger's size

- **What:** with room, the desktop's panes as they're built (the contents on
  the desk, the index on paper, the page on its blotter), at a finger's size.
  How many is the **Panes** setting the desktop already has, with **One at a
  time** added. The room caps it as the desktop's window does: three need
  1,060px, and two need 624px.
- **Each screen:** the phone and the folded screen get one at a time. Open
  gets two: the contents with their notes (the desktop's two-pane tree), then
  the page, the desk's edge on the fold. Upright gets two (264 · 556).
  Sideways gets two (the default) or three (264 · 316 · 600).
- **The page's tools** go where each layout puts them on the desktop: A's
  band, B's slip at the top right, C's strip of desk, and the colophon. Spare
  ones go behind ⋯ when short of room.
- **Where the option lives:** Settings › Writing › Lists › **Panes** (One at
  a time · Two · Three), and the panes icon at the contents' foot, whose menu
  greys Three where it won't fit and says why.
- **For:**
  - There's nothing new to learn, and almost nothing new to build: the panes,
    the two-pane tree, the bands and the Panes setting exist.
  - It's closest to today: the wide screen already gets these panes, at the
    wrong size.
- **Against:**
  - It's the densest of the three, and an upright tablet never gets three.
  - On the open fold the page is 360px beside the contents, a phone's width.
  - Unfolding turns a phone writer's app into a desk they may never have seen.
  - Pane edges and chevrons are made for a pointer.

## 2 · The stack, opened out

- **What:** the phone's one-at-a-time stays the model. With room, **the step
  you came from stays beside the one you're in**: the list beside the page,
  and back moves the pair one step (the contents beside the list). There's
  one bar across the top, cut where the panes meet, and the phone's paper to
  the edges.
- **Each screen:** the phone and the folded screen get one at a time. Open
  gets two halves (360 · 360) with the cut on the fold. Upright gets 340 ·
  480, and sideways 400 · 780. **Page alone** (an icon at the page half's
  left) gives the page the whole width, and back brings the list again.
- **The page's tools** are the phone's, in each layout's phone place: A's in
  the bar, B's slip at the page's foot, C's rail. The other note's ⇄ stays in
  the bar.
- **Where the option lives:** Settings › Look › Appearance › **Side by side**
  (When there's room · Unfolded only · Never), and **⋯ › Side by side**, a
  tick on the page (greyed on a phone, with why). "Unfolded only" lets a
  foldable open out while a tablet and a sideways phone keep one at a time.
  Never is today's phone at any width.
- **For:**
  - It's the phone. Folding and unfolding change the room, not the app: back,
    the ⋯, the tools and ⇄ all stay.
  - The open fold splits exactly at the crease, two steps on two leaves.
  - It's the smallest build: `phone-stack.ts` shows the step before, too, and
    the bar is cut where the panes are.
  - It has the fewest parts: one bar, one set of tools, nothing to drag.
- **Against:**
  - It never shows three panes, even where a sideways tablet has room.
  - The desktop's bands, Running head's strip and the colophon don't come.
  - The page is paper to the edges on a big tablet, not the sheet on its
    blotter.

## 3 · An open book

- **What:** the room goes to **pages, not panes**. The note you came from
  (the phone's ⇄) gets a page of its own and faces the one you're in, as
  Facing pages does on the desktop: one sheet opened like a book, the ribbon
  on the page you're in, and each note's figures and × in its folio. On the
  fold the crease is the gutter. The contents come to you: the bar's back word
  ("‹ Beneath the Walls") slides the phone's stack over the page as raised
  paper.
- **Each screen:** the phone and the folded screen get the phone, with ⇄
  Erwin in the bar. Open gets Erwin facing the chapter across the fold, paper
  to the edges. Upright gets the sheet on the blotter, two leaves of about
  360, their words a step down. Sideways gets two leaves of about 540.
- **Opening:** a tap in the drawer opens the note on the page you're in. A
  long press gives Open on this page and Open on the facing page. Tap the
  facing page to write there, and the ribbon moves. ⇄ in the bar swaps the
  pages.
- **Where the option lives:** Settings › Look › Appearance › **Facing
  pages** (Facing pages · One page), and **⋯ › Facing pages**, a tick. One page
  is the phone's page, wider, with the other note a tap away.
- **For:**
  - The room goes to the writing, and a chapter beside its notes is the case
    a bigger screen helps most.
  - The fold means something: a book's gutter. Unfolding turns ⇄ into a
    facing page, and folding turns it back.
  - It's built from what's decided: Facing pages, the phone's other note, and
    the phone's stack.
- **Against:**
  - The list is never in sight while you write. Finding a note goes through
    the drawer, one tap more.
  - Two leaves of 360 are each a phone's width.
  - It brings a split to a touch screen (an active page, a ribbon, folios),
    which is more to learn.
  - On a wide screen the facing page stays put. Folded, the phone's rule
    holds (the note you came from), so there are two rules for the other note.

## The checks (interface-design), on each page

- **Swap:** the type is the writer's face and the machine voice, from the
  face tokens, so a Typeface setting moves names and prose together while
  labels, counts and folios keep the mono. Swapped for a stock tablet template, each would lose what it's built on: 1
  its desk, index and blotter, 2 its back word and ⇄ in a desk bar cut at the
  fold, 3 its gutter, ribbon and folio. 2's list beside the page is the most
  common tablet pattern of the three, and Eien's parts are what keep it Eien.
- **Squint:** blurred, each reads as darker behind lighter: the desk and bar
  behind paper, the blotter round the sheet. The only strong marks are the
  seal's rule on the chosen row and 3's ribbon. The fold is a crease, quieter
  than a pane's hairline.
- **Signature:** the seal stays in its places only: the mark at the contents'
  head (1, 2), the chosen row's rule (all), the caret (all), ▪ sealed in the
  colophon or folio (1, 3), the Seal control in C's rail, and the chosen tab in
  Settings. Nothing else is vermilion. 3's ribbon is ink-soft, as decided.
- **Tokens:** every colour, space, radius, shadow and size is an `--eien-*`
  token or made of them. The few lengths of the device itself (its corners,
  bezel, status bar and fold) are marked OUTSIDE in `_src/tablet.css`. The
  room rules (600, 624 and 1,060px; the step behind's 340 and 400) live in
  the script beside the arithmetic, as the split's do (`PAGE_MIN`).

## How they compare

| | 1 · The desk | 2 · The stack, opened | 3 · An open book |
|---|---|---|---|
| What the room is for | Panes: finding | The step before: going back and forth | Pages: writing beside notes |
| Open fold | Contents with notes · page | List · page, cut on the fold | Two pages, the fold the gutter |
| Sideways tablet | Two or three panes | Two, the page wide | Two pages on the blotter |
| Page's tools | The desktop's places, the colophon | The phone's places | The phone's places, folios |
| The setting | Panes, with One added | Side by side (new) | Facing pages (new) |
| What's new to build | Touch sizes; One as a Panes value | The pair in `phone-stack.ts`; the cut bar | A split on touch; the drawer |
| Unfolding feels like | The desktop arriving | The phone, opened | The ⇄ note getting a page |

## Recommendation

**2 · The stack, opened out**, with "When there's room" as the default.

- It's the app the writer already holds. On a phone or a foldable the phone
  is where they learned Eien, and unfolding should give them more of it, not
  another app. Back, the ⋯, ⇄ and the layout's phone tools all stay where
  they were.
- It's the one direction whose two panes always meet on the fold: two steps,
  two leaves.
- It's the smallest build, in the files that already run there
  (`src/ui/phone/`, `vault/phone-view.ts`), and its rule is one line: show
  the step before, too.
- Its setting is honest about what it does, Never is exactly today's phone,
  and "Unfolded only" answers the sideways phone.

**What it could borrow later:**

- From **3**: when there's another open note, **Page alone** could offer it as
  a facing page across the fold (3's ribbon and folio), so a chapter and its
  notes can share the open screen without the drawer.
- From **1**: on a sideways tablet, three steps (contents · list · page) where
  there's room for them. Measure it on a real tablet before deciding.

**Whichever is chosen**, the 28px desktop panes on a wide touch screen (today's
behaviour) should go: every target on a touch screen is `--eien-touch`.

## Open

- **A phone turned sideways** (844 × 390) is wider than 600px. With 1 it
  gets two panes in 390px of height. With 2's "When there's room" it gets
  side by side, and with "Unfolded only" one at a time. With 3 it gets two
  short pages. 2's "Unfolded only" handles it, but whether a phone should
  count as a wide screen at all is the owner's call.
- **Knowing the fold:** these pages place the cut at the screen's middle. The
  app would ask the system (Android's window layout info reports the fold's
  place and posture), which needs a small Capacitor plugin. On iOS a tablet is
  just wider; if Apple ships a foldable, check what it reports. Until then,
  the middle of a screen 600–900px wide and taller than it is wide is a fair
  guess.
- **Half-folded (tabletop) posture:** a foldable bent like a laptop, the page
  above and the keyboard below. Not explored here.
- **A keyboard and a trackpad on a tablet:** hover returns and 28px controls
  could come back. Not explored here; the touch sizes stay until a pointer is
  seen.
