# Where the fixture books' pictures come from

Two of Hugh Thomson's illustrations for *Pride and Prejudice* (George Allen,
1894; public domain), from Project Gutenberg's edition, ebook #1342
(https://www.gutenberg.org/ebooks/1342), downscaled to 360 pixels and saved as
JPEG at quality 45 with macOS's `sips`:

- `black-horse.jpg`: "He rode a black horse." (Chapter III), from `images/i_038.jpg`.
- `headpiece.jpg`: Chapter II's headpiece, from `images/i_035_a.jpg`.

The words are the explorations' own copy of the first three chapters
(`docs/design/explorations/_src/epub-text.js`). `node scripts/epub-fixtures.mjs`
makes the books beside this folder from them (`tests/support/epub-fixtures.ts`).
