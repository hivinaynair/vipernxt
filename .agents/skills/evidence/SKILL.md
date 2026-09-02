---
name: evidence
description: >-
  Proves a slice against its journey steps with runtime artifacts — screenshots,
  a recording, Playwright captures, or measured numbers — instead of a prose
  claim, then attaches that proof to the PR. Use during build after the code
  works, when verifying UI, or when the user says evidence, before-and-after,
  or visual proof. Complements next-dev-loop; does not replace the merge bar.
---

# evidence

Adapted from [michaelshimeles/skills](https://github.com/michaelshimeles/skills)
`evidence-driven-testing` and `before-and-after`. The contract is the served
steps' EARS. The proof is something a reviewer can watch or read, not a
sentence that says it worked.

`/next` → `build` invokes this after the slice compiles and unit tests pass.

## Targets

Every assertion names a journey step: `J1.S3: clerk sees the confirmed booking`.
If the step has no testable surface (pure schema), capture the measured
output instead — row counts, status values, latency — and still name the ID.

Write artifacts to `.artifacts/<slice-id>/` (gitignored). Never commit them.

## Capture path — pick one, first that works

1. **Live GUI.** This host can drive a browser or desktop. Record the session
   (built-in computer use, screen recording, or `agent-browser`) while you
   click the flow a person would. Maximize the window. Annotate each step
   start and each pass/fail. `next-dev-loop` is the verify rhythm when
   `next dev` is up — this skill is the proof you keep.
2. **Headless.** No desktop. Drive the existing Playwright app
   (`e2e/<app>`, import `test`/`expect` from that app's `playwright.setup`).
   Numbered screenshots in test order:
   `01-J1.S3-precondition.png`, `02-J1.S3-passed.png`. Keep an
   `assertions.md` listing each step and `passed` / `failed` / `untested`.
3. **No running app.** Say what you could not verify. Do not fake a
   screenshot. The merge bar still runs.

Bug fixes: capture the failure **before** the fix when you still can. That
is the before half.

## Before / after for the PR

When the change has a visible surface, pair before and after (two URLs, two
PNGs, or staging vs this preview). Prefer:

```sh
bunx @vercel/before-and-after@latest <before> <after> --markdown
```

`bunx`, not `npm i -g`. In containers where Chrome has no sandbox, set
`AGENT_BROWSER_ARGS="--no-sandbox"`. `--markdown` uploads and prints a
table; paste that into the PR body. Default upload (0x0.st) is public —
do not send anything with customer data there.

If `bunx` cannot run it, embed the local PNGs in the PR the host allows, or
link them. Skip `--full` unless they asked for a full-page scroll.

Protected `*.vercel.app` (401/403): try a bypass token if the Vercel CLI is
logged in; otherwise say so and use local captures.

## Non-UI

- API / jobs: a probe script's stdout (`probe-output.txt`) with numbers
  before and after.
- Agent / workflow: the transcript excerpt that shows the step ran.

## Hygiene

- Confirm the server is *this* slice (`ss`/`lsof` on the port, then `ps`).
- State the commit: `git rev-parse HEAD`.
- Evidence complements `bun run check-types` && `check-boundaries` &&
  `check-tokens` && `check-journeys` && `bun test`. It never replaces them.
- Never record secrets, tokens, or customer data. Mark that step `untested`.

## Hand-off

Put the table or the assertion list in the draft PR body, next to the step
IDs that landed. If Linear has the feature issue, one line and a link there
too.
