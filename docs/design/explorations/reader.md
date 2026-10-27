# Reading EPUBs: nine explorations

**For the owner to choose (2026-10-27).** Backlog #40. Nothing is built. Three
sets of three, in one family so they share one look: turning pages, scrolling,
and the features (page count, bookmarks, highlights, search in the book).

Each page works, by Day and Night, in A · Band, B · Slip and C · Running head,
with the sidebar open or shut, the list shown or hidden, the window as wide or
narrow as you like, and on the phone (the bar's Device). Each works from the
keyboard, and each says what the phone does. The text is *Pride and Prejudice*
(1813, public domain): its first three chapters, with the other fifty-eight
counted by their length, so page counts and progress are the whole book's.
Your place carries from page to page, so you can compare them on the same
words.

| Group | Page | Direction |
|---|---|---|
| Pages | [reader-spread.html](reader-spread.html) | 1 · The spread |
| | [reader-leaf.html](reader-leaf.html) | **2 · One leaf, its edges** (recommended) |
| | [reader-columns.html](reader-columns.html) | 3 · Columns to the pane |
| Scroll | [reader-chapter.html](reader-chapter.html) | **1 · A chapter a sheet** (recommended) |
| | [reader-roll.html](reader-roll.html) | 2 · One roll |
| | [reader-beside.html](reader-beside.html) | 3 · Beside a note (recommended later, as a mode on 1) |
| Features | [reader-margin.html](reader-margin.html) | 1 · On the page (its marks recommended) |
| | [reader-index.html](reader-index.html) | **2 · In the list** (recommended, with 1's marks) |
| | [reader-edge.html](reader-edge.html) | 3 · On the edge |

## What all nine share

- **Books are files in the vault**, `.epub`, in any folder: Cooking holds its
  recipe notes and a cookbook side by side.
- **A sidebar section lists them**: a lens over the one folder tree. It shows
  every book, under the folders that hold one, at their depth. A folder that
  holds none itself shows only as the way to one deeper (Fic → Research). The
  folders aren't reworked: choosing Cooking under FOLDERS lists its notes, as
  now. A book's row counts how far you've read ("41%", "read"). The section
  sits last, after TAGS (the writing first), and folds per device as every
  section does.
- **Opening a book** reads it in the page pane. The note list becomes its
  contents: chapters in the book's order, each with the page it starts on.
  The chosen row is your chapter, with the selected fill and the seal's rule,
  as a note's row has. With the list hidden, the Contents tool or ⌘2 opens
  them as a menu.
- **The views' place holds the book's two**, Pages and Scroll, a pressed pair
  as Live · Source · Reading are. In the pages, the other one opens its
  exploration and keeps your place.
- **Your type, not the publisher's.** The book is set in your Typeface, with
  its size, leading and measure; ⌘+ and ⌘− zoom it as they zoom a note.
  Paragraphs are indented with no gap, as a book sets them. The book's own
  styles keep only its structure (italics, headings, a centred line), never
  its fonts or colours, so it reads by Night.
- **Safely**, as #40 plans: each chapter is drawn in a sandboxed frame, with
  no scripts and no network; the zip is read with sizes capped and no path out
  of it. The book file is never written.
- **What's kept**: your place, bookmarks and highlights, in `.eien/reading/`,
  keyed by the book's contents. A renamed or moved book keeps them, and they
  sync with the vault.
- **Keys**, once the book has the keyboard (a click in it, or ⌘3):
  - paged: → Space PgDn turn on; ← ⇧Space PgUp turn back; Home and End go to
    the chapter's start and end;
  - scrolling: the usual scrolling keys;
  - in the list: ↑ ↓ and Enter.
- **The phone:** the book is a page in the phone's stack, with the shelf
  behind its back bar. Its tools sit where the layout keeps a phone's: A in
  the bar, B a floating slip, C a rail. Paged books turn with a tap in either
  outer third, or a swipe.

### Nothing new in the system's terms

Every value is a token from `.interface-design/system.md`. The one token the
explorations' shared CSS lacked, `--eien-field`, is the app's own (the
field's wash). The marks reuse what the split's Facing pages already decided:

- the **ribbon** (ink-soft, forked, over the sheet's top edge);
- the **dog-ear** (the corner gone to the blotter, the flap in band with a
  rule-strong hairline);
- the **edge tab** (ink-soft, standing out from the outer edge).

Reading marks are pencil and ink, never the seal: the seal keeps its five
places. The current Find match uses the selection's wash, because Find
selects it.

## The section's name (an open question)

"Book" already means a folder marked as a manuscript (the BOOK mark, Export
Book), and LIBRARY is the sidebar's first section. The bar's **Section**
control renames the section in place on every page:

- **SHELF**: short, and a thing on the desk, the interface's own picture
  (desk, blotter, paper). It sits well beside LIBRARY, FOLDERS, TAGS.
- **READING**: says what you do there, but Reading is already a view of a
  note (Live · Source · Reading), so "Reading" would name two things a click
  apart.
- **BOOKSHELF**: plain, but the longest label in the sidebar, and it has
  "book" in it, the word the manuscript folders already own.

The recommendation is **SHELF**.

## Turning pages

| | For | Against |
|---|---|---|
| **1 · The spread** | The most book-like; Eien's own gutter and folios; uses a wide window; the same picture as Facing pages | Needs room: each page 20em, so with three panes at 1440px it closes to one page; a chapter's last spread may be half empty |
| **2 · One leaf, its edges** | The note's own sheet, so nothing to learn and every width works; how far you are shows as the book's fore-edge, in paper and hairlines, before any number | A wide window shows one page with blotter beside it; six edges are coarse |
| **3 · Columns to the pane** | The most words in sight, the calmest (Page frame Full and columns) | Not a book: no page, no edges; the eye runs foot-to-head across a wide screen; the columns change as panes open and shut |

### 1 · The spread

- **What:** one sheet, two pages facing across the gutter, as the split's
  Facing pages lays two notes. Running heads: the book's title over the left
  page, the chapter over the right. Folios at the foot, mirrored. A turn moves
  a spread; the outer margins turn too.
- **Narrow:** below two 20em pages it closes to one page, and the colophon
  says so. The page is never shrunk to fit.
- **Phone:** one page, always.
- **Intent:** the writer with room to open the book flat. *Palette:* paper and
  ink; the gutter is Facing pages' soft hairline. *Depth:* one sheet, one
  shadow, no fold shading (no gradients). *Type:* the text face; heads and
  folios in the machine voice. *Spacing:* the gutter is `--eien-space-8`
  between the text blocks.

### 2 · One leaf, its edges

- **What:** a book opens as a note does: one sheet, the same width and
  margins. Under it lies the rest of the book. The pages still to read stack
  at its right edge, and the pages read at its left, up to six paper edges
  `--eien-mark-w` apart, each in a `--eien-rule` hairline.
- **Turning:** the arrow keys, or click the edges. Hover an edge for "212
  pages to go".
- **Folio:** the chapter's page of its pages, and the book's page.
- **Page frame Full:** no sheet, so no edges; the colophon still counts.
- **Phone:** the fore-edge stays as hairlines down the page's right side.
- **Intent:** one page at a time beside the contents, knowing how far without
  reading a number. *Palette:* paper, blotter, ink; the edges are paper.
  *Depth:* the sheet's shadow on the top leaf alone, the stack in hairlines.
  *Spacing:* the edges are a mark's width apart.

### 3 · Columns to the pane

- **What:** Page frame Full for books. The pane is paper. The chapter flows
  into as many columns of at least 20em as fit (one, two or three), a soft
  hairline between them. A turn moves the whole screen; the side gutters turn
  too.
- **Intent:** the most words in sight. *Depth:* flat, as Full is. *Spacing:*
  `--eien-space-7` gutters.

### Recommendation: 2 · One leaf, opening to 1's spread when there's room

- **One leaf** is the note's own sheet, so a book looks like it belongs in
  Eien. It works at every width and on the phone, and the fore-edge is a
  quiet progress no other reader has.
- **When the page has room for two 20em pages**, open the book to 1's spread.
  That's the same rule Facing pages has, so the window has one idea of "two
  pages"; the edges then stand at the spread's outer sides.
- **3 is Full frame's answer** rather than a direction: in Page frame Full, a
  leaf has no edges, so it reads as one column. Columns could come later as an
  option.

## Scrolling

| | For | Against |
|---|---|---|
| **1 · A chapter a sheet** | Exactly how a note reads; one chapter is one EPUB file is one sandboxed frame, the simplest safe build; the chapter's end is a pause | A press at each chapter's end; progress through a chapter is only the scroll bar and the colophon |
| **2 · One roll** | Reads straight through; the head and the list follow you; time left, plainly | The hardest to build (frames stacked, drawn and dropped, a place that holds while they load); the scroll bar is too fine; a band always over the sheet |
| **3 · Beside a note** | What a writer reads for: the source beside the writing, a quote with its source in one key; nothing new (it's the split) | Two narrower pages; a mode on top of a reading mode |

### 1 · A chapter a sheet

- **What:** a chapter reads as a note does in Reading: one sheet that scrolls.
  At its foot, after a soft rule, the chapters before and after are word
  buttons. Nothing loads or moves until one is pressed.
- **Colophon:** how far through the chapter and the book.
- **Intent:** reading as you read your own notes. *Depth:* the note's sheet.
  *Type:* the text face; "next" in the machine voice.

### 2 · One roll

- **What:** the whole book on one long sheet, chapters running on with their
  headings and a wide space between.
- **Following you:** the sheet's running head stays at its top as a band,
  naming the chapter you're in, and the list's chosen row follows as you
  scroll. The colophon gives the time left at 250 words a minute.
- **Intent:** reading straight through. *Surfaces:* the head is a band
  (system.md's band pattern) over paper.

### 3 · Beside a note

- **What:** a book opens to the side of a note as a second note does: the
  split's Two sheets, the note on the left, the book on the right, scrolling a
  chapter at a time.
- **Tools:** one set, for the sheet you're in.
- **Quote:** select in the book and a small raised menu offers **Quote in the
  note** (`Q`) and Copy. Quote adds a Markdown quote to the note, with
  `— Pride and Prejudice, Chapter III` under it, and never touches the note's
  own words.
- **Phone:** the book and the note are a tap apart, the other's name in the
  back bar's slip (⇄), as the phone keeps the note you came from.

### Recommendation: 1 · A chapter a sheet; 3 after it

- **1 is the build's first phase** (#40: "the shelf and opening a book
  safely; scrolling"). It needs nothing the page doesn't already do, one
  frame at a time, and it's the phone's natural reader.
- **3 is the reason a writer opens a book in Eien rather than elsewhere**: a
  later step, once 1 and the split are both there. Quote with its source is
  small and worth it.
- **2 reads best straight through**, but costs the most to build safely.
  1's chapter buttons could later move on by themselves at the foot, if the
  pause is missed.

## The features

All three do all four: page count, bookmarks, highlights, Find (⌘F, as #41
gives a note). They differ in **where the marks live**, and each tries its
own look for a highlight:

| | Bookmark | Highlight | Find | Page count | Finding a mark again |
|---|---|---|---|---|---|
| **1 · On the page** | The ribbon over the page's top edge | Pencil underline, 2px, and a pencil tick in the margin | A field in the layout's bar; matches in a wash of ink | Folio and colophon; three ways to count, compared | `]` and `[` walk them |
| **2 · In the list** | A dog-ear | A wash of ink | The list's own search field; every match a row in its words | Each row's page; the folio and colophon | Marks and Found, lenses over the list, as rows |
| **3 · On the edge** | A pencil tab on the strip | A pencil bracket in the margin, the words left as printed | The bar's field; every match a dot on the strip | The edge tab's place, the folio, the colophon | The strip: point, click, or its arrow keys |

Shared by all three:

- **B** bookmarks the page (again, takes it off); **H** keeps the selected
  words (on a highlight, takes it off; ⌘Z puts it back).
- **From the keyboard**, `⇧→` selects the page's first sentence, then one
  more each time, and `⇧←` one fewer, so highlighting needs no mouse.
- **`]` and `[`** walk your marks in the book's order.

| | For | Against |
|---|---|---|
| **1 · On the page** | Nothing new opens; every mark in place, like a used paperback; the fewest parts | No list: thirty highlights later, walking is slow; a long underlined passage reads as the book's own emphasis |
| **2 · In the list** | Marks you can read all at once, a commonplace book with pages; every match in its words before you go; in a part Eien already has | Needs the list; the list's search field means the vault's notes or this book (the placeholder says which) |
| **3 · On the edge** | The whole book at a glance; where a word clusters; anywhere in one gesture; the quietest highlight | A new object always beside the page; chapters crowd in a long book; a bracket is by the line, not the word |

### Page count: three ways (Features 1's bar)

- **The screen's** (what Pages 1–3 show): exact for what you see, but it
  changes with the window, the panes and the zoom, so "page 212" means nothing
  tomorrow.
- **Steady:** a page is 1,500 characters of the book, whatever the screen.
  Its number never moves, and it's the same on the phone.
- **Print:** many EPUBs carry the printed edition's pages (a page-list).
  Where one does, its numbers match the paper copy, for citing.
- **Recommended:** Print where the book has it, else Steady, and the screen's
  turns underneath (a page number may then hold for a turn or two).

### Recommendation: 2 · In the list, with 1's marks on the page

- **2's index** (Contents, Marks, Found) is where a writer goes back to what
  they kept. Highlights listed as their own words, each with its page, are a
  commonplace book; Found shows every match in context. It's all in the
  list's own rows.
- **1's marks on the page:**
  - The **ribbon** for a bookmark: the most findable, and already Eien's.
  - The **pencil underline** with its margin tick for a highlight: quieter
    than a wash, and it leaves the wash to Find's matches, so the two never
    look alike (2 has to outline its matches to tell them apart).
  - 1's **page numbers**: Print, else Steady.
- **3's strip** is the most original, and Found's dots on it are the best map
  of a word. It's a lot of new furniture for a first build: keep it for later,
  perhaps as the scroll bar's marks.
- **One thing to settle when building:** in a split in Facing pages mode, the
  active page's mark is a ribbon, dog-ear or tab (`appearance.facingMark`). A
  book there would wear two ribbons. The bookmark should take whichever of
  the three the facing mark isn't, or the book should open beside a note only
  in Two sheets.

## The checks

Run on each page before it was called done:

- **Swap:** with a generic serif and a reader template, every page would
  change. The type is the writer's own face and the machine voice. The
  window is Eien's, with its panes, bands and colophon. The marks are
  Eien's objects.
- **Squint:** nothing jumps. The fore-edge, gutter, ticks and brackets are
  hairlines or pencil; the strongest mark is the ink-soft ribbon or tab, one
  at a time.
- **Signature:** the book as a physical thing, drawn only in Eien's depth:
  - the fore-edge (2 · One leaf);
  - the gutter and mirrored folios (1 · The spread);
  - the ribbon (Features 1);
  - the dog-ear (Features 2);
  - the edge tab and thumb index (Features 3);
  - pencil underline and bracket marginalia.
- **Tokens:** every colour, space, line and radius is a `--eien-*` token, and
  none is new. The local lengths come from them: `--leaf-gap` is a space token,
  and the phone frame copies the split's.
