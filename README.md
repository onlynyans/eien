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

## Install

Download the installer for your computer from the
[latest release](https://github.com/onlynyans/eien/releases/latest):

| Computer | File | Then |
|---|---|---|
| Mac (Apple Silicon or Intel) | `Eien-<version>-mac.dmg` | Open it, drag Eien to Applications, and open Eien from there |
| Windows (64-bit) | `Eien-<version>-windows-setup.exe` | Run it. It installs for you alone, without an administrator's password |
| Linux (64-bit) | `Eien-<version>-linux.AppImage` | Make it executable (`chmod +x`) and run it |

Eien isn't signed yet, so the first start asks once:

- **Mac:** macOS says it couldn't check Eien. Click Done, open System
  Settings → Privacy & Security, and beside "Eien" was blocked, click Open
  Anyway (it asks for your Mac's password). Before macOS 15, right-click Eien
  in Applications → Open → Open does the same.
- **Windows:** your browser may ask whether to keep the file: keep it. Then
  SmartScreen says it protected your PC: click More info → Run anyway.
- **Linux:** if it won't start on Ubuntu 24.04 or later, the system is
  stopping Chromium's sandbox, which Eien keeps on. CI allows it with
  `sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0`.

### Updating

Eien doesn't update itself, and never goes online to look for a new version.
To update, download the new installer and install it over the old one (on a
Mac, replace Eien in Applications).

An update, or uninstalling, changes only the app. What's yours stays:

- **Your notes**: plain Markdown files in your vault's folder. Nothing an
  installer does touches them.
- **The vault's own data**: its hidden `.eien/` folder (seals, the vault's
  settings, pins) and each folder's `.eien-folder.json`, inside the vault.
- **This device's settings** (the look, the panes, the vault last open), in
  Eien's data folder: `~/Library/Application Support/Eien` on a Mac,
  `%APPDATA%\Eien` on Windows, `~/.config/Eien` on Linux. Eien run from
  source uses the same folder.

## Develop

Needs Node 24.

```
npm install
npm run dev      # run the app with live reload
npm run check    # lint, types, unit and end-to-end tests
```

See [AGENTS.md](AGENTS.md) for the layout and rules.
