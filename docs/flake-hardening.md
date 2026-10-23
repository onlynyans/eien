# Plan: harden the flaky end-to-end tests

**Status: paused** (2026-10-21, by the owner). Kept here to pick up later.

**Goal:** fewer than 1–2% of CI runs failing for reasons that aren't a real
regression, each flaky test fixed at its cause. Never by adding retries,
raising timeouts, raising a budget or loosening an assertion.

**Why:** during stage 3 the suite failed often. Some failures were real
cross-platform bugs (a Restore finishing in the wrong note on Windows), and
main once broke when two PRs met. But many were races in the tests: typing
before a field had the keyboard, reading a file before a write landed, a
hover that didn't land on Linux's runner, a move's link-then-unlink. Six were
fixed then ([progress.md](progress.md), Tests made steady); this plan
finishes the job.

## Steps

1. **List the flakes from recent CI runs.** Go through the last ~100 runs of
   `ci.yml` on main and on PRs (`gh run list --repo onlynyans/eien --workflow ci.yml`,
   `gh run view <id> --log-failed`). Record every test that failed on one
   runner but passed elsewhere or on a rerun: its file and line, the OS, and
   how often.
2. **Find the seals-after-rename race.** `tests/e2e/versions.spec.ts:200`,
   "seals follow a renamed note, and another device's seal shows at once",
   failed twice in a row on macOS CI (PR #51): the Versions panel opened
   right after a rename shows no rows. It passes locally on main and on #51.
   It may be a real race in the app (the panel loading the old path's seals),
   so check the app first; if it is, fix the app, with a test that fails
   without the fix.
3. **Shared helpers in `tests/e2e/launch.ts`:**
   - a hover that moves again until the hovered state lands (Chromium can miss
     one that arrives in a single move; 1 in 5 on main, more on Linux);
   - a safe file read for `expect.poll` (a throwing `readFileSync` ends the
     poll at once instead of retrying);
   - typing only once a field has the keyboard.
4. **Fix each flake at its cause**, using the helpers. Known ones:
   - `settings-window.spec.ts`: moving and resizing Settings (Linux,
     Windows);
   - naming a seal in `versions.spec.ts` on Linux (the first word typed
     before the field has the keyboard);
   - `src/platform/storage.test.ts`, "never writes over a temp file another
     write left": over its 5 s limit on a slow Windows runner;
   - hover-driven checks on Linux (prefer the keyboard to show a tooltip).
     Found 2026-10-23 (draft #61's diagnostic): on Linux CI a still
     pointer's `:hover` lapses within a second or two, though nothing moved
     and nothing redrew. And a value read right after a move is mid-fade (the
     quiet icons' 0.27, 17ms into 220ms). Read a hover-driven style with its
     transitions finished (`el.getAnimations().forEach((a) => a.finish())`),
     as `sidebar-adders.spec.ts`'s `opacity` does, not after a wait.
   Wait on state, not time.
5. **Report retried tests in CI:** the end-to-end jobs' summary lists every
   test that passed only on a retry (Playwright's `flaky`), so a flake is
   seen the first time it happens.
6. **Document the patterns and the known flakes:** AGENTS.md's Tests section
   (the helpers and when to use them), and [handbook.md](handbook.md) §9
   (what's still flaky, if anything).
7. **One PR, then 5 green runs in a row:** the fixes, helpers, CI report and
   docs in one PR to main; then re-run its workflow until the full suite is
   green 5 times in a row, with the flaky counts noted in the PR.

## Rules

- Fix the cause. A retry, a longer timeout or a looser assertion only hides
  one.
- A race in the app gets an app fix and a test that fails without it.
- Run lint, types and the tests you touch locally; CI runs the rest on all
  three systems.
