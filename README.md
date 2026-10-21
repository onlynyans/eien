# Eien

A local Markdown notes app for writers. Notes are plain `.md` files in folders,
with tags, seals (the versions you keep) and named seals, and AO3-ready HTML
on copy.

For macOS, Windows, Linux, Android and iOS.

Status: every phase of the [plan](docs/spec.md#12-phases) is built. What
comes next is in the [backlog](docs/backlog.md).

- **Write** in Live, Source or Reading view. Format by key, from the Format
  menu, or from the bar over a selection. Tick checkboxes; see the vault's
  images on the page.
- **Never lose words.** Notes save as you type. A change from another device
  reloads; when both sides changed, both are kept. Words a crash caught
  mid-save come back as a "(recovered …)" note.
- **Organize.** Folders, and tags from `#inline` or front matter, nested in
  the sidebar. Search (⇧⌘F) finds words across the vault, accents aside.
  Rename a note by its title. Drag notes into folders or into a book's order.
  Pin notes, make a folder a book, and send what you don't want to the
  system's trash.
- **Versions.** ⌘S seals the note. Compare it with a seal, word by word; name
  a seal; restore one.
- **AO3.** Copy for AO3 gives HTML ready to paste into AO3's box, and pasting
  from AO3 or a web page gives Markdown back. Quotation marks are set as you
  type.
- **Writing tools.** Scene breaks, focus mode, typewriter scrolling, today's
  and a book's word counts, sprints, goals, outline cards, and spellcheck on
  macOS.
- **In and out.** Export a note or a book as EPUB, Word or PDF. Import a
  folder of Markdown from another app.
- **Look.** Settings (⌘,) choose day or night, the Washi or Otaku palette,
  eight typefaces, text size, density, the page's frame, zoom and chapter
  numbers.
- **Phones.** The same app on Android and iOS, one pane at a time, with the
  vault synced by Syncthing.

## Install

No version has been released yet. Until the first one, build the installer
on your computer from the source (`npm run package`, under Develop below).
From then on, download it from the
[latest release](https://github.com/onlynyans/eien/releases/latest):

| Computer | File | Then |
|---|---|---|
| Mac (Apple Silicon or Intel) | `Eien-<version>-mac.dmg` | Open it, drag Eien to Applications, and open Eien from there |
| Windows (64-bit) | `Eien-<version>-windows-setup.exe` | Run it. It installs for you alone, without an administrator's password |
| Linux (64-bit) | `Eien-<version>-linux.AppImage` | Make it executable (`chmod +x`) and run it |

Or take a portable copy, which installs nothing and keeps everything in an
"Eien Data" folder beside itself, for a USB stick or a folder you carry:

| Computer | File | Then |
|---|---|---|
| Mac | `Eien-<version>-mac-portable.zip` | Unzip it, move Eien with Finder into the folder it will live in, and open it there |
| Windows | `Eien-<version>-windows-portable.exe` | Put it in the folder it will live in, and run it |

On a Mac, move the portable Eien once before opening it: macOS runs a
downloaded app that hasn't been moved from a locked, read-only copy, where
Eien can't keep its data. If that happens, Eien says so and quits; move it and
open it again. A portable copy needs a folder it can write to.

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

On a Mac, macOS asks once whether Eien may use your Documents folder, where
it keeps your notes and this device's settings. Until Eien is signed, it may ask again after
an update.

### Where Eien keeps things

- **Your notes**: plain Markdown files in your vault. Eien starts in
  `Documents/Eien/Vault`, the same place as on the phone, and makes it the
  first time; a portable copy starts in `Vault` beside itself. File → Open
  Vault… (⌘O) opens any other folder, and Eien starts there from then on.
  Nothing an installer does touches your notes.
- **The vault's own data**: its hidden `.eien/` folder (seals, the vault's
  settings, pins) and each folder's `.eien-folder.json`, inside the vault.
- **This device's settings** (the look, the panes, the vault last open):
  - installed, or run from source: `settings.json` in `Documents/Eien`, where
    you can see it, and the window's own storage (pane widths, sorts, today's
    tally) in Eien's data folder: `~/Library/Application Support/Eien` on a
    Mac, `%APPDATA%\Eien` on Windows, `~/.config/Eien` on Linux. A
    `settings.json` already in the data folder moves to `Documents/Eien` the
    first time, unless one is there already. If your vault is `Documents/Eien`
    itself (or holds it), the settings stay in the data folder, so they never
    sync with your notes, and Eien says so. If something syncs your Documents
    folder (iCloud, OneDrive), your computers share this file.
  - portable: all of it in "Eien Data" beside the app, next to its `Vault`.

### On a phone

- **Android:** every change to `main` builds a debug APK. Open the latest
  [CI run on main](https://github.com/onlynyans/eien/actions/workflows/ci.yml?query=branch%3Amain),
  download `eien-debug-apk` (kept for 14 days), unzip it and install
  `app-debug.apk` (Android asks you to allow installs from your browser or
  file manager). Eien asks once for access to all files, so it can keep the
  vault in `Documents/Eien/Vault`, where a Syncthing app can sync it.
- **iOS:** there's no download. Build it with Xcode on a Mac and install it on
  your iPhone with your Apple ID (`npm run ios`, then `npx cap open ios`
  opens the project in Xcode). With a free Apple ID, the app has to be installed again every seven
  days. The vault is in the Files app under On My iPhone › Eien › Vault, where
  Möbius Sync can sync it.

### Updating

Eien doesn't update itself, and never goes online to look for a new version.
To update, download the new installer and install it over the old one (on a
Mac, replace Eien in Applications), or put the new portable copy where the
old one was. An update, or uninstalling, changes only the app: everything
above stays.

## Develop

Needs Node 24.

```
npm install
npm run dev      # run the app with live reload
npm run check    # lint, types, unit and end-to-end tests
npm run package  # this computer's installer in dist/, and a portable copy
```

See [AGENTS.md](AGENTS.md) for the layout, the rules, every command (the
phones' too) and how to release, and [docs/spec.md](docs/spec.md) for how
Eien behaves.
