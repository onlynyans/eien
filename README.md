# Eien

A local Markdown notes app for writers. Notes are plain `.md` files in folders,
with tags, checkpoints and named versions, and AO3-ready HTML on copy.

For macOS, Windows, Linux, Android and iOS.

Status: phase 5 of the [plan](docs/spec.md#12-phases). Open a folder as a
vault, browse its folders and notes, and write in Live, Source or Reading
view: format by key, the Format menu or the bar over a selection; tick
checkboxes; see images from the vault. Notes save as you type, a change from
another device reloads, and when both sides changed, both are kept. Settings
(⌘,) choose day or night, the Washi or Otaku palette, eight typefaces, text
size, density, the page's frame, zoom and chapter numbers. The note list
previews each note; tags, from front matter or #inline, nest in the sidebar;
search (⇧⌘F) finds words across the vault, accents aside. Rename a note by its
title, drag notes into folders or into a book's order, pin them, make a folder
a book, and send what you don't want to the system's trash.

## Develop

Needs Node 24.

```
npm install
npm run dev      # run the app with live reload
npm run check    # lint, types, unit and end-to-end tests
```

See [AGENTS.md](AGENTS.md) for the layout and rules.
