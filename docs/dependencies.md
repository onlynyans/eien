# Dependencies

Every package Eien uses, and why. Versions are pinned exactly in
`package.json`; `package-lock.json` pins the rest.

## Development only

Nothing below ships inside the app except Electron itself, which is the app's
runtime.

| Package | Why |
|---|---|
| `electron` | The desktop runtime: one web interface on macOS, Windows and Linux |
| `electron-vite` | Builds the main process, the sandboxed preload and the window from one config, and runs them together in development |
| `vite` | The bundler under electron-vite; also what Vitest runs on |
| `typescript` | Strict type checking (`npm run typecheck`). Vite strips types; tsc only checks them |
| `@types/node` | Types for the main process and tests. Major version matches Electron's Node (24) |
| `@biomejs/biome` | Lint and format in one tool (`npm run lint`) |
| `vitest` | Unit and architecture tests |
| `@vitest/coverage-v8` | Test coverage report in CI |
| `@playwright/test` | End-to-end tests that drive the real Electron app |

## Shipped with the app

None yet.
