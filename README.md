# Eien

A local Markdown notes app for writers. Notes are plain `.md` files in folders,
with tags, checkpoints and named versions, and AO3-ready HTML on copy.

For macOS, Windows, Linux, Android and iOS.

Status: phase 2 of the [plan](docs/spec.md#12-phases). The app opens an empty
window; CI tests it on all three desktops.

## Develop

Needs Node 24.

```
npm install
npm run dev      # run the app with live reload
npm run check    # lint, types, unit and end-to-end tests
```

See [AGENTS.md](AGENTS.md) for the layout and rules.
