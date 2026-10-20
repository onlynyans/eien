# Eien — notes for agents

Read [docs/spec.md](docs/spec.md) first. It is the source of truth for behavior;
when code and spec disagree, fix one of them in the same change.

## Rules

- **Words are never lost.** Any path that removes text leaves it recoverable
  (a version, a sibling copy, or the system trash), and the UI says where.
- **KISS and DRY.** The smallest design that works. Each setting, token, rule
  and string is defined once.
- **Small, named modules.** One concept per file; split past ~300 lines. No
  catch-all files (`utils.ts`, `helpers.ts`, `app.ts` holding everything).
- **Layers point inward:** `ui` and `app` → `platform` → `core`. `core` is
  pure TypeScript with no DOM, Node or Capacitor imports. `tests/layers.test.ts`
  enforces it.
- **The window never touches the disk.** All file access goes through the
  `Storage` interface in `src/platform/`.
- **Settings** are added only in `src/core/config/schema.ts`. **Theme tokens**
  only in `src/ui/theme/tokens.css`, documented in `docs/themes.md`.
- **Verify, don't assume.** Every behavior change comes with a test that would
  fail without it. Check library APIs and versions against the installed
  package, not memory.
- **No code from NEO or Otaku.** Eien is written from scratch.
- **Dependencies** are listed in `docs/dependencies.md` with the reason for each.
  Prefer a few lines of code to a new package.
- **Comments say why**, not what.

## Layout

| Path | What |
|---|---|
| `src/core/` | Rules, pure TypeScript: `paths`, `text`, `vault`, `saving`, `format` (the formatting commands), `config` (every setting, and its files) |
| `src/platform/` | `bridge.ts` (all the window may ask), `storage.ts` (the Storage contract), and its `electron/` and `memory/` implementations |
| `src/ui/` | The window: `app.ts` wires the views (`sidebar`, `list`, `page`, `welcome`) to the vault (`vault`) and the open note (`notes`); `editor/` is CodeMirror in a shadow root (its styles load as constructed style sheets, which the CSP allows); `settings/` is the settings screen and the look it sets on `<html>`; styles in `theme/` and beside each view |
| `src/app/electron/` | Main process: window, menu, the vault and settings sessions and their IPC (`ipc.ts`: one window per handler), the device's own file; the sandboxed `preload.ts` |
| `tests/` | Architecture tests; `tests/e2e/` drives the built app on real folders with Playwright |
| `tsconfig.{core,web,node,e2e}.json` | One per environment: core can use neither DOM nor Node, the window can't use Node |
| `docs/design/` | The approved design and its mockups; `src/ui/theme/` is the tokens' source from phase 3 on |

Unit tests sit beside their module as `name.test.ts`.

## Commands

```
npm install
npm run dev          # the app with live reload
npm run lint         # Biome: lint and format check (npm run format fixes)
npm run typecheck    # tsc -b over every tsconfig
npm test             # unit and architecture tests (Vitest)
npm run test:e2e     # builds, then drives the real app (Playwright)
npm run check        # all of the above, as CI runs them
```

CI (`.github/workflows/ci.yml`) runs lint, types and unit tests on Linux, and
the end-to-end tests on macOS, Windows and Linux, on every push to `main` and
every pull request.

A test that guards a security or safety rule should be shown to fail when the
rule is broken (turn the rule off, run the test, put it back).
